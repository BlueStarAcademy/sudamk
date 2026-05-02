import { MAX_GAME_INTEGER_INPUT } from '../constants/numericLimits.js';

export function clampGameInt(value: unknown, opts?: { min?: number; max?: number }): number {
    const min = opts?.min ?? 0;
    const max = opts?.max ?? MAX_GAME_INTEGER_INPUT;
    const n = typeof value === 'bigint' ? Number(value) : Number(value);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** 정수만 허용하는 문자열 입력(거래 가격 등). 빈 문자열은 그대로 둔다. */
export function clampDigitsOnlyInputString(raw: string, opts?: { max?: number }): string {
    const max = opts?.max ?? MAX_GAME_INTEGER_INPUT;
    const digits = raw.replace(/\D/g, '');
    if (digits === '') return '';
    try {
        const bi = BigInt(digits);
        if (bi > BigInt(max)) return String(max);
        const trimmed = digits.replace(/^0+(?=\d)/, '') || '0';
        return trimmed;
    } catch {
        return String(max);
    }
}

/** 거래소 10% 수수료: 곱셈 대신 나눗셈으로 정확히 계산(대수 오버플로·부동소수 오차 완화) */
export function exchangeListingFeeFromPrice(listPrice: number): number {
    const p = clampGameInt(listPrice, { min: 0 });
    return Math.floor(p / 10);
}
