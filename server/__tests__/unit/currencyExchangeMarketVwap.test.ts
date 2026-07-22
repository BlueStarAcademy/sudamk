import { describe, expect, it } from 'vitest';
import {
    CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_BUY,
    CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_SELL,
    CURRENCY_EXCHANGE_MARKET_VWAP_WINDOW_24H_MS,
    CURRENCY_EXCHANGE_MARKET_VWAP_WINDOW_7D_MS,
} from '../../../shared/constants/currencyExchange.js';
import {
    buildCurrencyExchangeMarketStatsAfterFill,
    computeFilledTradeVwap,
    defaultCurrencyExchangeMarketStats,
    filledTradeTickFromOrder,
    pruneFilledTradeTicks,
    resolveMarketDisplayGoldPerDiamondFromSnapshot,
    resolveMarketRatesFromFilledTicks,
    type CurrencyExchangeFilledTradeTick,
} from '../../../shared/utils/currencyExchange.js';

describe('P2P filled trade VWAP', () => {
    const now = Date.UTC(2026, 6, 22, 12, 0, 0);

    it('builds tick gold/diamond amounts from either order direction', () => {
        expect(filledTradeTickFromOrder({ fromCurrency: 'gold', fromAmount: 50_000, toAmount: 10 }, now)).toEqual({
            filledAt: now,
            fromCurrency: 'gold',
            goldAmount: 50_000,
            diamondAmount: 10,
        });
        expect(filledTradeTickFromOrder({ fromCurrency: 'diamonds', fromAmount: 20, toAmount: 40_000 }, now)).toEqual({
            filledAt: now,
            fromCurrency: 'diamonds',
            goldAmount: 40_000,
            diamondAmount: 20,
        });
    });

    it('computes volume-weighted average round(sumGold/sumDiamonds)', () => {
        const ticks: CurrencyExchangeFilledTradeTick[] = [
            { filledAt: now, fromCurrency: 'gold', goldAmount: 10_000, diamondAmount: 2 },
            { filledAt: now, fromCurrency: 'gold', goldAmount: 20_000, diamondAmount: 3 },
        ];
        // (10000+20000)/(2+3) = 6000
        expect(computeFilledTradeVwap(ticks, 'gold', now, CURRENCY_EXCHANGE_MARKET_VWAP_WINDOW_24H_MS)).toBe(6000);
    });

    it('excludes ticks outside the window and other directions', () => {
        const ticks: CurrencyExchangeFilledTradeTick[] = [
            { filledAt: now - CURRENCY_EXCHANGE_MARKET_VWAP_WINDOW_24H_MS - 1, fromCurrency: 'gold', goldAmount: 9_000, diamondAmount: 1 },
            { filledAt: now, fromCurrency: 'gold', goldAmount: 5_000, diamondAmount: 1 },
            { filledAt: now, fromCurrency: 'diamonds', goldAmount: 2_000, diamondAmount: 1 },
        ];
        expect(computeFilledTradeVwap(ticks, 'gold', now, CURRENCY_EXCHANGE_MARKET_VWAP_WINDOW_24H_MS)).toBe(5000);
        expect(computeFilledTradeVwap(ticks, 'diamonds', now, CURRENCY_EXCHANGE_MARKET_VWAP_WINDOW_24H_MS)).toBe(2000);
    });

    it('falls back 24h → 7d → cached → instant', () => {
        const oldTick: CurrencyExchangeFilledTradeTick = {
            filledAt: now - CURRENCY_EXCHANGE_MARKET_VWAP_WINDOW_24H_MS - 60_000,
            fromCurrency: 'gold',
            goldAmount: 8_000,
            diamondAmount: 1,
        };
        const rates7d = resolveMarketRatesFromFilledTicks([oldTick], null, now);
        expect(rates7d.buySource).toBe('fills_7d');
        expect(rates7d.buyGoldPerDiamond).toBe(8000);
        expect(rates7d.sellSource).toBe('instant');
        expect(rates7d.sellGoldPerDiamond).toBe(CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_SELL);

        const ratesCached = resolveMarketRatesFromFilledTicks([], { buyGoldPerDiamond: 7777, sellGoldPerDiamond: 2222 }, now);
        expect(ratesCached.buySource).toBe('cached');
        expect(ratesCached.buyGoldPerDiamond).toBe(7777);
        expect(ratesCached.sellSource).toBe('cached');
        expect(ratesCached.sellGoldPerDiamond).toBe(2222);

        const ratesInstant = resolveMarketRatesFromFilledTicks([], null, now);
        expect(ratesInstant.buySource).toBe('instant');
        expect(ratesInstant.buyGoldPerDiamond).toBe(CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_BUY);
        expect(ratesInstant.sellSource).toBe('instant');
        expect(ratesInstant.sellGoldPerDiamond).toBe(CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_SELL);
    });

    it('prunes ticks older than 7 days', () => {
        const ticks: CurrencyExchangeFilledTradeTick[] = [
            { filledAt: now - CURRENCY_EXCHANGE_MARKET_VWAP_WINDOW_7D_MS - 1, fromCurrency: 'gold', goldAmount: 1, diamondAmount: 1 },
            { filledAt: now, fromCurrency: 'gold', goldAmount: 5_000, diamondAmount: 1 },
        ];
        expect(pruneFilledTradeTicks(ticks, now)).toHaveLength(1);
        expect(pruneFilledTradeTicks(ticks, now)[0]?.goldAmount).toBe(5_000);
    });

    it('updates market stats after a fill without mixing instant exchange', () => {
        const base = defaultCurrencyExchangeMarketStats(now - 1);
        const after = buildCurrencyExchangeMarketStatsAfterFill(
            base,
            { fromCurrency: 'gold', fromAmount: 50_000, toAmount: 10 },
            now,
        );
        expect(after.ticks).toHaveLength(1);
        expect(after.buySource).toBe('fills_24h');
        expect(after.buyGoldPerDiamond).toBe(5000);
        expect(after.sellSource).toBe('instant');
        expect(after.sellGoldPerDiamond).toBe(CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_SELL);
    });

    it('maps snapshot to display rate per direction', () => {
        const snap = {
            buyGoldPerDiamond: 6100,
            sellGoldPerDiamond: 2100,
            buySource: 'fills_24h' as const,
            sellSource: 'fills_7d' as const,
            updatedAt: now,
        };
        expect(resolveMarketDisplayGoldPerDiamondFromSnapshot(snap, 'gold')).toEqual({
            goldPerDiamond: 6100,
            isFromMarket: true,
            source: 'fills_24h',
        });
        expect(resolveMarketDisplayGoldPerDiamondFromSnapshot(snap, 'diamonds')).toEqual({
            goldPerDiamond: 2100,
            isFromMarket: true,
            source: 'fills_7d',
        });
        expect(resolveMarketDisplayGoldPerDiamondFromSnapshot(null, 'gold').source).toBe('instant');
    });
});
