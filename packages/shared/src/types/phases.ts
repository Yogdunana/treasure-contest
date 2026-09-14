export type GamePhase =
  | 'LOBBY'
  | 'GAME_INIT'
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
  'GAME_INIT',
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

// NOTE: TOTAL_ROUNDS is defined in ../constants.ts as the canonical source.
