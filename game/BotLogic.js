/**
 * STEERING COMMITTEE — Bot Logic & Pathfinding AI
 * Implements Lefty, Shady, and Diplomat bot personalities.
 */

class BotLogic {
  /**
   * Evaluates and returns the bot's vote direction for the current tick
   * @param {string|Object} botProfile - 'LEFTY' | 'SHADY' | 'DIPLOMAT' or profile object
   * @param {Object} carPos - { row, col } or { x, y }
   * @param {Object} mapData - { grid, landmarks, obstacles, distanceMatrix }
   * @param {Map|Object} destinations - playerId -> landmarkId, or single landmark
   * @param {Array<Object>} allPlayers - List of all player objects
   * @param {number} currentTick - The 1-based tick index being evaluated
   * @param {string} [playerId] - Optional ID of the bot player
   * @returns {string} Direction ('UP' | 'DOWN' | 'LEFT' | 'RIGHT')
   */
  static getVote(botProfile, carPos, mapData, destinations, allPlayers = [], currentTick = 1, playerId = null) {
    const profileType = (typeof botProfile === 'object' && botProfile !== null)
      ? (botProfile.type || botProfile.botProfile || 'DIPLOMAT')
      : String(botProfile || 'DIPLOMAT').toUpperCase();

    const carR = carPos.row !== undefined ? carPos.row : (carPos.r !== undefined ? carPos.r : (carPos.y !== undefined ? carPos.y : 4));
    const carC = carPos.col !== undefined ? carPos.col : (carPos.c !== undefined ? carPos.c : (carPos.x !== undefined ? carPos.x : 4));

    if (profileType === 'DIPLOMAT') {
      return this._getDiplomatVote(carR, carC, mapData, destinations, allPlayers);
    } else if (profileType === 'SHADY') {
      const ownDest = this._resolveOwnDestination(botProfile, destinations, allPlayers, mapData, playerId);
      if (!ownDest) return 'UP';
      return this._getShadyVote(carR, carC, ownDest, mapData, currentTick);
    } else {
      // Default to LEFTY
      const ownDest = this._resolveOwnDestination(botProfile, destinations, allPlayers, mapData, playerId);
      if (!ownDest) return 'LEFT';
      return this._getLeftyVote(carR, carC, ownDest, mapData);
    }
  }

  // -------------------------------------------------------------
  // PROFILE HANDLERS
  // -------------------------------------------------------------

  /**
   * LEFTY: Minimizes distance to own destination.
   * Strict tie-break priority: LEFT, UP, DOWN, RIGHT.
   */
  static _getLeftyVote(carR, carC, dest, mapData) {
    const priority = ['LEFT', 'UP', 'DOWN', 'RIGHT'];
    return this._findMinDistanceDirection(carR, carC, dest.row, dest.col, mapData, priority);
  }

  /**
   * SHADY:
   * Ticks 1, 2, 3: Maximizes distance to own destination (excluding walls/Infinity).
   * Strict tie-break priority: RIGHT, DOWN, UP, LEFT.
   * Ticks 4+: Normal pathfinding to own destination.
   * Priority: UP, DOWN, LEFT, RIGHT.
   */
  static _getShadyVote(carR, carC, dest, mapData, currentTick) {
    if (currentTick <= 3) {
      const priority = ['RIGHT', 'DOWN', 'UP', 'LEFT'];
      return this._findMaxDistanceDirection(carR, carC, dest.row, dest.col, mapData, priority);
    } else {
      const priority = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      return this._findMinDistanceDirection(carR, carC, dest.row, dest.col, mapData, priority);
    }
  }

  /**
   * DIPLOMAT (and Autopilot):
   * Targets the closest destination landmark among all players from current car position.
   * If tied, picks the first one found.
   * Strict tie-break priority: UP, DOWN, LEFT, RIGHT.
   */
  static _getDiplomatVote(carR, carC, mapData, destinations, allPlayers) {
    const priority = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const carKey = `${carR},${carC}`;
    let closestLandmark = null;
    let closestDist = Infinity;

    if (Array.isArray(allPlayers) && allPlayers.length > 0) {
      for (const player of allPlayers) {
        const lm = this._resolvePlayerLandmark(player, destinations, mapData);
        if (!lm) continue;

        const destKey = `${lm.row},${lm.col}`;
        let dist = Infinity;
        if (mapData?.distanceMatrix?.[carKey]?.[destKey] !== undefined) {
          dist = mapData.distanceMatrix[carKey][destKey];
        } else {
          dist = Math.abs(carR - lm.row) + Math.abs(carC - lm.col);
        }

        if (dist < closestDist) {
          closestDist = dist;
          closestLandmark = lm;
        }
      }
    }

    // Fallback if no player destinations found
    if (!closestLandmark) {
      closestLandmark = this._resolveOwnDestination('DIPLOMAT', destinations, allPlayers, mapData);
    }

    if (!closestLandmark) return 'UP';

    return this._findMinDistanceDirection(carR, carC, closestLandmark.row, closestLandmark.col, mapData, priority);
  }

  // -------------------------------------------------------------
  // PATHFINDING HELPERS
  // -------------------------------------------------------------

  static _getDirectionDeltas() {
    return {
      UP: { dr: -1, dc: 0 },
      DOWN: { dr: 1, dc: 0 },
      LEFT: { dr: 0, dc: -1 },
      RIGHT: { dr: 0, dc: 1 }
    };
  }

  static _isObstacleOrOutOfBounds(r, c, mapData) {
    if (r < 0 || r >= 9 || c < 0 || c >= 9) return true;
    if (!mapData || !mapData.obstacles) return false;

    return mapData.obstacles.some(o => {
      const or = o.row !== undefined ? o.row : (o.r !== undefined ? o.r : o.y);
      const oc = o.col !== undefined ? o.col : (o.c !== undefined ? o.c : o.x);
      return or === r && oc === c;
    });
  }

