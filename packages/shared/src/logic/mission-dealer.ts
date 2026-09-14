import type { PlayerMission } from '../types/game.js';
import { EASY_MISSIONS } from '../missions/easy-pool.js';
import { MEDIUM_MISSIONS } from '../missions/medium-pool.js';
import { HARD_MISSIONS } from '../missions/hard-pool.js';
import type { Mission } from '../types/missions.js';

/**
 * Pick a random element from a non-empty array.
 */
function pickRandom<T>(array: readonly T[]): T {
  const index = Math.floor(Math.random() * array.length);
  return array[index];
}

/**
 * Convert a Mission definition to a PlayerMission (assigned to a player).
 */
function toPlayerMission(mission: Mission): PlayerMission {
  return {
    missionId: mission.id,
    difficulty: mission.difficulty,
    reward: mission.reward,
    completed: false,
  };
}

/**
 * Randomly deal 3 missions to a player.
 *
 * - 1 random easy mission from the EASY_MISSIONS pool.
 * - 1 random medium mission from the MEDIUM_MISSIONS pool.
 * - 1 random hard mission from the HARD_MISSIONS pool.
 *
 * Since each pool contains missions from a different difficulty tier, there
 * is naturally no duplication across the three dealt missions.
 * All missions start with completed = false.
 *
 * @returns An array of 3 PlayerMission objects (1 easy, 1 medium, 1 hard).
 */
export function dealMissions(): PlayerMission[] {
  const easy = pickRandom(EASY_MISSIONS);
  const medium = pickRandom(MEDIUM_MISSIONS);
  const hard = pickRandom(HARD_MISSIONS);

  return [
    toPlayerMission(easy),
    toPlayerMission(medium),
    toPlayerMission(hard),
  ];
}
