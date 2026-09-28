/**
 * STEERING COMMITTEE — Game Room (Stub for P0)
 * Game state machine: LOBBY -> REVEAL -> STEERING -> DEBRIEF -> repeat -> GAME_OVER.
 * Orchestrates tick timers, votes, round reveals, scoring, and bot management.
 */

const { GAME_STATES } = require('./constants');

class GameRoom {
  /**
   * @param {string} code - 4-character room code
   * @param {string} hostId - Socket ID or persistent ID of room creator
   */
  constructor(code, hostId) {
    this.code = code;
    this.hostId = hostId;
    this.state = GAME_STATES.LOBBY;
    this.players = new Map();
    this.round = 0;
    this.totalRounds = 3;
    this.timers = new Map();
    this.isStub = true;
  }

  /**
   * Adds a player to the room
   * @param {Object} player
   */
  addPlayer(player) {
    return false;
  }

  /**
   * Removes a player from the room
   * @param {string} playerId
   */
  removePlayer(playerId) {
    return false;
  }

  /**
   * Cleans up all timers and resources
   */
  destroy() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.timers.clear();
  }
}

module.exports = GameRoom;
