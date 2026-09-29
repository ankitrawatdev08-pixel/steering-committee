/**
 * STEERING COMMITTEE — Test: MapGenerator (9b)
 */

const assert = require('node:assert/strict');
const MapGenerator = require('../game/MapGenerator');

console.log('--- TEST 9b: MapGenerator Invariants & Performance ---');

const TOTAL_MAPS = 100;
const startBench = Date.now();
let maxSingleMapMs = 0;

for (let i = 0; i < TOTAL_MAPS; i++) {
  const seed = `map-audit-seed-${i}`;
  const t0 = Date.now();
  const mapData = MapGenerator.generate(seed);
  const durationMs = Date.now() - t0;
  if (durationMs > maxSingleMapMs) maxSingleMapMs = durationMs;

  // 1. Grid is 9x9
  assert.equal(mapData.grid.length, 9, `Map ${i}: grid rows must be 9`);
  for (let r = 0; r < 9; r++) {
    assert.equal(mapData.grid[r].length, 9, `Map ${i}: grid row ${r} cols must be 9`);
  }

  // 2. Car start (4,4) is not an obstacle
  assert.equal(mapData.grid[4][4], 0, `Map ${i}: center cell (4,4) must not be an obstacle`);

  // 3. Landmarks and Obstacles sets
  assert.equal(mapData.landmarks.length, 6, `Map ${i}: must have exactly 6 landmarks`);
  assert.ok(mapData.obstacles.length <= 8, `Map ${i}: obstacle count must be <= 8`);

  // 4. Landmarks not on obstacles
  for (const lm of mapData.landmarks) {
    assert.equal(mapData.grid[lm.row][lm.col], 0, `Map ${i}: landmark ${lm.id} is on an obstacle cell (${lm.row}, ${lm.col})`);
  }

  // 5. All non-obstacle cells connected (BFS from 4,4 reaches all)
  const reachableCount = Object.keys(mapData.distanceMatrix['4,4']).filter(
    key => mapData.distanceMatrix['4,4'][key] !== Infinity
  ).length;
  const nonObstacleCount = 81 - mapData.obstacles.length;
  assert.equal(
    reachableCount,
    nonObstacleCount,
    `Map ${i}: Disconnected cells detected! Reachable: ${reachableCount}, Non-obstacles: ${nonObstacleCount}`
  );

  // 6. Exactly 6 landmarks, one per 60-degree sector (0 to 5)
  const coveredSectors = new Set(mapData.landmarks.map(lm => lm.sector));
  assert.equal(coveredSectors.size, 6, `Map ${i}: Not all 6 sectors covered. Covered: ${Array.from(coveredSectors).sort()}`);

  // 7. Distance from center is 5 (or 4-6 if relaxed)
  for (const lm of mapData.landmarks) {
    const d = mapData.distanceMatrix['4,4'][`${lm.row},${lm.col}`];
    assert.ok(
      d >= 4 && d <= 6,
      `Map ${i}: Landmark ${lm.id} BFS distance from center (${d}) out of bounds [4, 6]`
    );
  }

  // 8. All 15 landmark pairs have BFS distance >= 3
  for (let a = 0; a < mapData.landmarks.length; a++) {
    for (let b = a + 1; b < mapData.landmarks.length; b++) {
      const lmA = mapData.landmarks[a];
      const lmB = mapData.landmarks[b];
      const pairDist = mapData.distanceMatrix[`${lmA.row},${lmA.col}`][`${lmB.row},${lmB.col}`];
      assert.ok(
        pairDist >= 3,
        `Map ${i}: Pairwise distance violation between ${lmA.id} and ${lmB.id}: distance is ${pairDist} (< 3)`
      );
    }
  }

  // 9. Performance constraint: each map must be generated in < 200ms
  assert.ok(
    durationMs < 200,
    `Map ${i} took ${durationMs}ms which exceeds the 200ms threshold`
  );
}

const totalBenchMs = Date.now() - startBench;
console.log(`✔ ASSERTION PASSED: 100 maps generated. All 9 structural & connectivity invariants verified.`);
console.log(`✔ ASSERTION PASSED: Benchmark: Total 100 maps = ${totalBenchMs}ms, Max single map = ${maxSingleMapMs}ms (< 200ms threshold).`);

// 10. Same seed -> identical map (deep equality)
const fixedSeed = 'boardroom-deterministic-test-seed';
const mapRepA = MapGenerator.generate(fixedSeed);
const mapRepB = MapGenerator.generate(fixedSeed);

assert.deepEqual(mapRepA.grid, mapRepB.grid, 'Grids must match identically');
assert.deepEqual(mapRepA.landmarks, mapRepB.landmarks, 'Landmarks must match identically');
assert.deepEqual(mapRepA.obstacles, mapRepB.obstacles, 'Obstacles must match identically');
assert.deepEqual(mapRepA.distanceMatrix, mapRepB.distanceMatrix, 'Distance matrices must match identically');
console.log('✔ ASSERTION PASSED: Determinism verified. Identical seeds produce bitwise-identical map structures.');

console.log('--- TEST 9b: ALL ASSERTIONS PASSED ---\n');
