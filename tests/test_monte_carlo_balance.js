/**
 * STEERING COMMITTEE — Test: Monte Carlo Balance Test (9i)
 * 10,000 seeded rounds per N from 3 to 8 across 4 strategy profiles.
 * Asserts:
 * 1. For each N, MEAN chairAdvantage across all 4 profiles <= 20
 * 2. No single profile has chairAdvantage > 60 for any N
 * 3. allDeadlockRate (rounds where car moves <= 3 times) < 30% in MIXED profile
 * 4. Prints full summary table: N, profile, avgChairScore, avgNonChairScore, chairAdvantage, deadlockRate
 */

const assert = require('node:assert/strict');
const MapGenerator = require('../game/MapGenerator');
const DestinationAssigner = require('../game/DestinationAssigner');
const TickResolver = require('../game/TickResolver');
const Scoring = require('../game/Scoring');
const SeededRNG = require('../game/SeededRNG');

console.log('--- TEST 9i: Monte Carlo Game Balance Audit (10,000 rounds per N) ---');

// Pre-generate pool of 100 verified maps
console.log('Generating map pool for Monte Carlo trials...');
const MAP_POOL_SIZE = 100;
const mapPool = [];
for (let i = 0; i < MAP_POOL_SIZE; i++) {
  mapPool.push(MapGenerator.generate(`mc_pool_${i}`));
}
console.log(`Map pool ready (${mapPool.length} distinct boards).\n`);

const PROFILES = ['ALL_SELFISH', 'COORDINATING_PAIR', 'OPTIMAL_CHAIR', 'MIXED'];
const ROUNDS_PER_PROFILE = 2500; // 2,500 * 4 = 10,000 rounds per N
const summaryRows = [];
const meanAdvantageByN = {};

function getBestDir(car, dest, map) {
  const deltas = [
    ['UP', -1, 0],
    ['DOWN', 1, 0],
    ['LEFT', 0, -1],
    ['RIGHT', 0, 1]
  ];
  let bestD = Infinity;
  let bestDir = 'UP';

  for (const [dir, dr, dc] of deltas) {
    const nr = car.row + dr;
    const nc = car.col + dc;
    if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9 && map.grid[nr][nc] === 0) {
      const dist = map.distanceMatrix[`${nr},${nc}`][`${dest.row},${dest.col}`];
      if (dist < bestD) {
        bestD = dist;
        bestDir = dir;
      }
    }
  }

  return bestDir;
}

