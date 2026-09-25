/**
 * Longitudinal Cognitive Drift Detector (DriftDetector.js)
 *
 * Pure function module (no React Native or AsyncStorage dependencies) for detecting
 * genuine longitudinal cognitive changes in dementia patients across gameplay sessions.
 *
 * Distinguishes true cognitive drift from game difficulty pacing:
 * - Weights accuracy by difficulty level (Easy=1.0, Medium=1.4, Hard=1.8).
 * - Calibrates against a patient baseline (first N rounds).
 * - Tracks reaction time slowing (response time drift).
 * - Calculates standard deviation / z-score trajectory across sliding observation windows.
 * - Always uses neutral, calm, non-diagnostic caregiver language.
 */

const DEFAULT_DIFFICULTY_WEIGHTS = {
  easy: 1.0,
  medium: 1.4,
  hard: 1.8,
};

/**
 * Normalizes difficulty string to lowercase canonical key
 */
function normalizeDifficulty(diff) {
  if (!diff || typeof diff !== 'string') return 'medium';
  const lower = diff.trim().toLowerCase();
  if (lower === 'easy') return 'easy';
  if (lower === 'hard') return 'hard';
  return 'medium';
}

/**
 * Detects longitudinal drift across an array of gameplay rounds or sessions
 *
 * @param {Array<Object>} rounds - Chronological or un-ordered session/round objects
 * @param {Object} [options]
 * @param {number} [options.minRounds=6] - Minimum completed rounds before exiting calibrating status
 * @param {number} [options.baselineRounds=5] - Number of initial rounds to establish baseline
 * @param {number} [options.windowSize=5] - Sliding window size for recent performance
 * @param {Object} [options.difficultyWeights] - Custom difficulty multipliers
 * @returns {Object} Drift report
 */
