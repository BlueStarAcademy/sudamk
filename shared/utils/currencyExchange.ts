import {
    CURRENCY_EXCHANGE_BASE_GOLD_PER_DIAMOND,
    CURRENCY_EXCHANGE_INSTANT_SPREAD_PERCENT,
    CURRENCY_EXCHANGE_MIN_DIAMONDS,
    CURRENCY_EXCHANGE_MIN_GOLD,
} from '../constants/currencyExchange.js';
import { clampGameInt } from './gameIntegerField.js';

export type CurrencyExchangeDirection = 'gold_to_diamonds' | 'diamonds_to_gold';

/** 평균 시세(기준): 1다이아당 필요 골드 */
export function averageGoldPerDiamond(): number {
    return CURRENCY_EXCHANGE_BASE_GOLD_PER_DIAMOND;
}

/** 바로환전: 골드→다이아 시 1다이아당 필요 골드 (시세보다 높음) */
export function instantGoldPerDiamondWhenBuyingDiamonds(): number {
    const base = averageGoldPerDiamond();
    return Math.max(1, Math.ceil((base * (100 + CURRENCY_EXCHANGE_INSTANT_SPREAD_PERCENT)) / 100));
}

/** 바로환전: 다이아→골드 시 1다이아당 받는 골드 (시세보다 낮음) */
export function instantGoldPerDiamondWhenSellingDiamonds(): number {
    const base = averageGoldPerDiamond();
    return Math.max(1, Math.floor((base * (100 - CURRENCY_EXCHANGE_INSTANT_SPREAD_PERCENT)) / 100));
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
