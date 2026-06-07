import { describe, expect, it } from 'vitest';
import {
    defaultDetailedStatResetScope,
    formatDetailedStatRecordLine,
    getAvailableDetailedStatResetScopes,
} from '../../../shared/utils/detailedStatResetUi.js';

describe('detailedStatResetUi', () => {
    it('formats record lines with win rate', () => {
        expect(formatDetailedStatRecordLine({ wins: 3, losses: 1 })).toBe('3승 1패 (75%)');
    });

    it('offers scope choices based on available records', () => {
        expect(getAvailableDetailedStatResetScopes({ wins: 2, losses: 0 }, { wins: 0, losses: 0 })).toEqual(['pvp']);
        expect(getAvailableDetailedStatResetScopes({ wins: 0, losses: 0 }, { wins: 1, losses: 1 })).toEqual(['ai']);
        expect(getAvailableDetailedStatResetScopes({ wins: 0, losses: 0 }, { wins: 0, losses: 0 })).toEqual([]);
        expect(getAvailableDetailedStatResetScopes({ wins: 2, losses: 1 }, { wins: 1, losses: 0 })).toEqual([
            'pvp',
            'ai',
            'both',
        ]);
        expect(defaultDetailedStatResetScope({ wins: 2, losses: 0 }, { wins: 1, losses: 0 })).toBe('pvp');
    });
});
