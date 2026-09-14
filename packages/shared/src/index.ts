// Main entry point for @treasure-contest/shared
// Re-exports all type definitions, constants, and mission definitions
// for use by server and client packages.

// Type definitions (GemColor, Gem, Player, Room, Mission, GamePhase, etc.)
export * from './types/index.js';

// Game constants (timing, player limits, gem colors, color bonuses, mission rewards)
export * from './constants.js';

// Mission definitions (30 missions: 10 easy + 10 medium + 10 hard)
export * from './missions/index.js';

// Core game logic (pure functions: gem generation, order calculation, scoring, missions, tiebreakers, validators)
export * from './logic/index.js';
