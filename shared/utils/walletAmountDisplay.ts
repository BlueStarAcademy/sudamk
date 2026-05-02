import { GOLD_G_DISPLAY_UNIT, MAX_PLAYER_DIAMONDS, MAX_PLAYER_GOLD } from '../constants/numericLimits.js';

export type FormatGoldKoGOptions = { /** 기본: 플레이어 골드 상한(100억). 길드 자금 등은 더 큰 값 전달. */
    valueCap?: number };

/** 골드: 10억 미만은 천 단위 콤마, 10억 이상은 1G=10억 단위(표시 상한 10G=100억까지 동일 규칙). */
export function formatGoldAmountKoG(raw: unknown, opts?: FormatGoldKoGOptions): string {
    const cap = opts?.valueCap ?? MAX_PLAYER_GOLD;
    const n = Math.trunc(Math.min(Math.max(Number(raw) || 0, 0), cap));
    if (n < GOLD_G_DISPLAY_UNIT) {
        return n.toLocaleString('ko-KR');
    }
    if (n % GOLD_G_DISPLAY_UNIT === 0) {
        return `${Math.min(10, n / GOLD_G_DISPLAY_UNIT)}G`;
    }
    const gVal = Math.min(10, n / GOLD_G_DISPLAY_UNIT);
    const rounded = Math.round(gVal * 100) / 100;
    const s = rounded.toFixed(2).replace(/\.?0+$/, '');
    return `${s}G`;
}

export function formatWalletDiamonds(raw: unknown): string {
    const n = Math.trunc(Math.min(Math.max(Number(raw) || 0, 0), MAX_PLAYER_DIAMONDS));
    return n.toLocaleString('ko-KR');
}

export function formatWalletCurrencyAmount(value: number, currency: 'gold' | 'diamonds'): string {
    return currency === 'gold' ? formatGoldAmountKoG(value) : formatWalletDiamonds(value);
}
