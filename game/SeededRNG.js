/**
 * STEERING COMMITTEE — Seeded PRNG
 * Deterministic pseudorandom number generator using xoshiro128** with SplitMix32 seeding.
 * Used for map generation, secret destination assignment, and tie-breaks.
 * NOT for room codes (which use crypto.randomBytes).
 */

class SeededRNG {
  /**
   * @param {string|number} seed
   */
  constructor(seed = 'steering-committee-default-seed') {
    this.seedString = String(seed);
    this._init(this.seedString);
  }

  /**
   * Hashes string into 32-bit integer seed via FNV-1a variant
   * @private
   */
  _hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  /**
   * SplitMix32 generator to expand 32-bit seed into 4 state words
   * @private
   */
  _splitmix32(state) {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return [(z ^ (z >>> 16)) >>> 0, state];
  }

  /**
   * Initialize 4 32-bit state words for xoshiro128**
   * @private
   */
  _init(seedStr) {
    let smState = this._hashString(seedStr);
    let s0, s1, s2, s3;
    [s0, smState] = this._splitmix32(smState);
    [s1, smState] = this._splitmix32(smState);
    [s2, smState] = this._splitmix32(smState);
    [s3, smState] = this._splitmix32(smState);

    // Prevent all-zero state
    if (s0 === 0 && s1 === 0 && s2 === 0 && s3 === 0) {
      s0 = 1;
    }

    this.s0 = s0;
    this.s1 = s1;
    this.s2 = s2;
    this.s3 = s3;
  }

  /**
   * Generates next 32-bit integer and returns float in [0, 1)
   * xoshiro128** algorithm
   * @returns {number} Float in range [0, 1)
   */
  next() {
    const s0 = this.s0;
    const s1 = this.s1;
    let s2 = this.s2;
    let s3 = this.s3;

    // rotl(s1 * 5, 7) * 9
    const rotl = (x, k) => ((x << k) | (x >>> (32 - k))) >>> 0;
    const result = Math.imul(rotl(Math.imul(s1, 5) >>> 0, 7), 9) >>> 0;
    const t = (s1 << 9) >>> 0;

    s2 = (s2 ^ s0) >>> 0;
    s3 = (s3 ^ s1) >>> 0;
    this.s1 = (s1 ^ s2) >>> 0;
    this.s0 = (s0 ^ s3) >>> 0;

    this.s2 = (s2 ^ t) >>> 0;
    this.s3 = rotl(s3, 11);

    return result / 4294967296;
  }

  /**
   * Returns a random integer between min and max (inclusive)
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  nextInt(min, max) {
    const low = Math.min(min, max);
    const high = Math.max(min, max);
    const range = high - low + 1;
    return low + Math.floor(this.next() * range);
  }

  /**
   * Deterministic Fisher-Yates shuffle.
   * Returns a new shuffled copy of the input array.
   * @param {Array} array
   * @returns {Array}
   */
  shuffle(array) {
    if (!Array.isArray(array)) {
      throw new TypeError('Expected an array to shuffle');
    }
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }
}

module.exports = SeededRNG;
