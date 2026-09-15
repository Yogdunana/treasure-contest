import type { FinalResult, PlayerMission } from '../types/game.js';

/**
 * Compute the bonus from completed missions of a specific difficulty.
 */
function getMissionBonusByDifficulty(
  missions: PlayerMission[],
  difficulty: PlayerMission['difficulty'],
): number {
  return missions
    .filter((m) => m.difficulty === difficulty && m.completed)
    .reduce((sum, m) => sum + m.reward, 0);
}

/**
 * Tiebreaker key used for comparing two players.
 */
interface TiebreakerKey {
  /** Primary rank key: higher total score ranks higher. */
  finalScore: number;
  /** Tiebreaker 1: higher base score ranks higher. */
  baseScore: number;
  /** Tiebreaker 2: higher hard mission bonus ranks higher. */
  hardBonus: number;
  /** Tiebreaker 3: higher medium mission bonus ranks higher. */
  mediumBonus: number;
  /** Tiebreaker 4: more total gems ranks higher. */
  totalGems: number;
}

/**
 * Build the tiebreaker key for a FinalResult.
 */
function buildKey(result: FinalResult): TiebreakerKey {
  return {
    finalScore: result.finalScore,
    baseScore: result.baseScore,
    hardBonus: getMissionBonusByDifficulty(result.missions, 'hard'),
    mediumBonus: getMissionBonusByDifficulty(result.missions, 'medium'),
    totalGems: result.totalGems,
  };
}

/**
 * Check whether two tiebreaker keys are fully tied.
 */
function keysEqual(a: TiebreakerKey, b: TiebreakerKey): boolean {
  return (
    a.finalScore === b.finalScore &&
    a.baseScore === b.baseScore &&
    a.hardBonus === b.hardBonus &&
    a.mediumBonus === b.mediumBonus &&
    a.totalGems === b.totalGems
  );
}

/**
 * Resolve ties in final ranking and assign final ranks.
 *
 * Primary ranking is by total score. Remaining criteria break ties:
 * 1. Higher base score.
 * 2. Higher hard mission bonus.
 * 3. Higher medium mission bonus.
 * 4. More total gems.
 * 5. If still tied: same rank (parallel / competition ranking).
 *
 * Uses competition ranking (1, 2, 2, 4): tied players receive the same rank,
 * and the next non-tied player's rank skips the occupied positions.
 *
 * @param results - Array of FinalResult (unsorted or tied), each with
 *                  finalRank possibly unset or placeholder.
 * @returns A new array sorted by ranking with finalRank assigned.
 */
export function resolveTies(results: FinalResult[]): FinalResult[] {
  // Build sortable entries with tiebreaker keys
  const entries = results.map((result) => ({
    result,
    key: buildKey(result),
  }));

  // Sort by tiebreaker criteria (all descending)
  entries.sort((a, b) => {
    if (b.key.finalScore !== a.key.finalScore) {
      return b.key.finalScore - a.key.finalScore;
    }
    if (b.key.baseScore !== a.key.baseScore) {
      return b.key.baseScore - a.key.baseScore;
    }
    if (b.key.hardBonus !== a.key.hardBonus) {
      return b.key.hardBonus - a.key.hardBonus;
    }
    if (b.key.mediumBonus !== a.key.mediumBonus) {
      return b.key.mediumBonus - a.key.mediumBonus;
    }
    if (b.key.totalGems !== a.key.totalGems) {
      return b.key.totalGems - a.key.totalGems;
    }
    return 0; // fully tied
  });

  // Assign ranks using competition ranking (1, 2, 2, 4, ...)
  const ranked: FinalResult[] = [];
  let currentRank = 1;

  for (let i = 0; i < entries.length; i++) {
    if (i > 0 && !keysEqual(entries[i - 1].key, entries[i].key)) {
      // Not tied with the previous entry: rank = position + 1
      currentRank = i + 1;
    }
    // If tied, currentRank stays the same as the previous tied entry

    ranked.push({
      ...entries[i].result,
      finalRank: currentRank,
    });
  }

  return ranked;
}
