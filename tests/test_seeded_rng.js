/**
 * STEERING COMMITTEE — Test: SeededRNG (9a)
 */

const assert = require('node:assert/strict');
const SeededRNG = require('../game/SeededRNG');

console.log('--- TEST 9a: SeededRNG Invariants ---');

// 1. Same seed -> same 1000-number sequence
const seed1 = 'boardroom-agenda-alpha';
const rng1 = new SeededRNG(seed1);
const rng2 = new SeededRNG(seed1);

const seq1 = [];
const seq2 = [];
for (let i = 0; i < 1000; i++) {
  seq1.push(rng1.next());
  seq2.push(rng2.next());
}

assert.equal(seq1.length, 1000, 'Sequence 1 must have 1000 elements');
assert.equal(seq2.length, 1000, 'Sequence 2 must have 1000 elements');
for (let i = 0; i < 1000; i++) {
  assert.equal(seq1[i], seq2[i], `Sequences diverged at index ${i}`);
}
console.log('✔ ASSERTION PASSED: Same seed produces identical 1000-number sequence.');

// 2. Different seeds -> different sequences
const rngA = new SeededRNG('seed-executive-A');
const rngB = new SeededRNG('seed-executive-B');
let matchCount = 0;
for (let i = 0; i < 1000; i++) {
  if (rngA.next() === rngB.next()) {
    matchCount++;
  }
}
assert.ok(matchCount < 5, `Different seeds produced too many identical values: ${matchCount}/1000`);
console.log(`✔ ASSERTION PASSED: Different seeds produce distinct sequences (matches: ${matchCount}/1000).`);

// 3. shuffle() deterministic and preserves elements
const shuffleSeed = 'agenda-shuffle-deterministic';
const rngS1 = new SeededRNG(shuffleSeed);
const rngS2 = new SeededRNG(shuffleSeed);
const testArray = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'PARK', 'GAVEL', 'VETO'];

const shuffled1 = rngS1.shuffle(testArray);
const shuffled2 = rngS2.shuffle(testArray);

assert.deepEqual(shuffled1, shuffled2, 'Identical seeds must produce identical shuffles');
assert.equal(shuffled1.length, testArray.length, 'Shuffled array length must match input');
assert.deepEqual(shuffled1.slice().sort(), testArray.slice().sort(), 'Shuffled array must contain identical elements');
assert.notDeepEqual(shuffled1, testArray, 'Shuffled array should differ from original ordering');
console.log(`✔ ASSERTION PASSED: Deterministic shuffle confirmed. Output: [${shuffled1.join(', ')}].`);

// 4. Distribution: 10,000 nextInt(0,9) calls, each bucket within 15% of expected (1,000 ± 150)
const distRNG = new SeededRNG('uniform-distribution-audit');
const buckets = new Array(10).fill(0);
const TOTAL_DRAWS = 10000;
const EXPECTED_PER_BUCKET = TOTAL_DRAWS / 10; // 1000
const TOLERANCE = 0.15; // 15%
const MIN_ALLOWED = EXPECTED_PER_BUCKET * (1 - TOLERANCE); // 850
const MAX_ALLOWED = EXPECTED_PER_BUCKET * (1 + TOLERANCE); // 1150

for (let i = 0; i < TOTAL_DRAWS; i++) {
  const num = distRNG.nextInt(0, 9);
  assert.ok(Number.isInteger(num), `Output must be integer, got: ${num}`);
  assert.ok(num >= 0 && num <= 9, `Output out of bounds [0, 9]: ${num}`);
  buckets[num]++;
}

console.log('Distribution buckets (expected 1000 ± 150):', buckets);
for (let b = 0; b < 10; b++) {
  const count = buckets[b];
  assert.ok(
    count >= MIN_ALLOWED && count <= MAX_ALLOWED,
    `Bucket ${b} count ${count} outside allowed [${MIN_ALLOWED}, ${MAX_ALLOWED}]`
  );
}
console.log(`✔ ASSERTION PASSED: All 10 buckets within 15% tolerance of expected 1000 (Range: ${Math.min(...buckets)} - ${Math.max(...buckets)}).`);

console.log('--- TEST 9a: ALL ASSERTIONS PASSED ---\n');
