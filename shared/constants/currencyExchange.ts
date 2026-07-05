import { SHOP_DIAMOND_GOLD_EQUIV_FOR_SELL } from './shopSellGoldReference.js';

/** 기준 시세: 1다이아 = N골드 (상점 환산과 동일) */
export const CURRENCY_EXCHANGE_BASE_GOLD_PER_DIAMOND = SHOP_DIAMOND_GOLD_EQUIV_FOR_SELL;

/** 바로환전: 골드→다이아 (50,000골드 = 10다이아) */
export const CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_BUY = 5000;

/** 바로환전: 다이아→골드 (10다이아 = 25,000골드) */
export const CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_SELL = 2500;

/** 바로환전 UI·안내용 기준 묶음 (골드→다이아) */
export const CURRENCY_EXCHANGE_INSTANT_GOLD_TO_DIAMONDS_BATCH = {
    gold: 50_000,
    diamonds: 10,
} as const;

/** 바로환전 UI·안내용 기준 묶음 (다이아→골드) */
export const CURRENCY_EXCHANGE_INSTANT_DIAMONDS_TO_GOLD_BATCH = {
    diamonds: 10,
    gold: 25_000,
} as const;

/** 일일 바로환전 한도: 골드→다이아 (골드 지출 상한) */
export const CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_SPENT = 500_000;

/** 일일 바로환전 한도: 골드→다이아 (다이아 수령 상한) */
export const CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_FROM_GOLD = 100;

/** 일일 바로환전 한도: 다이아→골드 (다이아 지출 상한) */
export const CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_SPENT = 100;

/** 일일 바로환전 한도: 다이아→골드 (골드 수령 상한) */
export const CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_FROM_DIAMONDS = 250_000;

/** P2P 환전 요청 최소 금액 */
export const CURRENCY_EXCHANGE_MIN_GOLD = 100;
export const CURRENCY_EXCHANGE_MIN_DIAMONDS = 1;

/** 유저당 동시에 열 수 있는 P2P 환전 요청 수 */
export const CURRENCY_EXCHANGE_MAX_OPEN_ORDERS_PER_USER = 1;
