/**
 * STEERING COMMITTEE — GameRoom State Machine
 * Orchestrates game phases: LOBBY -> REVEAL -> STEERING -> DEBRIEF -> repeat -> GAME_OVER
 * Timers are strictly tracked, cleared before set, and wiped on destroy.
 */

const crypto = require('crypto');
const {
  GAME_STATES,
  TIMINGS,
  DIRECTIONS,
  AVATAR_COLOURS,
  AVATAR_ICONS,
  BOT_NAMES,
  PLAYER_LIMITS
} = require('./constants');

const MapGenerator = require('./MapGenerator');
const DestinationAssigner = require('./DestinationAssigner');
const TickResolver = require('./TickResolver');
const Scoring = require('./Scoring');
const { sanitizePlayerName, resolveDuplicateName } = require('./ProfanityFilter');

class GameRoom {
  /**
   * @param {string} code - 4-character room code
   * @param {string} hostSocketId - Socket ID of the creating host
   * @param {Object} options - Config options (e.g. io instance, callbacks)
   */
  constructor(code, hostSocketId, options = {}) {
    this.code = code;
    this.hostSocketId = hostSocketId;
    this.hostId = hostSocketId || null;
    this.io = options.io || null;
    this.onDestroy = options.onDestroy || null;

    this.state = GAME_STATES.LOBBY;
    this.gameIndex = 0;
    this.round = 0;
    this.totalRounds = 0;
    this.chairId = null;
    this.chairCounts = new Map(); // playerId -> count of chair turns

    // Players: Map<playerId, playerObject>
    this.players = new Map();
    this.playerOrder = []; // Array of playerIds

    // Timer tracking: Map<string, Timeout|Interval>
    this.timers = new Map();

    // Map & Round State
    this.map = null;
    this.destinations = new Map(); // playerId -> landmarkId
    this.currentVotes = new Map(); // playerId -> direction
    this.readyPlayers = new Set(); // playerIds marked ready in debrief
    this.playAgainVotes = new Set(); // playerIds voted play again in GAME_OVER

    this.timings = { ...TIMINGS, ...(options.timings || {}) };

    // Tick & Vehicle State
    this.tick = 0;
    this.carPos = { row: 4, col: 4, x: 4, y: 4 };
    this.heading = null;
    this.inertiaEarned = false;
    this.fuel = this.timings.FUEL;
    this.gavels = this.timings.GAVELS_PER_ROUND;
    this.currentRoute = []; // [{ tick, row, col, type, direction }]

    // Scores: Map<playerId, Array<number>> (round scores)
    this.scores = new Map();

    // Emote & Ping Cooldowns: Map<playerId, timestamp>
    this.lastEmoteTimes = new Map();
    this.lastPingTimes = new Map();

    // Initialize map for game 0
    this._regenerateMap();
  }

  // -------------------------------------------------------------
  // TIMER HELPERS (Strict Ownership & Leak Prevention)
  // -------------------------------------------------------------

  setTrackedTimeout(name, fn, delayMs) {
    this.clearTrackedTimer(name);
    const timeout = setTimeout(() => {
      this.timers.delete(name);
      fn();
    }, delayMs);
    this.timers.set(name, timeout);
    return timeout;
  }

  setTrackedInterval(name, fn, intervalMs) {
    this.clearTrackedTimer(name);
    const interval = setInterval(fn, intervalMs);
    this.timers.set(name, interval);
    return interval;
  }

  clearTrackedTimer(name) {
    if (this.timers.has(name)) {
      const timer = this.timers.get(name);
      clearTimeout(timer);
      clearInterval(timer);
      this.timers.delete(name);
    }
  }

  clearTickTimers() {
    this.clearTrackedTimer('tick');
  }

  clearAllTimers() {
    for (const [name, timer] of this.timers.entries()) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.timers.clear();
  }

  // -------------------------------------------------------------
  // PLAYER MANAGEMENT
  // -------------------------------------------------------------

