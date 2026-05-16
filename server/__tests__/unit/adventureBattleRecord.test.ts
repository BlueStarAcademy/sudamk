import { describe, expect, it } from 'vitest';
import {
    formatAdventureModeWinLossRecord,
    getAdventureBattleRecordSummary,
} from '../../../utils/adventureBattleRecord.js';

describe('adventureBattleRecord', () => {
    it('summarizes caught, missed, and per-mode records', () => {
        const summary = getAdventureBattleRecordSummary({
            monstersDefeatedTotal: 10,
            monstersMissedTotal: 4,
            monstersDefeatedByMode: { classic: 6, capture: 4 },
            monstersMissedByMode: { classic: 2, capture: 2 },
        });
        expect(summary.caught).toBe(10);
        expect(summary.missed).toBe(4);
        expect(summary.total).toBe(14);
        const classic = summary.byMode.find((r) => r.mode === 'classic');
        expect(classic).toMatchObject({ wins: 6, losses: 2, winRatePercent: 75 });
    });

    it('formats mode record as N승N패(N%)', () => {
        expect(formatAdventureModeWinLossRecord(3, 1, 75)).toBe('3승1패(75%)');
        expect(formatAdventureModeWinLossRecord(0, 0, null)).toBe('0승0패(—)');
    });
});
