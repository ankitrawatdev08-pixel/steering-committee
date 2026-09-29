/**
 * STEERING COMMITTEE — Room Manager
 * Manages active rooms, code lookup, player socket bindings,
 * disconnect grace periods, and lifecycle cleanup.
 */

const crypto = require('crypto');
const { ROOM_CODE_CHARS, ROOM_CODE_LENGTH, TIMINGS, GAME_STATES } = require('./constants');
const GameRoom = require('./GameRoom');

class RoomManager {
  /**
   * @param {Object} options - Config options (e.g. io instance)
   */
  constructor(options = {}) {
    this.io = options.io || null;
    this.rooms = new Map(); // roomCode -> GameRoom
    this.socketToRoom = new Map(); // socketId -> roomCode
    this.socketToPlayer = new Map(); // socketId -> playerId
  }

  /**
   * Generates a 4-character room code using crypto.randomBytes (NOT seeded RNG)
   * @returns {string}
   */
  generateRoomCode() {
    const charsLen = ROOM_CODE_CHARS.length;
    let code = '';
    let attempts = 0;

    do {
      code = '';
      const bytes = crypto.randomBytes(ROOM_CODE_LENGTH);
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_CHARS[bytes[i] % charsLen];
      }
      attempts++;
      if (attempts > 1000) {
        throw new Error('Failed to generate unique room code.');
      }
    } while (this.rooms.has(code));

    return code;
  }

  /**
   * Creates a new game room with host player
   * @param {string} hostSocketId
   * @param {Object} options - { playerName }
   * @returns {{ room: GameRoom, player: Object }}
   */
  createRoom(hostSocketId, options = {}) {
    if (this.rooms.size >= 50) {
      throw new Error('Server is currently at capacity. Please try again later.');
    }

    const roomCode = this.generateRoomCode();
    const room = new GameRoom(roomCode, hostSocketId, {
      io: this.io,
      onDestroy: (code) => this.destroyRoom(code),
      timings: options.timings
    });

    const hostPlayer = room.addPlayer({
      name: options.playerName || 'Host',
      socketId: hostSocketId,
      isBot: false,
      isHost: true
    });

    this.rooms.set(roomCode, room);
    if (hostSocketId) {
      this.socketToRoom.set(hostSocketId, roomCode);
      this.socketToPlayer.set(hostSocketId, hostPlayer.id);
    }

    // Start lobby idle timer (300s)
    room.setTrackedTimeout('lobby_idle', () => {
      this.destroyRoom(roomCode);
    }, TIMINGS.LOBBY_IDLE_TIMEOUT);

    return { room, player: hostPlayer };
  }

  /**
   * Retrieves room by 4-letter room code (case-insensitive)
   * @param {string} code
   * @returns {GameRoom|null}
   */
  getRoom(code) {
    if (!code || typeof code !== 'string') return null;
    return this.rooms.get(code.trim().toUpperCase()) || null;
  }

  /**
   * Joins an existing room or reconnects a returning player
   * @param {string} code
   * @param {string} socketId
   * @param {string} playerName
   * @param {string|null} existingPlayerId
   * @returns {{ room: GameRoom, player: Object, isReconnect: boolean }}
   */
  joinRoom(code, socketId, playerName, existingPlayerId = null) {
    const roomCode = (code || '').trim().toUpperCase();
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error(`Room "${roomCode}" not found.`);
    }

    // Check reconnect first
    if (existingPlayerId && room.players.has(existingPlayerId)) {
      const restoredPlayer = room.handleReconnect(existingPlayerId, socketId);
      if (restoredPlayer) {
        if (socketId) {
          this.socketToRoom.set(socketId, roomCode);
          this.socketToPlayer.set(socketId, restoredPlayer.id);
        }
        return { room, player: restoredPlayer, isReconnect: true };
      }
    }

    // Cannot join non-lobby game as a new player
    if (room.state !== GAME_STATES.LOBBY) {
      throw new Error('Game already in progress.');
    }

    // Add new player
    const newPlayer = room.addPlayer({
      name: playerName || 'Player',
      socketId,
      isBot: false,
      isHost: false
    });

    if (socketId) {
      this.socketToRoom.set(socketId, roomCode);
      this.socketToPlayer.set(socketId, newPlayer.id);
    }

    return { room, player: newPlayer, isReconnect: false };
  }

  /**
   * Handles player socket disconnection
   * @param {string} socketId
   * @returns {{ room: GameRoom|null, player: Object|null, removed: boolean }}
   */
  handleDisconnect(socketId) {
    const roomCode = this.socketToRoom.get(socketId);
    if (!roomCode) {
      return { room: null, player: null, removed: false };
    }

    const room = this.rooms.get(roomCode);
    this.socketToRoom.delete(socketId);
    this.socketToPlayer.delete(socketId);

    if (!room) {
      return { room: null, player: null, removed: false };
    }

    const result = room.handleDisconnect(socketId);
    return {
      room,
      player: result ? result.player : null,
      removed: result ? result.removed : false
    };
  }

  /**
   * Destroys a room and cleans up bindings
   * @param {string} code
   */
  destroyRoom(code) {
    const roomCode = (code || '').trim().toUpperCase();
    const room = this.rooms.get(roomCode);
    if (room) {
      room.clearAllTimers();
      for (const player of room.players.values()) {
        if (player.socketId) {
          this.socketToRoom.delete(player.socketId);
          this.socketToPlayer.delete(player.socketId);
        }
      }
      this.rooms.delete(roomCode);
    }
  }
}

module.exports = RoomManager;
