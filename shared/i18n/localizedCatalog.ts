import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GameMode } from '../../types.js';
import type { ItemGrade } from '../../types/enums.js';
import type { EquipmentSlot } from '../../types.js';
import type { QuickUtilityPanelKind } from '../types/quickUtilityPanel.js';
import type { LobbyGameModeDefinition } from '../constants/gameModes.js';
import { SPEED_PER_MOVE_SECONDS } from '../constants/speedTimePressure.js';
import {
    GAME_MODE_SLUG,
    translateGameMode,
    translateGameModeDescription,
    translateQuickUtilityPanel,
    tx,
} from './runtimeText.js';

export { GAME_MODE_SLUG, translateGameMode, translateGameModeDescription, translateQuickUtilityPanel, tx };

export function useLocalizedGameMode() {
    const { t } = useTranslation('gameModes');
    return useCallback(
        (mode: GameMode) => {
            const slug = GAME_MODE_SLUG[mode];
            return t(slug, { defaultValue: mode });
        },
        [t],
    );
}

export function useLocalizedGameModeDescription() {
    const { t } = useTranslation('gameModes');
    return useCallback(
        (mode: GameMode, fallback = '') => {
            const slug = GAME_MODE_SLUG[mode];
            return t(`descriptions.${slug}`, {
                defaultValue: fallback,
                seconds: SPEED_PER_MOVE_SECONDS,
            });
        },
        [t],
    );
}

/** Lobby cards: localized name + description from static mode definitions. */
export function useLocalizedLobbyGameModes(modes: readonly LobbyGameModeDefinition[]) {
    const localizeName = useLocalizedGameMode();
    const localizeDescription = useLocalizedGameModeDescription();
    return useMemo(
        () =>
            modes.map((entry) => ({
                ...entry,
                name: localizeName(entry.mode),
                description: localizeDescription(entry.mode, entry.description),
            })),
        [modes, localizeName, localizeDescription],
    );
}

export function useLocalizedQuickUtilityPanel() {
    const { t } = useTranslation('nav');
    return useCallback(
        (kind: QuickUtilityPanelKind) => t(`quickMenu.${kind}`, { defaultValue: kind }),
        [t],
    );
}

const ITEM_GRADE_KEYS: Record<ItemGrade, string> = {
    normal: 'filters.gradeNormal',
    uncommon: 'filters.gradeUncommon',
    rare: 'filters.gradeRare',
    epic: 'filters.gradeEpic',
    legendary: 'filters.gradeLegendary',
    mythic: 'filters.gradeMythic',
    transcendent: 'filters.gradeTranscendent',
};

/** Item grade display names (exchange filter labels). */
export function useLocalizedItemGrade() {
    const { t } = useTranslation('exchange');
    return useCallback((grade: ItemGrade) => t(ITEM_GRADE_KEYS[grade]), [t]);
}

const EQUIPMENT_SLOT_KEYS: Record<EquipmentSlot, string> = {
    fan: 'filters.slotFan',
    board: 'filters.slotBoard',
    top: 'filters.slotTop',
    bottom: 'filters.slotBottom',
    bowl: 'filters.slotBowl',
    stones: 'filters.slotStones',
};

/** Equipment slot display names. */
export function useLocalizedEquipmentSlot() {
    const { t } = useTranslation('exchange');
    return useCallback((slot: EquipmentSlot) => t(EQUIPMENT_SLOT_KEYS[slot]), [t]);
}
