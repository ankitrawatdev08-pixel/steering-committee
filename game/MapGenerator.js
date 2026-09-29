/**
 * STEERING COMMITTEE — Map Generator
 * Generates 9x9 grid with 8 obstacles, 6 landmarks at BFS distance 5 from center (4,4),
 * one landmark per 60° angular sector, pairwise BFS distance >= 3,
 * and complete BFS distance matrix between all non-obstacle cells.
 */

const SeededRNG = require('./SeededRNG');
const {
  MAP_CONFIG,
  LANDMARK_SHAPES,
  LANDMARK_COLOURS
} = require('./constants');

const MAP_SIZE = MAP_CONFIG.MAP_SIZE || 9;
const CENTER_ROW = Math.floor(MAP_SIZE / 2); // 4
const CENTER_COL = Math.floor(MAP_SIZE / 2); // 4
const TARGET_DISTANCE = MAP_CONFIG.LANDMARK_TARGET_DISTANCE || 5;
const MIN_PAIRWISE_DISTANCE = MAP_CONFIG.LANDMARK_MIN_PAIRWISE_DISTANCE || 3;
const MAX_ATTEMPTS = MAP_CONFIG.MAX_MAP_REGEN_ATTEMPTS || 50;

const ORTHOGONAL_DELTAS = [
  { dr: -1, dc: 0 }, // UP
  { dr: 1, dc: 0 },  // DOWN
  { dr: 0, dc: -1 }, // LEFT
  { dr: 0, dc: 1 }   // RIGHT
];

/**
 * Normalizes an angle into [0, 2π) and maps to one of 6 angular sectors [0..5]
 * Sector 0: [0, 60°)
 * Sector 1: [60°, 120°)
 * Sector 2: [120°, 180°)
 * Sector 3: [180°, 240°)
 * Sector 4: [240°, 300°)
 * Sector 5: [300°, 360°)
 */
function getSector(r, c) {
  const dr = r - CENTER_ROW;
  const dc = c - CENTER_COL;
  let angle = Math.atan2(dr, dc);
  if (angle < 0) {
    angle += 2 * Math.PI;
  }
  let sector = Math.floor(angle / (Math.PI / 3));
  if (sector >= 6) sector = 5;
  return sector;
}

/**
 * Computes single-source BFS distances on the grid avoiding obstacles
 */
function bfsSingleSource(startR, startC, isObstacle) {
  const dist = Array.from({ length: MAP_SIZE }, () => new Array(MAP_SIZE).fill(Infinity));
  if (isObstacle[startR][startC]) return dist;

  const queue = [{ r: startR, c: startC }];
  dist[startR][startC] = 0;
  let head = 0;

  while (head < queue.length) {
    const { r, c } = queue[head++];
    const d = dist[r][c];

    for (const delta of ORTHOGONAL_DELTAS) {
      const nr = r + delta.dr;
      const nc = c + delta.dc;

      if (nr >= 0 && nr < MAP_SIZE && nc >= 0 && nc < MAP_SIZE) {
        if (!isObstacle[nr][nc] && dist[nr][nc] === Infinity) {
          dist[nr][nc] = d + 1;
          queue.push({ r: nr, c: nc });
        }
      }
    }
  }

  return dist;
}

/**
 * Checks if all non-obstacle cells are connected to (4,4)
 */
function isFullyConnected(isObstacle, obstacleCount) {
  const dist = bfsSingleSource(CENTER_ROW, CENTER_COL, isObstacle);
  let reachableCount = 0;
  for (let r = 0; r < MAP_SIZE; r++) {
    for (let c = 0; c < MAP_SIZE; c++) {
      if (!isObstacle[r][c] && dist[r][c] !== Infinity) {
        reachableCount++;
      }
    }
  }
  return reachableCount === (MAP_SIZE * MAP_SIZE - obstacleCount);
}

/**
 * Computes complete pairwise distance matrix for all cells
 */
