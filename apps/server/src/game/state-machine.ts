import type {
  Player,
  Gem,
  GamePhase,
  CollisionGroup,
  FinalResult,
  PlayerMission,
  GemColor,
} from '@treasure-contest/shared';
import type { MissionCheckContext } from '@treasure-contest/shared';
import {
  MIN_PLAYERS,
  TOTAL_ROUNDS,
  INITIAL_NUMBERS,
  GEMS_PER_ROUND,
  COLLISION_VOID_THRESHOLD,
  MISSION_REWARDS,
} from '@treasure-contest/shared';
import {
  generateGems,
  calculateOrder,
  type NumberSubmission,
  calculateBaseScore,
  calculateColorBonus,
  calculateScore,
  checkMissions,
  resolveTies,
  validateNumberSubmission,
  validateGemSelection,
  validatePhase,
  dealMissions,
} from '@treasure-contest/shared';
import type { Room, RoundHistory } from './room.js';

// ============================================================================
// Result type
// ============================================================================

export interface StateResult {
  success: boolean;
  error?: string;
}

// ============================================================================
// State machine functions
// ============================================================================

/**
 * Start the game: validate minimum players, lock room, deal missions.
 *
 * Validates:
 * - Room is in LOBBY phase
 * - At least MIN_PLAYERS connected players
 *
 * Actions:
 * - Deal 3 missions (1 easy + 1 medium + 1 hard) to each player
 * - Transition LOBBY -> GAME_INIT
 */
export function startGame(room: Room): StateResult {
  if (!validatePhase(room.phase, 'LOBBY')) {
    return {
      success: false,
      error: `Cannot start game: room is in ${room.phase} phase (expected LOBBY)`,
    };
  }

  const connectedPlayers = room.getConnectedPlayers();
  if (connectedPlayers.length < MIN_PLAYERS) {
    return {
      success: false,
      error: `Not enough players: ${connectedPlayers.length} connected (minimum ${MIN_PLAYERS})`,
    };
  }

  // Deal missions to each player
  for (const player of room.players.values()) {
    player.missions = dealMissions();
    player.finalScore = 0;
    player.finalRank = null;
  }

  // Transition to GAME_INIT
  room.phase = 'GAME_INIT';
  room.currentRound = 0;
  room.roundHistory = [];
  room.finalResults = [];
  room.revealedResultsCount = 0;
  room.round3Ranking = [];

  return { success: true };
}

/**
 * Start a new round: generate gems, reset per-round state.
 *
 * Transitions GAME_INIT / ROUND_END -> ROUND_START.
 * - Increments currentRound (or sets to 1 if 0)
 * - Generates 4 gems for the round
 * - Resets selection order, collision groups, voided numbers, revealed numbers
 * - Resets each player's roundSubmission to null
 */
export function startRound(room: Room): void {
  // Increment round (first round: 0 -> 1)
  if (room.currentRound === 0) {
    room.currentRound = 1;
  } else {
    room.currentRound++;
  }

  // Generate gems for this round
  room.currentGems = generateGems(room.currentRound);

  // Reset per-round state
  room.selectionOrder = [];
  room.collisionGroups = [];
  room.voidedNumbers = [];
  room.revealedNumbers = [];
  room.currentPickerIndex = 0;

  // Reset each player's round submission
  for (const player of room.players.values()) {
    player.roundSubmission = null;
  }

  // Transition to ROUND_START
  room.phase = 'ROUND_START';
}

/**
 * Transition from ROUND_START to GEM_REVEAL.
 */
export function revealGems(room: Room): void {
  if (validatePhase(room.phase, 'ROUND_START')) {
    room.phase = 'GEM_REVEAL';
  }
}

/**
 * Transition from GEM_REVEAL to NUMBER_SELECTION.
 */
export function startNumberSelection(room: Room): void {
  if (validatePhase(room.phase, 'GEM_REVEAL')) {
    room.phase = 'NUMBER_SELECTION';
  }
}

/**
 * Submit a number for a player during NUMBER_SELECTION.
 *
 * Validates:
 * - Phase is NUMBER_SELECTION
 * - Player exists and is connected
 * - Player has not already submitted this round
 * - Number is in player's availableNumbers
 *
 * Actions:
 * - Remove number from availableNumbers
 * - Add number to usedNumbers
 * - Set player.roundSubmission = number
 */
export function submitNumber(
  room: Room,
  playerId: string,
  number: number,
): StateResult {
  if (!validatePhase(room.phase, 'NUMBER_SELECTION')) {
    return {
      success: false,
      error: `Cannot submit number: room is in ${room.phase} phase (expected NUMBER_SELECTION)`,
    };
  }

  const player = room.players.get(playerId);
  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  if (!player.isConnected) {
    return { success: false, error: 'Player is not connected' };
  }

  if (player.roundSubmission !== null) {
    return {
      success: false,
      error: `Player ${player.name} has already submitted number ${player.roundSubmission} this round`,
    };
  }

  const validation = validateNumberSubmission(player, number);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Consume the number
  player.availableNumbers = player.availableNumbers.filter((n) => n !== number);
  player.usedNumbers = [...player.usedNumbers, number];
  player.roundSubmission = number;

  return { success: true };
}

