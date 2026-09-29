/**
 * STEERING COMMITTEE — Bot AI & Pathfinding Unit Tests
 * Asserts:
 * 1. BotLogic.getVote('LEFTY', ...) returns LEFT when UP and LEFT tie for shortest distance.
 * 2. BotLogic.getVote('SHADY', ...) returns a distance-maximizing move on tick 2.
 * 3. BotLogic.getVote('DIPLOMAT', ...) targets the closest human's destination.
 */

const assert = require('assert');
const BotLogic = require('../game/BotLogic');
const MapGenerator = require('../game/MapGenerator');

console.log('--- TEST: Bot AI Personalities & Pathfinding ---');

// Helper to build a clean 9x9 distance matrix with Manhattan distance and optional obstacles
function createMockMap(obstacles = []) {
  const distanceMatrix = {};
  const obsSet = new Set(obstacles.map(o => `${o.row},${o.col}`));

  for (let r1 = 0; r1 < 9; r1++) {
    for (let c1 = 0; c1 < 9; c1++) {
      const k1 = `${r1},${c1}`;
      distanceMatrix[k1] = {};
      for (let r2 = 0; r2 < 9; r2++) {
        for (let c2 = 0; c2 < 9; c2++) {
          const k2 = `${r2},${c2}`;
          if (obsSet.has(k1) || obsSet.has(k2)) {
            distanceMatrix[k1][k2] = Infinity;
          } else {
            // BFS/Manhattan distance on unobstructed grid
            distanceMatrix[k1][k2] = Math.abs(r1 - r2) + Math.abs(c1 - c2);
          }
        }
      }
    }
  }

  return {
    size: 9,
    obstacles,
    landmarks: [
      { id: 'lm_0', row: 3, col: 3, shape: 'star', color: '#E53E3E' },
      { id: 'lm_up', row: 3, col: 4, shape: 'triangle', color: '#3182CE' },
      { id: 'lm_h1', row: 4, col: 6, shape: 'diamond', color: '#38A169' },
      { id: 'lm_h2', row: 4, col: 0, shape: 'circle', color: '#D69E2E' },
      { id: 'lm_far', row: 8, col: 8, shape: 'hexagon', color: '#805AD5' }
    ],
    distanceMatrix
  };
}

// -----------------------------------------------------------------------------
// TEST 1: LEFTY Tie-Breaking (LEFT over UP on tie for minimum distance)
// -----------------------------------------------------------------------------
{
  const mapData = createMockMap();
  const carPos = { row: 4, col: 4 };
  const destLandmark = { id: 'lm_0', row: 3, col: 3 };

  // From (4, 4), target (3, 3):
  // UP (3, 4): dist |3-3| + |4-3| = 1
  // LEFT (4, 3): dist |4-3| + |3-3| = 1
  // DOWN (5, 4): dist |5-3| + |4-3| = 3
  // RIGHT (4, 5): dist |4-3| + |5-3| = 3
  // Both UP and LEFT tie for minimum distance 1.
  // Strict tie-break for LEFTY is: LEFT, UP, DOWN, RIGHT.

  const destinations = new Map([['bot_lefty', 'lm_0']]);
  const allPlayers = [{ id: 'bot_lefty', name: 'Lefty', isBot: true, botProfile: 'LEFTY' }];

  const vote = BotLogic.getVote('LEFTY', carPos, mapData, destinations, allPlayers, 1, 'bot_lefty');
  assert.strictEqual(vote, 'LEFT', 'LEFTY must choose LEFT when UP and LEFT tie for shortest distance');
  console.log('✔ ASSERTION 1 PASSED: BotLogic.getVote(\'LEFTY\') returns LEFT when UP and LEFT tie for shortest distance.');

  // Also test direct landmark object passed in destinations
  const voteDirect = BotLogic.getVote('LEFTY', carPos, mapData, destLandmark, allPlayers, 1);
  assert.strictEqual(voteDirect, 'LEFT', 'LEFTY must choose LEFT with direct landmark destination object');
}