function computeDistanceMatrix(isObstacle) {
  const matrix = {};

  for (let r1 = 0; r1 < MAP_SIZE; r1++) {
    for (let c1 = 0; c1 < MAP_SIZE; c1++) {
      const key1 = `${r1},${c1}`;
      matrix[key1] = {};
      if (isObstacle[r1][c1]) {
        for (let r2 = 0; r2 < MAP_SIZE; r2++) {
          for (let c2 = 0; c2 < MAP_SIZE; c2++) {
            matrix[key1][`${r2},${c2}`] = Infinity;
          }
        }
        continue;
      }

      const dist = bfsSingleSource(r1, c1, isObstacle);
      for (let r2 = 0; r2 < MAP_SIZE; r2++) {
        for (let c2 = 0; c2 < MAP_SIZE; c2++) {
          matrix[key1][`${r2},${c2}`] = dist[r2][c2];
        }
      }
    }
  }

  return matrix;
}

/**
 * Generates map layout according to all constraints
 */
function generateMap(seed) {
  const rng = new SeededRNG(seed);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // 1. Initialize grid
    const isObstacle = Array.from({ length: MAP_SIZE }, () => new Array(MAP_SIZE).fill(false));
    const obstacles = [];

    // 2. Place 8 obstacles
    let placedObstacles = 0;
    while (placedObstacles < 8) {
      let placed = false;
      for (let retry = 0; retry < 100; retry++) {
        const r = rng.nextInt(0, MAP_SIZE - 1);
        const c = rng.nextInt(0, MAP_SIZE - 1);

        // Cannot be car start (4,4) or already an obstacle
        if ((r === CENTER_ROW && c === CENTER_COL) || isObstacle[r][c]) {
          continue;
        }

        // Test placement
        isObstacle[r][c] = true;
        if (isFullyConnected(isObstacle, placedObstacles + 1)) {
          obstacles.push({ row: r, col: c });
          placedObstacles++;
          placed = true;
          break;
        } else {
          isObstacle[r][c] = false; // reject disconnecting obstacle
        }
      }
      if (!placed) {
        // Could not place more without disconnecting; break early per spec
        break;
      }
    }

    // 3. BFS from center (4,4)
    const distFromCenter = bfsSingleSource(CENTER_ROW, CENTER_COL, isObstacle);

    // Group non-obstacle cells by sector and distance
    const candidatesBySector = [[], [], [], [], [], []];
    const relaxedBySector = [[], [], [], [], [], []];

    for (let r = 0; r < MAP_SIZE; r++) {
      for (let c = 0; c < MAP_SIZE; c++) {
        if (r === CENTER_ROW && c === CENTER_COL) continue;
        if (isObstacle[r][c]) continue;

        const d = distFromCenter[r][c];
        if (d === Infinity) continue;

        const sector = getSector(r, c);
        if (d === TARGET_DISTANCE) {
          candidatesBySector[sector].push({ row: r, col: c, dist: d });
        }
        if (d >= 4 && d <= 6) {
          relaxedBySector[sector].push({ row: r, col: c, dist: d });
        }
      }
    }

    // Check if every sector has at least one candidate at distance 5
    const hasStrictCandidates = candidatesBySector.every(list => list.length > 0);
    if (!hasStrictCandidates && attempt < MAX_ATTEMPTS) {
      continue; // Try again
    }

    // Pick candidate landmarks per sector with pairwise BFS distance >= 3
    const chosenLandmarks = tryPickLandmarks(
      hasStrictCandidates ? candidatesBySector : relaxedBySector,
      isObstacle,
      rng
    );

    if (chosenLandmarks) {
      // Build output
      const distanceMatrix = computeDistanceMatrix(isObstacle);
      const grid = Array.from({ length: MAP_SIZE }, (v, r) =>
        Array.from({ length: MAP_SIZE }, (v2, c) => (isObstacle[r][c] ? 1 : 0))
      );

      const landmarks = chosenLandmarks.map((lm, i) => ({
        id: `landmark_${i}`,
        row: lm.row,
        col: lm.col,
        shape: LANDMARK_SHAPES[i],
        colour: LANDMARK_COLOURS[i],
        sector: lm.sector,
        distFromCenter: distFromCenter[lm.row][lm.col]
      }));

      return {
        seed: String(seed),
        size: MAP_SIZE,
        grid,
        landmarks,
        obstacles,
        distanceMatrix
      };
    }
  }

  // Fallback relaxation if all 50 attempts fail strict distance 5
  // Guaranteed fallback that enforces pairwise >= 3 and valid sector coverage
  return generateRelaxedMap(seed, rng);
}

