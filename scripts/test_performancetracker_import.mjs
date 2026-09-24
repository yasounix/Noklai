import test from 'node:test';
import assert from 'node:assert/strict';
import { PerformanceTracker } from '../src/modules/performance/PerformanceTracker.js';
import { defaultLocalStorage } from '../src/modules/LocalPerformanceStorage.js';

test('PerformanceTracker and LocalPerformanceStorage imports resolve cleanly', () => {
  assert.ok(PerformanceTracker, 'PerformanceTracker should be imported');
  assert.ok(defaultLocalStorage, 'defaultLocalStorage should be imported');

  const tracker = new PerformanceTracker({
    gameType: 'suh_tah_lam',
    playerId: 'test_p1',
  });
  assert.ok(tracker);
  assert.equal(tracker.gameType, 'suh_tah_lam');
});

