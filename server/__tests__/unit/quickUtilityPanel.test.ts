import { describe, expect, it } from 'vitest';
import { QUICK_UTILITY_PANEL_TITLES, type QuickUtilityPanelKind } from '../../../shared/types/quickUtilityPanel.js';
import {
    PC_HOME_CENTER_INNER_MAX_CLASS,
    PC_HOME_CENTER_SHELL_CLASS,
    PC_HOME_LEFT_COLUMN_CLASS,
    PC_LOBBY_USERS_COLUMN_CLASS,
    PC_QUICK_RAIL_COLUMN_CLASS,
    PC_QUICK_UTILITY_CENTER_SHELL_CLASS,
} from '../../../shared/constants/pcShellLayout.js';
import { QUICK_UTILITY_PANEL_CHROME } from '../../../shared/types/quickUtilityPanel.js';

describe('quickUtilityPanel', () => {
    it('maps all six quick menu kinds to Korean titles', () => {
        const kinds: QuickUtilityPanelKind[] = [
            'quests',
            'exchange',
            'blacksmith',
            'shop',
            'inventory',
            'pet',
            'trainingQuest',
            'detailedStats',
            'monsterCodex',
            'ranking',
            'gameRecords',
            'encyclopedia',
            'announcements',
        ];
        for (const kind of kinds) {
            expect(QUICK_UTILITY_PANEL_TITLES[kind].length).toBeGreaterThan(0);
        }
    });
});

describe('pcShellLayout', () => {
    it('exports Profile-home-aligned column class tokens', () => {
        expect(PC_HOME_LEFT_COLUMN_CLASS).toContain('max-w-[500px]');
        expect(PC_HOME_CENTER_INNER_MAX_CLASS).toContain('1040px');
        expect(PC_HOME_CENTER_SHELL_CLASS).toContain('border-amber-500/45');
        expect(PC_HOME_CENTER_SHELL_CLASS).toContain('bg-transparent');
        expect(PC_QUICK_RAIL_COLUMN_CLASS).toContain('7.5rem');
        expect(PC_LOBBY_USERS_COLUMN_CLASS).toContain('30rem');
        expect(PC_QUICK_UTILITY_CENTER_SHELL_CLASS).toContain('rounded-2xl');
    });
});

describe('quickUtilityPanel chrome', () => {
    it('defines accent chrome for each utility kind', () => {
        expect(QUICK_UTILITY_PANEL_CHROME.shop.iconUrl).toContain('store');
        expect(QUICK_UTILITY_PANEL_CHROME.pet.iconEmoji).toBe('🐾');
    });
});
