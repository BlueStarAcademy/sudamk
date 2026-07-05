import {
    CURRENCY_EXCHANGE_BASE_GOLD_PER_DIAMOND,
    CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_FROM_GOLD,
    CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_SPENT,
    CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_FROM_DIAMONDS,
    CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_SPENT,
    CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_BUY,
    CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_SELL,
    CURRENCY_EXCHANGE_MIN_DIAMONDS,
    CURRENCY_EXCHANGE_MIN_GOLD,
} from '../constants/currencyExchange.js';
import { clampGameInt } from './gameIntegerField.js';
import { getStartOfDayKST } from './timeUtils.js';

export type InstantDailyUsage = {
    lastResetDayKST: number;
    goldSpent: number;
    diamondsSpent: number;
};

export type InstantDailyRemaining = {
    usage: InstantDailyUsage;
    goldSpentRemaining: number;
    diamondsSpentRemaining: number;
    diamondsReceiveRemaining: number;
    goldReceiveRemaining: number;
    maxGoldInput: number;
    maxDiamondsInput: number;
};

export type CurrencyExchangeDirection = 'gold_to_diamonds' | 'diamonds_to_gold';

/** 평균 시세(기준): 1다이아당 필요 골드 */
export function averageGoldPerDiamond(): number {
    return CURRENCY_EXCHANGE_BASE_GOLD_PER_DIAMOND;
}

/** 바로환전: 골드→다이아 시 1다이아당 필요 골드 */
export function instantGoldPerDiamondWhenBuyingDiamonds(): number {
    return CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_BUY;
}

/** 바로환전: 다이아→골드 시 1다이아당 받는 골드 */
export function instantGoldPerDiamondWhenSellingDiamonds(): number {
    return CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_SELL;
}

export function computeInstantGoldToDiamonds(goldAmount: number): { diamonds: number; goldSpent: number } {
    const gold = clampGameInt(goldAmount, { min: 0 });
    const rate = instantGoldPerDiamondWhenBuyingDiamonds();
    const diamonds = Math.floor(gold / rate);
    return { diamonds, goldSpent: diamonds * rate };
}

export function computeInstantDiamondsToGold(diamondAmount: number): { gold: number; diamondsSpent: number } {
    const diamonds = clampGameInt(diamondAmount, { min: 0 });
    const rate = instantGoldPerDiamondWhenSellingDiamonds();
    return { gold: diamonds * rate, diamondsSpent: diamonds };
}

export function normalizeInstantDailyUsage(usage: InstantDailyUsage | undefined, now: number = Date.now()): InstantDailyUsage {
    const todayStart = getStartOfDayKST(now);
    if (!usage || getStartOfDayKST(usage.lastResetDayKST || 0) !== todayStart) {
        return { lastResetDayKST: todayStart, goldSpent: 0, diamondsSpent: 0 };
    }
    return {
        lastResetDayKST: todayStart,
        goldSpent: Math.max(0, Math.floor(usage.goldSpent ?? 0)),
        diamondsSpent: Math.max(0, Math.floor(usage.diamondsSpent ?? 0)),
    };
}

export function getInstantDailyRemaining(
    usage: InstantDailyUsage | undefined,
    now: number = Date.now(),
): InstantDailyRemaining {
    const normalized = normalizeInstantDailyUsage(usage, now);
    const buyRate = instantGoldPerDiamondWhenBuyingDiamonds();
    const sellRate = instantGoldPerDiamondWhenSellingDiamonds();

    const goldSpentRemaining = Math.max(0, CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_SPENT - normalized.goldSpent);
    const diamondsSpentRemaining = Math.max(0, CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_SPENT - normalized.diamondsSpent);

    const diamondsReceivedToday = Math.floor(normalized.goldSpent / buyRate);
    const diamondsReceiveRemaining = Math.max(0, CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_FROM_GOLD - diamondsReceivedToday);

    const goldReceivedToday = normalized.diamondsSpent * sellRate;
    const goldReceiveRemaining = Math.max(0, CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_FROM_DIAMONDS - goldReceivedToday);

    const maxGoldByOutputCap = diamondsReceiveRemaining * buyRate;
    const maxGoldInput = Math.min(goldSpentRemaining, maxGoldByOutputCap);

    const maxDiamondsByOutputCap = Math.floor(goldReceiveRemaining / sellRate);
    const maxDiamondsInput = Math.min(diamondsSpentRemaining, maxDiamondsByOutputCap);

    return {
        usage: normalized,
        goldSpentRemaining,
        diamondsSpentRemaining,
        diamondsReceiveRemaining,
        goldReceiveRemaining,
        maxGoldInput,
        maxDiamondsInput,
    };
}

export function validateInstantExchangeDailyLimit(
    direction: CurrencyExchangeDirection,
    usage: InstantDailyUsage | undefined,
    goldSpent: number,
    diamondsSpent: number,
    diamondsReceived: number,
    goldReceived: number,
    now: number = Date.now(),
): string | null {
    const remaining = getInstantDailyRemaining(usage, now);
    if (direction === 'gold_to_diamonds') {
        if (goldSpent > remaining.goldSpentRemaining) {
            return `일일 바로환전 골드 한도(최대 ${CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_SPENT.toLocaleString()})를 초과했습니다.`;
        }
        if (diamondsReceived > remaining.diamondsReceiveRemaining) {
            return `일일 바로환전 다이아 수령 한도(최대 ${CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_FROM_GOLD})를 초과했습니다.`;
        }
        return null;
    }
    if (diamondsSpent > remaining.diamondsSpentRemaining) {
        return `일일 바로환전 다이아 한도(최대 ${CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_SPENT})를 초과했습니다.`;
    }
    if (goldReceived > remaining.goldReceiveRemaining) {
        return `일일 바로환전 골드 수령 한도(최대 ${CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_FROM_DIAMONDS.toLocaleString()})를 초과했습니다.`;
    }
    return null;
}

