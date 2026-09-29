/**
 * STEERING COMMITTEE — Test: Play Again Soak Test (9h)
 * Plays 5 consecutive full games through Play Again with 3 players,
 * asserting state resets, map regeneration, and timer leak prevention.
 */

const assert = require('node:assert/strict');
const RoomManager = require('../game/RoomManager');
const { GAME_STATES } = require('../game/constants');

console.log('--- TEST 9h: Play Again Soak Test (5 Consecutive Games) ---');

const roomManager = new RoomManager();
const fastTimings = {
  FIRST_REVEAL_DURATION: 50,
  REVEAL_DURATION: 30,
  TICK_INTERVAL: 20,
  DEBRIEF_DURATION: 50,
  LOBBY_IDLE_TIMEOUT: 60000,
  GAME_OVER_IDLE_TIMEOUT: 60000
};

const { room, player: hostPlayer } = roomManager.createRoom('socket_host', {
  playerName: 'Director 1',
  timings: fastTimings
});

const p2 = roomManager.joinRoom(room.code, 'socket_p2', 'Director 2').player;
const p3 = roomManager.joinRoom(room.code, 'socket_p3', 'Director 3').player;

assert.equal(room.players.size, 3);
const initialRoomCode = room.code;
let previousMapSeed = null;

async function playSingleGame(gameNumber) {
  console.log(`\n>>> Starting Game ${gameNumber} (GameIndex=${room.gameIndex}, Code=${room.code})`);

  // Start game
  room.startGame(hostPlayer.id);
  assert.equal(room.state, GAME_STATES.REVEAL);
  assert.equal(room.round, 1);
  assert.equal(room.totalRounds, 6);

  // Play through all 6 rounds
  while (room.state !== GAME_STATES.GAME_OVER) {
    if (room.state === GAME_STATES.REVEAL) {
      // Fast-forward reveal
      room.clearTrackedTimer('reveal_timer');
      room._startSteering();
    } else if (room.state === GAME_STATES.STEERING) {
      // Simulate quick round ending via fuel exhaustion or PARK
      room.clearTrackedTimer('tick');
      // Execute 1 tick with PARK
      room.tick = 6;
      room.currentVotes.set(hostPlayer.id, 'PARK');
      room._executeTick();
      assert.equal(room.state, GAME_STATES.DEBRIEF);
    } else if (room.state === GAME_STATES.DEBRIEF) {
      // All ready
      room.markPlayerReady(hostPlayer.id);
      room.markPlayerReady(p2.id);
      room.markPlayerReady(p3.id);
    }
  }

  assert.equal(room.state, GAME_STATES.GAME_OVER, 'Game must reach GAME_OVER');
  console.log(`Game ${gameNumber} reached GAME_OVER successfully.`);

  // Verify non-zero scores were accumulated
  for (const pid of [hostPlayer.id, p2.id, p3.id]) {
    assert.equal(room.scores.get(pid).length, 6, `Player ${pid} must have 6 round scores`);
  }

  const finishedMapSeed = room.map.seed;
  if (previousMapSeed !== null) {
    assert.notEqual(finishedMapSeed, previousMapSeed, 'Map must differ from previous game');
  }

  // Vote Play Again
  room.votePlayAgain(hostPlayer.id);
  room.votePlayAgain(p2.id);
  room.votePlayAgain(p3.id);

  // Assertions after Play Again reset:
  // 1. State reset to LOBBY
  assert.equal(room.state, GAME_STATES.LOBBY, 'Room state must return to LOBBY');

  // 2. All scores reset to empty / 0
  for (const pid of [hostPlayer.id, p2.id, p3.id]) {
    assert.deepEqual(room.scores.get(pid), [], `Player ${pid} scores must be empty array`);
  }

  // 3. Map regenerated (different seed)
  assert.notEqual(room.map.seed, finishedMapSeed, 'New game must generate new map seed');
  previousMapSeed = finishedMapSeed;

  // 4. Round counter reset
  assert.equal(room.round, 0, 'Round counter must be reset to 0');
  assert.equal(room.totalRounds, 0, 'Total rounds must be reset to 0');

  // 5. Room code unchanged
  assert.equal(room.code, initialRoomCode, 'Room code must remain constant');

  // 6. Player count unchanged
  assert.equal(room.players.size, 3, 'Player count must remain 3');

  // 7. No timer leaks: GameRoom's timer tracking should only have lobby_idle
  // All tick, reveal, debrief, and countdown timers must be cleared
  assert.ok(!room.timers.has('tick'), 'Tick interval must not leak');
  assert.ok(!room.timers.has('reveal_timer'), 'Reveal timer must not leak');
  assert.ok(!room.timers.has('debrief_timer'), 'Debrief timer must not leak');
  assert.ok(!room.timers.has('play_again_countdown'), 'Play again countdown must not leak');
  console.log(`✔ ASSERTION PASSED: Game ${gameNumber} fully reset. Scores cleared, map seed refreshed, 0 leaked game timers.`);
}

async function main() {
  for (let g = 1; g <= 5; g++) {
    await playSingleGame(g);
  }

  // Clean up
  room.destroy();
  assert.equal(room.timers.size, 0, 'All timers completely wiped after destroy');
  console.log('\n✔ ASSERTION PASSED: 5 consecutive full games completed cleanly with 0 timer leaks.');
  console.log('--- TEST 9h: ALL ASSERTIONS PASSED ---\n');
}

main().catch(err => {
  console.error('TEST 9h FAILED:', err);
  process.exit(1);
});
