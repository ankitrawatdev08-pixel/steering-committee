/**
 * STEERING COMMITTEE — Scoring System
 * Evaluates round scores: max(0, 100 - 20 * roadDistance)
 * Total scores: cumulative sum across rounds.
 * Standings tiebreak order:
 * 1. Total score (descending)
 * 2. More rounds with score = 100 (descending)
 * 3. Higher best single-round score (descending)
 * 4. Fewer Chairperson turns (ascending)
 * 5. Shared rank
 */

/**
 * Calculates score from BFS road distance
 * @param {number} roadDistance
 * @returns {number} Score integer [0..100]
 */
function calculateDistanceScore(roadDistance) {
  if (roadDistance === Infinity || roadDistance === undefined || roadDistance === null || isNaN(roadDistance)) {
    return 0;
  }
  return Math.max(0, 100 - 20 * Math.max(0, roadDistance));
}

/**
 * Evaluates round scores for all players
 * @param {Object} carPos - { row, col }
 * @param {Map|Object} destinations - playerId -> landmarkId
 * @param {Object} distanceMatrix - BFS distance lookup
 * @param {Array<Object>|Map} landmarks - Landmark objects with { id, row, col }
 * @returns {Map<string, number>} Map of playerId -> roundScore
 */
function scoreRound(carPos, destinations, distanceMatrix, landmarks) {
  const scores = new Map();

  const carR = carPos.row !== undefined ? carPos.row : (carPos.y !== undefined ? carPos.y : 4);
  const carC = carPos.col !== undefined ? carPos.col : (carPos.x !== undefined ? carPos.x : 4);
  const carKey = `${carR},${carC}`;

  // Build landmark lookup table
  const lmLookup = new Map();
  if (Array.isArray(landmarks)) {
    for (const lm of landmarks) {
      lmLookup.set(lm.id, lm);
    }
  } else if (landmarks instanceof Map) {
    for (const [id, lm] of landmarks.entries()) {
      lmLookup.set(id, lm);
    }
  }

  // Iterate over destination assignments
  const entries = destinations instanceof Map
    ? destinations.entries()
    : Object.entries(destinations || {});

  for (const [playerId, landmarkId] of entries) {
    const lm = lmLookup.get(landmarkId);
    if (!lm) {
      scores.set(playerId, 0);
      continue;
    }

    const lmR = lm.row !== undefined ? lm.row : lm.y;
    const lmC = lm.col !== undefined ? lm.col : lm.x;
    const lmKey = `${lmR},${lmC}`;

    let roadDistance = Infinity;
    if (carKey === lmKey) {
      roadDistance = 0;
    } else if (distanceMatrix && distanceMatrix[carKey] && distanceMatrix[carKey][lmKey] !== undefined) {
      roadDistance = distanceMatrix[carKey][lmKey];
    } else {
      // Fallback Manhattan if distanceMatrix not supplied
      roadDistance = Math.abs(carR - lmR) + Math.abs(carC - lmC);
    }

    scores.set(playerId, calculateDistanceScore(roadDistance));
  }

  return scores;
}

/**
 * Computes sorted standings across all rounds with full tiebreak resolution
 * @param {Map|Object} allScores - playerId -> Array of round scores
 * @param {Map|Object} chairCounts - playerId -> number of rounds as Chair
 * @param {Map|Object} playerInfo - optional metadata (names, avatars)
 * @returns {Array<Object>} Sorted list of player standing objects with rank
 */
function computeStandings(allScores = {}, chairCounts = {}, playerInfo = {}) {
  const playerList = [];

  const scoreEntries = allScores instanceof Map
    ? Array.from(allScores.entries())
    : Object.entries(allScores || {});

  for (const [playerId, rounds] of scoreEntries) {
    const roundList = Array.isArray(rounds) ? rounds : [Number(rounds) || 0];
    const totalScore = roundList.reduce((acc, s) => acc + (Number(s) || 0), 0);
    const exactHits = roundList.filter(s => s === 100).length;
    const bestRound = roundList.length > 0 ? Math.max(...roundList) : 0;

    let cCount = 0;
    if (chairCounts instanceof Map) {
      cCount = chairCounts.get(playerId) || 0;
    } else if (chairCounts && typeof chairCounts === 'object') {
      cCount = chairCounts[playerId] || 0;
    }

    let meta = {};
    if (playerInfo instanceof Map) {
      meta = playerInfo.get(playerId) || {};
    } else if (playerInfo && typeof playerInfo === 'object') {
      meta = playerInfo[playerId] || {};
    }

    playerList.push({
      playerId,
      name: meta.name || playerId,
      roundScores: roundList,
      totalScore,
      exactHits,
      bestRound,
      chairCount: cCount,
      ...meta
    });
  }

  // Sort per tiebreak rules:
  // 1. totalScore desc
  // 2. exactHits desc
  // 3. bestRound desc
  // 4. chairCount asc (fewer chair turns preferred)
  playerList.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.exactHits !== a.exactHits) return b.exactHits - a.exactHits;
    if (b.bestRound !== a.bestRound) return b.bestRound - a.bestRound;
    if (a.chairCount !== b.chairCount) return a.chairCount - b.chairCount;
    return a.playerId.localeCompare(b.playerId);
  });

  // Assign ranks (handling shared ranks)
  for (let i = 0; i < playerList.length; i++) {
    if (i === 0) {
      playerList[i].rank = 1;
    } else {
      const prev = playerList[i - 1];
      const curr = playerList[i];
      const isTied = (
        curr.totalScore === prev.totalScore &&
        curr.exactHits === prev.exactHits &&
        curr.bestRound === prev.bestRound &&
        curr.chairCount === prev.chairCount
      );

      if (isTied) {
        curr.rank = prev.rank;
      } else {
        curr.rank = i + 1;
      }
    }
  }

  return playerList;
}

class Scoring {
  static calculateScore(roadDistance) {
    return calculateDistanceScore(roadDistance);
  }

  static scoreRound(carPos, destinations, distanceMatrix, landmarks) {
    return scoreRound(carPos, destinations, distanceMatrix, landmarks);
  }

  static evaluateRound(carPos, destinations, distanceMatrix, landmarks) {
    return scoreRound(carPos, destinations, distanceMatrix, landmarks);
  }

  static computeStandings(allScores, chairCounts, playerInfo) {
    return computeStandings(allScores, chairCounts, playerInfo);
  }
}

Scoring.calculateScore = calculateDistanceScore;
Scoring.scoreRound = scoreRound;
Scoring.evaluateRound = scoreRound;
Scoring.computeStandings = computeStandings;

module.exports = Scoring;
