// Mission pool barrel file.
// Re-exports all mission definitions and a combined array of all 30 missions.

export { EASY_MISSIONS } from './easy-pool.js';
export { MEDIUM_MISSIONS } from './medium-pool.js';
export { HARD_MISSIONS } from './hard-pool.js';

import { EASY_MISSIONS } from './easy-pool.js';
import { MEDIUM_MISSIONS } from './medium-pool.js';
import { HARD_MISSIONS } from './hard-pool.js';

/** All 30 missions combined (10 easy + 10 medium + 10 hard). */
export const ALL_MISSIONS = [
  ...EASY_MISSIONS,
  ...MEDIUM_MISSIONS,
  ...HARD_MISSIONS,
];