  static _getCellDistance(r, c, destR, destC, mapData) {
    if (this._isObstacleOrOutOfBounds(r, c, mapData)) {
      return Infinity;
    }

    const key1 = `${r},${c}`;
    const key2 = `${destR},${destC}`;

    if (mapData?.distanceMatrix?.[key1]?.[key2] !== undefined) {
      return mapData.distanceMatrix[key1][key2];
    }

    // Fallback Manhattan distance
    return Math.abs(r - destR) + Math.abs(c - destC);
  }

  static _findMinDistanceDirection(carR, carC, destR, destC, mapData, priorityList) {
    const deltas = this._getDirectionDeltas();
    let bestDir = priorityList[0];
    let minDist = Infinity;

    for (const dir of priorityList) {
      const { dr, dc } = deltas[dir];
      const targetR = carR + dr;
      const targetC = carC + dc;
      const dist = this._getCellDistance(targetR, targetC, destR, destC, mapData);

      if (dist < minDist) {
        minDist = dist;
        bestDir = dir;
      }
    }

    return bestDir;
  }

  static _findMaxDistanceDirection(carR, carC, destR, destC, mapData, priorityList) {
    const deltas = this._getDirectionDeltas();
    let bestDir = null;
    let maxDist = -1;

    for (const dir of priorityList) {
      const { dr, dc } = deltas[dir];
      const targetR = carR + dr;
      const targetC = carC + dc;
      const dist = this._getCellDistance(targetR, targetC, destR, destC, mapData);

      // Exclude Infinity and obstacles
      if (dist !== Infinity && dist > maxDist) {
        maxDist = dist;
        bestDir = dir;
      }
    }

    // If all candidate directions are walls/out of bounds, fallback to first in priority
    return bestDir || priorityList[0];
  }

  // -------------------------------------------------------------
  // DESTINATION RESOLUTION
  // -------------------------------------------------------------

  static _resolvePlayerLandmark(player, destinations, mapData) {
    if (!player || !destinations) return null;
    const pid = player.id || player.name || player;
    let destVal;

    if (destinations instanceof Map) {
      destVal = destinations.get(pid);
    } else if (typeof destinations === 'object') {
      destVal = destinations[pid];
    }

    return this._normalizeLandmark(destVal, mapData);
  }

  static _resolveOwnDestination(botProfile, destinations, allPlayers, mapData, playerId = null) {
    // 1. If destinations is already a direct landmark object
    if (destinations && (destinations.row !== undefined || destinations.r !== undefined)) {
      return this._normalizeLandmark(destinations, mapData);
    }

    // 2. If destinations is a single landmark ID string
    if (typeof destinations === 'string') {
      return this._normalizeLandmark(destinations, mapData);
    }

    const getVal = (key) => {
      if (!destinations || key === undefined || key === null) return undefined;
      if (destinations instanceof Map) return destinations.get(key);
      return destinations[key];
    };

    // 3. If explicit playerId is provided
    if (playerId) {
      const val = getVal(playerId);
      if (val) return this._normalizeLandmark(val, mapData);
    }

    // 4. Try matching botProfile directly or profile.type
    const profileType = (typeof botProfile === 'object' && botProfile !== null)
      ? (botProfile.type || botProfile.botProfile || botProfile.id)
      : botProfile;

    let val = getVal(botProfile) || getVal(profileType);
    if (val) return this._normalizeLandmark(val, mapData);

    // 5. Look up in allPlayers
    if (Array.isArray(allPlayers)) {
      const match = allPlayers.find(p =>
        p.id === playerId ||
        p.botProfile === profileType ||
        p.type === profileType ||
        p.id === profileType ||
        p.name === profileType
      );
      if (match) {
        val = getVal(match.id) || getVal(match.name);
        if (val) return this._normalizeLandmark(val, mapData);
      }
    }

    // 6. Fallback if single destination in map
    const entries = destinations instanceof Map ? Array.from(destinations.entries()) : Object.entries(destinations || {});
    if (entries.length > 0) {
      return this._normalizeLandmark(entries[0][1], mapData);
    }

    // 7. Fallback to first landmark on map
    if (mapData?.landmarks && mapData.landmarks.length > 0) {
      return this._normalizeLandmark(mapData.landmarks[0], mapData);
    }

    return null;
  }

  static _normalizeLandmark(landmarkOrId, mapData) {
    if (!landmarkOrId) return null;

    if (typeof landmarkOrId === 'object') {
      const row = landmarkOrId.row !== undefined ? landmarkOrId.row : (landmarkOrId.r !== undefined ? landmarkOrId.r : landmarkOrId.y);
      const col = landmarkOrId.col !== undefined ? landmarkOrId.col : (landmarkOrId.c !== undefined ? landmarkOrId.c : landmarkOrId.x);
      if (row !== undefined && col !== undefined) {
        return { row, col, id: landmarkOrId.id };
      }
    }

    const id = typeof landmarkOrId === 'object' ? landmarkOrId.id : String(landmarkOrId);
    const landmarks = mapData?.landmarks || [];
    const list = Array.isArray(landmarks) ? landmarks : Array.from(landmarks.values());
    const found = list.find(l => l.id === id);

    if (found) {
      const row = found.row !== undefined ? found.row : (found.r !== undefined ? found.r : found.y);
      const col = found.col !== undefined ? found.col : (found.c !== undefined ? found.c : found.x);
      return { row, col, id: found.id };
    }

    return null;
  }
}

module.exports = BotLogic;