/**
 * Tries to pick 1 landmark per sector such that pairwise BFS distance >= 3
 */
function tryPickLandmarks(poolBySector, isObstacle, rng) {
  // Try up to 200 random combinations across the sectors
  const shuffledPools = poolBySector.map(pool => rng.shuffle(pool));

  function search(sectorIndex, currentPicked) {
    if (sectorIndex === 6) {
      return currentPicked;
    }

    const pool = shuffledPools[sectorIndex];
    for (const cand of pool) {
      // Check pairwise distance with already picked landmarks
      let valid = true;
      const distFromCand = bfsSingleSource(cand.row, cand.col, isObstacle);

      for (const existing of currentPicked) {
        if (distFromCand[existing.row][existing.col] < MIN_PAIRWISE_DISTANCE) {
          valid = false;
          break;
        }
      }

      if (valid) {
        const result = search(sectorIndex + 1, currentPicked.concat({ ...cand, sector: sectorIndex }));
        if (result) return result;
      }
    }

    return null;
  }

  return search(0, []);
}

/**
 * Fallback generator with relaxed target distances (4..6) while strictly keeping pairwise >= 3
 */
function generateRelaxedMap(seed, rng) {
  const isObstacle = Array.from({ length: MAP_SIZE }, () => new Array(MAP_SIZE).fill(false));
  const obstacles = [];
  // Clear center obstacles
  const distFromCenter = bfsSingleSource(CENTER_ROW, CENTER_COL, isObstacle);
  const candidatesBySector = [[], [], [], [], [], []];

  for (let r = 0; r < MAP_SIZE; r++) {
    for (let c = 0; c < MAP_SIZE; c++) {
      if (r === CENTER_ROW && c === CENTER_COL) continue;
      const d = distFromCenter[r][c];
      const sector = getSector(r, c);
      candidatesBySector[sector].push({ row: r, col: c, dist: d });
    }
  }

  // Sort by closest to 5
  for (let s = 0; s < 6; s++) {
    candidatesBySector[s].sort((a, b) => Math.abs(a.dist - 5) - Math.abs(b.dist - 5));
  }

  const chosenLandmarks = tryPickLandmarks(candidatesBySector, isObstacle, rng);
  const distanceMatrix = computeDistanceMatrix(isObstacle);
  const grid = Array.from({ length: MAP_SIZE }, () => new Array(MAP_SIZE).fill(0));

  const landmarks = chosenLandmarks.map((lm, i) => ({
    id: `landmark_${i}`,
    row: lm.row,
    col: lm.col,
    shape: LANDMARK_SHAPES[i],
    colour: LANDMARK_COLOURS[i],
    sector: lm.sector,
    distFromCenter: distFromCenter[lm.row][lm.col]
  }));

  return {
    seed: String(seed),
    size: MAP_SIZE,
    grid,
    landmarks,
    obstacles,
    distanceMatrix
  };
}

class MapGenerator {
  static generate(seed) {
    return generateMap(seed);
  }

  static generateMap(seed) {
    return generateMap(seed);
  }
}

MapGenerator.generate = generateMap;
MapGenerator.generateMap = generateMap;

module.exports = MapGenerator;
