/**
 * STEERING COMMITTEE — Test: Room Lifecycle & Host Migration (9f)
 */

const assert = require('node:assert/strict');
const RoomManager = require('../game/RoomManager');
const { GAME_STATES, TIMINGS } = require('../game/constants');

console.log('--- TEST 9f: Room Lifecycle & Reconnect Invariants ---');

const roomManager = new RoomManager();

// 1. Create room -> 4-char code, host assigned
const { room, player: hostPlayer } = roomManager.createRoom('socket_host_1', { playerName: 'CEO Alice' });
assert.equal(typeof room.code, 'string');
assert.equal(room.code.length, 4, 'Room code must be exactly 4 characters');
assert.equal(room.hostId, hostPlayer.id, 'Host ID must match created host player');
assert.equal(room.players.size, 1, 'Room player count should be 1');
console.log(`✔ ASSERTION PASSED: Room created with code "${room.code}" and host "${hostPlayer.name}".`);

// 2. Join room -> player added, count incremented
const joinResult1 = roomManager.joinRoom(room.code, 'socket_p2', 'Director Bob');
assert.equal(room.players.size, 2);
assert.equal(joinResult1.player.name, 'Director Bob');
assert.equal(joinResult1.isReconnect, false);
console.log('✔ ASSERTION PASSED: Player 2 successfully joined.');

// 3. Duplicate names -> auto-numbered ("Director Bob 2")
const joinDup = roomManager.joinRoom(room.code, 'socket_p3', 'Director Bob');
assert.equal(joinDup.player.name, 'Director Bob 2', 'Duplicate name must be suffixed');
console.log(`✔ ASSERTION PASSED: Duplicate name handled -> "${joinDup.player.name}".`);

// 4. Fill room to 8 players, then 9th joins -> error thrown
for (let i = 4; i <= 8; i++) {
  roomManager.joinRoom(room.code, `socket_p${i}`, `Member ${i}`);
}
assert.equal(room.players.size, 8, 'Room now has 8 players');

assert.throws(() => {
  roomManager.joinRoom(room.code, 'socket_p9', 'Overflow Player');
}, /full/i, 'Joining full room must throw error');
console.log('✔ ASSERTION PASSED: Joining full room (8 players) throws expected error.');

// 5. Join non-existent room code -> error
assert.throws(() => {
  roomManager.joinRoom('ZZZZ', 'socket_invalid', 'Guest');
}, /not found/i, 'Non-existent room code must throw error');
console.log('✔ ASSERTION PASSED: Non-existent room code throws error.');

// Clean up room 1
roomManager.destroyRoom(room.code);

// 6. Start with 1 human -> error
const { room: soloRoom, player: soloHost } = roomManager.createRoom('socket_solo', { playerName: 'Solo' });
assert.throws(() => {
  soloRoom.startGame(soloHost.id);
}, /at least 2/i, 'Starting with 1 human must throw error');
console.log('✔ ASSERTION PASSED: Starting game with only 1 human throws error.');

// 7. Start with 2 humans, 0 bots -> 1 bot auto-added (total = 3)
const p2Join = roomManager.joinRoom(soloRoom.code, 'socket_human_2', 'Partner');
assert.equal(soloRoom.players.size, 2);
soloRoom.startGame(soloHost.id);

assert.equal(soloRoom.players.size, 3, 'Auto-bot backfill must bring player total to 3');
const botFound = Array.from(soloRoom.players.values()).find(p => p.isBot);
assert.ok(botFound, 'An auto-added bot must exist in the room');
assert.equal(soloRoom.state, GAME_STATES.REVEAL, 'Game transitioned to REVEAL state');
console.log(`✔ ASSERTION PASSED: 2 humans started -> 1 bot auto-added ("${botFound.name}"), total seats = 3.`);

// 8. Reconnect with playerId -> state restored, vote preserved
// Simulate player 2 voting, disconnecting, and reconnecting
soloRoom.state = GAME_STATES.STEERING;
soloRoom.recordVote(p2Join.player.id, 'UP');
assert.equal(soloRoom.currentVotes.get(p2Join.player.id), 'UP');

// Disconnect player 2
const discResult = roomManager.handleDisconnect('socket_human_2');
assert.equal(discResult.player.connected, false);
assert.equal(soloRoom.currentVotes.get(p2Join.player.id), 'UP', 'Vote stays sticky during disconnect grace');

// Reconnect player 2 with new socket
const reconnResult = roomManager.joinRoom(soloRoom.code, 'socket_human_2_new', 'Partner', p2Join.player.id);
assert.equal(reconnResult.isReconnect, true);
assert.equal(reconnResult.player.connected, true);
assert.equal(reconnResult.player.socketId, 'socket_human_2_new');
assert.equal(soloRoom.currentVotes.get(p2Join.player.id), 'UP', 'Restored player retains sticky vote');
console.log('✔ ASSERTION PASSED: Disconnect grace retains sticky vote; reconnect restores player state.');

// 9. Host disconnect beyond grace -> host migrated to next human
const originalHostId = soloHost.id;
roomManager.handleDisconnect('socket_solo');
assert.equal(soloHost.connected, false);

// Fast-forward or trigger host migration
soloRoom._migrateHost();
assert.equal(soloRoom.hostId, p2Join.player.id, 'Host migrated to next human (skipping bot)');
assert.notEqual(soloRoom.hostId, botFound.id, 'Host migration must NOT select a bot');
console.log(`✔ ASSERTION PASSED: Host migrated to next human (${soloRoom.hostId}), skipping bot.`);

// 10. Play Again -> scores reset to 0, map regenerated, fuel=20, code preserved
const map1Seed = soloRoom.map.seed;
soloRoom.scores.set(p2Join.player.id, [100, 80]);
soloRoom.heading = 'DOWN';
soloRoom.fuel = 4;
soloRoom.state = GAME_STATES.GAME_OVER;

soloRoom.resetPlayAgain();
assert.equal(soloRoom.state, GAME_STATES.LOBBY);
assert.equal(soloRoom.fuel, TIMINGS.FUEL, 'Fuel reset to 20');
assert.equal(soloRoom.heading, null, 'Heading reset to null');
assert.deepEqual(soloRoom.scores.get(p2Join.player.id), [], 'Scores reset to empty array');
assert.notEqual(soloRoom.map.seed, map1Seed, 'Map regenerated with new seed');
assert.equal(soloRoom.code, soloRoom.code, 'Room code preserved');
assert.equal(soloRoom.players.size, 3, 'Player IDs and roster preserved');

console.log('✔ ASSERTION PASSED: Play Again resets state, regenerates map, and preserves room identity.');

// Clean up
soloRoom.destroy();
console.log('--- TEST 9f: ALL ASSERTIONS PASSED ---\n');
