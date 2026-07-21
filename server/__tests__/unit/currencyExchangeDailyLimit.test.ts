import { describe, expect, it } from 'vitest';
import {
    applyInstantDailyUsage,
    clampInstantExchangeInputToDailyLimit,
    computeDesiredExchangeAmountFromMarketRate,
    computeInstantDiamondsToGold,
    computeInstantGoldToDiamonds,
    computeMarketAverageGoldPerDiamondFromOrders,
    computeOrderUnitGoldPerDiamond,
    getInstantDailyRemaining,
    normalizeInstantDailyUsage,
    resolveMarketDisplayGoldPerDiamond,
    validateInstantExchangeDailyLimit,
} from '../../../shared/utils/currencyExchange.js';
import {
    CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_BUY,
    CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_SELL,
    CURRENCY_EXCHANGE_INSTANT_MIN_DIAMONDS,
} from '../../../shared/constants/currencyExchange.js';
import { getStartOfDayKST } from '../../../shared/utils/timeUtils.js';

describe('instant daily exchange limits', () => {
    const now = getStartOfDayKST(Date.UTC(2026, 6, 5, 12, 0, 0)) + 60_000;
    const buyRate = CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_BUY;
    const sellRate = CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_SELL;

    it('resets usage on a new KST day', () => {
        const yesterday = now - 24 * 60 * 60 * 1000;
        const normalized = normalizeInstantDailyUsage(
            { lastResetDayKST: getStartOfDayKST(yesterday), goldSpent: 400_000, diamondsSpent: 50 },
            now,
        );
        expect(normalized.goldSpent).toBe(0);
        expect(normalized.diamondsSpent).toBe(0);
    });

    it('caps gold instant exchange at daily gold / diamond limits', () => {
        const usage = { lastResetDayKST: getStartOfDayKST(now), goldSpent: buyRate * 90, diamondsSpent: 0 };
        const err = validateInstantExchangeDailyLimit('gold_to_diamonds', usage, buyRate * 20, 0, 20, 0, now);
        expect(err).toMatch(/골드 한도|다이아 수령 한도/);

        const ok = validateInstantExchangeDailyLimit('gold_to_diamonds', usage, buyRate * 10, 0, 10, 0, now);
        expect(ok).toBeNull();

        const updated = applyInstantDailyUsage(usage, 'gold_to_diamonds', buyRate * 10, 0, now);
        expect(updated.goldSpent).toBe(buyRate * 100);
    });

    it('caps diamond instant exchange at daily diamond / gold limits', () => {
        const usage = { lastResetDayKST: getStartOfDayKST(now), goldSpent: 0, diamondsSpent: 90 };
        const err = validateInstantExchangeDailyLimit('diamonds_to_gold', usage, 0, 15, 0, 15 * sellRate, now);
        expect(err).toMatch(/다이아 한도/);

        const remaining = getInstantDailyRemaining(usage, now);
        expect(remaining.maxDiamondsInput).toBe(10);
        expect(remaining.goldReceiveRemaining).toBe(10 * sellRate);
    });

    it('clamps requested amount down to 100% of remaining daily limit', () => {
        const usage = { lastResetDayKST: getStartOfDayKST(now), goldSpent: buyRate * 90, diamondsSpent: 0 };
        const remaining = getInstantDailyRemaining(usage, now);
        expect(remaining.maxGoldInput).toBe(buyRate * 10);

        expect(clampInstantExchangeInputToDailyLimit('gold_to_diamonds', buyRate * 50, usage, now)).toBe(
            remaining.maxGoldInput,
        );
        expect(clampInstantExchangeInputToDailyLimit('gold_to_diamonds', buyRate * 5, usage, now)).toBe(buyRate * 5);

        const diaUsage = { lastResetDayKST: getStartOfDayKST(now), goldSpent: 0, diamondsSpent: 40 };
        const diaRemaining = getInstantDailyRemaining(diaUsage, now);
        expect(diaRemaining.maxDiamondsInput).toBe(60);
        expect(clampInstantExchangeInputToDailyLimit('diamonds_to_gold', 100, diaUsage, now)).toBe(60);
        expect(clampInstantExchangeInputToDailyLimit('diamonds_to_gold', 55, diaUsage, now)).toBe(55);
    });
});

describe('instant exchange rates and fees', () => {
    it('buys diamonds at 4800 gold each and adds 10% fee on gold paid', () => {
        const result = computeInstantGoldToDiamonds(4800 * 50);
        expect(result.diamonds).toBe(50);
        expect(result.diamondsGross).toBe(50);
        expect(result.goldSpent).toBe(240_000);
        expect(result.fee).toBe(24_000);
        expect(result.totalGoldPaid).toBe(264_000);
    });

    it('sells diamonds at 2000 gold each with min 50 and 10% fee on diamonds paid', () => {
        expect(computeInstantDiamondsToGold(CURRENCY_EXCHANGE_INSTANT_MIN_DIAMONDS - 1).gold).toBe(0);

        const result = computeInstantDiamondsToGold(50);
        expect(result.diamondsSpent).toBe(50);
        expect(result.gold).toBe(100_000);
        expect(result.goldGross).toBe(100_000);
        expect(result.fee).toBe(5);
        expect(result.totalDiamondsPaid).toBe(55);
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
        expect(resolved.goldPerDiamond).toBe(CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_BUY);
    });

    it('computes desired receive amount from average market rate', () => {
        expect(computeDesiredExchangeAmountFromMarketRate('gold', 240_000, 4800)).toBe(50);
        expect(computeDesiredExchangeAmountFromMarketRate('diamonds', 50, 2000)).toBe(100_000);
        expect(computeDesiredExchangeAmountFromMarketRate('gold', 0, 4800)).toBe(0);
    });

    it('computes order unit gold per diamond for list display', () => {
        expect(
            computeOrderUnitGoldPerDiamond({ fromCurrency: 'gold', fromAmount: 240_000, toAmount: 50 }),
        ).toBe(4800);
        expect(
            computeOrderUnitGoldPerDiamond({ fromCurrency: 'diamonds', fromAmount: 50, toAmount: 100_000 }),
        ).toBe(2000);
    });
});