// -----------------------------------------------------------------------------
// TEST 2: SHADY Distance-Maximizing on Tick 2 (ticks 1-3 max dist, tick 4+ min dist)
// -----------------------------------------------------------------------------
{
  const mapData = createMockMap();
  const carPos = { row: 4, col: 4 };
  // Target directly UP at (3, 4)
  const destLandmark = { id: 'lm_up', row: 3, col: 4 };

  // Candidates from (4, 4):
  // UP (3, 4): dist 0
  // DOWN (5, 4): dist 2
  // LEFT (4, 3): dist 2
  // RIGHT (4, 5): dist 2
  // On tick 2: SHADY maximizes distance -> max dist is 2 (DOWN, LEFT, RIGHT tie).
  // Priority for SHADY ticks 1-3 is: RIGHT, DOWN, UP, LEFT.
  // Therefore, it must choose RIGHT.

  const destinations = new Map([['bot_shady', 'lm_up']]);
  const allPlayers = [{ id: 'bot_shady', name: 'Shady', isBot: true, botProfile: 'SHADY' }];

  const voteTick2 = BotLogic.getVote('SHADY', carPos, mapData, destinations, allPlayers, 2, 'bot_shady');
  assert.strictEqual(voteTick2, 'RIGHT', 'SHADY on tick 2 must pick distance-maximizing move (RIGHT among ties)');
  console.log('✔ ASSERTION 2 PASSED: BotLogic.getVote(\'SHADY\') returns a distance-maximizing move on tick 2.');

  // Confirm tick 1 also maximizes
  const voteTick1 = BotLogic.getVote('SHADY', carPos, mapData, destinations, allPlayers, 1, 'bot_shady');
  assert.strictEqual(voteTick1, 'RIGHT', 'SHADY on tick 1 also maximizes distance');

  // Confirm tick 4 switches to normal pathfinding (minimizing distance to target -> UP)
  const voteTick4 = BotLogic.getVote('SHADY', carPos, mapData, destinations, allPlayers, 4, 'bot_shady');
  assert.strictEqual(voteTick4, 'UP', 'SHADY on tick 4+ normalizes to distance-minimizing pathfinding (UP)');

  // Verify obstacles are excluded from max-distance consideration
  const mapWithObstacle = createMockMap([{ row: 4, col: 5 }]); // RIGHT is an obstacle
  const voteWithObs = BotLogic.getVote('SHADY', carPos, mapWithObstacle, destinations, allPlayers, 2, 'bot_shady');
  // RIGHT is obstacle (Infinity) -> next highest priority among DOWN and LEFT is DOWN
  assert.strictEqual(voteWithObs, 'DOWN', 'SHADY must not choose an obstacle even if in priority order');
}

// -----------------------------------------------------------------------------
// TEST 3: DIPLOMAT Consensus (targets the closest human's destination)
// -----------------------------------------------------------------------------
{
  const mapData = createMockMap();
  const carPos = { row: 4, col: 4 };

  // Setup players:
  // Human 1: dest 'lm_h1' at (4, 6) -> dist from carPos (4, 4) is 2.
  // Human 2: dest 'lm_h2' at (4, 0) -> dist from carPos (4, 4) is 4.
  // Bot Diplomat: dest 'lm_far' at (8, 8) -> dist is 8.
  const destinations = new Map([
    ['human_1', 'lm_h1'],
    ['human_2', 'lm_h2'],
    ['bot_diplomat', 'lm_far']
  ]);

  const allPlayers = [
    { id: 'human_1', name: 'Alice', isBot: false },
    { id: 'human_2', name: 'Bob', isBot: false },
    { id: 'bot_diplomat', name: 'Diplomat', isBot: true, botProfile: 'DIPLOMAT' }
  ];

  // Diplomat finds closest destination among players:
  // lm_h1 (dist 2) vs lm_h2 (dist 4) vs lm_far (dist 8).
  // Closest is lm_h1 at (4, 6).
  // From (4, 4) towards (4, 6):
  // UP (3, 4): dist 3
  // DOWN (5, 4): dist 3
  // LEFT (4, 3): dist 3
  // RIGHT (4, 5): dist 1 (minimum distance)
  // Vote must be RIGHT.

  const vote = BotLogic.getVote('DIPLOMAT', carPos, mapData, destinations, allPlayers, 1, 'bot_diplomat');
  assert.strictEqual(vote, 'RIGHT', 'DIPLOMAT must target closest player destination (lm_h1) and steer RIGHT');
  console.log('✔ ASSERTION 3 PASSED: BotLogic.getVote(\'DIPLOMAT\') targets the closest human\'s destination.');

  // Autopilot for disconnected human behaves as DIPLOMAT
  const disconnectedPlayer = { id: 'human_1', name: 'Alice', isBot: false, isAutopiloted: true };
  const autopilotVote = BotLogic.getVote('DIPLOMAT', carPos, mapData, destinations, allPlayers, 1, disconnectedPlayer.id);
  assert.strictEqual(autopilotVote, 'RIGHT', 'Autopilot must use Diplomat logic');
}

// -----------------------------------------------------------------------------
// TEST 4: Full MapGenerator Integration Test
// -----------------------------------------------------------------------------
{
  const realMap = MapGenerator.generate(99999);
  const carPos = { row: 4, col: 4 };
  const dest = realMap.landmarks[0];
  const destinations = new Map([['b1', dest.id]]);
  const allPlayers = [{ id: 'b1', name: 'Lefty', isBot: true, botProfile: 'LEFTY' }];

  const vote = BotLogic.getVote('LEFTY', carPos, realMap, destinations, allPlayers, 1, 'b1');
  assert.ok(['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(vote), 'Vote must be a valid cardinal direction');
  console.log(`✔ ASSERTION 4 PASSED: BotLogic operates on real generated MapGenerator instance (vote=${vote}).`);
}

console.log('--- ALL BOT AI ASSERTIONS PASSED ---');