  addPlayer({ name, socketId, isBot = false, isHost = false }) {
    if (this.players.size >= PLAYER_LIMITS.MAX_PLAYERS) {
      throw new Error('Room is full (max 8 players).');
    }

    const playerId = isBot
      ? `bot_${crypto.randomBytes(3).toString('hex')}`
      : `usr_${crypto.randomBytes(4).toString('hex')}`;

    // Sanitize and resolve duplicate names
    const existingNames = Array.from(this.players.values()).map(p => p.name);
    const sanitized = sanitizePlayerName(name || (isBot ? 'Bot' : 'Player'));
    const finalName = resolveDuplicateName(sanitized, existingNames);

    // Pick avatar colour and icon based on current count
    const colourIndex = this.players.size % AVATAR_COLOURS.length;
    const iconIndex = this.players.size % AVATAR_ICONS.length;

    const player = {
      id: playerId,
      playerId,
      name: finalName,
      socketId: isBot ? null : socketId,
      isBot,
      isHost,
      connected: true,
      isAutopiloted: false,
      colour: AVATAR_COLOURS[colourIndex],
      icon: AVATAR_ICONS[iconIndex],
      joinedAt: Date.now()
    };

    this.players.set(playerId, player);
    this.playerOrder.push(playerId);
    this.scores.set(playerId, []);
    this.chairCounts.set(playerId, 0);

    if (isHost || !this.hostId) {
      this.hostId = playerId;
      this.hostSocketId = socketId;
      player.isHost = true;
    }

    return player;
  }

  addBot() {
    if (this.state !== GAME_STATES.LOBBY) {
      throw new Error('Bots can only be added in the lobby.');
    }
    if (this.players.size >= PLAYER_LIMITS.MAX_PLAYERS) {
      throw new Error('Room is full.');
    }

    // Pick unused bot name from BOT_NAMES
    const existingNames = new Set(Array.from(this.players.values()).map(p => p.name.toLowerCase()));
    let botName = BOT_NAMES.find(n => !existingNames.has(n.toLowerCase()));
    if (!botName) {
      botName = `Advisor ${this.players.size + 1}`;
    }

    return this.addPlayer({ name: botName, socketId: null, isBot: true, isHost: false });
  }

  removeBot(botId) {
    if (this.state !== GAME_STATES.LOBBY) {
      throw new Error('Bots can only be removed in the lobby.');
    }
    const player = this.players.get(botId);
    if (!player || !player.isBot) {
      throw new Error('Player is not a bot.');
    }

    this.players.delete(botId);
    this.playerOrder = this.playerOrder.filter(id => id !== botId);
    this.scores.delete(botId);
    this.chairCounts.delete(botId);
    return true;
  }

  kickPlayer(targetPlayerId, requestingPlayerId) {
    if (this.state !== GAME_STATES.LOBBY) {
      throw new Error('Players can only be kicked in the lobby.');
    }
    if (requestingPlayerId !== this.hostId) {
      throw new Error('Only the host can kick players.');
    }
    if (targetPlayerId === this.hostId) {
      throw new Error('Host cannot kick themselves.');
    }

    const player = this.players.get(targetPlayerId);
    if (!player) {
      throw new Error('Player not found.');
    }

    this.players.delete(targetPlayerId);
    this.playerOrder = this.playerOrder.filter(id => id !== targetPlayerId);
    this.scores.delete(targetPlayerId);
    this.chairCounts.delete(targetPlayerId);
    return player;
  }

  removePlayer(playerId) {
    if (!this.players.has(playerId)) return false;
    this.players.delete(playerId);
    this.playerOrder = this.playerOrder.filter(id => id !== playerId);
    this.scores.delete(playerId);
    this.chairCounts.delete(playerId);
    if (playerId === this.hostId) {
      this._migrateHost();
    }
    return true;
  }

