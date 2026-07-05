import { describe, expect, it } from 'vitest';
import {
    applyInstantDailyUsage,
    computeDesiredExchangeAmountFromMarketRate,
    computeMarketAverageGoldPerDiamondFromOrders,
    computeOrderUnitGoldPerDiamond,
    getInstantDailyRemaining,
    normalizeInstantDailyUsage,
    resolveMarketDisplayGoldPerDiamond,
    validateInstantExchangeDailyLimit,
} from '../../../shared/utils/currencyExchange.js';
import { getStartOfDayKST } from '../../../shared/utils/timeUtils.js';

describe('instant daily exchange limits', () => {
    const now = getStartOfDayKST(Date.UTC(2026, 6, 5, 12, 0, 0)) + 60_000;

    it('resets usage on a new KST day', () => {
        const yesterday = now - 24 * 60 * 60 * 1000;
        const normalized = normalizeInstantDailyUsage(
            { lastResetDayKST: getStartOfDayKST(yesterday), goldSpent: 400_000, diamondsSpent: 50 },
            now,
        );
        expect(normalized.goldSpent).toBe(0);
        expect(normalized.diamondsSpent).toBe(0);
    });

    it('caps gold instant exchange at 500,000 gold / 100 diamonds per day', () => {
        const usage = { lastResetDayKST: getStartOfDayKST(now), goldSpent: 450_000, diamondsSpent: 0 };
        const err = validateInstantExchangeDailyLimit('gold_to_diamonds', usage, 60_000, 0, 12, 0, now);
        expect(err).toMatch(/골드 한도/);

        const ok = validateInstantExchangeDailyLimit('gold_to_diamonds', usage, 50_000, 0, 10, 0, now);
        expect(ok).toBeNull();

        const updated = applyInstantDailyUsage(usage, 'gold_to_diamonds', 50_000, 0, now);
        expect(updated.goldSpent).toBe(500_000);
    });

    it('caps diamond instant exchange at 100 diamonds / 250,000 gold per day', () => {
        const usage = { lastResetDayKST: getStartOfDayKST(now), goldSpent: 0, diamondsSpent: 90 };
        const err = validateInstantExchangeDailyLimit('diamonds_to_gold', usage, 0, 15, 0, 37_500, now);
        expect(err).toMatch(/다이아 한도/);

        const remaining = getInstantDailyRemaining(usage, now);
        expect(remaining.maxDiamondsInput).toBe(10);
        expect(remaining.goldReceiveRemaining).toBe(25_000);
    });
});

describe('market average rate', () => {
    it('uses weighted average from open orders in the same direction', () => {
        const orders = [
            {
                status: 'open' as const,
                fromCurrency: 'gold' as const,
                fromAmount: 10_000,
                toAmount: 2,
            },
            {
                status: 'open' as const,
                fromCurrency: 'gold' as const,
                fromAmount: 20_000,
                toAmount: 3,
            },
        ];
        expect(computeMarketAverageGoldPerDiamondFromOrders(orders, 'gold')).toBe(6000);
    });

    it('falls back to instant rate when no matching orders exist', () => {
        const resolved = resolveMarketDisplayGoldPerDiamond([], 'gold');
        expect(resolved.isFromMarket).toBe(false);
        expect(resolved.goldPerDiamond).toBe(5000);
    });

    it('computes desired receive amount from average market rate', () => {
        expect(computeDesiredExchangeAmountFromMarketRate('gold', 50_000, 5000)).toBe(10);
        expect(computeDesiredExchangeAmountFromMarketRate('diamonds', 10, 2500)).toBe(25_000);
        expect(computeDesiredExchangeAmountFromMarketRate('gold', 0, 5000)).toBe(0);
    });

    it('computes order unit gold per diamond for list display', () => {
        expect(
            computeOrderUnitGoldPerDiamond({ fromCurrency: 'gold', fromAmount: 50_000, toAmount: 10 }),
        ).toBe(5000);
        expect(
            computeOrderUnitGoldPerDiamond({ fromCurrency: 'diamonds', fromAmount: 10, toAmount: 25_000 }),
        ).toBe(2500);
    });
});
