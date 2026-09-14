import type { Gem, GemColor, PlayerMission } from '../types/game.js';
import type { MissionCheckContext } from '../types/missions.js';

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Count the number of distinct colors the player owns (count > 0).
 */
function countDistinctColors(colorCounts: Record<GemColor, number>): number {
  return (Object.values(colorCounts) as number[]).filter((c) => c > 0).length;
}

/**
 * Count gems whose value is greater than or equal to a threshold.
 */
function countGemsWithValueAtLeast(gems: Gem[], threshold: number): number {
  return gems.filter((g) => g.value >= threshold).length;
}

/**
 * Count gems whose value equals an exact number.
 */
function countGemsWithValueExactly(gems: Gem[], value: number): number {
  return gems.filter((g) => g.value === value).length;
}

/**
 * Check whether any two gems share the same value.
 */
function hasPairSameValue(gems: Gem[]): boolean {
  const values = gems.map((g) => g.value);
  return new Set(values).size !== values.length;
}

/**
 * Count how many colors have at least `threshold` gems.
 */
function countColorsWithAtLeast(
  colorCounts: Record<GemColor, number>,
  threshold: number,
): number {
  return (Object.values(colorCounts) as number[]).filter((c) => c >= threshold)
    .length;
}

// ============================================================================
// Mission check function
// ============================================================================

/**
 * Evaluate a single mission condition and return whether it is completed.
 *
 * @param missionId - The mission ID (e.g. 'S01', 'M05', 'H09').
 * @param ctx - The mission check context with all player data.
 * @returns true if the mission condition is satisfied.
 */
function checkMissionCondition(
  missionId: string,
  ctx: MissionCheckContext,
): boolean {
  const {
    playerGems,
    playerBaseScore,
    colorCounts,
    roundsWithGems,
    roundGemResults,
    round3BaseScoreRank,
    collisionWins,
    finalRank,
  } = ctx;

  switch (missionId) {
    // ---- Easy missions (S01-S10) ----

    // S01-S05: colorCounts[color] >= 2
    case 'S01':
      return colorCounts.blue >= 2;
    case 'S02':
      return colorCounts.red >= 2;
    case 'S03':
      return colorCounts.green >= 2;
    case 'S04':
      return colorCounts.yellow >= 2;
    case 'S05':
      return colorCounts.purple >= 2;

    // S06: at least 3 distinct colors
    case 'S06':
      return countDistinctColors(colorCounts) >= 3;

    // S07: base score >= 20
    case 'S07':
      return playerBaseScore >= 20;

    // S08: any gem value >= 7
    case 'S08':
      return playerGems.some((g) => g.value >= 7);

    // S09: any two gems with the same value
    case 'S09':
      return hasPairSameValue(playerGems);

    // S10: rounds with gems >= 4
    case 'S10':
      return roundsWithGems >= 4;

    // ---- Medium missions (M01-M10) ----

    // M01: distinct colors >= 3 AND any color count >= 3
    case 'M01':
      return (
        countDistinctColors(colorCounts) >= 3 &&
        countColorsWithAtLeast(colorCounts, 3) >= 1
      );

    // M02: blue >= 3
    case 'M02':
      return colorCounts.blue >= 3;

    // M03: red >= 3
    case 'M03':
      return colorCounts.red >= 3;

    // M04: distinct colors >= 4
    case 'M04':
      return countDistinctColors(colorCounts) >= 4;

    // M05: at least 3 gems with value >= 8
    case 'M05':
      return countGemsWithValueAtLeast(playerGems, 8) >= 3;

    // M06: base score >= 35
    case 'M06':
      return playerBaseScore >= 35;

    // M07: at least 2 colors with count >= 3
    case 'M07':
      return countColorsWithAtLeast(colorCounts, 3) >= 2;

    // M08: at least 2 gems with value === 10
    case 'M08':
      return countGemsWithValueExactly(playerGems, 10) >= 2;

    // M09: any color count >= 3 AND base score >= 30
    case 'M09':
      return (
        countColorsWithAtLeast(colorCounts, 3) >= 1 && playerBaseScore >= 30
      );

    // M10: round 6 (index 5) got gem AND gem value >= 8
    case 'M10': {
      const round6 = roundGemResults[5];
      return (
        round6?.gotGem === true &&
        round6?.gem !== undefined &&
        round6.gem.value >= 8
      );
    }

    // ---- Hard missions (H01-H10) ----

    // H01: any color count >= 5
    case 'H01':
      return countColorsWithAtLeast(colorCounts, 5) >= 1;

    // H02: all 5 colors present
    case 'H02':
      return countDistinctColors(colorCounts) === 5;

    // H03: at least 3 gems with value >= 9
    case 'H03':
      return countGemsWithValueAtLeast(playerGems, 9) >= 3;

    // H04: base score >= 45
    case 'H04':
      return playerBaseScore >= 45;

    // H05: at least 2 colors with count >= 4
    case 'H05':
      return countColorsWithAtLeast(colorCounts, 4) >= 2;

    // H06: distinct colors >= 4 AND at least 3 colors with count >= 2
    case 'H06':
      return (
        countDistinctColors(colorCounts) >= 4 &&
        countColorsWithAtLeast(colorCounts, 2) >= 3
      );

    // H07: total gems >= 6
    case 'H07':
      return playerGems.length >= 6;

    // H08: collision wins >= 2
    case 'H08':
      return collisionWins >= 2;

    // H09: round3 rank > 3 AND final rank <= 3
    case 'H09':
      return (
        round3BaseScoreRank !== null &&
        round3BaseScoreRank > 3 &&
        finalRank !== null &&
        finalRank <= 3
      );

    // H10: base score >= 40 AND distinct colors >= 4
    case 'H10':
      return (
        playerBaseScore >= 40 && countDistinctColors(colorCounts) >= 4
      );

    default:
      // Unknown mission ID: not completed
      return false;
  }
}

/**
 * Check which missions are completed for a player.
 *
 * Takes a MissionCheckContext (with all player data including final rank)
 * and an array of the player's 3 assigned PlayerMissions. For each mission,
 * the condition is evaluated based on the mission ID. Returns a new array
 * of PlayerMissions with the `completed` field updated.
 *
 * @param context - All data needed to evaluate mission conditions.
 * @param missions - The player's 3 assigned missions.
 * @returns Updated PlayerMission array with completed status set.
 */
export function checkMissions(
  context: MissionCheckContext,
  missions: PlayerMission[],
): PlayerMission[] {
  return missions.map((mission) => ({
    ...mission,
    completed: checkMissionCondition(mission.missionId, context),
  }));
}
