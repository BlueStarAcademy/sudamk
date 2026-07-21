import { SHOP_DIAMOND_GOLD_EQUIV_FOR_SELL } from './shopSellGoldReference.js';

/** 기준 시세: 1다이아 = N골드 (상점 환산과 동일) */
export const CURRENCY_EXCHANGE_BASE_GOLD_PER_DIAMOND = SHOP_DIAMOND_GOLD_EQUIV_FOR_SELL;

/** 바로환전: 골드→다이아 (4,800골드 = 1다이아) */
export const CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_BUY = 4800;

/** 바로환전: 다이아→골드 (1다이아 = 2,000골드) */
export const CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_SELL = 2000;

/** 바로환전 UI·안내용 기준 묶음 (골드→다이아): 1다이아 단위 */
export const CURRENCY_EXCHANGE_INSTANT_GOLD_TO_DIAMONDS_BATCH = {
    gold: CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_BUY,
    diamonds: 1,
} as const;

/** 바로환전 UI·안내용 기준 묶음 다이아 수 (다이아→골드 시세·최소 단위) */
export const CURRENCY_EXCHANGE_INSTANT_RATE_DISPLAY_DIAMONDS = 50;

/** 바로환전 UI·안내용 기준 묶음 (다이아→골드) */
export const CURRENCY_EXCHANGE_INSTANT_DIAMONDS_TO_GOLD_BATCH = {
    diamonds: CURRENCY_EXCHANGE_INSTANT_RATE_DISPLAY_DIAMONDS,
    gold: CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_SELL * CURRENCY_EXCHANGE_INSTANT_RATE_DISPLAY_DIAMONDS,
} as const;

/** 바로환전: 다이아→골드 최소 환전량 (골드→다이아는 1다이아 상당 골드부터) */
export const CURRENCY_EXCHANGE_INSTANT_MIN_DIAMONDS = 50;

/** 일일 바로환전 한도: 골드→다이아 (골드 지출 상한, 고정 50만) */
export const CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_SPENT = 500_000;

/** 일일 바로환전 한도: 골드→다이아 (다이아 수령 상한 — 50만 골드가 모두 쓰이도록 ceil) */
export const CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_FROM_GOLD = Math.ceil(
    CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_SPENT / CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_BUY,
);

/** 일일 바로환전 한도: 다이아→골드 (다이아 지출 상한) */
export const CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_SPENT = 100;

/** 일일 바로환전 한도: 다이아→골드 (골드 수령 상한, 수수료 전) */
export const CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_GOLD_FROM_DIAMONDS =
    CURRENCY_EXCHANGE_INSTANT_GOLD_PER_DIAMOND_SELL * CURRENCY_EXCHANGE_INSTANT_DAILY_MAX_DIAMONDS_SPENT;

/** P2P 환전 요청 최소 금액 */
export const CURRENCY_EXCHANGE_MIN_GOLD = 100;
export const CURRENCY_EXCHANGE_MIN_DIAMONDS = 1;

/** 유저당 동시에 열 수 있는 P2P 환전 요청 수 */
export const CURRENCY_EXCHANGE_MAX_OPEN_ORDERS_PER_USER = 1;
