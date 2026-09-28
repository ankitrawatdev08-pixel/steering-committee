/**
 * STEERING COMMITTEE — Scoring System (Stub for P0)
 * Evaluates round scores: max(0, 100 - 20 * roadDistance).
 * Manages player leaderboards, cumulative scores, and end-of-game tiebreaks.
 */

class Scoring {
  /**
   * Calculates score for distance to destination
   * @param {number} roadDistance - BFS distance from car to player's secret landmark
   * @returns {number} Score integer between 0 and 100
   */
  static calculateScore(roadDistance) {
    return Math.max(0, 100 - 20 * Math.max(0, roadDistance));
  }

  /**
   * Evaluates round end scores for all players
   * @param {Array<Object>} players
   * @param {Object} carPos
   * @param {Object} distanceMatrix
   * @returns {Array<Object>} Array of player results with round points and total scores
   */
  static evaluateRound(players = [], carPos, distanceMatrix) {
    return [];
  }
}

module.exports = Scoring;