/**
 * Check if all connected players have submitted their number.
 */
export function checkAllSubmitted(room: Room): boolean {
  const connectedPlayers = room.getConnectedPlayers();
  if (connectedPlayers.length === 0) return false;
  return connectedPlayers.every((p) => p.roundSubmission !== null);
}

/**
 * Consume the lowest remaining number for a player who has not submitted.
 */
function autoSubmitLowestNumber(player: Player): void {
  if (player.roundSubmission !== null) return;
  if (player.availableNumbers.length === 0) return;
  const lowest = Math.min(...player.availableNumbers);
  player.availableNumbers = player.availableNumbers.filter((n) => n !== lowest);
  player.usedNumbers = [...player.usedNumbers, lowest];
  player.roundSubmission = lowest;
}

/**
 * Transition from NUMBER_SELECTION to NUMBER_REVEAL.
 *
 * Populates revealedNumbers with all submitted numbers.
 */
export function revealNumbers(room: Room): void {
  if (!validatePhase(room.phase, 'NUMBER_SELECTION')) return;

  // Timeout / AFK / disconnect: anyone who did not pick still consumes
  // their lowest remaining number so sitting out is not an advantage.
  for (const player of room.players.values()) {
    autoSubmitLowestNumber(player);
  }

  // Build revealed numbers from all players who submitted
  room.revealedNumbers = [];
  for (const player of room.players.values()) {
    if (player.roundSubmission !== null) {
      room.revealedNumbers.push({
        playerId: player.id,
        number: player.roundSubmission,
      });
    }
  }

  // Sort by number descending for display
  room.revealedNumbers.sort((a, b) => b.number - a.number);

  room.phase = 'NUMBER_REVEAL';
}

/**
 * Calculate the selection order from submitted numbers.
 *
 * Transitions NUMBER_REVEAL -> ORDER_CALCULATION.
 * Uses the shared calculateOrder function to determine:
 * - Selection order (highest number first, ties resolved by seat)
 * - Collision groups (2-3 players: resolved by seat; 4+: voided)
 * - Voided numbers (4+ player collisions)
 */
export function calculateSelectionOrder(room: Room): void {
  if (!validatePhase(room.phase, 'NUMBER_REVEAL')) return;

  // Build submissions array
  const submissions: NumberSubmission[] = [];
  for (const player of room.players.values()) {
    submissions.push({
      playerId: player.id,
      seatNumber: player.seatNumber,
      number: player.roundSubmission,
    });
  }

  const result = calculateOrder(submissions);
  room.selectionOrder = result.order;
  room.collisionGroups = result.collisionGroups;
  room.voidedNumbers = result.voidedNumbers;

  room.phase = 'ORDER_CALCULATION';
}

/**
 * Transition from ORDER_CALCULATION to GEM_SELECTION.
 * Resets the picker index to 0.
 */
export function startGemSelection(room: Room): void {
  if (!validatePhase(room.phase, 'ORDER_CALCULATION')) return;

  room.currentPickerIndex = 0;
  room.phase = 'GEM_SELECTION';
}

/**
 * A player picks a gem during GEM_SELECTION.
 *
 * Validates:
 * - Phase is GEM_SELECTION
 * - It is the player's turn (playerId matches current picker)
 * - The gem exists and has not been picked
 *
 * Actions:
 * - Set gem.pickedBy and gem.pickOrder
 * - Add gem to player's gem collection
 */
export function selectGem(
  room: Room,
  playerId: string,
  gemId: string,
): StateResult {
  if (!validatePhase(room.phase, 'GEM_SELECTION')) {
    return {
      success: false,
      error: `Cannot select gem: room is in ${room.phase} phase (expected GEM_SELECTION)`,
    };
  }

  const player = room.players.get(playerId);
  if (!player) {
    return { success: false, error: 'Player not found' };
  }

  const currentPickerId = room.getCurrentPickerId();
  if (currentPickerId === null) {
    return { success: false, error: 'No current picker' };
  }

  const validation = validateGemSelection(
    player,
    gemId,
    room.currentGems,
    currentPickerId,
  );
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Find the gem and mark it as picked
  const gem = room.currentGems.find((g) => g.id === gemId);
  if (!gem) {
    return { success: false, error: `Gem ${gemId} not found` };
  }

  const pickOrder = room.getPickedGemCount();
  gem.pickedBy = playerId;
  gem.pickOrder = pickOrder;

  // Add to player's gem collection (copy with picked metadata)
  player.gems.push({
    id: gem.id,
    color: gem.color,
    value: gem.value,
    pickedBy: playerId,
    pickOrder,
  });

  return { success: true };
}

