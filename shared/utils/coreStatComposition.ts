/**
 * 핵심 능력치 최종값 — 서머너즈워 룬과 유사한 적층:
 * - Σ% 는 (기본 스탯 + 분배 포인트)에만 적용 (0 미만은 0으로 잘라 계산).
 * - Σflat(장비·길드 연구 등)은 그 위에 더함 → flat이 %의 기준값을 부풀리지 않음.
 *
 * final = max(0, max(0, base+spent) + floor(max(0, base+spent) * Σ% / 100) + Σflat)
 */
export function computeCoreStatFinalFromBonuses(
    baseAndSpentRaw: number,
    flatSum: number,
    percentSum: number,
): number {
    const base = Math.max(0, Number(baseAndSpentRaw) || 0);
    const flat = Number(flatSum) || 0;
    const pct = Number(percentSum) || 0;
    const percentGain = Math.floor(base * (pct / 100));
    const total = base + percentGain + flat;
    if (!Number.isFinite(total)) return 0;
    return Math.max(0, total);
}
