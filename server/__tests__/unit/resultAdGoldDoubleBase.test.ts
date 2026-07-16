import { describe, expect, it } from 'vitest';
import { getResultAdGoldDoubleBase } from '../../../components/game/ResultAdGoldDoubleButton.js';

describe('getResultAdGoldDoubleBase', () => {
    it('prefers matchGold when present', () => {
        expect(
            getResultAdGoldDoubleBase({
                gold: 150,
                matchGold: 100,
                vipGoldBonus: 50,
                adGoldBonus: 0,
            }),
        ).toBe(100);
    });

    it('subtracts vip and prior ad bonus from total gold when matchGold is absent', () => {
        expect(
            getResultAdGoldDoubleBase({
                gold: 250,
                vipGoldBonus: 50,
                adGoldBonus: 100,
            }),
        ).toBe(100);
    });

    it('returns 0 when there is no claimable base', () => {
        expect(getResultAdGoldDoubleBase({ gold: 50, vipGoldBonus: 50, adGoldBonus: 0 })).toBe(0);
        expect(getResultAdGoldDoubleBase(null)).toBe(0);
    });
});
