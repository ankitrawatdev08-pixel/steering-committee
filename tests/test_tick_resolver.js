/**
 * STEERING COMMITTEE — Test: TickResolver (9d)
 */

const assert = require('node:assert/strict');
const TickResolver = require('../game/TickResolver');
const Scoring = require('../game/Scoring');

console.log('--- TEST 9d: TickResolver Invariants & Pure Function ---');

// Base state template
function createBaseState(overrides = {}) {
  return {
    tick: 1,
    carPos: { row: 4, col: 4, x: 4, y: 4 },
    heading: null,
    inertiaEarned: false,
    fuel: 20,
    gavels: 3,
    obstacles: [{ row: 3, col: 4 }], // obstacle directly UP of (4,4) for BUMP test
    mapSize: 9,
    ...overrides
  };
}

// 1. UNIQUE PLURALITY: 3 players, votes UP:2, DOWN:1
{
  const state = createBaseState({ obstacles: [] });
  const votes = { p1: 'UP', p2: 'UP', p3: 'DOWN' };
  const { newState, result } = TickResolver.resolveTick(state, votes, 'p1');

  assert.equal(result.type, 'MOVE');
  assert.equal(result.direction, 'UP');
  assert.equal(result.inertiaEarned, true);
  assert.equal(newState.carPos.row, 3);
  assert.equal(newState.carPos.col, 4);
  assert.equal(newState.heading, 'UP');
  assert.equal(newState.fuel, 19);
  console.log('✔ ASSERTION PASSED: Unique plurality wins direction, moves car, sets inertiaEarned=true.');
}

// 2. TIE WITH HEADING CONTINUATION (earned)
{
  const state = createBaseState({ heading: 'UP', inertiaEarned: true, obstacles: [] });
  const votes = { p1: 'UP', p2: 'UP', p3: 'DOWN', p4: 'DOWN' }; // 2 UP vs 2 DOWN
  const { newState, result } = TickResolver.resolveTick(state, votes, 'p3'); // Chair is p3 (voted DOWN)

  assert.equal(result.type, 'MOVE');
  assert.equal(result.direction, 'UP');
  assert.equal(result.resolutionMethod, 'HEADING_CONTINUATION');
  assert.equal(newState.gavels, 3, 'No gavel consumed on earned heading continuation');
  assert.equal(newState.inertiaEarned, true, 'inertiaEarned remains true');
  console.log('✔ ASSERTION PASSED: Heading continuation wins tie without consuming gavel when inertiaEarned=true.');
}

// 3. TIE WITH HEADING CONTINUATION BLOCKED (not earned)
{
  const state = createBaseState({ heading: 'UP', inertiaEarned: false, gavels: 2, obstacles: [] });
  const votes = { p1: 'UP', p2: 'UP', p3: 'DOWN', p4: 'DOWN' };
  const { newState, result } = TickResolver.resolveTick(state, votes, 'p3'); // Chair p3 voted DOWN

  // Since inertia was NOT earned, heading continuation cannot fire. Chair p3's vote DOWN wins via gavel!
  assert.equal(result.direction, 'DOWN');
  assert.equal(result.resolutionMethod, 'GAVEL');
  assert.equal(newState.gavels, 1, 'Gavel was consumed');
  assert.equal(newState.inertiaEarned, false, 'inertiaEarned set to false after gavel');
  console.log('✔ ASSERTION PASSED: Heading continuation blocked when inertiaEarned=false; falls back to Gavel.');
}

// 4. GAVEL: no heading, Chair voted UP, votes UP:2 DOWN:2
{
  const state = createBaseState({ heading: null, inertiaEarned: false, gavels: 3, obstacles: [] });
  const votes = { p1: 'UP', p2: 'UP', p3: 'DOWN', p4: 'DOWN' };
  const { newState, result } = TickResolver.resolveTick(state, votes, 'p1'); // Chair p1 voted UP

  assert.equal(result.type, 'MOVE');
  assert.equal(result.direction, 'UP');
  assert.equal(result.resolutionMethod, 'GAVEL');
  assert.equal(newState.gavels, 2, 'One gavel consumed');
  assert.equal(newState.inertiaEarned, false);
  console.log('✔ ASSERTION PASSED: Chairperson gavel breaks tie when gavels > 0.');
}

