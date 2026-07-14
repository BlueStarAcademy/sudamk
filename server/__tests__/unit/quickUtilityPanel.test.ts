import { describe, expect, it } from 'vitest';
import { QUICK_UTILITY_PANEL_TITLES, type QuickUtilityPanelKind } from '../../../shared/types/quickUtilityPanel.js';
import type { InventoryItem } from '../../../types.js';
import {
    MOBILE_VIEWPORT_ENTRY_TITLES,
    type MobileViewportEntry,
} from '../../../shared/types/mobileViewportStack.js';
import {
    getQuickUtilityKindFromStack,
    getMobileViewportStackTop,
    isMobileViewportEntryTypeActive,
    mobileViewportStacksEqual,
} from '../../../shared/utils/mobileViewportStackUtils.js';
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
            'help',
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
    it('defines accent chrome and WebP icons for each utility kind', () => {
        expect(QUICK_UTILITY_PANEL_CHROME.shop.iconUrl).toContain('store');
        expect(QUICK_UTILITY_PANEL_CHROME.pet.iconUrl).toContain('pet.webp');
        expect(QUICK_UTILITY_PANEL_CHROME.ranking.iconUrl).toContain('ranking.webp');
        expect(QUICK_UTILITY_PANEL_CHROME.announcements.iconUrl).toContain('news.webp');
        expect(QUICK_UTILITY_PANEL_CHROME.encyclopedia.iconUrl).toContain('encyclopedia.webp');
        expect(QUICK_UTILITY_PANEL_CHROME.help.iconUrl).toContain('help.webp');
        expect(QUICK_UTILITY_PANEL_CHROME.pet.iconEmoji).toBeUndefined();
        expect(QUICK_UTILITY_PANEL_CHROME.help.iconEmoji).toBeUndefined();
    });
});

describe('mobileViewportStack', () => {
    it('maps all entry types to Korean titles', () => {
        const types = Object.keys(MOBILE_VIEWPORT_ENTRY_TITLES) as Array<keyof typeof MOBILE_VIEWPORT_ENTRY_TITLES>;
        for (const type of types) {
            if (type === 'quickUtility') continue;
            expect(MOBILE_VIEWPORT_ENTRY_TITLES[type].length).toBeGreaterThan(0);
        }
    });

    it('resolves quick utility kind from stack tail', () => {
        const mockItem = { id: 'item-1', name: 'Test', type: 'equipment' } as InventoryItem;
        const stack: MobileViewportEntry[] = [
            { type: 'quickUtility', kind: 'inventory' },
            { type: 'itemDetail', item: mockItem, isOwnedByCurrentUser: true },
        ];
        expect(getQuickUtilityKindFromStack(stack)).toBe('inventory');
        expect(getMobileViewportStackTop(stack)?.type).toBe('itemDetail');
        expect(isMobileViewportEntryTypeActive(stack, 'itemDetail')).toBe(true);
        expect(isMobileViewportEntryTypeActive(stack, 'settings')).toBe(false);
    });

    it('compares stacks by entry type sequence', () => {
        const a: MobileViewportEntry[] = [{ type: 'settings' }, { type: 'mailbox' }];
        const b: MobileViewportEntry[] = [{ type: 'settings' }, { type: 'mailbox' }];
        const c: MobileViewportEntry[] = [{ type: 'settings' }];
        expect(mobileViewportStacksEqual(a, b)).toBe(true);
        expect(mobileViewportStacksEqual(a, c)).toBe(false);
    });
});