  handleDisconnect(socketId) {
    let disconnectedPlayer = null;
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        disconnectedPlayer = player;
        break;
      }
    }

    if (!disconnectedPlayer) return null;

    disconnectedPlayer.connected = false;

    if (this.state === GAME_STATES.LOBBY) {
      // In lobby: remove immediately
      this.players.delete(disconnectedPlayer.id);
      this.playerOrder = this.playerOrder.filter(id => id !== disconnectedPlayer.id);
      this.scores.delete(disconnectedPlayer.id);
      this.chairCounts.delete(disconnectedPlayer.id);

      // Migrate host if host left
      if (disconnectedPlayer.id === this.hostId) {
        this._migrateHost();
      }

      this._checkEmptyRoom();
      return { player: disconnectedPlayer, removed: true };
    }

    // In active game: 30s grace period. Vote stays sticky!
    const graceTimerKey = `grace_${disconnectedPlayer.id}`;
    this.setTrackedTimeout(
      graceTimerKey,
      () => {
        // Grace period expired: set player to autopiloted
        disconnectedPlayer.isAutopiloted = true;

        // If host was disconnected beyond grace, migrate host to next human
        if (disconnectedPlayer.id === this.hostId) {
          this._migrateHost();
        }

        this._checkEmptyRoom();
      },
      TIMINGS.DISCONNECT_GRACE
    );

    return { player: disconnectedPlayer, removed: false };
  }

  handleReconnect(playerId, socketId) {
    const player = this.players.get(playerId);
    if (!player) return null;

    // Cancel grace timer
    this.clearTrackedTimer(`grace_${playerId}`);

    player.connected = true;
    player.socketId = socketId;
    player.isAutopiloted = false;

    // Cancel empty room timer if running
    this.clearTrackedTimer('empty_room_destroy');

    return player;
  }

  _migrateHost() {
    // Find next connected human in playerOrder
    const nextHuman = this.playerOrder
      .map(id => this.players.get(id))
      .find(p => p && !p.isBot && p.connected);

    if (nextHuman) {
      this.hostId = nextHuman.id;
      this.hostSocketId = nextHuman.socketId;
      nextHuman.isHost = true;
      if (this.io) {
        this.io.to(this.code).emit('host-migrated', { newHostId: nextHuman.id });
      }
    } else {
      // No connected humans left
      this.hostId = null;
      this.hostSocketId = null;
      this._checkEmptyRoom();
    }
  }

  _checkEmptyRoom() {
    const connectedHumans = Array.from(this.players.values()).filter(p => !p.isBot && p.connected);
    if (connectedHumans.length === 0) {
      // Destroy room after 60s empty timeout
      this.setTrackedTimeout('empty_room_destroy', () => {
        this.destroy();
      }, TIMINGS.EMPTY_ROOM_TIMEOUT);
    }
  }

  // -------------------------------------------------------------
  // GAME LIFECYCLE & STATE MACHINE
  // -------------------------------------------------------------

  _regenerateMap() {
    const seed = `room_${this.code}_game_${this.gameIndex}`;
    this.map = MapGenerator.generate(seed);
  }

  startGame(requestingPlayerId) {
    if (this.state !== GAME_STATES.LOBBY) {
      throw new Error('Game already started.');
    }
    if (requestingPlayerId !== this.hostId) {
      throw new Error('Only the host can start the game.');
    }

    // Require >= 2 connected humans
    const connectedHumans = Array.from(this.players.values()).filter(p => !p.isBot && p.connected);
    if (connectedHumans.length < PLAYER_LIMITS.MIN_HUMANS) {
      throw new Error(`Requires at least ${PLAYER_LIMITS.MIN_HUMANS} human players to start.`);
    }

    // Auto-bot backfill: if total seats < 3, add bots to reach 3
    while (this.players.size < PLAYER_LIMITS.MIN_PLAYERS) {
      this.addBot();
    }

    const N = this.players.size;
    this.totalRounds = N * Math.ceil(4 / N);
    this.round = 1;

    // Reset scores for all players
    for (const pid of this.playerOrder) {
      this.scores.set(pid, []);
      this.chairCounts.set(pid, 0);
    }

    // Broadcast game-started
    if (this.io) {
      this.io.to(this.code).emit('game-started', {
        round: this.round,
        totalRounds: this.totalRounds,
        map: {
          grid: this.map.grid,
          landmarks: this.map.landmarks,
          obstacles: this.map.obstacles
        },
        chairId: this.playerOrder[0]
      });
    }

    this._startRoundReveal(true);
  }

  _startRoundReveal(isFirstReveal = false) {
    this.state = GAME_STATES.REVEAL;
    this.clearTickTimers();

    const N = this.playerOrder.length;
    const chairIndex = (this.round - 1) % N;
    this.chairId = this.playerOrder[chairIndex];
    this.chairCounts.set(this.chairId, (this.chairCounts.get(this.chairId) || 0) + 1);

    // Round start state
    this.tick = 0;
    this.carPos = { row: 4, col: 4, x: 4, y: 4 };
    this.heading = null;
    this.inertiaEarned = false;
    this.fuel = this.timings.FUEL;
    this.gavels = this.timings.GAVELS_PER_ROUND;
    this.currentVotes.clear();
    this.currentRoute = [{ tick: 0, row: 4, col: 4, x: 4, y: 4, type: 'START' }];

    // Assign secret destinations
    const destSeed = `dest_${this.code}_game_${this.gameIndex}_round_${this.round}`;
    this.destinations = DestinationAssigner.assignDestinations(
      destSeed,
      this.playerOrder,
      this.map.landmarks
    );

    const duration = isFirstReveal ? this.timings.FIRST_REVEAL_DURATION : this.timings.REVEAL_DURATION;
    const serverTime = Date.now();
    const phaseEndTime = serverTime + duration;

    // Emit private round-reveal to each player
    for (const player of this.players.values()) {
      if (player.socketId && this.io) {
        const destId = this.destinations.get(player.id);
        const destLandmark = this.map.landmarks.find(l => l.id === destId);

        this.io.to(player.socketId).emit('round-reveal', {
          round: this.round,
          totalRounds: this.totalRounds,
          destination: destLandmark || null,
          chairId: this.chairId,
          gavels: this.gavels,
          isFirstReveal,
          revealDuration: duration,
          serverTime,
          phaseEndTime
        });
      }
    }

    // Schedule transition to STEERING
    this.setTrackedTimeout('reveal_timer', () => {
      this._startSteering();
    }, duration);
  }

  _startSteering() {
    this.state = GAME_STATES.STEERING;
    this.tick = 0;

    // Run tick every TICK_INTERVAL
    this.setTrackedInterval('tick', () => {
      this._executeTick();
    }, this.timings.TICK_INTERVAL);
  }

  _executeTick() {
    this.tick++;

    const tickState = {
      tick: this.tick,
      carPos: this.carPos,
      car: this.carPos,
      heading: this.heading,
      inertiaEarned: this.inertiaEarned,
      fuel: this.fuel,
      gavels: this.gavels,
      obstacles: this.map.obstacles,
      mapSize: 9
    };

    const { newState, result } = TickResolver.resolveTick(
      tickState,
      this.currentVotes,
      this.chairId
    );

    // Apply new state
    this.carPos = newState.carPos;
    this.heading = newState.heading;
    this.inertiaEarned = newState.inertiaEarned;
    this.fuel = newState.fuel;
    this.gavels = newState.gavels;

    // Record route
    this.currentRoute.push({
      tick: this.tick,
      row: this.carPos.row,
      col: this.carPos.col,
      x: this.carPos.x,
      y: this.carPos.y,
      type: result.type,
      direction: result.direction
    });

    // Broadcast tick-update
    if (this.io) {
      const votesObj = {};
      for (const [pid, dir] of this.currentVotes.entries()) {
        votesObj[pid] = dir;
      }

      this.io.to(this.code).emit('tick-update', {
        tick: this.tick,
        votes: votesObj,
        carPos: this.carPos,
        heading: this.heading,
        inertiaEarned: this.inertiaEarned,
        fuel: this.fuel,
        gavels: this.gavels,
        result: result.type,
        winningDirection: result.direction,
        roundEnds: newState.roundEnds,
        serverTime: Date.now()
      });
    }

    if (newState.roundEnds) {
      this.clearTickTimers();
      this._startDebrief();
    }
  }

  _startDebrief() {
    this.state = GAME_STATES.DEBRIEF;
    this.readyPlayers.clear();

    // Compute round scores
    const roundScoresMap = Scoring.scoreRound(
      this.carPos,
      this.destinations,
      this.map.distanceMatrix,
      this.map.landmarks
    );

    // Record scores
    for (const [pid, score] of roundScoresMap.entries()) {
      const history = this.scores.get(pid) || [];
      history.push(score);
      this.scores.set(pid, history);
    }

    const duration = this.timings.DEBRIEF_DURATION;
    const serverTime = Date.now();
    const phaseEndTime = serverTime + duration;

    // Broadcast round-debrief
    if (this.io) {
      const destObj = {};
      for (const [pid, lmid] of this.destinations.entries()) {
        destObj[pid] = lmid;
      }

      const scoreObj = {};
      for (const [pid, s] of roundScoresMap.entries()) {
        scoreObj[pid] = s;
      }

      this.io.to(this.code).emit('round-debrief', {
        round: this.round,
        destinations: destObj,
        scores: scoreObj,
        route: this.currentRoute,
        serverTime,
        phaseEndTime
      });
    }

    // Schedule next phase
    this.setTrackedTimeout('debrief_timer', () => {
      this._advanceFromDebrief();
    }, duration);
  }

  _advanceFromDebrief() {
    this.clearTrackedTimer('debrief_timer');

    if (this.round < this.totalRounds) {
      this.round++;
      this._startRoundReveal(false);
    } else {
      this._endGame();
    }
  }

  markPlayerReady(playerId) {
    if (this.state !== GAME_STATES.DEBRIEF) return false;

    this.readyPlayers.add(playerId);

    // Check if all connected humans are ready
    const connectedHumans = Array.from(this.players.values()).filter(p => !p.isBot && p.connected);
    const allReady = connectedHumans.every(p => this.readyPlayers.has(p.id));

    if (allReady && connectedHumans.length > 0) {
      this._advanceFromDebrief();
      return true;
    }

    return false;
  }

  _endGame() {
    this.state = GAME_STATES.GAME_OVER;
    this.playAgainVotes.clear();

    const playerMeta = new Map();
    for (const [pid, p] of this.players.entries()) {
      playerMeta.set(pid, { name: p.name, colour: p.colour, icon: p.icon, isBot: p.isBot });
    }

    const standings = Scoring.computeStandings(this.scores, this.chairCounts, playerMeta);

    if (this.io) {
      this.io.to(this.code).emit('game-over', {
        standings,
        tiebreakInfo: '1. Total Score  2. Exact Hits (100)  3. Best Single Round  4. Fewer Chair Turns',
        awards: []
      });
    }

    // Set idle timeout for GAME_OVER state
    this.setTrackedTimeout('game_over_idle', () => {
      this.destroy();
    }, TIMINGS.GAME_OVER_IDLE_TIMEOUT);
  }

  votePlayAgain(playerId) {
    if (this.state !== GAME_STATES.GAME_OVER) return false;

    this.playAgainVotes.add(playerId);

    const connectedHumans = Array.from(this.players.values()).filter(p => !p.isBot && p.connected);
    const totalHumans = connectedHumans.length;
    const votedCount = this.playAgainVotes.size;

    // If all humans tapped or majority tapped and timeout fires
    if (votedCount >= totalHumans && totalHumans > 0) {
      this.resetPlayAgain();
      return true;
    }

    // Start 10s countdown if majority voted
    if (votedCount > totalHumans / 2 && !this.timers.has('play_again_countdown')) {
      this.setTrackedTimeout('play_again_countdown', () => {
        this.resetPlayAgain();
      }, 10000);
    }

    return false;
  }

  resetPlayAgain() {
    this.clearAllTimers();

    this.state = GAME_STATES.LOBBY;
    this.gameIndex++;
    this.round = 0;
    this.totalRounds = 0;
    this.chairId = null;

    // Reset scores & chair counts
    for (const pid of this.playerOrder) {
      this.scores.set(pid, []);
      this.chairCounts.set(pid, 0);
    }

    this.destinations.clear();
    this.currentVotes.clear();
    this.readyPlayers.clear();
    this.playAgainVotes.clear();
    this.currentRoute = [];

    this.tick = 0;
    this.carPos = { row: 4, col: 4, x: 4, y: 4 };
    this.heading = null;
    this.inertiaEarned = false;
    this.fuel = TIMINGS.FUEL;
    this.gavels = TIMINGS.GAVELS_PER_ROUND;

    // Generate fresh map for new game
    this._regenerateMap();

    if (this.io) {
      this.io.to(this.code).emit('play-again-reset', {
        roomCode: this.code,
        players: Array.from(this.players.values()),
        hostId: this.hostId
      });
    }

    // Start lobby idle timer
    this.setTrackedTimeout('lobby_idle', () => {
      this.destroy();
    }, TIMINGS.LOBBY_IDLE_TIMEOUT);
  }

  // -------------------------------------------------------------
  // IN-GAME INTENT VALIDATION (VOTE, EMOTE, PING)
  // -------------------------------------------------------------

  recordVote(playerId, direction) {
    if (this.state !== GAME_STATES.STEERING) {
      throw new Error('Votes only accepted during STEERING phase.');
    }
    const player = this.players.get(playerId);
    if (!player) {
      throw new Error('Player not in room.');
    }
    if (!Object.values(DIRECTIONS).includes(direction)) {
      throw new Error('Invalid direction.');
    }
    if (direction === DIRECTIONS.PARK && this.tick < this.timings.PARK_LOCKOUT_TICKS) {
      throw new Error(`PARK is locked out during ticks 1-${this.timings.PARK_LOCKOUT_TICKS}.`);
    }

    this.currentVotes.set(playerId, direction);
    return true;
  }

  recordEmote(playerId, emoteIndex) {
    const player = this.players.get(playerId);
    if (!player) throw new Error('Player not in room.');

    const now = Date.now();
    const last = this.lastEmoteTimes.get(playerId) || 0;
    if (now - last < TIMINGS.EMOTE_COOLDOWN || now - last < 3000) {
      throw new Error('Emote on cooldown.');
    }

    if (emoteIndex < 0 || emoteIndex > 5) {
      throw new Error('Invalid emote index (0-5).');
    }

    this.lastEmoteTimes.set(playerId, now);
    return true;
  }

  recordPing(playerId, landmarkId) {
    const player = this.players.get(playerId);
    if (!player) throw new Error('Player not in room.');

    const now = Date.now();
    const last = this.lastPingTimes.get(playerId) || 0;
    if (now - last < TIMINGS.PING_COOLDOWN || now - last < 5000) {
      throw new Error('Ping on cooldown.');
    }

    const landmarkExists = this.map.landmarks.some(l => l.id === landmarkId);
    if (!landmarkExists) {
      throw new Error('Invalid landmark ID.');
    }

    this.lastPingTimes.set(playerId, now);
    return true;
  }

  // -------------------------------------------------------------
  // RECONNECT STATE SNAPSHOT
  // -------------------------------------------------------------

  getReconnectSnapshot(playerId) {
    const votesObj = {};
    for (const [pid, dir] of this.currentVotes.entries()) {
      votesObj[pid] = dir;
    }

    const scoresObj = {};
    for (const [pid, sList] of this.scores.entries()) {
      scoresObj[pid] = sList;
    }

    const destId = this.destinations.get(playerId);
    const destination = destId ? this.map.landmarks.find(l => l.id === destId) : null;

    return {
      gameState: this.state,
      round: this.round,
      totalRounds: this.totalRounds,
      tick: this.tick,
      map: {
        grid: this.map.grid,
        landmarks: this.map.landmarks,
        obstacles: this.map.obstacles
      },
      carPos: this.carPos,
      heading: this.heading,
      fuel: this.fuel,
      gavels: this.gavels,
      votes: votesObj,
      scores: scoresObj,
      destination,
      players: Array.from(this.players.values()),
      chairId: this.chairId,
      serverTime: Date.now()
    };
  }

  destroy() {
    this.clearAllTimers();
    if (typeof this.onDestroy === 'function') {
      this.onDestroy(this.code);
    }
  }
}

module.exports = GameRoom;
