/**
 * STEERING COMMITTEE — Test: Timer Cleanup & Destroy Invariants (9j)
 */

const assert = require('node:assert/strict');
const RoomManager = require('../game/RoomManager');
const { GAME_STATES } = require('../game/constants');

console.log('--- TEST 9j: Strict Timer Cleanup & Destroy Invariants ---');

const roomManager = new RoomManager();

// Test Scenario 1: Create room, start game, play 2 rounds, then destroy room
{
  const { room, player: host } = roomManager.createRoom('socket_host_timer', { playerName: 'Host' });
  roomManager.joinRoom(room.code, 'socket_p2', 'Player 2');
  roomManager.joinRoom(room.code, 'socket_p3', 'Player 3');

  room.startGame(host.id);
  assert.equal(room.state, GAME_STATES.REVEAL);
  assert.ok(room.timers.size > 0, 'Timers must be active during game');

  // Fast forward through round 1
  room.clearTrackedTimer('reveal_timer');
  room._startSteering();
  assert.ok(room.timers.has('tick'), 'Tick timer active during STEERING');

  // End round 1
  room.clearTickTimers();
  room._startDebrief();
  assert.ok(room.timers.has('debrief_timer'), 'Debrief timer active');

  // Advance from round 0 practice round to round 1
  room._advanceFromDebrief();
  assert.equal(room.round, 1);
  assert.ok(room.timers.size > 0, 'Round 1 timers active');

  // Destroy room
  roomManager.destroyRoom(room.code);
  assert.equal(room.timers.size, 0, 'ALL timers must be completely empty after destroy');
  console.log('✔ ASSERTION PASSED: Room destroyed after 2 rounds -> room.timers.size is exactly 0.');
}

// Test Scenario 2: Create room, start game, play 1 round, then Play Again
{
  const { room, player: host } = roomManager.createRoom('socket_host_timer2', { playerName: 'Host 2' });
  roomManager.joinRoom(room.code, 'socket_p2_2', 'Member B');
  roomManager.joinRoom(room.code, 'socket_p3_2', 'Member C');

  room.startGame(host.id);

  // Play 1 round to completion
  room.clearTrackedTimer('reveal_timer');
  room._startSteering();
  assert.ok(room.timers.has('tick'));

  // Trigger round end
  room.clearTickTimers();
  room._startDebrief();

  // Fast forward debrief to game over (simulate 1 round game or end)
  room.state = GAME_STATES.GAME_OVER;
  room.setTrackedTimeout('game_over_idle', () => {}, 120000);
  assert.ok(room.timers.has('game_over_idle'));

  // Play Again
  room.resetPlayAgain();

  // ASSERT: All previous-game timers cleared before new game timers set
  assert.ok(!room.timers.has('tick'), 'Previous tick timer must be cleared');
  assert.ok(!room.timers.has('reveal_timer'), 'Previous reveal timer must be cleared');
  assert.ok(!room.timers.has('debrief_timer'), 'Previous debrief timer must be cleared');
  assert.ok(!room.timers.has('game_over_idle'), 'Previous game over idle timer must be cleared');
  assert.ok(room.timers.has('lobby_idle'), 'New lobby idle timer is set');
  assert.equal(room.timers.size, 1, 'Only the new lobby_idle timer exists');

  room.destroy();
  assert.equal(room.timers.size, 0);
  console.log('✔ ASSERTION PASSED: Play Again clears all previous game timers before new game begins.');
}

console.log('--- TEST 9j: ALL ASSERTIONS PASSED ---\n');