/**
 * Advance to the next picker.
 * Does NOT transition to ROUND_END — the caller checks if the round is over.
 */
export function advancePicker(room: Room): void {
  room.currentPickerIndex++;
}

/**
 * End the current round: record round history, transition to ROUND_END.
 *
 * Also calculates round3Ranking after round 3 (for H09 mission check).
 */
export function endRound(room: Room): void {
  // Build gem results for each player
  const gemResults: { playerId: string; gotGem: boolean; gem?: Gem }[] = [];
  for (const player of room.players.values()) {
    // Check if the player got a gem this round
    const pickedGem = room.currentGems.find(
      (g) => g.pickedBy === player.id,
    );
    gemResults.push({
      playerId: player.id,
      gotGem: pickedGem !== undefined,
      ...(pickedGem !== undefined ? { gem: pickedGem } : {}),
    });
  }

  // Build submissions record
  const submissions: Record<string, number | null> = {};
  for (const player of room.players.values()) {
    submissions[player.id] = player.roundSubmission;
  }

  // Record round history
  const history: RoundHistory = {
    round: room.currentRound,
    gems: [...room.currentGems],
    submissions,
    selectionOrder: [...room.selectionOrder],
    collisionGroups: [...room.collisionGroups],
    voidedNumbers: [...room.voidedNumbers],
    gemResults,
  };
  room.roundHistory.push(history);

  // After round 3, calculate base score ranking (for H09 mission)
  if (room.currentRound === 3) {
    calculateRound3Ranking(room);
  }

  room.phase = 'ROUND_END';
}

/**
 * Calculate the round 3 ranking by base score (descending).
 * Used for the H09 mission check.
 */
export function calculateRound3Ranking(room: Room): void {
  const playersWithScores = Array.from(room.players.values()).map((p) => ({
    playerId: p.id,
    baseScore: calculateBaseScore(p.gems),
  }));

  // Sort by base score descending
  playersWithScores.sort((a, b) => b.baseScore - a.baseScore);

  room.round3Ranking = playersWithScores.map((p) => p.playerId);
}

/**
 * Calculate all final scores, check missions, assign ranks.
 *
 * Uses a multi-pass approach to handle the H09 mission (which depends on
 * final rank, which in turn depends on mission bonuses):
 * 1. Build mission check contexts with finalRank = null
 * 2. Check missions, calculate preliminary scores
 * 3. Resolve ties -> get preliminary final ranks
 * 4. Re-check missions with preliminary final ranks
 * 5. If any H09 status changed, recalculate scores and ranks
 * 6. Repeat until stable (max 3 iterations)
 *
 * Transitions to FINAL_CALCULATION.
 */
export function calculateFinalScores(room: Room): void {
  // Transition to FINAL_CALCULATION
  room.phase = 'FINAL_CALCULATION';

  const players = Array.from(room.players.values());

  // Iterative approach for H09 (which depends on final rank).
  // Pass 1 scores with finalRank = null (H09 always false).
  // Pass 2+ re-check with preliminary ranks so H09 can complete.
  let stable = false;
  let iterations = 0;
  const maxIterations = 3;

  while (!stable && iterations < maxIterations) {
    iterations++;

    const finalRanksMap = new Map<string, number>();
    if (room.finalResults.length > 0) {
      for (const result of room.finalResults) {
        finalRanksMap.set(result.playerId, result.finalRank);
      }
    }

    // Build results for each player
    const results: FinalResult[] = players.map((player) => {
      const context = buildMissionCheckContext(room, player, finalRanksMap);
      const updatedMissions = checkMissions(context, player.missions);

      // Update player's missions
      player.missions = updatedMissions;

      const scoreResult = calculateScore(player.gems, updatedMissions);
      player.finalScore = scoreResult.finalScore;

      return {
        playerId: player.id,
        name: player.name,
        finalScore: scoreResult.finalScore,
        finalRank: 0, // placeholder, resolved by resolveTies
        baseScore: scoreResult.baseScore,
        colorBonus: scoreResult.colorBonuses.reduce(
          (sum, b) => sum + b.bonus,
          0,
        ),
        missionBonus: scoreResult.missionBonus,
        totalGems: player.gems.length,
        missions: updatedMissions,
      };
    });

    // Resolve ties and assign ranks
    const ranked = resolveTies(results);

    // Always run at least two passes so H09 sees preliminary ranks.
    // On later passes, stop when no H09 completion status flipped.
    stable = iterations >= 2;
    if (iterations >= 2) {
      for (const result of ranked) {
        const player = room.players.get(result.playerId);
        if (!player) continue;

        const hardMission = player.missions.find(
          (m) => m.missionId === 'H09',
        );
        if (hardMission) {
          // H09: round3BaseScoreRank > 3 AND finalRank <= 3
          const round3Rank =
            room.round3Ranking.length > 0
              ? room.round3Ranking.indexOf(result.playerId) + 1
              : null;
          const shouldBeCompleted =
            round3Rank !== null &&
            round3Rank > 3 &&
            result.finalRank <= 3;

          if (hardMission.completed !== shouldBeCompleted) {
            stable = false;
          }
        }
      }
    }

    // Set final results and player ranks
    room.finalResults = ranked;
    for (const result of ranked) {
      const player = room.players.get(result.playerId);
      if (player) {
        player.finalRank = result.finalRank;
        player.finalScore = result.finalScore;
      }
    }
  }
}

