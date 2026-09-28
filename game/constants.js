/**
 * STEERING COMMITTEE — Game Constants
 * Corporate Boardroom Party Game
 */

const ROOM_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 31 chars (no 0, 1, I, O, L)
const ROOM_CODE_LENGTH = 4;

const GAME_STATES = Object.freeze({
  LOBBY: 'LOBBY',
  REVEAL: 'REVEAL',
  STEERING: 'STEERING',
  DEBRIEF: 'DEBRIEF',
  GAME_OVER: 'GAME_OVER'
});

const TIMINGS = Object.freeze({
  FIRST_REVEAL_DURATION: 8000,
  REVEAL_DURATION: 5000,
  TICK_INTERVAL: 1500,
  DEBRIEF_DURATION: 8000,
  FUEL: 20,
  PARK_LOCKOUT_TICKS: 5,
  GAVELS_PER_ROUND: 3,
  DISCONNECT_GRACE: 30000,
  LOBBY_IDLE_TIMEOUT: 300000,
  GAME_OVER_IDLE_TIMEOUT: 120000,
  EMPTY_ROOM_TIMEOUT: 60000,
  IDLE_WARN_ROUNDS: 1,
  IDLE_AUTOPILOT_ROUNDS: 2
});

const DIRECTIONS = Object.freeze({
  UP: 'UP',
  DOWN: 'DOWN',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  PARK: 'PARK'
});

const DIRECTION_VECTORS = Object.freeze({
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
  PARK: { x: 0, y: 0 }
});

const LANDMARK_SHAPES = Object.freeze([
  'star',
  'diamond',
  'triangle',
  'circle',
  'square',
  'hexagon'
]);

const LANDMARK_COLOURS = Object.freeze([
  '#E53E3E', // Stamp Red
  '#3182CE', // Legal Blue
  '#38A169', // Executive Emerald
  '#DD6B20', // Warm Amber
  '#319795', // Teal Ink
  '#D53F8C'  // Crimson Mulberry
]);

// 8 distinct, warm corporate boardroom avatar colours (NOT neon)
const AVATAR_COLOURS = Object.freeze([
  '#8B2635', // Deep Oxblood
  '#1B3B6F', // Executive Navy
  '#2E5A36', // Boardroom Emerald / British Racing Green
  '#B7791F', // Legal-Pad Gold
  '#4A2545', // Plum Mahogany
  '#3E5C76', // Steel Slate
  '#744210', // Walnut Amber
  '#1D4044'  // Deep Petroleum Teal
]);

const AVATAR_ICONS = Object.freeze([
  'briefcase',
  'fountain-pen',
  'gavel',
  'stamp',
  'ledger',
  'monocle',
  'scale',
  'hourglass'
]);

const EMOTES = Object.freeze([
  'Deal?',
  'Deal!',
  'No way',
  'Follow me',
  'Trust me',
  'Liar!'
]);

const EMOTE_COOLDOWN = 3000;
const PING_COOLDOWN = 5000;

const BOT_NAMES = Object.freeze([
  'Intern',
  'Temp',
  'Consultant',
  'Advisor',
  'Delegate',
  'Liaison',
  'Deputy',
  'Analyst'
]);

const MAP_CONFIG = Object.freeze({
  MAP_SIZE: 9,
  OBSTACLE_COUNT: 8,
  LANDMARK_COUNT: 6,
  LANDMARK_TARGET_DISTANCE: 5,
  LANDMARK_MIN_PAIRWISE_DISTANCE: 3,
  MAX_MAP_REGEN_ATTEMPTS: 50
});

const PLAYER_LIMITS = Object.freeze({
  MIN_PLAYERS: 3,  // Total seats required to play (human + bots)
  MIN_HUMANS: 2,   // Minimum human players for regular game
  MAX_PLAYERS: 8
});

module.exports = {
  ROOM_CODE_CHARS,
  ROOM_CODE_LENGTH,
  GAME_STATES,
  TIMINGS,
  DIRECTIONS,
  DIRECTION_VECTORS,
  LANDMARK_SHAPES,
  LANDMARK_COLOURS,
  AVATAR_COLOURS,
  AVATAR_ICONS,
  EMOTES,
  EMOTE_COOLDOWN,
  PING_COOLDOWN,
  BOT_NAMES,
  MAP_SIZE: MAP_CONFIG.MAP_SIZE,
  OBSTACLE_COUNT: MAP_CONFIG.OBSTACLE_COUNT,
  LANDMARK_COUNT: MAP_CONFIG.LANDMARK_COUNT,
  LANDMARK_TARGET_DISTANCE: MAP_CONFIG.LANDMARK_TARGET_DISTANCE,
  LANDMARK_MIN_PAIRWISE_DISTANCE: MAP_CONFIG.LANDMARK_MIN_PAIRWISE_DISTANCE,
  MAX_MAP_REGEN_ATTEMPTS: MAP_CONFIG.MAX_MAP_REGEN_ATTEMPTS,
  MAP_CONFIG,
  MIN_PLAYERS: PLAYER_LIMITS.MIN_PLAYERS,
  MIN_HUMANS: PLAYER_LIMITS.MIN_HUMANS,
  MAX_PLAYERS: PLAYER_LIMITS.MAX_PLAYERS,
  PLAYER_LIMITS
};
