import type { Gem, GemColor, ColorBonus, PlayerMission } from '../types/game.js';
import { GEM_COLORS, COLOR_BONUS_TABLE } from '../constants.js';

/**
 * Build an empty color counts record with all five colors initialized to 0.
 */
function emptyColorCounts(): Record<GemColor, number> {
  return { red: 0, blue: 0, green: 0, yellow: 0, purple: 0 };
}

/**
 * Count how many gems the player has of each color.
 */
function countColors(gems: Gem[]): Record<GemColor, number> {
  const counts = emptyColorCounts();
  for (const gem of gems) {
    counts[gem.color]++;
  }
  return counts;
}

/**
 * Look up the color bonus for a given count using the tier table.
 * The highest applicable tier (where count >= tier key) is used.
 * For counts exceeding the table maximum, the highest tier bonus applies.
 */
function getColorBonusForCount(count: number): number {
  const tiers = Object.keys(COLOR_BONUS_TABLE)
    .map(Number)
    .sort((a, b) => a - b);

  let bonus = 0;
  for (const tier of tiers) {
    if (count >= tier) {
      bonus = COLOR_BONUS_TABLE[tier];
    }
  }
  return bonus;
}

/**
 * Calculate the base score (sum of all gem values).
 *
 * @param gems - All gems the player collected.
 * @returns The sum of gem values.
 */
export function calculateBaseScore(gems: Gem[]): number {
  return gems.reduce((sum, gem) => sum + gem.value, 0);
}

/**
 * Calculate the color bonus for a set of gems.
 *
 * For each color, the highest applicable tier from COLOR_BONUS_TABLE is applied.
 * Only colors with a bonus > 0 (i.e. count >= 2) are included in the result.
 * Multiple colors' bonuses stack additively.
 *
 * @param gems - All gems the player collected.
 * @returns The color bonus breakdown, total bonus, and per-color counts.
 */
export function calculateColorBonus(gems: Gem[]): {
  bonuses: ColorBonus[];
  totalBonus: number;
  colorCounts: Record<GemColor, number>;
} {
  const colorCounts = countColors(gems);
  const bonuses: ColorBonus[] = [];
  let totalBonus = 0;

  for (const color of GEM_COLORS) {
    const count = colorCounts[color];
    const bonus = getColorBonusForCount(count);
    if (bonus > 0) {
      bonuses.push({ color, count, bonus });
      totalBonus += bonus;
    }
  }

  return { bonuses, totalBonus, colorCounts };
}

/**
 * Complete score calculation result.
 */
export interface ScoreResult {
  /** Sum of all gem values. */
  baseScore: number;
  /** Per-color bonus breakdown (only colors with bonus > 0). */
  colorBonuses: ColorBonus[];
  /** Sum of rewards for completed missions. */
  missionBonus: number;
  /** Final score = baseScore + colorBonus + missionBonus. */
  finalScore: number;
  /** Per-color gem counts. */
  colorCounts: Record<GemColor, number>;
}

/**
 * Calculate the full score for a player.
 *
 * - Base score = sum of all gem values.
 * - Color bonus = sum of per-color bonuses (highest tier per color, stacks).
 * - Mission bonus = sum of rewards for completed missions
 *   (easy = +10, medium = +20, hard = +35).
 * - Final score = base score + color bonus + mission bonus.
 *
 * @param gems - All gems the player collected across 6 rounds.
 * @param missions - The player's 3 assigned missions (with completed status set).
 * @returns The complete score breakdown.
 */
export function calculateScore(gems: Gem[], missions: PlayerMission[]): ScoreResult {
  const baseScore = calculateBaseScore(gems);
  const { bonuses, totalBonus, colorCounts } = calculateColorBonus(gems);

  const missionBonus = missions
    .filter((m) => m.completed)
    .reduce((sum, m) => sum + m.reward, 0);

  const finalScore = baseScore + totalBonus + missionBonus;

  return {
    baseScore,
    colorBonuses: bonuses,
    missionBonus,
    finalScore,
    colorCounts,
  };
}
