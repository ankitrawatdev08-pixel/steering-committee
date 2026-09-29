/**
 * STEERING COMMITTEE — Tick Resolver
 * Pure function resolving directional voting every 1.5 seconds.
 *
 * Rules:
 * 1. Collect sticky votes. PARK is ignored on ticks 1..5.
 * 2. If 0 counted votes -> ALL_ABSTAIN.
 * 3. Unique plurality -> direction wins, inertiaEarned = true.
 * 4. Tie:
 *    i. Heading Continuation: if heading is tied and inertiaEarned === true -> heading wins, inertiaEarned unchanged.
 *    ii. Chairperson Gavel: else if Chair vote is tied and gavels > 0 -> Chair direction wins, gavels - 1, inertiaEarned = false.
 *    iii. Deadlock: else -> car stays, heading unchanged, inertiaEarned unchanged.
 * 5. Winner movement:
 *    - PARK: roundEnds = true.
 *    - UP/DOWN/LEFT/RIGHT:
 *        Obstacle or out-of-bounds -> BUMP (car stays, heading = direction, fuel - 1).
 *        Clear road -> MOVE (car advances, heading = direction, fuel - 1).
 * 6. Fuel exhaustion: if fuel reaches 0 -> roundEnds = true.
 */

const { DIRECTIONS } = require('./constants');

const DELTAS = {
  UP: { dr: -1, dc: 0 },
  DOWN: { dr: 1, dc: 0 },
  LEFT: { dr: 0, dc: -1 },
  RIGHT: { dr: 0, dc: 1 },
  PARK: { dr: 0, dc: 0 }
};

/**
 * Normalizes car coordinates to have both row/col and x/y
 */
function normalizeCarPos(car) {
  if (!car) return { row: 4, col: 4, x: 4, y: 4 };
  const r = car.row !== undefined ? car.row : (car.y !== undefined ? car.y : 4);
  const c = car.col !== undefined ? car.col : (car.x !== undefined ? car.x : 4);
  return { row: r, col: c, x: c, y: r };
}

/**
 * Pure function that resolves a single steering tick
 * @param {Object} state - Current tick state
 * @param {Map|Object} votes - Map or object of playerId -> direction
 * @param {string} chairId - ID of current Chairperson
 * @returns {{ newState: Object, result: Object }}
 */