// ============================================================================
// Helper: build MissionCheckContext for a player
// ============================================================================

/**
 * Build the MissionCheckContext for a player from the room's round history.
 */
function buildMissionCheckContext(
  room: Room,
  player: Player,
  finalRanksMap: Map<string, number>,
): MissionCheckContext {
  const playerGems = player.gems;
  const playerBaseScore = calculateBaseScore(playerGems);
  const { colorCounts } = calculateColorBonus(playerGems);

  // Per-round submissions and gem results
  const roundSubmissions: (number | null)[] = [];
  const roundGemResults: { round: number; gotGem: boolean; gem?: Gem }[] = [];
  let roundsWithGems = 0;

  for (const rh of room.roundHistory) {
    const submission = rh.submissions[player.id] ?? null;
    roundSubmissions.push(submission);

    const gemResult = rh.gemResults.find((gr) => gr.playerId === player.id);
    const gotGem = gemResult?.gotGem ?? false;
    roundGemResults.push({
      round: rh.round,
      gotGem,
      ...(gemResult?.gem !== undefined ? { gem: gemResult.gem } : {}),
    });

    if (gotGem) roundsWithGems++;
  }

  // Round 3 base score rank
  const round3BaseScoreRank =
    room.round3Ranking.length > 0
      ? room.round3Ranking.indexOf(player.id) + 1
      : null;

  // Collision wins: rounds where player was in a non-voided collision
  // group AND got a gem
  let collisionWins = 0;
  for (const rh of room.roundHistory) {
    const inNonVoidedCollision = rh.collisionGroups.some(
      (cg) => !cg.isVoided && cg.playerIds.includes(player.id),
    );
    const gotGemInRound = rh.gemResults.find(
      (gr) => gr.playerId === player.id,
    )?.gotGem;

    if (inNonVoidedCollision && gotGemInRound) {
      collisionWins++;
    }
  }

  // Final rank (from previous iteration, or null on first pass)
  const finalRank = finalRanksMap.get(player.id) ?? null;

  return {
    playerGems,
    playerBaseScore,
    colorCounts: colorCounts as Record<GemColor, number>,
    roundsWithGems,
    roundSubmissions,
    roundGemResults,
    round3BaseScoreRank,
    collisionWins,
    finalRank,
  };
}

// ============================================================================
// Restart game
// ============================================================================

/**
 * Reset the room for a new game.
 *
 * - Increments gameSession (invalidates old reconnect tokens)
 * - Resets phase to LOBBY
 * - Resets all round/game state
 * - Resets each player's game state (numbers, gems, missions, scores)
 */
export function restartGame(room: Room): void {
  room.gameSession++;
  room.phase = 'LOBBY';
  room.currentRound = 0;
  room.currentGems = [];
  room.revealedNumbers = [];
  room.selectionOrder = [];
  room.collisionGroups = [];
  room.voidedNumbers = [];
  room.currentPickerIndex = 0;
  room.round3Ranking = [];
  room.finalResults = [];
  room.revealedResultsCount = 0;
  room.roundHistory = [];
  room.isPaused = false;
  room.pausedPhase = null;
  room.timerRemaining = 0;
  room.timerDeadline = null;

  // Reset each player's game state
  for (const player of room.players.values()) {
    player.availableNumbers = [...INITIAL_NUMBERS];
    player.usedNumbers = [];
    player.roundSubmission = null;
    player.gems = [];
    player.missions = [];
    player.finalScore = 0;
    player.finalRank = null;
    player.isReady = false;
  }
}

// ============================================================================
// Utility exports (for convenience)
// ============================================================================

export {
  TOTAL_ROUNDS,
  GEMS_PER_ROUND,
  COLLISION_VOID_THRESHOLD,
  MISSION_REWARDS,
  type PlayerMission,
  type CollisionGroup,
  type FinalResult,
  type GamePhase,
  type Player,
  type Gem,
};
