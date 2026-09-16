import { describe, expect, it } from 'vitest';
import { checkMissions } from './mission-checker.js';
import type { Gem, GemColor, PlayerMission } from '../types/game.js';
import type { MissionCheckContext } from '../types/missions.js';
import { MISSION_REWARDS } from '../constants.js';

function colors(
  partial: Partial<Record<GemColor, number>> = {},
): Record<GemColor, number> {
  return {
    red: 0,
    blue: 0,
    green: 0,
    yellow: 0,
    purple: 0,
    ...partial,
  };
}

function gem(color: GemColor, value: number, id = `${color}-${value}`): Gem {
  return { id, color, value };
}

function ctx(
  overrides: Partial<MissionCheckContext> = {},
): MissionCheckContext {
  return {
    playerGems: [],
    playerBaseScore: 0,
    colorCounts: colors(),
    roundsWithGems: 0,
    roundSubmissions: [],
    roundGemResults: [],
    round3BaseScoreRank: null,
    collisionWins: 0,
    finalRank: null,
    ...overrides,
  };
}

function mission(id: string, difficulty: PlayerMission['difficulty']): PlayerMission {
  return {
    missionId: id,
    difficulty,
    reward: MISSION_REWARDS[difficulty],
    completed: false,
  };
}

function completed(id: string, context: MissionCheckContext): boolean {
  const difficulty: PlayerMission['difficulty'] = id.startsWith('S')
    ? 'easy'
    : id.startsWith('M')
      ? 'medium'
      : 'hard';
  return checkMissions(context, [mission(id, difficulty)])[0]!.completed;
}

describe('mission feasibility under the 6-gem cap', () => {
  it('H05 同色四连 completes with 4 of one color (possible in 6 rounds)', () => {
    expect(
      completed(
        'H05',
        ctx({ colorCounts: colors({ blue: 4, red: 1 }) }),
      ),
    ).toBe(true);
    expect(completed('H05', ctx({ colorCounts: colors({ blue: 3 }) }))).toBe(
      false,
    );
  });

  it('H05 no longer requires two 4-of-a-kind sets (that needed 8 gems)', () => {
    expect(
      completed(
        'H05',
        ctx({ colorCounts: colors({ blue: 4 }) }),
      ),
    ).toBe(true);
  });

  it('H06 三色成双 completes with three pairs (exactly 6 gems)', () => {
    expect(
      completed(
        'H06',
        ctx({ colorCounts: colors({ red: 2, blue: 2, green: 2 }) }),
      ),
    ).toBe(true);
    expect(
      completed(
        'H06',
        ctx({ colorCounts: colors({ red: 2, blue: 2, green: 1 }) }),
      ),
    ).toBe(false);
  });

  it('H06 no longer requires 4 colors with three pairs (that needed 7 gems)', () => {
    expect(
      completed(
        'H06',
        ctx({ colorCounts: colors({ red: 2, blue: 2, green: 2 }) }),
      ),
    ).toBe(true);
  });

  it('H01 still needs 5 of one color, which fits in 6 gems', () => {
    expect(completed('H01', ctx({ colorCounts: colors({ purple: 5 }) }))).toBe(
      true,
    );
    expect(completed('H01', ctx({ colorCounts: colors({ purple: 4 }) }))).toBe(
      false,
    );
  });

  it('H07 completes at 6 gems (one per round)', () => {
    const gems = [
      gem('red', 4),
      gem('blue', 5),
      gem('green', 6),
      gem('yellow', 7),
      gem('purple', 8),
      gem('red', 9),
    ];
    expect(completed('H07', ctx({ playerGems: gems }))).toBe(true);
    expect(completed('H07', ctx({ playerGems: gems.slice(0, 5) }))).toBe(false);
  });
});