// 5. GAVEL EXHAUSTION: gavels=0, no heading, tie
{
  const state = createBaseState({ heading: null, inertiaEarned: false, gavels: 0, obstacles: [] });
  const votes = { p1: 'UP', p2: 'UP', p3: 'DOWN', p4: 'DOWN' };
  const { newState, result } = TickResolver.resolveTick(state, votes, 'p1');

  assert.equal(result.type, 'DEADLOCK');
  assert.equal(result.direction, null);
  assert.equal(newState.carPos.row, 4);
  assert.equal(newState.carPos.col, 4);
  assert.equal(newState.gavels, 0);
  assert.equal(newState.fuel, 19);
  console.log('✔ ASSERTION PASSED: Gavel exhaustion leads to DEADLOCK.');
}

// 6. DEADLOCK: tie, heading not among tied, Chair not among tied
{
  const state = createBaseState({ heading: 'LEFT', inertiaEarned: true, gavels: 3, obstacles: [] });
  const votes = { p1: 'UP', p2: 'UP', p3: 'DOWN', p4: 'DOWN', pChair: 'LEFT' }; // UP:2, DOWN:2, LEFT:1
  const { newState, result } = TickResolver.resolveTick(state, votes, 'pChair');

  assert.equal(result.type, 'DEADLOCK');
  assert.equal(newState.carPos.row, 4);
  assert.equal(newState.carPos.col, 4);
  assert.equal(newState.heading, 'LEFT', 'Heading unchanged');
  assert.equal(newState.inertiaEarned, true, 'inertiaEarned unchanged');
  assert.equal(newState.fuel, 19);
  console.log('✔ ASSERTION PASSED: Deadlock preserves car position, heading, and inertiaEarned.');
}

// 7. BUMP: direction wins, target is obstacle
{
  const state = createBaseState({ obstacles: [{ row: 3, col: 4 }] }); // obstacle at (3,4)
  const votes = { p1: 'UP', p2: 'UP', p3: 'DOWN' };
  const { newState, result } = TickResolver.resolveTick(state, votes, 'p1');

  assert.equal(result.type, 'BUMP');
  assert.equal(result.direction, 'UP');
  assert.equal(newState.carPos.row, 4, 'Car stays at (4,4) after bump');
  assert.equal(newState.carPos.col, 4);
  assert.equal(newState.heading, 'UP', 'Heading reflects attempted move direction');
  assert.equal(newState.fuel, 19, 'Burns 1 fuel');
  console.log('✔ ASSERTION PASSED: BUMP into obstacle retains position, updates heading, and consumes fuel.');
}

// 8. PARK: tick > 5, PARK wins plurality -> roundEnds=true
{
  const state = createBaseState({ tick: 6, obstacles: [] });
  const votes = { p1: 'PARK', p2: 'PARK', p3: 'UP' };
  const { newState, result } = TickResolver.resolveTick(state, votes, 'p1');

  assert.equal(result.type, 'PARK');
  assert.equal(result.direction, 'PARK');
  assert.equal(result.roundEnds, true);
  assert.equal(newState.roundEnds, true);
  console.log('✔ ASSERTION PASSED: PARK plurality on tick 6 ends the round.');
}

// 9. PARK LOCKOUT: tick <= 5, PARK votes ignored
{
  const state = createBaseState({ tick: 5, obstacles: [] });
  const votes = { p1: 'PARK', p2: 'PARK', p3: 'UP' }; // 2 PARK, 1 UP. But PARK is locked out!
  const { newState, result } = TickResolver.resolveTick(state, votes, 'p1');

  assert.equal(result.type, 'MOVE');
  assert.equal(result.direction, 'UP');
  assert.equal(newState.roundEnds, false);
  console.log('✔ ASSERTION PASSED: PARK lockout on tick 5 ignores PARK votes, resolving to remaining valid votes.');
}

// 10. ALL ABSTAIN: no votes
{
  const state = createBaseState({ heading: 'RIGHT', inertiaEarned: true, obstacles: [] });
  const votes = { p1: null, p2: null, p3: null };
  const { newState, result } = TickResolver.resolveTick(state, votes, 'p1');

  assert.equal(result.type, 'ALL_ABSTAIN');
  assert.equal(result.direction, null);
  assert.equal(newState.carPos.row, 4);
  assert.equal(newState.heading, 'RIGHT');
  assert.equal(newState.fuel, 19);
  console.log('✔ ASSERTION PASSED: ALL_ABSTAIN retains position and heading while burning fuel.');
}

