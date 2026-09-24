import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_REGISTRY,
  getGameInfo,
  resolveGameDomain,
  getGameDisplayName,
  getCanonicalGameId,
} from '../src/modules/performance/gameRegistry.js';

test('gameRegistry - Canonical game lookups', () => {
  const suh = getGameInfo('suh_tah_lam');
  assert.ok(suh, 'suh_tah_lam should be found');
  assert.equal(suh.gameId, 'suh_tah_lam');
  assert.equal(suh.domain, 'visual_memory');
  assert.equal(suh.displayName, 'Suh Tah Lam (Bamboo Rhythm)');

  const ubila = getGameInfo('ubilakapki');
  assert.ok(ubila, 'ubilakapki should be found');
  assert.equal(ubila.gameId, 'ubilakapki');
  assert.equal(ubila.domain, 'spatial_coordination');

  const sinaki = getGameInfo('northeast_memory');
  assert.ok(sinaki, 'northeast_memory should be found');
  assert.equal(sinaki.domain, 'episodic_recall');

  const stories = getGameInfo('memory_stories');
  assert.ok(stories, 'memory_stories should be found');
  assert.equal(stories.domain, 'episodic_recall');
});

test('gameRegistry - Alias lookups', () => {
  assert.equal(getCanonicalGameId('coconut_toss'), 'ubilakapki');
  assert.equal(getCanonicalGameId('ubila'), 'ubilakapki');
  assert.equal(getCanonicalGameId('suhtahlam'), 'suh_tah_lam');
  assert.equal(getCanonicalGameId('bamboo'), 'suh_tah_lam');
  assert.equal(getCanonicalGameId('sinaki_sthan'), 'northeast_memory');
  assert.equal(getCanonicalGameId('xuworoni_kotha'), 'memory_stories');
});

test('gameRegistry - Display names', () => {
  assert.equal(getGameDisplayName('suh_tah_lam'), 'Suh Tah Lam (Bamboo Rhythm)');
  assert.equal(getGameDisplayName('coconut_toss'), 'Ubilakapki Coconut Toss');
  assert.equal(getGameDisplayName('sinaki_sthan'), 'Sinaki Sthan');
  assert.equal(getGameDisplayName('xuworoni_kotha'), 'Xuworoni Kotha');
  assert.equal(getGameDisplayName('unknown_game'), 'unknown_game');
});

test('gameRegistry - Domain resolution and safe unknown fallback', () => {
  assert.equal(resolveGameDomain('suh_tah_lam'), 'visual_memory');
  assert.equal(resolveGameDomain('ubila'), 'spatial_coordination');
  assert.equal(resolveGameDomain('sinaki_sthan'), 'episodic_recall');
  assert.equal(resolveGameDomain('stories'), 'episodic_recall');

  // Explicit valid override
  assert.equal(resolveGameDomain('anything', 'spatial_coordination'), 'spatial_coordination');

  // Unknown fallback
  assert.equal(resolveGameDomain('non_existent_game'), 'unknown');
});

