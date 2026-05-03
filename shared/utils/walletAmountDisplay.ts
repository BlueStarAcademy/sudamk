import { MAX_PLAYER_DIAMONDS, MAX_PLAYER_GOLD } from '../constants/numericLimits.js';

export type FormatGoldKoGOptions = { /** 기본: 플레이어 골드 상한(100억). 길드 자금 등은 더 큰 값 전달. */
    valueCap?: number };

/** 골드: 천 단위 콤마로 전체 정수 표기(표시 상한은 `valueCap` 또는 플레이어 골드 상한). */
export function formatGoldAmountKoG(raw: unknown, opts?: FormatGoldKoGOptions): string {
    const cap = opts?.valueCap ?? MAX_PLAYER_GOLD;
    const n = Math.trunc(Math.min(Math.max(Number(raw) || 0, 0), cap));
    return n.toLocaleString('ko-KR');
}

export function formatWalletDiamonds(raw: unknown): string {
    const n = Math.trunc(Math.min(Math.max(Number(raw) || 0, 0), MAX_PLAYER_DIAMONDS));
    return n.toLocaleString('ko-KR');
}

export function formatWalletCurrencyAmount(value: number, currency: 'gold' | 'diamonds'): string {
    return currency === 'gold' ? formatGoldAmountKoG(value) : formatWalletDiamonds(value);
}
