/**
 * STEERING COMMITTEE — Destination Assigner
 * Deterministically assigns one secret landmark destination to each player per round.
 * Constraints:
 * - Cap per landmark = floor(N / 2). For N <= 3: cap = 1 (all distinct).
 * - Guaranteed at least 2 distinct destinations per round.
 */

const SeededRNG = require('./SeededRNG');

/**
 * Assigns secret destinations to players
 * @param {string|number} seed
 * @param {Array<string|Object>} playerIds - Array of player IDs or player objects
 * @param {Array<string|Object>} landmarks - Array of Landmark objects (with .id) or landmark ID strings
 * @returns {Map<string, string>} Map of playerId -> landmarkId
 */
function assignDestinations(seed, playerIds = [], landmarks = []) {
  const rng = new SeededRNG(seed);
  const assignments = new Map();

  const normalizedPlayerIds = playerIds.map(p => (typeof p === 'object' && p !== null ? (p.id || p.playerId) : String(p)));
  const normalizedLandmarkIds = landmarks.map(lm => (typeof lm === 'object' && lm !== null ? lm.id : String(lm)));

  const N = normalizedPlayerIds.length;
  if (N === 0 || normalizedLandmarkIds.length === 0) {
    return assignments;
  }

  // Cap per landmark
  const cap = N <= 3 ? 1 : Math.floor(N / 2);

  // Initialize counts for each landmark
  const counts = new Map();
  for (const lmId of normalizedLandmarkIds) {
    counts.set(lmId, 0);
  }

  // Deterministically shuffle available landmarks
  const shuffledLandmarks = rng.shuffle(normalizedLandmarkIds);

  for (const playerId of normalizedPlayerIds) {
    // Collect landmarks with count < cap
    const available = shuffledLandmarks.filter(lmId => counts.get(lmId) < cap);

    if (available.length === 0) {
      // Fallback if cap configuration is exhausted
      const minCount = Math.min(...Array.from(counts.values()));
      const fallback = shuffledLandmarks.filter(lmId => counts.get(lmId) === minCount);
      const chosen = fallback[rng.nextInt(0, fallback.length - 1)];
      assignments.set(playerId, chosen);
      counts.set(chosen, counts.get(chosen) + 1);
    } else {
      const chosenIndex = rng.nextInt(0, available.length - 1);
      const chosen = available[chosenIndex];
      assignments.set(playerId, chosen);
      counts.set(chosen, counts.get(chosen) + 1);
    }
  }

  return assignments;
}

class DestinationAssigner {
  static assign(playerIds, landmarks, rngOrSeed) {
    const seed = typeof rngOrSeed === 'object' && rngOrSeed !== null && rngOrSeed.seedString
      ? rngOrSeed.seedString
      : (rngOrSeed || 'default-dest-seed');
    return assignDestinations(seed, playerIds, landmarks);
  }

  static assignDestinations(seed, playerIds, landmarks) {
    return assignDestinations(seed, playerIds, landmarks);
  }
}

DestinationAssigner.assignDestinations = assignDestinations;

module.exports = DestinationAssigner;
