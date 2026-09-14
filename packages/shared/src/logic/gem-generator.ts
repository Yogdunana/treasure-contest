import type { Gem } from '../types/game.js';
import { GEM_COLORS, GEMS_PER_ROUND, GEM_MIN_VALUE, GEM_MAX_VALUE } from '../constants.js';

/**
 * Fisher-Yates shuffle (in-place on a copy).
 * Returns a new shuffled array without mutating the input.
 */
function shuffle<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Returns a random integer in the inclusive range [min, max].
 * Each value has equal probability.
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate 4 gems for a given round.
 *
 * Rules:
 * - Pick 4 unique colors from the 5 available colors (red, blue, green, yellow, purple).
 * - Each gem gets a random value 1-10 (equal probability).
 * - Gem ID format: `gem_r{round}_{index}` (e.g. gem_r1_0, gem_r1_1, ...).
 * - Returns an array of Gem objects without `pickedBy` / `pickOrder`.
 *
 * @param round - The round number (1-based).
 * @returns Array of 4 Gem objects.
 */
export function generateGems(round: number): Gem[] {
  // 1. Shuffle all 5 colors and take the first 4 (guarantees uniqueness within the round)
  const selectedColors = shuffle(GEM_COLORS).slice(0, GEMS_PER_ROUND);

  // 2. For each color, generate a random value 1-10
  // 3. Create gem with id `gem_r${round}_${index}`
  return selectedColors.map((color, index) => ({
    id: `gem_r${round}_${index}`,
    color,
    value: randomInt(GEM_MIN_VALUE, GEM_MAX_VALUE),
  }));
}
