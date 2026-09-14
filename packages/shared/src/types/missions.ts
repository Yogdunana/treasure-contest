import type { Gem, GemColor } from './game';

/**
 * The three difficulty tiers for missions.
 * - easy: +10 reward
 * - medium: +20 reward
 * - hard: +35 reward
 */
export type MissionDifficulty = 'easy' | 'medium' | 'hard';

/**
 * A mission definition from the mission pool.
 * 30 missions total: S01-S10 (easy), M01-M10 (medium), H01-H10 (hard).
 * Each player is randomly dealt 1 easy + 1 medium + 1 hard at game start.
 */
export interface Mission {
  id: string;
  difficulty: MissionDifficulty;
  reward: number;
  title: string;
  description: string;
}

/**
 * Context passed to mission check functions at final settlement.
 * Contains all the data needed to evaluate any mission condition.
 *
 * Key fields:
 * - `playerGems`: All gems the player collected across 6 rounds
 * - `playerBaseScore`: Sum of all gem values
 * - `colorCounts`: Count of each color the player owns
 * - `roundsWithGems`: How many rounds the player successfully got a gem
 * - `roundSubmissions`: The number submitted each round (null = timeout/no submit)
 * - `roundGemResults`: Per-round detail of whether the player got a gem and which one
 * - `round3BaseScoreRank`: The player's base-score rank after round 3 (1-based, null if not ranked)
 * - `collisionWins`: Rounds where the player collided with others but still got a gem
 * - `finalRank`: The player's final rank after all tiebreakers (1-based, null if not yet ranked)
 */
export interface MissionCheckContext {
  playerGems: Gem[];
  playerBaseScore: number;
  colorCounts: Record<GemColor, number>;
  roundsWithGems: number;
  roundSubmissions: (number | null)[];
  roundGemResults: { round: number; gotGem: boolean; gem?: Gem }[];
  round3BaseScoreRank: number | null;
  collisionWins: number; // rounds where player collided with others but still got a gem
  finalRank: number | null; // player's final rank, needed for H09 mission check
}
