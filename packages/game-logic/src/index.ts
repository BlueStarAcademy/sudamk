// Game logic package
// This will contain Go rules, game mode logic, etc.
// Shared between frontend and backend

export * from './go-logic.js';
export * from './game-modes.js';

// Re-export types
export type { Point, Player, BoardState, Move, ProcessMoveResult } from './go-logic.js';
export { GameMode, STRATEGIC_MODES, PLAYFUL_MODES, getGameModeConfig, isStrategicMode, isPlayfulMode } from './game-modes.js';

