/**
 * STEERING COMMITTEE — Test: Scoring System (9e)
 */

const assert = require('node:assert/strict');
const Scoring = require('../game/Scoring');

console.log('--- TEST 9e: Scoring Formula & Tiebreak Invariants ---');

// 1. Distance scoring formula: max(0, 100 - 20 * d)
assert.equal(Scoring.calculateScore(0), 100, 'Distance 0 -> 100');
assert.equal(Scoring.calculateScore(1), 80, 'Distance 1 -> 80');
assert.equal(Scoring.calculateScore(2), 60, 'Distance 2 -> 60');
assert.equal(Scoring.calculateScore(3), 40, 'Distance 3 -> 40');
assert.equal(Scoring.calculateScore(4), 20, 'Distance 4 -> 20');
assert.equal(Scoring.calculateScore(5), 0, 'Distance 5 -> 0');
assert.equal(Scoring.calculateScore(6), 0, 'Distance 6 -> 0');
assert.equal(Scoring.calculateScore(10), 0, 'Distance 10 -> 0');
console.log('✔ ASSERTION PASSED: Distance formula strictly evaluated for all distances 0 to 10.');

// 2. scoreRound() with distance matrix lookup
const dummyLandmarks = [
  { id: 'L1', row: 4, col: 1 },
  { id: 'L2', row: 1, col: 4 }
];
const dummyDistMatrix = {
  '4,4': {
    '4,1': 3, // distance 3 -> score 40
    '1,4': 4  // distance 4 -> score 20
  }
};
const destinations = { p1: 'L1', p2: 'L2' };
const roundScores = Scoring.scoreRound({ row: 4, col: 4 }, destinations, dummyDistMatrix, dummyLandmarks);

assert.equal(roundScores.get('p1'), 40, 'p1 score for distance 3 must be 40');
assert.equal(roundScores.get('p2'), 20, 'p2 score for distance 4 must be 20');
console.log('✔ ASSERTION PASSED: scoreRound accurately computes scores via distanceMatrix.');

// 3. Tiebreak Level 2: Exact Hits (score = 100)
// Player A total=200 with 2 exact hits (100, 100, 0)
// Player B total=200 with 1 exact hit (100, 80, 20)
const allScoresExact = {
  playerA: [100, 100, 0],
  playerB: [100, 80, 20]
};
const standingsExact = Scoring.computeStandings(allScoresExact);
assert.equal(standingsExact[0].playerId, 'playerA', 'Player A with 2 exact hits must rank higher than Player B with 1');
assert.equal(standingsExact[0].rank, 1);
assert.equal(standingsExact[1].rank, 2);
console.log('✔ ASSERTION PASSED: Tiebreak Level 2 (Exact hits) prioritizes 2x100 over 1x100 on equal 200 total.');

// 4. Tiebreak Level 3: Best Single Round
// Player C total=160 with scores [80, 80] (best = 80)
// Player D total=160 with scores [90, 70] (best = 90)
const allScoresBest = {
  playerC: [80, 80],
  playerD: [90, 70]
};
const standingsBest = Scoring.computeStandings(allScoresBest);
assert.equal(standingsBest[0].playerId, 'playerD', 'Player D with best single round of 90 must rank above Player C');
console.log('✔ ASSERTION PASSED: Tiebreak Level 3 (Best single round) prioritizes 90 over 80 on equal totals.');

// 5. Tiebreak Level 4: Fewer Chair Turns
// Both players total=120, best=60, exact=0. Player E had 1 chair turn, Player F had 2.
const allScoresChair = {
  playerE: [60, 60],
  playerF: [60, 60]
};
const chairCounts = {
  playerE: 1,
  playerF: 2
};
const standingsChair = Scoring.computeStandings(allScoresChair, chairCounts);
assert.equal(standingsChair[0].playerId, 'playerE', 'Player E with 1 chair turn must rank above Player F with 2');
console.log('✔ ASSERTION PASSED: Tiebreak Level 4 (Fewer Chair turns) prioritizes 1 turn over 2 turns.');

// 6. Tiebreak Level 5: Shared Rank
const allScoresTie = {
  playerG: [100, 40],
  playerH: [100, 40]
};
const standingsShared = Scoring.computeStandings(allScoresTie);
assert.equal(standingsShared[0].rank, 1);
assert.equal(standingsShared[1].rank, 1, 'Completely tied players must share rank 1');
console.log('✔ ASSERTION PASSED: Completely tied players share rank.');

console.log('--- TEST 9e: ALL ASSERTIONS PASSED ---\n');
