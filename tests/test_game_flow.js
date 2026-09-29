/**
 * STEERING COMMITTEE — Test: Real Socket Game Flow Integration (9g)
 */

const assert = require('node:assert/strict');
const http = require('node:http');
const ioClient = require('socket.io-client');
const { server, roomManager } = require('../server');
const { GAME_STATES } = require('../game/constants');

console.log('--- TEST 9g: End-to-End Socket.io Game Flow Integration ---');

const TEST_PORT = 5055;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;

function createClientSocket() {
  return ioClient(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true
  });
}

function waitForEvent(socket, eventName, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event "${eventName}" on socket ${socket.id}`));
    }, timeoutMs);

    socket.once(eventName, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

async function runGameFlowTest() {
  await new Promise((resolve) => {
    server.listen(TEST_PORT, '127.0.0.1', resolve);
  });

  const client1 = createClientSocket();
  const client2 = createClientSocket();
  const client3 = createClientSocket();

  try {
    // Connect all 3 clients
    await Promise.all([
      waitForEvent(client1, 'connected'),
      waitForEvent(client2, 'connected'),
      waitForEvent(client3, 'connected')
    ]);
    console.log('✔ Connected 3 real Socket.io clients.');

    // 1. Create room with accelerated test timings
    const fastTimings = {
      FIRST_REVEAL_DURATION: 150,
      REVEAL_DURATION: 100,
      TICK_INTERVAL: 80,
      DEBRIEF_DURATION: 200
    };

    let roomCode = null;
    let p1Id = null;

    const createPromise = waitForEvent(client1, 'room-created');
    client1.emit('create-room', { playerName: 'Alice (Chair)', timings: fastTimings });
    const createData = await createPromise;

    roomCode = createData.roomCode;
    p1Id = createData.playerId;
    assert.equal(roomCode.length, 4);
    assert.equal(createData.players.length, 1);
    console.log(`✔ ASSERTION PASSED: Room created (${roomCode}).`);

    // 2. Join players 2 and 3
    const join2Promise = waitForEvent(client2, 'room-joined');
    client2.emit('join-room', { roomCode, playerName: 'Bob' });
    const join2Data = await join2Promise;
    const p2Id = join2Data.playerId;

    const join3Promise = waitForEvent(client3, 'room-joined');
    client3.emit('join-room', { roomCode, playerName: 'Charlie' });
    const join3Data = await join3Promise;
    const p3Id = join3Data.playerId;

    const room = roomManager.getRoom(roomCode);
    assert.equal(room.players.size, 3);
    console.log(`✔ ASSERTION PASSED: 3 human players joined room ${roomCode}.`);

    // 3. Start game
    const p1StartedPromise = waitForEvent(client1, 'game-started');
    const p1RevealPromise = waitForEvent(client1, 'round-reveal');
    const p2RevealPromise = waitForEvent(client2, 'round-reveal');
    const p3RevealPromise = waitForEvent(client3, 'round-reveal');

    client1.emit('start-game');

    const startedData = await p1StartedPromise;
    assert.equal(startedData.round, 0);
    assert.equal(startedData.totalRounds, 6); // N=3 -> 3 * ceil(4/3) = 6
    assert.ok(startedData.map.landmarks.length === 6);
    assert.equal(room.state, GAME_STATES.REVEAL);
    console.log(`✔ ASSERTION PASSED: Game started, round 0 (PRACTICE) of ${startedData.totalRounds}, state = REVEAL.`);

    const [reveal1, reveal2, reveal3] = await Promise.all([
      p1RevealPromise,
      p2RevealPromise,
      p3RevealPromise
    ]);

    assert.ok(reveal1.destination, 'Player 1 received private destination');
    assert.ok(reveal2.destination, 'Player 2 received private destination');
    assert.ok(reveal3.destination, 'Player 3 received private destination');
    assert.equal(reveal1.round, 0);
    assert.equal(reveal1.gavels, 0);
    console.log('✔ ASSERTION PASSED: Private round-reveal received by all 3 players (Round 0 Practice).');

    // 4. Wait for reveal timer to finish and transition to STEERING
    await new Promise(r => setTimeout(r, 200));
    assert.equal(room.state, GAME_STATES.STEERING);
    console.log('✔ ASSERTION PASSED: Room transitioned to STEERING phase.');

    // 5. Submit votes: p1 and p2 vote in a clear road direction, p3 votes different
    const deltas = { UP: [-1, 0], DOWN: [1, 0], LEFT: [0, -1], RIGHT: [0, 1] };
    const clearDir = ['UP', 'DOWN', 'LEFT', 'RIGHT'].find(d => {
      const [dr, dc] = deltas[d];
      return room.map.grid[4 + dr][4 + dc] === 0;
    }) || 'UP';
    const otherDir = clearDir === 'UP' ? 'DOWN' : 'UP';

    client1.emit('vote', { direction: clearDir });
    client2.emit('vote', { direction: clearDir });
    client3.emit('vote', { direction: otherDir });

    // Wait for first tick-update
    const tickData1 = await waitForEvent(client1, 'tick-update');
    assert.equal(tickData1.tick, 1);
    assert.equal(tickData1.result, 'MOVE');
    assert.equal(tickData1.winningDirection, clearDir);
    assert.equal(tickData1.votes[p1Id], clearDir);
    assert.equal(tickData1.votes[p2Id], clearDir);
    assert.equal(tickData1.votes[p3Id], otherDir);
    assert.equal(tickData1.heading, clearDir);
    console.log(`✔ ASSERTION PASSED: Tick 1 resolved plurality (MOVE ${clearDir}), votes broadcast correctly.`);

    // 6. Play through Round 0 (5 fuel ticks to round exhaustion)
    const debriefPromise = waitForEvent(client1, 'round-debrief');
    while (true) {
      const update = await waitForEvent(client1, 'tick-update');
      if (update.tick === 5) {
        assert.equal(update.roundEnds, true);
        break;
      }
    }

    // 7. Debrief verification for Round 0 Practice
    const debriefData = await debriefPromise;
    assert.equal(debriefData.round, 0);
    assert.ok(debriefData.destinations[p1Id], 'Debrief contains p1 destination');
    assert.ok(typeof debriefData.scores[p1Id] === 'number', 'Scores computed for p1');
    assert.ok(typeof debriefData.scores[p2Id] === 'number', 'Scores computed for p2');
    assert.ok(typeof debriefData.scores[p3Id] === 'number', 'Scores computed for p3');
    assert.equal(room.state, GAME_STATES.DEBRIEF);
    console.log(`✔ ASSERTION PASSED: Round 0 PRACTICE DEBRIEF received.`);

    // 8. Ready skip mechanic in Debrief -> advances to Round 1
    const round1RevealPromise = waitForEvent(client1, 'round-reveal');
    client1.emit('ready');
    client2.emit('ready');
    client3.emit('ready');

    const round1Data = await round1RevealPromise;
    assert.equal(round1Data.round, 1);
    console.log('✔ ASSERTION PASSED: All players tapped ready -> immediately advanced to Round 1.');

    // 9. Fast-forward through remaining rounds (rounds 1 through 6)
    for (let r = 1; r <= 6; r++) {
      // Wait for steering
      await new Promise(res => setTimeout(res, 120));

      // Fast park by setting fuel to 1 or letting PARK resolve
      room.fuel = 1;
      client1.emit('vote', { direction: 'DOWN' });
      client2.emit('vote', { direction: 'DOWN' });

      const dPromise = waitForEvent(client1, 'round-debrief');
      await dPromise;

      if (r < 6) {
        const nextReveal = waitForEvent(client1, 'round-reveal');
        client1.emit('ready');
        client2.emit('ready');
        client3.emit('ready');
        await nextReveal;
      } else {
        // Round 6 is the final round -> expect game-over!
        const gameOverPromise = waitForEvent(client1, 'game-over');
        client1.emit('ready');
        client2.emit('ready');
        client3.emit('ready');
        const gameOverData = await gameOverPromise;

        assert.equal(room.state, GAME_STATES.GAME_OVER);
        assert.equal(gameOverData.standings.length, 3);
        assert.ok(gameOverData.standings[0].rank === 1);
        console.log(`✔ ASSERTION PASSED: All 6 rounds completed. GAME_OVER received. Winner: ${gameOverData.standings[0].name} (Score: ${gameOverData.standings[0].totalScore}).`);
      }
    }

    console.log('✔ ASSERTION PASSED: Full game lifecycle verified with 3 real socket connections.');
  } finally {
    client1.disconnect();
    client2.disconnect();
    client3.disconnect();
    server.close();
  }

  console.log('--- TEST 9g: ALL ASSERTIONS PASSED ---\n');
}

runGameFlowTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error('TEST 9g FAILED:', err);
    process.exit(1);
  });
