/**
 * STEERING COMMITTEE — Map Generator (Stub for P0)
 * Generates 9x9 grid with 8 obstacles, 6 landmarks at BFS distance 5 from center,
 * pairwise distance >= 3, and precomputed BFS distance matrices.
 */

class MapGenerator {
  /**
   * Generates a deterministic map from a seed
   * @param {string|number} seed
   * @returns {Object} Map layout with grid, landmarks, obstacles, and distance matrix
   */
  static generate(seed) {
    return {
      seed: String(seed),
      size: 9,
      obstacles: [],
      landmarks: [],
      distanceMatrix: {},
      isStub: true
    };
  }
}

module.exports = MapGenerator;
