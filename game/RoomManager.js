/**
 * STEERING COMMITTEE — Room Manager (Stub for P0)
 * Manages active rooms, code lookup, player socket bindings,
 * disconnect grace periods, and lifecycle cleanup.
 */

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.socketToRoom = new Map();
  }

  /**
   * Creates a new game room
   * @param {string} hostSocketId
   * @param {Object} options
   * @returns {Object} Created GameRoom instance
   */
  createRoom(hostSocketId, options = {}) {
    return null;
  }

  /**
   * Retrieves room by 4-letter room code
   * @param {string} code
   * @returns {Object|null}
   */
  getRoom(code) {
    if (!code) return null;
    return this.rooms.get(code.toUpperCase()) || null;
  }

  /**
   * Handles player socket disconnection
   * @param {string} socketId
   */
  handleDisconnect(socketId) {
    // Stub
  }
}

module.exports = RoomManager;
