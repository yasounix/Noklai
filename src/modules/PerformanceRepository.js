/**
 * Central Performance Repository Interface
 *
 * Abstract repository pattern enabling complete offline persistence
 * across all cognitive games with Supabase synchronization capability.
 */

export class PerformanceRepository {
  async getProfile(gameId, playerId) {
    throw new Error('getProfile() must be implemented by repository');
  }

  async saveRoundResult({ session, roundData, profile }) {
    throw new Error('saveRoundResult() must be implemented by repository');
  }

  async getRoundHistory(gameId, playerId, limit = 50) {
    throw new Error('getRoundHistory() must be implemented by repository');
  }

  async flushOfflineQueue() {
    throw new Error('flushOfflineQueue() must be implemented by repository');
  }
}
