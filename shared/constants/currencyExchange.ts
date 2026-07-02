import { SHOP_DIAMOND_GOLD_EQUIV_FOR_SELL } from './shopSellGoldReference.js';

/** 기준 시세: 1다이아 = N골드 (상점 환산과 동일) */
export const CURRENCY_EXCHANGE_BASE_GOLD_PER_DIAMOND = SHOP_DIAMOND_GOLD_EQUIV_FOR_SELL;

/** 바로환전: 평균 시세 대비 유저에게 불리한 스프레드(%) */
export const CURRENCY_EXCHANGE_INSTANT_SPREAD_PERCENT = 5;

/** P2P 환전 요청 최소 금액 */
export const CURRENCY_EXCHANGE_MIN_GOLD = 100;
export const CURRENCY_EXCHANGE_MIN_DIAMONDS = 1;

/** 유저당 동시에 열 수 있는 P2P 환전 요청 수 */
export const CURRENCY_EXCHANGE_MAX_OPEN_ORDERS_PER_USER = 5;
