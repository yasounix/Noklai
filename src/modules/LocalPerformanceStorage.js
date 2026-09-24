/**
 * Centralized Local Performance Storage
 *
 * Concrete implementation of PerformanceRepository using AsyncStorage.
 * Operates 100% offline with zero external network dependencies.
 * Fully player-scoped, versioned storage schema with legacy backward compatibility.
 * Provides generous retention (at least 1,000 sessions / 90 days of active gameplay).
 * Fail-safe: Storage errors are logged with structured context and never crash gameplay.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PerformanceRepository } from './PerformanceRepository.js';
import { validateRoundResult } from './performance/CognitiveVitalityIndex.js';

const STORAGE_KEY_V2_PREFIX = '@cognitive_performance_v2';
const STORAGE_KEY_STL_PREFIX = '@suh_tah_lam_performance_v2';
const STORAGE_KEY_V1_PREFIX = '@suh_tah_lam_performance_v1';

const getStorageInstance = () => {
  if (globalThis.AsyncStorage !== undefined) {
    return globalThis.AsyncStorage;
  }
  if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
    return AsyncStorage;
  }
  if (AsyncStorage?.default && typeof AsyncStorage.default.getItem === 'function') {
    return AsyncStorage.default;
  }
  return null;
};

export class LocalPerformanceStorage extends PerformanceRepository {
  constructor() {
    super();
    this.memoryCache = new Map();
  }

  _getStorageKey(playerId) {
    if (!playerId || typeof playerId !== 'string' || !playerId.trim()) {
      return null;
    }
    return `${STORAGE_KEY_V2_PREFIX}_${playerId.trim()}`;
  }

  _getSuhTahLamStorageKey(playerId) {
    if (!playerId || typeof playerId !== 'string' || !playerId.trim()) {
      return null;
    }
    return `${STORAGE_KEY_STL_PREFIX}_${playerId.trim()}`;
  }

  _getLegacyStorageKey(playerId) {
    if (!playerId || typeof playerId !== 'string' || !playerId.trim()) {
      return null;
    }
    return `${STORAGE_KEY_V1_PREFIX}_${playerId.trim()}`;
  }

  /**
   * Retrieves player's historical profile.
   * Requires authentic playerId; returns null if missing or empty.
   */
  async getProfile(arg1 = 'all', arg2) {
    if (arg1 === '' || arg1 === null) {
      return null;
    }

    let gameId = 'all';
    let playerId = null;

    if (arg2 !== undefined) {
      if (arg2 === '' || arg2 === null) {
        return null;
      }
      gameId = arg1;
      playerId = arg2;
    } else {
      playerId = arg1;
    }

    if (!playerId || typeof playerId !== 'string' || !playerId.trim()) {
      return null;
    }

    const cleanPlayerId = playerId.trim();
    const key = this._getStorageKey(cleanPlayerId);
    const stlKey = this._getSuhTahLamStorageKey(cleanPlayerId);
    if (!key) return null;

    try {
      const storage = getStorageInstance();
      let raw = null;

      if (storage) {
        try {
          raw = await storage.getItem(key);
          if (!raw && stlKey) {
            raw = await storage.getItem(stlKey);
          }
          if (!raw) {
            const legacyKey = this._getLegacyStorageKey(cleanPlayerId);
            if (legacyKey) raw = await storage.getItem(legacyKey);
          }
        } catch (storageReadErr) {
          console.warn('[LocalPerformanceStorage] Storage engine read error, using memoryCache:', storageReadErr?.message);
        }
      }

      // Consistent fallback to memory cache if storage returns null or is unavailable
      if (!raw) {
        const cached = this.memoryCache.get(key) || (stlKey ? this.memoryCache.get(stlKey) : null);
        if (cached?.profile) {
          return {
            ...this._getDefaultProfile(gameId, cleanPlayerId),
            ...cached.profile,
            playerId: cleanPlayerId,
          };
        }
      }

      if (raw) {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed?.profile) {
          this.memoryCache.set(key, parsed);
          if (stlKey) this.memoryCache.set(stlKey, parsed);
          return {
            ...this._getDefaultProfile(gameId, cleanPlayerId),
            ...parsed.profile,
            playerId: cleanPlayerId,
          };
        }
      }
    } catch (err) {
      console.error('[LocalPerformanceStorage] Failed to read profile from storage, checking memory cache:', err);
      const cached = this.memoryCache.get(key) || (stlKey ? this.memoryCache.get(stlKey) : null);
      if (cached?.profile) {
        return {
          ...this._getDefaultProfile(gameId, cleanPlayerId),
          ...cached.profile,
          playerId: cleanPlayerId,
        };
      }
    }
    return this._getDefaultProfile(gameId, cleanPlayerId);
  }

  /**
   * Saves round result, updating profile and local history.
   * Retention is increased to at least 1,000 sessions / 90 days.
   */
  async saveRoundResult({ session, roundData, profile }) {
    try {
      // 1. Authenticate player ID (no hardcoded P001 or default fallback)
      const playerId = profile?.playerId || session?.playerId || roundData?.playerId;
      if (!playerId || typeof playerId !== 'string' || !playerId.trim()) {
        return { success: false, error: 'MISSING_PLAYER_ID' };
      }
      const cleanPlayerId = playerId.trim();

      // 2. Validate session ID for round persistence
      const sessionId = session?.id || session?.sessionId || roundData?.sessionId;
      if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
        return { success: false, error: 'MISSING_SESSION_ID' };
      }
      const cleanSessionId = sessionId.trim();

      // 3. Validate real gameId
      const gameId = roundData?.gameId || session?.gameId || session?.gameType || profile?.gameId;
      if (!gameId || typeof gameId !== 'string' || !gameId.trim()) {
        return { success: false, error: 'MISSING_GAME_ID' };
      }
      const cleanGameId = gameId.trim();

      const key = this._getStorageKey(cleanPlayerId);
      const stlKey = this._getSuhTahLamStorageKey(cleanPlayerId);
      if (!key) {
        return { success: false, error: 'MISSING_PLAYER_ID' };
      }

      const storage = getStorageInstance();

      let existingData = { profile: null, rounds: [] };
      if (storage) {
        try {
          let raw = await storage.getItem(key);
          if (!raw && stlKey) {
            raw = await storage.getItem(stlKey);
          }
          if (raw) {
            try {
              existingData = JSON.parse(raw) || existingData;
            } catch (pe) {
              console.error('[LocalPerformanceStorage] Corrupt storage JSON encountered, resetting buffer:', pe);
            }
          }
        } catch (storageReadErr) {
          console.warn('[LocalPerformanceStorage] Storage engine read error, using memoryCache:', storageReadErr?.message);
          const cached = this.memoryCache.get(key) || (stlKey ? this.memoryCache.get(stlKey) : null);
          if (cached) existingData = cached;
        }
      } else {
        const cached = this.memoryCache.get(key) || (stlKey ? this.memoryCache.get(stlKey) : null);
        if (cached) existingData = cached;
      }

      // 4. Build the complete sanitized round object first
      const rawRound = {
        ...roundData,
        playerId: cleanPlayerId,
        sessionId: cleanSessionId,
        gameId: cleanGameId,
      };

      // 5. Run validateRoundResult on sanitizedRound
      const validation = validateRoundResult(rawRound);

      // 6. Explicitly label data quality and CVI eligibility
      const dataQuality = validation.valid ? 'verified_gameplay' : 'invalid_gameplay';
      const sanitizedRound = {
        ...rawRound,
        dataQuality,
        eligibleForCVI: validation.valid === true,
        validationReason: validation.reason || null,
      };

      // 7. Deduplicate existing rounds
      const existingRounds = Array.isArray(existingData.rounds) ? existingData.rounds : [];
      const filteredExisting = existingRounds.filter((r) => {
        if (cleanSessionId && r.sessionId === cleanSessionId && r.roundNumber === sanitizedRound.roundNumber) {
          return false;
        }
        if (sanitizedRound.startedAt && r.startedAt === sanitizedRound.startedAt) {
          return false;
        }
        return true;
      });

      // Retain at least 1,000 rounds or 90 days of history
      const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
      let updatedRounds = [sanitizedRound, ...filteredExisting];
      if (updatedRounds.length > 1000) {
        const recent1000 = updatedRounds.slice(0, 1000);
        const olderWithin90Days = updatedRounds
          .slice(1000)
          .filter((r) => new Date(r.completedAt || r.startedAt || 0).getTime() >= ninetyDaysAgo);
        updatedRounds = [...recent1000, ...olderWithin90Days];
      }

      const recordToSave = {
        version: 2,
        gameId: cleanGameId,
        playerId: cleanPlayerId,
        profile: {
          ...profile,
          gameId: cleanGameId,
          playerId: cleanPlayerId,
          updatedAt: new Date().toISOString(),
        },
        rounds: updatedRounds,
        lastSessionId: cleanSessionId,
      };

      if (storage) {
        try {
          await storage.setItem(key, JSON.stringify(recordToSave));
          if (stlKey) {
            await storage.setItem(stlKey, JSON.stringify(recordToSave));
          }
        } catch (storageWriteErr) {
          console.error('[LocalPerformanceStorage] Failed to save round result:', storageWriteErr);
          this.memoryCache.set(key, recordToSave);
          if (stlKey) this.memoryCache.set(stlKey, recordToSave);
          return { success: true, round: sanitizedRound, storageWarning: storageWriteErr?.message };
        }
      }
      this.memoryCache.set(key, recordToSave);
      if (stlKey) this.memoryCache.set(stlKey, recordToSave);
      return { success: true, round: sanitizedRound };
    } catch (err) {
      console.error('[LocalPerformanceStorage] Failed to save round result:', err);
      return { success: false, error: 'ROUND_SAVE_FAILED', details: err?.message };
    }
  }

  /**
   * Retrieves all historical rounds for a player across all cognitive games.
   */
  async getAllRoundHistory(playerId, limit = 1000) {
    if (!playerId || typeof playerId !== 'string' || !playerId.trim()) {
      return [];
    }
    return this.getRoundHistory('all', playerId.trim(), limit);
  }

  /**
   * Retrieves historical rounds for calculation with legacy tagging.
   */
  async getRoundHistory(arg1 = 'all', arg2, limit = 1000) {
    if (arg1 === null || arg1 === '' || arg1 === undefined) {
      return [];
    }

    let filterGameId = null;
    let playerId = null;
    let actualLimit = limit;

    if (arg2 !== undefined) {
      if (typeof arg2 === 'number') {
        playerId = arg1;
        actualLimit = arg2;
      } else {
        filterGameId = arg1;
        playerId = arg2;
      }
    } else {
      playerId = arg1;
    }

    if (!playerId || typeof playerId !== 'string' || !playerId.trim()) {
      return [];
    }

    const cleanPlayerId = playerId.trim();
    const key = this._getStorageKey(cleanPlayerId);
    const stlKey = this._getSuhTahLamStorageKey(cleanPlayerId);
    if (!key) return [];

    try {
      const storage = getStorageInstance();
      let raw = null;

      if (storage) {
        try {
          raw = await storage.getItem(key);
          if (!raw && stlKey) {
            raw = await storage.getItem(stlKey);
          }
          if (!raw) {
            const legacyKey = this._getLegacyStorageKey(cleanPlayerId);
            if (legacyKey) raw = await storage.getItem(legacyKey);
          }
        } catch (storageReadErr) {
          console.warn('[LocalPerformanceStorage] Storage engine read error, using memoryCache:', storageReadErr?.message);
        }
      }

      let parsed = null;
      if (raw) {
        parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } else {
        parsed = this.memoryCache.get(key) || (stlKey ? this.memoryCache.get(stlKey) : null);
      }

      if (parsed?.rounds && Array.isArray(parsed.rounds)) {
        let rounds = parsed.rounds;
        if (filterGameId && filterGameId !== 'all') {
          rounds = rounds.filter((r) => r.gameId === filterGameId);
        }
        return rounds.slice(0, actualLimit);
      }
    } catch (err) {
      console.error('[LocalPerformanceStorage] Failed to read round history, checking memory cache:', err);
      const cached = this.memoryCache.get(key) || (stlKey ? this.memoryCache.get(stlKey) : null);
      if (cached?.rounds && Array.isArray(cached.rounds)) {
        let rounds = cached.rounds;
        if (filterGameId && filterGameId !== 'all') {
          rounds = rounds.filter((r) => r.gameId === filterGameId);
        }
        return rounds.slice(0, actualLimit);
      }
    }
    return [];
  }

  async flushOfflineQueue() {
    return { flushed: 0 };
  }

  _getDefaultProfile(gameId, playerId) {
    return {
      playerId,
      gameId,
      currentDifficulty: 'Medium',
      rollingScore: 0,
      roundsPlayed: 0,
      promotions: 0,
      demotions: 0,
      updatedAt: new Date().toISOString(),
    };
  }
}

export const defaultLocalStorage = new LocalPerformanceStorage();
