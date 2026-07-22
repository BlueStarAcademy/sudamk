import * as db from './db.js';
import type {
    CurrencyExchangeFilledTradeTick,
    CurrencyExchangeMarketRateSnapshot,
    CurrencyExchangeMarketStats,
} from '../shared/utils/currencyExchange.js';
import {
    buildCurrencyExchangeMarketStatsAfterFill,
    defaultCurrencyExchangeMarketStats,
    normalizeCurrencyExchangeMarketStats,
} from '../shared/utils/currencyExchange.js';

const KV_KEY = 'currencyExchangeMarketStats';

let cached: CurrencyExchangeMarketStats = defaultCurrencyExchangeMarketStats();

export function getCurrencyExchangeMarketStats(): CurrencyExchangeMarketStats {
    return cached;
}

export function getCurrencyExchangeMarketRateSnapshot(): CurrencyExchangeMarketRateSnapshot {
    const { buyGoldPerDiamond, sellGoldPerDiamond, buySource, sellSource, updatedAt } = cached;
    return { buyGoldPerDiamond, sellGoldPerDiamond, buySource, sellSource, updatedAt };
}

export async function hydrateCurrencyExchangeMarketStatsFromKV(): Promise<CurrencyExchangeMarketStats> {
    try {
        const raw = await db.getKV<Partial<CurrencyExchangeMarketStats> | null>(KV_KEY);
        cached = normalizeCurrencyExchangeMarketStats(raw);
    } catch (e) {
        console.warn('[currencyExchangeMarketStatsStore] hydrate failed, using defaults:', e);
        cached = defaultCurrencyExchangeMarketStats();
    }
    return cached;
}

export async function recordCurrencyExchangeFilledTrade(order: {
    fromCurrency: 'gold' | 'diamonds';
    fromAmount: number;
    toAmount: number;
    filledAt?: number;
}): Promise<CurrencyExchangeMarketStats> {
    const filledAt = Number(order.filledAt) || Date.now();
    const next = buildCurrencyExchangeMarketStatsAfterFill(cached, order, filledAt);
    cached = next;
    try {
        await db.setKV(KV_KEY, next);
    } catch (e) {
        console.warn('[currencyExchangeMarketStatsStore] persist failed (in-memory kept):', e);
    }
    return cached;
}

/** 테스트/관리용: tick 목록으로 강제 재계산 */
export async function replaceCurrencyExchangeMarketTicks(
    ticks: CurrencyExchangeFilledTradeTick[],
    now: number = Date.now(),
): Promise<CurrencyExchangeMarketStats> {
    const next = normalizeCurrencyExchangeMarketStats(
        {
            ticks,
            buyGoldPerDiamond: cached.buyGoldPerDiamond,
            sellGoldPerDiamond: cached.sellGoldPerDiamond,
            updatedAt: now,
        },
        now,
    );
    cached = next;
    await db.setKV(KV_KEY, next);
    return cached;
}
