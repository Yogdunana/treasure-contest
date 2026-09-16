import type { GemColor } from './types/game.js';

// ============================================================================
// Timer configuration (all values in milliseconds or seconds as labeled)
// ============================================================================

export const TIMING_CONFIG = {
  /** Time limit for number selection phase (seconds). */
  NUMBER_SELECTION_SECONDS: 20,
  /** Time allotted per player for gem picking (seconds). */
  GEM_PICK_SECONDS_PER_PLAYER: 8,
  /** Delay after gems are revealed before proceeding (ms). */
  GEM_REVEAL_DELAY_MS: 7000,
  /** Delay after numbers are revealed before order calculation (ms). */
  NUMBER_REVEAL_DELAY_MS: 8000,
  /** Delay for order calculation processing (ms). */
  ORDER_CALC_DELAY_MS: 5000,
  /** Delay at the end of each round before starting the next (ms). */
  ROUND_END_DELAY_MS: 8000,
  /** Interval between final result reveals (ms). */
  FINAL_REVEAL_INTERVAL_MS: 2500,
} as const;

// ============================================================================
// Queue configuration
// ============================================================================

export const QUEUE_CONFIG = {
  /** Maximum number of players allowed in the waiting queue. */
  MAX_QUEUE_SIZE: 10,
} as const;

// ============================================================================
// Player limits
// ============================================================================

/** Minimum number of players required to start a game. */
export const MIN_PLAYERS = 4;

/** Maximum number of players allowed in a single room. */
export const MAX_PLAYERS = 8;

/** Default target number of players for a room. */
export const DEFAULT_TARGET_PLAYERS = 6;

// ============================================================================
// Game rules
// ============================================================================

/** Total number of rounds in a complete game. */
export const TOTAL_ROUNDS = 6;

/** The set of numbers each player can choose from (1-7). */
export const INITIAL_NUMBERS = [1, 2, 3, 4, 5, 6, 7];

/** Number of gems generated each round. */
export const GEMS_PER_ROUND = 4;

/** Minimum possible value for a gem. */
export const GEM_MIN_VALUE = 1;

/** Maximum possible value for a gem. */
export const GEM_MAX_VALUE = 10;

// ============================================================================
// Colors
// ============================================================================

/** All valid gem colors in the game. */
export const GEM_COLORS: GemColor[] = ['red', 'blue', 'green', 'yellow', 'purple'];

/** Human-readable Chinese labels for each gem color. */
export const GEM_COLOR_LABELS: Record<GemColor, string> = {
  red: '红色',
  blue: '蓝色',
  green: '绿色',
  yellow: '黄色',
  purple: '紫色',
};

/** Emoji representations for each gem color. */
export const GEM_COLOR_EMOJI: Record<GemColor, string> = {
  red: '🔴',
  blue: '🔵',
  green: '🟢',
  yellow: '🟡',
  purple: '🟣',
};

// ============================================================================
// Color bonus tiers
// ============================================================================

/**
 * Color bonus table: maps gem count (per color) to bonus points.
 * Only the highest applicable tier is applied per color.
 * Multiple colors' bonuses stack additively.
 */
export const COLOR_BONUS_TABLE: Record<number, number> = {
  1: 0,
  2: 3,
  3: 8,
  4: 15,
  5: 25,
  6: 40,
};

// ============================================================================
// Mission rewards
// ============================================================================

/** Reward points for completing missions by difficulty. */
export const MISSION_REWARDS = {
  easy: 10,
  medium: 20,
  hard: 35,
} as const;

// ============================================================================
// Collision rules
// ============================================================================

/** 4+ players submitting the same number causes the number to be voided. */
export const COLLISION_VOID_THRESHOLD = 4;

/** 2-3 players submitting the same number is resolved by seat order. */
export const COLLISION_RESOLVE_THRESHOLD = 3;

// ============================================================================
// Opening rules briefing (shown on phones and the big screen)
// ============================================================================

export interface GameRuleSection {
  title: string;
  items: string[];
}

/** Shared copy for the pre-game rules screen. Missions stay off the projector. */
export const GAME_RULE_SECTIONS: GameRuleSection[] = [
  {
    title: '对局概览',
    items: [
      '全场共 6 轮，4–8 人同桌。',
      '开局每人会拿到 3 个秘密任务（简单 / 中等 / 困难各 1 个），只有自己能看见。',
      '每轮出现 4 颗宝石，颜色互不相同，点数 1–10。',
    ],
  },
  {
    title: '选数字',
    items: [
      '每人手里有 1–7，每轮只能打出一张，用过的不能再用。',
      '限时内没出牌，会自动打出你手里最小的数字。',
    ],
  },
  {
    title: '选宝石顺序',
    items: [
      '数字越大的人越先选宝石。',
      '2–3 人出同一数字：按座位号从小到大依次选。',
      '4 人及以上出同一数字：该数字作废，这些人本轮不能选宝石。',
    ],
  },
  {
    title: '计分',
    items: [
      '宝石点数直接计入基础分。',
      '同色越多加成越高：2 颗 +3，3 颗 +8，4 颗 +15，5 颗 +25，6 颗 +40。多色可叠加。',
      '任务完成后额外加分：简单 +10、中等 +20、困难 +35。',
    ],
  },
];