// 11. FUEL EXHAUSTION: fuel=1 -> fuel=0, roundEnds=true
{
  const state = createBaseState({ fuel: 1, obstacles: [] });
  const votes = { p1: 'DOWN', p2: 'DOWN' };
  const { newState, result } = TickResolver.resolveTick(state, votes, 'p1');

  assert.equal(newState.fuel, 0);
  assert.equal(result.roundEnds, true);
  assert.equal(newState.roundEnds, true);
  console.log('✔ ASSERTION PASSED: Fuel reaching 0 triggers roundEnds=true.');
}

// 12. N=3 CHAIR DICTATORSHIP PREVENTED
{
  let state = createBaseState({ obstacles: [], fuel: 20, gavels: 3, carPos: { row: 4, col: 4 } });
  const chairId = 'p_chair';
  const votes = { p_chair: 'UP', p2: 'LEFT', p3: 'RIGHT' }; // 3-way tie every tick

  let moveCount = 0;
  let deadlockCount = 0;

  for (let tick = 1; tick <= 20; tick++) {
    state.tick = tick;
    const { newState, result } = TickResolver.resolveTick(state, votes, chairId);
    state = newState;

    if (result.type === 'MOVE') moveCount++;
    if (result.type === 'DEADLOCK') deadlockCount++;
  }

  assert.equal(moveCount, 3, 'Car must move exactly 3 times (the 3 gavels)');
  assert.equal(deadlockCount, 17, 'Remaining 17 ticks must be deadlocks');
  assert.equal(state.carPos.row, 1, 'Car moved 3 steps UP from row 4 to row 1');
  assert.equal(state.carPos.col, 4);

  // If Chair destination was at distance 5 from (4,4), after 3 steps towards it, distance is 2
  const finalDistance = 5 - 3;
  const chairScore = Scoring.calculateScore(finalDistance);
  assert.equal(chairScore, 60);
  assert.ok(chairScore <= 60, `Chair score must be <= 60, got ${chairScore}`);
  console.log(`✔ ASSERTION PASSED: Chair dictatorship prevented. Exactly ${moveCount} moves, ${deadlockCount} deadlocks. Final Chair score: ${chairScore} <= 60.`);
}

// 13. EARNED INERTIA AFTER COOPERATION
{
  let state = createBaseState({ obstacles: [], fuel: 20, gavels: 0, heading: null, inertiaEarned: false });
  // Two players cooperate to form unique plurality
  const coopVotes = { p1: 'UP', p2: 'UP', p3: 'DOWN' };
  const resCoop = TickResolver.resolveTick(state, coopVotes, 'p3');
  assert.equal(resCoop.result.inertiaEarned, true, 'Cooperation earns inertia');

  // Next tick: subsequent tie UP:2 vs DOWN:2
  const tieVotes = { p1: 'UP', p2: 'UP', p3: 'DOWN', p4: 'DOWN' };
  const resTie = TickResolver.resolveTick(resCoop.newState, tieVotes, 'p3');
  assert.equal(resTie.result.resolutionMethod, 'HEADING_CONTINUATION', 'Earned inertia allows heading continuation');
  assert.equal(resTie.result.direction, 'UP');
  console.log('✔ ASSERTION PASSED: Cooperation earns inertia, allowing continuation on subsequent ties.');
}

// 14. PURE FUNCTION ASSERTION: calling twice with same inputs produces identical outputs
{
  const state = createBaseState({ heading: 'DOWN', inertiaEarned: true, fuel: 15, gavels: 2 });
  const votes = { p1: 'DOWN', p2: 'UP', p3: 'LEFT' };

  const run1 = TickResolver.resolveTick(state, votes, 'p1');
  const run2 = TickResolver.resolveTick(state, votes, 'p1');

  assert.deepEqual(run1, run2, 'resolveTick must be a pure function with identical outputs for identical inputs');
  console.log('✔ ASSERTION PASSED: Pure function confirmed. Multiple invocations yield deep-equal output.');
}

console.log('--- TEST 9d: ALL ASSERTIONS PASSED ---\n');
