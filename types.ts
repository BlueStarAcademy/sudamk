// This file acts as a barrel file, re-exporting all types from the new modular structure.
// This allows other files to continue importing from './types.js' without any changes.

export * from './types/enums';
export * from './types/entities';
export * from './types/api';
export * from './types/navigation';
export type { Theme, SoundCategory, GraphicsSettings, SoundSettings, FeatureSettings, AppSettings, PanelEdgeStyle, AppLocale } from './types/settings';
// Resolve export * ambiguity: entities re-exports these from shared enums; prefer enums path.
export type { Point, Move, BoardState } from './types/enums';
