const test = require('node:test');
const assert = require('node:assert/strict');
const SeededRNG = require('../game/SeededRNG');

test('SeededRNG: same seed produces identical sequence across 100 calls', () => {
  const seed = 'boardroom-agenda-2026';
  const rng1 = new SeededRNG(seed);
  const rng2 = new SeededRNG(seed);

  const seq1 = [];
  const seq2 = [];

  for (let i = 0; i < 100; i++) {
    seq1.push(rng1.next());
    seq2.push(rng2.next());
  }

  assert.equal(seq1.length, 100);
  assert.equal(seq2.length, 100);
  for (let i = 0; i < 100; i++) {
    assert.equal(seq1[i], seq2[i], `Mismatch at index ${i}: ${seq1[i]} !== ${seq2[i]}`);
    assert.ok(seq1[i] >= 0 && seq1[i] < 1, `Value out of bounds [0, 1): ${seq1[i]}`);
  }
});

test('SeededRNG: different seeds produce different sequences', () => {
  const rngA = new SeededRNG('seed-alpha');
  const rngB = new SeededRNG('seed-beta');

  let matches = 0;
  for (let i = 0; i < 100; i++) {
    if (rngA.next() === rngB.next()) {
      matches++;
    }
  }

  // With 32-bit float PRNG, 100 consecutive matches across distinct seeds is astronomically impossible
  assert.ok(matches < 5, `Too many coincidental matches between different seeds: ${matches}/100`);
});

test('SeededRNG: nextInt respects min and max bounds', () => {
  const rng = new SeededRNG('bounds-check');
  const min = -5;
  const max = 5;
  const seen = new Set();

  for (let i = 0; i < 1000; i++) {
    const val = rng.nextInt(min, max);
    assert.ok(Number.isInteger(val), `Value must be integer: ${val}`);
    assert.ok(val >= min && val <= max, `Value out of bounds [${min}, ${max}]: ${val}`);
    seen.add(val);
  }

  assert.equal(seen.size, max - min + 1, 'All integers in range should be covered');
});

test('SeededRNG: shuffle() is deterministic and preserves elements', () => {
  const seed = 'agenda-shuffle-seed';
  const rng1 = new SeededRNG(seed);
  const rng2 = new SeededRNG(seed);

  const original = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'PARK', 'GAVEL', 'VETO'];
  const shuffled1 = rng1.shuffle(original);
  const shuffled2 = rng2.shuffle(original);

  assert.deepEqual(shuffled1, shuffled2, 'Identical seeds must yield identical shuffles');
  assert.equal(shuffled1.length, original.length, 'Shuffled array must retain same length');
  assert.deepEqual(shuffled1.slice().sort(), original.slice().sort(), 'Shuffled array must contain same elements');
  // Original array should not be mutated
  assert.deepEqual(original, ['UP', 'DOWN', 'LEFT', 'RIGHT', 'PARK', 'GAVEL', 'VETO']);
});