export function detectCognitiveDrift(rounds = [], options = {}) {
  const minRounds = typeof options.minRounds === 'number' ? options.minRounds : 6;
  const baselineCount = typeof options.baselineRounds === 'number' ? options.baselineRounds : 5;
  const windowSize = typeof options.windowSize === 'number' ? options.windowSize : 5;
  const weights = { ...DEFAULT_DIFFICULTY_WEIGHTS, ...(options.difficultyWeights || {}) };

  if (!Array.isArray(rounds)) {
    return {
      status: 'calibrating',
      zScore: 0,
      details: 'Insufficient gameplay records. Continue regular practice to establish a baseline.',
      roundsNeeded: minRounds,
      completedRounds: 0,
      minRounds,
    };
  }

  // Filter valid rounds with authentic accuracy numbers
  const validRounds = rounds
    .filter((r) => {
      if (!r || typeof r !== 'object') return false;
      const acc = r.accuracy ?? r.score;
      return typeof acc === 'number' && Number.isFinite(acc);
    })
    .map((r) => {
      let rawAcc = r.accuracy ?? r.score;
      if (rawAcc <= 1 && rawAcc > 0) rawAcc = rawAcc * 100; // normalize 0..1 to 0..100
      const diffKey = normalizeDifficulty(r.difficulty);
      const weight = weights[diffKey] || 1.4;
      const weightedScore = rawAcc * weight;

      // Extract response time in seconds
      let rtSec = null;
      if (typeof r.responseTimeSec === 'number' && Number.isFinite(r.responseTimeSec)) {
        rtSec = r.responseTimeSec;
      } else if (typeof r.responseTimeMs === 'number' && Number.isFinite(r.responseTimeMs)) {
        rtSec = r.responseTimeMs / 1000;
      } else if (typeof r.averageResponseTime === 'number' && Number.isFinite(r.averageResponseTime)) {
        rtSec = r.averageResponseTime;
      } else if (typeof r.durationSec === 'number' && typeof r.questionsTotal === 'number' && r.questionsTotal > 0) {
        rtSec = r.durationSec / r.questionsTotal;
      }

      const timestamp = new Date(r.timestamp || r.startedAt || r.completedAt || 0).getTime();

      return {
        ...r,
        accuracy: rawAcc,
        difficulty: diffKey,
        weight,
        weightedScore,
        responseTimeSec: rtSec,
        timestamp: isNaN(timestamp) ? 0 : timestamp,
      };
    })
    // Sort chronologically ascending
    .sort((a, b) => a.timestamp - b.timestamp);

  const completedRounds = validRounds.length;
  if (completedRounds < minRounds) {
    const needed = Math.max(1, minRounds - completedRounds);
    return {
      status: 'calibrating',
      zScore: 0,
      baselineScore: null,
      recentScore: null,
      baselineResponseTime: null,
      recentResponseTime: null,
      details: `Baseline calibration in progress (${completedRounds} of ${minRounds} completed). Continue regular daily activities.`,
      roundsNeeded: needed,
      completedRounds,
      minRounds,
    };
  }

  // Determine split for baseline vs recent sliding window
  const effectiveBaselineCount = Math.min(baselineCount, Math.floor(completedRounds / 2));
  const baselineSlice = validRounds.slice(0, effectiveBaselineCount);
  const recentSlice = validRounds.slice(-Math.min(windowSize, completedRounds - effectiveBaselineCount));

  // Compute baseline metrics
  const baseScores = baselineSlice.map((r) => r.weightedScore);
  const baseMeanScore = baseScores.reduce((sum, s) => sum + s, 0) / baseScores.length;

  // Standard deviation of baseline with conservative floor
  const variance =
    baseScores.reduce((sum, s) => sum + Math.pow(s - baseMeanScore, 2), 0) / baseScores.length;
  const baseStdDev = Math.max(6.0, Math.sqrt(variance)); // minimum standard deviation floor

  const baseValidRts = baselineSlice.map((r) => r.responseTimeSec).filter((t) => typeof t === 'number' && t > 0);
  const baseAvgRt =
    baseValidRts.length > 0 ? baseValidRts.reduce((sum, t) => sum + t, 0) / baseValidRts.length : null;

  // Compute recent window metrics
  const recentScores = recentSlice.map((r) => r.weightedScore);
  const recentMeanScore = recentScores.reduce((sum, s) => sum + s, 0) / recentScores.length;

  const recentValidRts = recentSlice.map((r) => r.responseTimeSec).filter((t) => typeof t === 'number' && t > 0);
  const recentAvgRt =
    recentValidRts.length > 0 ? recentValidRts.reduce((sum, t) => sum + t, 0) / recentValidRts.length : null;

  // Compute standardized z-score difference
  const zScoreRaw = (recentMeanScore - baseMeanScore) / baseStdDev;
  const zScore = Math.round(zScoreRaw * 100) / 100;

  // Check response time slowing ratio
  const rtSlowingRatio = baseAvgRt && recentAvgRt ? recentAvgRt / baseAvgRt : 1.0;

  // Classification logic grounded in multi-factor evidence
  let status = 'stable';
  let details = 'Gameplay performance remains consistent with baseline levels.';

  // Decline criteria:
  // 1. Significant z-score drop (<= -1.5)
  // OR 2. Moderate drop (<= -1.0) combined with pronounced response slowing (> 25%)
  // OR 3. Severe raw weighted drop (> 25% drop from baseline)
  const isScoreDropping = zScore <= -1.5 || recentMeanScore < baseMeanScore * 0.75;
  const isModerateDropWithSlowing = zScore <= -1.0 && rtSlowingRatio >= 1.25;

  if (isScoreDropping || isModerateDropWithSlowing) {
    status = 'possible_decline';
    details =
      'Recent gameplay shows a pattern of lower accuracy and slower responses compared to earlier sessions. Consider discussing this observation with a healthcare professional.';
  } else if (zScore >= 1.0 || recentMeanScore > baseMeanScore * 1.2) {
    status = 'improving';
    details = 'Recent gameplay shows an improving performance trend compared to baseline.';
  }

  return {
    status,
    zScore,
    baselineScore: Math.round(baseMeanScore),
    recentScore: Math.round(recentMeanScore),
    baselineResponseTime: baseAvgRt !== null ? Math.round(baseAvgRt * 10) / 10 : null,
    recentResponseTime: recentAvgRt !== null ? Math.round(recentAvgRt * 10) / 10 : null,
    rtSlowingRatio: Math.round(rtSlowingRatio * 100) / 100,
    details,
    roundsNeeded: 0,
    completedRounds,
    minRounds,
  };
}
