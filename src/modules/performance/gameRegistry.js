/**
 * Unified Game and Cognitive Domain Registry (SIH Memory Assistant)
 *
 * Single source of truth for:
 * - Canonical game IDs
 * - Display names
 * - Associated cognitive domains
 * - Accepted legacy aliases
 */

export const GAME_REGISTRY = {
  suh_tah_lam: {
    gameId: 'suh_tah_lam',
    displayName: 'Suh Tah Lam (Bamboo Rhythm)',
    domain: 'visual_memory',
    aliases: ['suh_tah_lam', 'suhtahlam', 'bamboo', 'bamboo_rhythm'],
  },
  ubilakapki: {
    gameId: 'ubilakapki',
    displayName: 'Ubilakapki Coconut Toss',
    domain: 'spatial_coordination',
    aliases: ['ubilakapki', 'ubila', 'coconut_toss'],
  },
  northeast_memory: {
    gameId: 'northeast_memory',
    displayName: 'Sinaki Sthan',
    domain: 'episodic_recall',
    aliases: ['northeast_memory', 'northeast', 'sinaki_sthan', 'morung_wayfinding'],
  },
  memory_stories: {
    gameId: 'memory_stories',
    displayName: 'Xuworoni Kotha',
    domain: 'episodic_recall',
    aliases: ['memory_stories', 'stories', 'storyteller', 'xuworoni_kotha'],
  },
};

/**
 * Normalizes a game ID or alias to its canonical registry entry
 */
export function getGameInfo(gameIdOrAlias) {
  if (!gameIdOrAlias || typeof gameIdOrAlias !== 'string') {
    return null;
  }

  const normalized = gameIdOrAlias.trim().toLowerCase();

  // Direct canonical match
  if (GAME_REGISTRY[normalized]) {
    return GAME_REGISTRY[normalized];
  }

  // Alias match
  for (const entry of Object.values(GAME_REGISTRY)) {
    if (entry.aliases.some((alias) => alias.toLowerCase() === normalized)) {
      return entry;
    }
  }

  return null;
}

/**
 * Resolves the cognitive domain for a game.
 * If unknown, logs a warning and returns 'unknown' (NEVER silently defaults to visual_memory).
 */
export function resolveGameDomain(gameIdOrAlias, providedDomain = null) {
  const VALID_DOMAINS = ['visual_memory', 'spatial_coordination', 'attention_focus', 'episodic_recall'];
  if (providedDomain && VALID_DOMAINS.includes(providedDomain)) {
    return providedDomain;
  }

  const info = getGameInfo(gameIdOrAlias);
  if (info && info.domain) {
    return info.domain;
  }

  console.warn(`[GameRegistry] Unknown game ID or alias: "${gameIdOrAlias}". Marking domain as "unknown".`);
  return 'unknown';
}

/**
 * Gets human-readable display name for a game
 */
export function getGameDisplayName(gameIdOrAlias) {
  const info = getGameInfo(gameIdOrAlias);
  if (info && info.displayName) {
    return info.displayName;
  }
  return gameIdOrAlias || 'Cognitive Exercise';
}

/**
 * Resolves canonical game ID from alias
 */
export function getCanonicalGameId(gameIdOrAlias) {
  const info = getGameInfo(gameIdOrAlias);
  return info ? info.gameId : gameIdOrAlias;
}