function resolveTick(state = {}, votes = new Map(), chairId = null) {
  state = state || {};
  const currentTick = state.tick || 1;
  const currentCar = normalizeCarPos(state.carPos || state.car);
  const currentHeading = state.heading || null;
  const currentInertiaEarned = Boolean(state.inertiaEarned);
  const currentFuel = state.fuel !== undefined ? state.fuel : 20;
  const currentGavels = state.gavels !== undefined ? state.gavels : 3;
  const mapSize = state.mapSize || 9;
  const obstacles = state.obstacles || [];

  // Helper to check obstacles
  const isObstacle = (r, c) => {
    return obstacles.some(obs => {
      const or = obs.row !== undefined ? obs.row : obs.y;
      const oc = obs.col !== undefined ? obs.col : obs.x;
      return or === r && oc === c;
    });
  };

  // Helper to get vote for a player
  const getPlayerVote = (pid) => {
    if (!pid || !votes) return null;
    if (typeof votes.get === 'function') {
      return votes.get(pid) || null;
    }
    return votes[pid] || null;
  };

  // Convert all votes to an iterable
  const voteList = [];
  if (typeof votes.entries === 'function') {
    for (const [pid, dir] of votes.entries()) {
      voteList.push({ pid, dir });
    }
  } else if (typeof votes === 'object' && votes !== null) {
    for (const [pid, dir] of Object.entries(votes)) {
      voteList.push({ pid, dir });
    }
  }

  // 1 & 2: Count valid votes
  const tallies = {
    UP: 0,
    DOWN: 0,
    LEFT: 0,
    RIGHT: 0,
    PARK: 0
  };

  let countedVotesCount = 0;
  for (const { dir } of voteList) {
    if (!dir) continue; // ABSTAIN / null
    if (dir === DIRECTIONS.PARK && currentTick <= 5) {
      // PARK ignored on ticks 1-5
      continue;
    }
    if (tallies[dir] !== undefined) {
      tallies[dir]++;
      countedVotesCount++;
    }
  }

  // ALL ABSTAIN: no valid votes counted
  if (countedVotesCount === 0) {
    const newFuel = Math.max(0, currentFuel - 1);
    const roundEnds = newFuel === 0;

    const newState = {
      ...state,
      tick: currentTick + 1,
      carPos: currentCar,
      car: currentCar,
      heading: currentHeading,
      inertiaEarned: currentInertiaEarned,
      fuel: newFuel,
      gavels: currentGavels,
      roundEnds
    };

    const result = {
      type: 'ALL_ABSTAIN',
      direction: null,
      carPos: currentCar,
      heading: currentHeading,
      inertiaEarned: currentInertiaEarned,
      fuel: newFuel,
      gavels: currentGavels,
      roundEnds,
      newState
    };

    return { newState, result, ...result, car: currentCar, carPos: currentCar, heading: currentHeading };
  }

  // 3: Determine winning direction
  let maxVotes = 0;
  for (const dir of Object.keys(tallies)) {
    if (tallies[dir] > maxVotes) {
      maxVotes = tallies[dir];
    }
  }

  const topDirections = Object.keys(tallies).filter(dir => tallies[dir] === maxVotes);

  let winningDirection = null;
  let nextInertiaEarned = currentInertiaEarned;
  let nextGavels = currentGavels;
  let resolutionMethod = null;

  if (topDirections.length === 1) {
    // 3a: UNIQUE PLURALITY
    winningDirection = topDirections[0];
    nextInertiaEarned = true;
    resolutionMethod = 'PLURALITY';
  } else {
    // 3b: TIE
    // i. Heading continuation: heading is tied AND inertiaEarned === true
    if (currentHeading && topDirections.includes(currentHeading) && currentInertiaEarned) {
      winningDirection = currentHeading;
      // inertiaEarned unchanged
      resolutionMethod = 'HEADING_CONTINUATION';
    } else {
      // ii. Chairperson gavel: Chair vote is tied AND gavels > 0
      const chairVote = getPlayerVote(chairId);
      if (chairVote && topDirections.includes(chairVote) && currentGavels > 0) {
        winningDirection = chairVote;
        nextGavels = currentGavels - 1;
        nextInertiaEarned = false;
        resolutionMethod = 'GAVEL';
      } else {
        // iii. DEADLOCK
        winningDirection = null;
        resolutionMethod = 'DEADLOCK';
      }
    }
  }

  // 4: If PARK won
  if (winningDirection === DIRECTIONS.PARK) {
    const newState = {
      ...state,
      tick: currentTick + 1,
      carPos: currentCar,
      car: currentCar,
      heading: currentHeading,
      inertiaEarned: nextInertiaEarned,
      fuel: currentFuel,
      gavels: nextGavels,
      roundEnds: true
    };

    const result = {
      type: 'PARK',
      direction: DIRECTIONS.PARK,
      carPos: currentCar,
      heading: currentHeading,
      inertiaEarned: nextInertiaEarned,
      fuel: currentFuel,
      gavels: nextGavels,
      roundEnds: true,
      resolutionMethod,
      newState
    };

    return { newState, result, ...result, car: currentCar, carPos: currentCar, heading: currentHeading };
  }

  // 5 & 6: Move or Bump or Deadlock
  let newCarPos = { ...currentCar };
  let newHeading = currentHeading;
  let resultType = 'DEADLOCK';

  const newFuel = Math.max(0, currentFuel - 1);

  if (winningDirection) {
    newHeading = winningDirection;
    const delta = DELTAS[winningDirection];
    const targetR = currentCar.row + delta.dr;
    const targetC = currentCar.col + delta.dc;

    const outOfBounds = targetR < 0 || targetR >= mapSize || targetC < 0 || targetC >= mapSize;
    const hitsObstacle = !outOfBounds && isObstacle(targetR, targetC);

    if (outOfBounds || hitsObstacle) {
      // BUMP: car stays, heading changes to direction, burns 1 fuel
      resultType = 'BUMP';
    } else {
      // MOVE: car moves, heading changes, burns 1 fuel
      resultType = 'MOVE';
      newCarPos = normalizeCarPos({ row: targetR, col: targetC });
    }
  } else {
    // DEADLOCK: car stays, heading unchanged, burns 1 fuel
    resultType = 'DEADLOCK';
  }

  const roundEnds = newFuel === 0;

  const newState = {
    ...state,
    tick: currentTick + 1,
    carPos: newCarPos,
    car: newCarPos,
    heading: newHeading,
    inertiaEarned: nextInertiaEarned,
    fuel: newFuel,
    gavels: nextGavels,
    roundEnds
  };

  const result = {
    type: resultType,
    direction: winningDirection,
    carPos: newCarPos,
    heading: newHeading,
    inertiaEarned: nextInertiaEarned,
    fuel: newFuel,
    gavels: nextGavels,
    roundEnds,
    resolutionMethod,
    tallies,
    newState
  };

  return { newState, result, ...result, car: newCarPos, carPos: newCarPos, heading: newHeading };
}

class TickResolver {
  static resolve(state, votes, chairId) {
    return resolveTick(state, votes, chairId);
  }

  static resolveTick(state, votes, chairId) {
    return resolveTick(state, votes, chairId);
  }
}

TickResolver.resolveTick = resolveTick;
TickResolver.resolve = resolveTick;

module.exports = TickResolver;
