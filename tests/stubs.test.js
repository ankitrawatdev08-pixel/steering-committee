const test = require('node:test');
const assert = require('node:assert/strict');

const constants = require('../game/constants');
const SeededRNG = require('../game/SeededRNG');
const MapGenerator = require('../game/MapGenerator');
const DestinationAssigner = require('../game/DestinationAssigner');
const TickResolver = require('../game/TickResolver');
const Scoring = require('../game/Scoring');
const RoomManager = require('../game/RoomManager');
const GameRoom = require('../game/GameRoom');

test('constants.js: exports all required game configurations', () => {
  // Room code
  assert.equal(typeof constants.ROOM_CODE_CHARS, 'string');
  assert.equal(constants.ROOM_CODE_CHARS.length, 31);
  assert.equal(constants.ROOM_CODE_LENGTH, 4);

  // States
  assert.deepEqual(constants.GAME_STATES, {
    LOBBY: 'LOBBY',
    REVEAL: 'REVEAL',
    STEERING: 'STEERING',
    DEBRIEF: 'DEBRIEF',
    GAME_OVER: 'GAME_OVER'
  });

  // Timings
  assert.equal(constants.TIMINGS.FIRST_REVEAL_DURATION, 8000);
  assert.equal(constants.TIMINGS.REVEAL_DURATION, 5000);
  assert.equal(constants.TIMINGS.TICK_INTERVAL, 1500);
  assert.equal(constants.TIMINGS.DEBRIEF_DURATION, 8000);
  assert.equal(constants.TIMINGS.FUEL, 20);
  assert.equal(constants.TIMINGS.PARK_LOCKOUT_TICKS, 5);
  assert.equal(constants.TIMINGS.GAVELS_PER_ROUND, 3);
  assert.equal(constants.TIMINGS.DISCONNECT_GRACE, 30000);
  assert.equal(constants.TIMINGS.LOBBY_IDLE_TIMEOUT, 300000);
  assert.equal(constants.TIMINGS.GAME_OVER_IDLE_TIMEOUT, 120000);
  assert.equal(constants.TIMINGS.EMPTY_ROOM_TIMEOUT, 60000);
  assert.equal(constants.TIMINGS.IDLE_WARN_ROUNDS, 1);
  assert.equal(constants.TIMINGS.IDLE_AUTOPILOT_ROUNDS, 2);

  // Directions
  assert.deepEqual(constants.DIRECTIONS, {
    UP: 'UP',
    DOWN: 'DOWN',
    LEFT: 'LEFT',
    RIGHT: 'RIGHT',
    PARK: 'PARK'
  });

  // Landmarks & Avatars
  assert.equal(constants.LANDMARK_SHAPES.length, 6);
  assert.equal(constants.LANDMARK_COLOURS.length, 6);
  assert.equal(constants.AVATAR_COLOURS.length, 8);
  assert.equal(constants.EMOTES.length, 6);
  assert.equal(constants.EMOTE_COOLDOWN, 3000);
  assert.equal(constants.PING_COOLDOWN, 5000);
  assert.equal(constants.BOT_NAMES.length, 8);

  // Map & Players
  assert.equal(constants.MAP_SIZE, 9);
  assert.equal(constants.OBSTACLE_COUNT, 8);
  assert.equal(constants.LANDMARK_COUNT, 6);
  assert.equal(constants.LANDMARK_TARGET_DISTANCE, 5);
  assert.equal(constants.LANDMARK_MIN_PAIRWISE_DISTANCE, 3);
  assert.equal(constants.MAX_MAP_REGEN_ATTEMPTS, 50);
  assert.equal(constants.MIN_PLAYERS, 3);
  assert.equal(constants.MIN_HUMANS, 2);
  assert.equal(constants.MAX_PLAYERS, 8);
});

test('Module stubs: all export expected class/function shape', () => {
  // SeededRNG
  assert.equal(typeof SeededRNG, 'function');
  const rng = new SeededRNG('test');
  assert.equal(typeof rng.next, 'function');
  assert.equal(typeof rng.nextInt, 'function');
  assert.equal(typeof rng.shuffle, 'function');

  // MapGenerator
  assert.equal(typeof MapGenerator, 'function');
  assert.equal(typeof MapGenerator.generate, 'function');
  const mapResult = MapGenerator.generate('test-seed');
  assert.equal(typeof mapResult, 'object');
  assert.equal(mapResult.size, 9);

  // DestinationAssigner
  assert.equal(typeof DestinationAssigner, 'function');
  assert.equal(typeof DestinationAssigner.assign, 'function');
  const assignResult = DestinationAssigner.assign();
  assert.ok(assignResult instanceof Map);

  // TickResolver
  assert.equal(typeof TickResolver, 'function');
  assert.equal(typeof TickResolver.resolve, 'function');
  const tickResult = TickResolver.resolve();
  assert.equal(typeof tickResult, 'object');
  assert.ok('car' in tickResult);
  assert.ok('heading' in tickResult);

  // Scoring
  assert.equal(typeof Scoring, 'function');
  assert.equal(typeof Scoring.calculateScore, 'function');
  assert.equal(Scoring.calculateScore(0), 100);
  assert.equal(Scoring.calculateScore(5), 0);
  assert.equal(Scoring.calculateScore(6), 0);
  assert.equal(typeof Scoring.evaluateRound, 'function');

  // RoomManager
  assert.equal(typeof RoomManager, 'function');
  const rm = new RoomManager();
  assert.ok(rm.rooms instanceof Map);
  assert.equal(typeof rm.createRoom, 'function');
  assert.equal(typeof rm.getRoom, 'function');
  assert.equal(typeof rm.handleDisconnect, 'function');

  // GameRoom
  assert.equal(typeof GameRoom, 'function');
  const gr = new GameRoom('TEST', 'socket-1');
  assert.equal(gr.code, 'TEST');
  assert.equal(gr.hostId, 'socket-1');
  assert.equal(gr.state, constants.GAME_STATES.LOBBY);
  assert.ok(gr.players instanceof Map);
  assert.ok(gr.timers instanceof Map);
  assert.equal(typeof gr.addPlayer, 'function');
  assert.equal(typeof gr.removePlayer, 'function');
  assert.equal(typeof gr.destroy, 'function');
});
