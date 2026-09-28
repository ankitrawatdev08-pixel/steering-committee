/**
 * STEERING COMMITTEE — Destination Assigner (Stub for P0)
 * Secretly assigns one landmark destination to each player per round.
 * Maximum players assigned to the same landmark is capped at floor(N / 2).
 */

class DestinationAssigner {
  /**
   * Assigns secret destinations to players
   * @param {Array<Object>} players - List of player objects
   * @param {Array<Object>} landmarks - Available landmarks
   * @param {Object} rng - SeededRNG instance
   * @returns {Map<string, Object>} Map of playerId -> assigned landmark
   */
  static assign(players = [], landmarks = [], rng = null) {
    return new Map();
  }
}

module.exports = DestinationAssigner;
