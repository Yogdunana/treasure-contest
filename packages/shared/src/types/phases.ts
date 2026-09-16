export type GamePhase =
  | 'LOBBY'
  | 'GAME_INIT'
  | 'RULES_BRIEFING'
  | 'MISSION_BRIEFING'
  | 'ROUND_START'
  | 'GEM_REVEAL'
  | 'NUMBER_SELECTION'
  | 'NUMBER_REVEAL'
  | 'ORDER_CALCULATION'
  | 'GEM_SELECTION'
  | 'ROUND_END'
  | 'FINAL_CALCULATION'
  | 'RESULTS_REVEAL'
  | 'GAME_OVER'
  | 'PAUSED';

export const PHASE_ORDER: GamePhase[] = [
  'LOBBY',
  'RULES_BRIEFING',
  'MISSION_BRIEFING',
  'ROUND_START',
  'GEM_REVEAL',
  'NUMBER_SELECTION',
  'NUMBER_REVEAL',
  'ORDER_CALCULATION',
  'GEM_SELECTION',
  'ROUND_END',
  'FINAL_CALCULATION',
  'RESULTS_REVEAL',
  'GAME_OVER',
];

/** Pre-round briefing: everyone reads rules, then their own missions. */
export function isBriefingPhase(phase: GamePhase): boolean {
  return (
    phase === 'RULES_BRIEFING' ||
    phase === 'MISSION_BRIEFING' ||
    phase === 'GAME_INIT'
  );
}

// NOTE: TOTAL_ROUNDS is defined in ../constants.ts as the canonical source.
