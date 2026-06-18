import i18n from './config.js';
import type { ArenaEntranceKey } from '../../constants/arenaEntrance.js';
import { GameMode } from '../../types.js';
import type { QuickUtilityPanelKind } from '../types/quickUtilityPanel.js';
import { SPEED_PER_MOVE_SECONDS } from '../constants/speedTimePressure.js';

const GAME_MODE_SLUG: Record<GameMode, string> = {
    [GameMode.Standard]: 'standard',
    [GameMode.Capture]: 'capture',
    [GameMode.Speed]: 'speed',
    [GameMode.Base]: 'base',
    [GameMode.Hidden]: 'hidden',
    [GameMode.Missile]: 'missile',
    [GameMode.Uniform]: 'uniform',
    [GameMode.Castle]: 'castle',
    [GameMode.Chess]: 'chess',
    [GameMode.Mix]: 'mix',
    [GameMode.Dice]: 'dice',
    [GameMode.Omok]: 'omok',
    [GameMode.Ttamok]: 'ttamok',
    [GameMode.Thief]: 'thief',
    [GameMode.Alkkagi]: 'alkkagi',
    [GameMode.Curling]: 'curling',
};

/** Non-React i18n lookup — use for constants, alerts, shared utilities. */
export function tx(key: string, options?: Record<string, unknown>): string {
    return i18n.t(key, options ?? {});
}

const ITEM_GRADE_I18N_KEYS: Record<string, string> = {
    normal: 'exchange:filters.gradeNormal',
    uncommon: 'exchange:filters.gradeUncommon',
    rare: 'exchange:filters.gradeRare',
    epic: 'exchange:filters.gradeEpic',
    legendary: 'exchange:filters.gradeLegendary',
    mythic: 'exchange:filters.gradeMythic',
    transcendent: 'exchange:filters.gradeTranscendent',
};

/** Localized equipment/pet grade label (replaces EQUIPMENT_GRADE_LABEL_KO in UI). */
export function translateItemGrade(grade: string, fallback?: string): string {
    const key = ITEM_GRADE_I18N_KEYS[grade];
    if (!key) return fallback ?? grade;
    return tx(key, { defaultValue: fallback ?? grade });
}

export function translateGameMode(mode: GameMode): string {
    const slug = GAME_MODE_SLUG[mode];
    return tx(`gameModes:${slug}`, { defaultValue: mode });
}

export function translateGameModeDescription(slug: string, fallback = ''): string {
    return tx(`gameModes:descriptions.${slug}`, {
        defaultValue: fallback,
        seconds: SPEED_PER_MOVE_SECONDS,
    });
}

export function translateQuickUtilityPanel(kind: QuickUtilityPanelKind): string {
    return tx(`nav:quickMenu.${kind}`, { defaultValue: kind });
}

export function translateArenaEntranceLabel(key: ArenaEntranceKey): string {
    return tx(`nav:arenaEntrance.${key}`, { defaultValue: key });
}

export function translateArenaEntranceClosed(key: ArenaEntranceKey): string {
    return tx(`nav:alerts.entranceClosed.${key}`, { defaultValue: key });
}

import {
    CHAMPIONSHIP_MIN_BADUK_ABILITY_TOTAL,
    PVP_LOBBIES_MIN_COMBINED_LEVEL,
} from '../utils/contentProgressionGates.js';

export function translateArenaProgressionBlocked(key: ArenaEntranceKey): string {
    return tx(`nav:alerts.progressionBlocked.${key}`, {
        level: PVP_LOBBIES_MIN_COMBINED_LEVEL,
        ability: CHAMPIONSHIP_MIN_BADUK_ABILITY_TOTAL,
        defaultValue: '',
    });
}

export { GAME_MODE_SLUG };