for (let N = 3; N <= 8; N++) {
  const playerIds = Array.from({ length: N }, (_, i) => `p${i}`);
  const chairId = 'p0';
  let totalAdvantageForN = 0;

  for (const profile of PROFILES) {
    let totalChairScore = 0;
    let totalNonChairScore = 0;
    let nonChairCount = 0;
    let deadlockRounds = 0;

    for (let r = 0; r < ROUNDS_PER_PROFILE; r++) {
      const map = mapPool[r % MAP_POOL_SIZE];
      const roundSeed = `mc_seed_N${N}_prof_${profile}_r_${r}`;
      const rng = new SeededRNG(roundSeed);

      // Assign destinations
      const destinationsMap = DestinationAssigner.assignDestinations(
        roundSeed + '_dest',
        playerIds,
        map.landmarks
      );

      const destLookup = {};
      for (const pid of playerIds) {
        const lmid = destinationsMap.get(pid);
        destLookup[pid] = map.landmarks.find(l => l.id === lmid);
      }

      // Identifying coordinating pair if profile is COORDINATING_PAIR
      let pairA = playerIds[0];
      let pairB = playerIds[1];
      if (profile === 'COORDINATING_PAIR') {
        let minPairDist = Infinity;
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            const dA = destLookup[playerIds[i]];
            const dB = destLookup[playerIds[j]];
            const pairDist = map.distanceMatrix[`${dA.row},${dA.col}`][`${dB.row},${dB.col}`];
            if (pairDist < minPairDist) {
              minPairDist = pairDist;
              pairA = playerIds[i];
              pairB = playerIds[j];
            }
          }
        }
      }

      let state = {
        tick: 1,
        carPos: { row: 4, col: 4, x: 4, y: 4 },
        heading: null,
        inertiaEarned: false,
        fuel: 20,
        gavels: 3,
        obstacles: map.obstacles,
        mapSize: 9
      };

      let moves = 0;

      while (!state.roundEnds) {
        const votes = {};

        if (profile === 'ALL_SELFISH') {
          for (const pid of playerIds) {
            const dest = destLookup[pid];
            if (state.tick > 5 && state.carPos.row === dest.row && state.carPos.col === dest.col) {
              votes[pid] = 'PARK';
            } else {
              votes[pid] = getBestDir(state.carPos, dest, map);
            }
          }
        } else if (profile === 'COORDINATING_PAIR') {
          const destA = destLookup[pairA];
          const destB = destLookup[pairB];
          const distA = map.distanceMatrix[`${state.carPos.row},${state.carPos.col}`][`${destA.row},${destA.col}`];
          const target = distA > 0 ? destA : destB;
          const coopDir = getBestDir(state.carPos, target, map);

          for (const pid of playerIds) {
            if (pid === pairA || pid === pairB) {
              if (state.tick > 5 && state.carPos.row === target.row && state.carPos.col === target.col) {
                votes[pid] = 'PARK';
              } else {
                votes[pid] = coopDir;
              }
            } else {
              const dest = destLookup[pid];
              votes[pid] = getBestDir(state.carPos, dest, map);
            }
          }
        } else if (profile === 'OPTIMAL_CHAIR') {
          for (const pid of playerIds) {
            if (pid === chairId) {
              if (state.tick <= 3) {
                votes[pid] = getBestDir(state.carPos, destLookup[pid], map);
              } else {
                // Join plurality of other non-chair votes
                const nonChairTallies = { UP: 0, DOWN: 0, LEFT: 0, RIGHT: 0 };
                for (const other of playerIds) {
                  if (other !== chairId) {
                    const d = getBestDir(state.carPos, destLookup[other], map);
                    nonChairTallies[d]++;
                  }
                }
                let topD = 'UP';
                let topCount = -1;
                for (const [dir, c] of Object.entries(nonChairTallies)) {
                  if (c > topCount) {
                    topCount = c;
                    topD = dir;
                  }
                }
                votes[pid] = topD;
              }
            } else {
              votes[pid] = getBestDir(state.carPos, destLookup[pid], map);
            }
          }
        } else if (profile === 'MIXED') {
          for (const pid of playerIds) {
            const roll = rng.next();
            if (roll < 0.5) {
              // 50% Selfish
              const dest = destLookup[pid];
              if (state.tick > 5 && state.carPos.row === dest.row && state.carPos.col === dest.col) {
                votes[pid] = 'PARK';
              } else {
                votes[pid] = getBestDir(state.carPos, dest, map);
              }
            } else if (roll < 0.75) {
              // 25% Cooperative with nearest
              let nearestDest = destLookup[pid];
              let nearestDist = Infinity;
              for (const other of playerIds) {
                if (other !== pid) {
                  const od = destLookup[other];
                  const dist = map.distanceMatrix[`${state.carPos.row},${state.carPos.col}`][`${od.row},${od.col}`];
                  if (dist < nearestDist) {
                    nearestDist = dist;
                    nearestDest = od;
                  }
                }
              }
              votes[pid] = getBestDir(state.carPos, nearestDest, map);
            } else {
              // 25% Random
              const dirs = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
              votes[pid] = dirs[rng.nextInt(0, 3)];
            }
          }
        }

        const { newState, result } = TickResolver.resolveTick(state, votes, chairId);
        if (result.type === 'MOVE') {
          moves++;
        }
        state = newState;
      }

      if (moves <= 3) {
        deadlockRounds++;
      }

      // Compute round scores
      const scores = Scoring.scoreRound(state.carPos, destinationsMap, map.distanceMatrix, map.landmarks);
      for (const [pid, score] of scores.entries()) {
        if (pid === chairId) {
          totalChairScore += score;
        } else {
          totalNonChairScore += score;
          nonChairCount++;
        }
      }
    }

    const avgChair = totalChairScore / ROUNDS_PER_PROFILE;
    const avgNonChair = totalNonChairScore / nonChairCount;
    const chairAdvantage = avgChair - avgNonChair;
    const deadlockRate = (deadlockRounds / ROUNDS_PER_PROFILE) * 100;

    totalAdvantageForN += chairAdvantage;

    summaryRows.push({
      N,
      profile,
      avgChairScore: avgChair.toFixed(2),
      avgNonChairScore: avgNonChair.toFixed(2),
      chairAdvantage: chairAdvantage.toFixed(2),
      deadlockRate: `${deadlockRate.toFixed(2)}%`
    });

    // Invariant 2: No single profile has chairAdvantage > 60 for any N
    assert.ok(
      chairAdvantage <= 60,
      `N=${N}, profile=${profile}: chairAdvantage ${chairAdvantage.toFixed(2)} exceeded ceiling of 60`
    );

    // Invariant 3: allDeadlockRate < 30% in MIXED profile
    if (profile === 'MIXED') {
      assert.ok(
        deadlockRate < 30,
        `N=${N}, MIXED profile deadlockRate ${deadlockRate.toFixed(2)}% exceeded threshold of 30%`
      );
    }
  }

  const meanAdvantage = totalAdvantageForN / PROFILES.length;
  meanAdvantageByN[N] = meanAdvantage;

  // Invariant 1: For each N, MEAN chairAdvantage across all 4 profiles <= 20
  assert.ok(
    meanAdvantage <= 20,
    `N=${N}: Mean chairAdvantage ${meanAdvantage.toFixed(2)} across 4 profiles exceeded threshold of 20`
  );
}

// Print full summary table
console.log('========================================================================================');
console.log('                         MONTE CARLO BALANCE SUMMARY TABLE                              ');
console.log('========================================================================================');
console.table(summaryRows);
console.log('========================================================================================\n');

console.log('Mean Chairperson Advantage across all 4 profiles by N:');
for (let N = 3; N <= 8; N++) {
  console.log(`  N = ${N}: Mean Advantage = ${meanAdvantageByN[N].toFixed(2)} pts (Threshold: <= 20.0 pts)`);
}

console.log('\n✔ ASSERTION PASSED: All 6 player counts (N=3..8) satisfy mean chairAdvantage <= 20.');
console.log('✔ ASSERTION PASSED: No single profile exceeds chairAdvantage of 60.');
console.log('✔ ASSERTION PASSED: MIXED profile deadlock rate strictly below 30% for all N.');
console.log('--- TEST 9i: ALL ASSERTIONS PASSED ---\n');