export function applyInstantDailyUsage(
    usage: InstantDailyUsage | undefined,
    direction: CurrencyExchangeDirection,
    goldSpent: number,
    diamondsSpent: number,
    now: number = Date.now(),
): InstantDailyUsage {
    const normalized = normalizeInstantDailyUsage(usage, now);
    if (direction === 'gold_to_diamonds') {
        normalized.goldSpent += Math.max(0, goldSpent);
    } else {
        normalized.diamondsSpent += Math.max(0, diamondsSpent);
    }
    return normalized;
}

type MarketOrderLike = {
    status: string;
    fromCurrency: 'gold' | 'diamonds';
    fromAmount: number;
    toAmount: number;
};

/** 등록된 P2P 환전 요청(동일 방향)의 가중 평균: 1다이아당 골드. 데이터 없으면 null */
export function computeMarketAverageGoldPerDiamondFromOrders(
    orders: MarketOrderLike[],
    fromCurrency: 'gold' | 'diamonds',
): number | null {
    const matching = orders.filter((o) => o.status === 'open' && o.fromCurrency === fromCurrency);
    if (matching.length === 0) return null;

    let totalGold = 0;
    let totalDiamonds = 0;
    for (const order of matching) {
        if (order.fromCurrency === 'gold') {
            totalGold += Math.max(0, Math.floor(order.fromAmount));
            totalDiamonds += Math.max(0, Math.floor(order.toAmount));
        } else {
            totalDiamonds += Math.max(0, Math.floor(order.fromAmount));
            totalGold += Math.max(0, Math.floor(order.toAmount));
        }
    }
    if (totalDiamonds <= 0) return null;
    return Math.round(totalGold / totalDiamonds);
}

/** 평균 시세(등록 요청 기준). 없으면 바로환전 시세 */
export function resolveMarketDisplayGoldPerDiamond(
    orders: MarketOrderLike[],
    fromCurrency: 'gold' | 'diamonds',
): { goldPerDiamond: number; isFromMarket: boolean } {
    const average = computeMarketAverageGoldPerDiamondFromOrders(orders, fromCurrency);
    if (average != null && average > 0) {
        return { goldPerDiamond: average, isFromMarket: true };
    }
    return {
        goldPerDiamond:
            fromCurrency === 'gold'
                ? instantGoldPerDiamondWhenBuyingDiamonds()
                : instantGoldPerDiamondWhenSellingDiamonds(),
        isFromMarket: false,
    };
}

/** P2P 환전 요청: 제공 수량 → 평균 시세 기준 희망 수령량 */
export function computeDesiredExchangeAmountFromMarketRate(
    fromCurrency: 'gold' | 'diamonds',
    fromAmount: number,
    goldPerDiamond: number,
): number {
    const from = Math.max(0, Math.floor(fromAmount));
    const rate = Math.max(1, Math.floor(goldPerDiamond));
    if (from <= 0) return 0;
    if (fromCurrency === 'gold') return Math.floor(from / rate);
    return from * rate;
}

/** P2P 환전 요청 체결 단가: 1다이아당 골드 */
export function computeOrderUnitGoldPerDiamond(order: {
    fromCurrency: 'gold' | 'diamonds';
    fromAmount: number;
    toAmount: number;
}): number {
    const from = Math.max(0, Math.floor(order.fromAmount));
    const to = Math.max(0, Math.floor(order.toAmount));
    if (from <= 0 || to <= 0) return 0;
    if (order.fromCurrency === 'gold') return Math.round(from / to);
    return Math.round(to / from);
}

export function validateCurrencyExchangeOrderAmounts(
    fromCurrency: 'gold' | 'diamonds',
    fromAmount: number,
    toAmount: number,
): string | null {
    const from = clampGameInt(fromAmount, { min: 0 });
    const to = clampGameInt(toAmount, { min: 0 });
    if (from <= 0 || to <= 0) return '환전 수량을 입력해 주세요.';
    if (fromCurrency === 'gold') {
        if (from < CURRENCY_EXCHANGE_MIN_GOLD) return `최소 ${CURRENCY_EXCHANGE_MIN_GOLD.toLocaleString()}골드 이상 등록할 수 있습니다.`;
        if (to < CURRENCY_EXCHANGE_MIN_DIAMONDS) return `최소 ${CURRENCY_EXCHANGE_MIN_DIAMONDS}다이아 이상 요청할 수 있습니다.`;
    } else {
        if (from < CURRENCY_EXCHANGE_MIN_DIAMONDS) return `최소 ${CURRENCY_EXCHANGE_MIN_DIAMONDS}다이아 이상 등록할 수 있습니다.`;
        if (to < CURRENCY_EXCHANGE_MIN_GOLD) return `최소 ${CURRENCY_EXCHANGE_MIN_GOLD.toLocaleString()}골드 이상 요청할 수 있습니다.`;
    }
    return null;
}
