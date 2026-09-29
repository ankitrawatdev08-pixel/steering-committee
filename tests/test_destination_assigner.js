/**
 * STEERING COMMITTEE — Test: DestinationAssigner (9c)
 */

const assert = require('node:assert/strict');
const DestinationAssigner = require('../game/DestinationAssigner');

console.log('--- TEST 9c: DestinationAssigner Invariants ---');

const dummyLandmarks = [
  { id: 'landmark_0' },
  { id: 'landmark_1' },
  { id: 'landmark_2' },
  { id: 'landmark_3' },
  { id: 'landmark_4' },
  { id: 'landmark_5' }
];

for (let N = 3; N <= 8; N++) {
  const playerIds = Array.from({ length: N }, (_, i) => `player_${i + 1}`);
  const expectedCap = N <= 3 ? 1 : Math.floor(N / 2);

  for (let trial = 0; trial < 1000; trial++) {
    const seed = `dest-trial-N${N}-trial${trial}`;
    const assignments = DestinationAssigner.assignDestinations(seed, playerIds, dummyLandmarks);

    // 1. Each player gets exactly 1 destination
    assert.equal(assignments.size, N, `N=${N}, trial=${trial}: Assignments count must equal ${N}`);
    for (const pid of playerIds) {
      assert.ok(assignments.has(pid), `N=${N}: Missing assignment for ${pid}`);
      assert.ok(assignments.get(pid), `N=${N}: Invalid landmark assigned to ${pid}`);
    }

    // 2. Count occurrences of each landmark
    const counts = new Map();
    for (const lmid of assignments.values()) {
      counts.set(lmid, (counts.get(lmid) || 0) + 1);
    }

    // 3. No landmark assigned to more than cap
    for (const [lmid, count] of counts.entries()) {
      assert.ok(
        count <= expectedCap,
        `N=${N}, trial=${trial}: Landmark ${lmid} assigned ${count} times (cap=${expectedCap})`
      );
    }

    // 4. At least 2 distinct destinations per round
    assert.ok(
      counts.size >= 2,
      `N=${N}, trial=${trial}: Less than 2 distinct destinations assigned (${counts.size})`
    );

    // 5. N <= 3 -> all destinations distinct
    if (N <= 3) {
      assert.equal(
        counts.size,
        N,
        `N=${N}, trial=${trial}: Not all destinations distinct (unique=${counts.size}, N=${N})`
      );
    }
  }

  console.log(`✔ ASSERTION PASSED: N=${N} (1000 trials). Each player has 1 dest, max cap=${expectedCap} respected, >=2 distinct destinations.`);
}

// 6. Same seed -> identical assignment
const fixedSeed = 'boardroom-dest-deterministic-seed';
const pList = ['p1', 'p2', 'p3', 'p4', 'p5'];
const assignA = DestinationAssigner.assignDestinations(fixedSeed, pList, dummyLandmarks);
const assignB = DestinationAssigner.assignDestinations(fixedSeed, pList, dummyLandmarks);

assert.deepEqual(Array.from(assignA.entries()), Array.from(assignB.entries()), 'Identical seeds must produce identical assignments');
console.log('✔ ASSERTION PASSED: Deterministic assignment verified across identical seeds.');

console.log('--- TEST 9c: ALL ASSERTIONS PASSED ---\n');
