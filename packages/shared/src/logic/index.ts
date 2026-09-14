// Logic barrel file.
// Re-exports all core game logic functions for use by server and client packages.

// Gem generation
export { generateGems } from './gem-generator.js';

// Order calculation (number submission -> selection order)
export { calculateOrder } from './order-calculator.js';
export type { NumberSubmission, OrderResult } from './order-calculator.js';

// Score calculation (base score, color bonus, mission bonus, final score)
export {
  calculateBaseScore,
  calculateColorBonus,
  calculateScore,
} from './score-calculator.js';
export type { ScoreResult } from './score-calculator.js';

// Mission checking (evaluate which missions are completed)
export { checkMissions } from './mission-checker.js';

// Mission dealing (randomly assign 1 easy + 1 medium + 1 hard)
export { dealMissions } from './mission-dealer.js';

// Tiebreaker (resolve ties and assign final ranks)
export { resolveTies } from './tiebreaker.js';

// Validators (number submission, gem selection, phase checks)
export {
  validateNumberSubmission,
  validateGemSelection,
  validatePhase,
} from './validators.js';
