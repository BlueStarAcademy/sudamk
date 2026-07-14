/**
 * 길드전 승패 보상 — 전쟁 중 개인 도전 횟수에 따른 수령 비율.
 * 6회 이상 100% / 4~5회 75% / 1~3회 50% / 0회 수령 불가(호출측에서 차단).
 */
export function getGuildWarParticipationRewardMult(attempts: number): number {
    const n = Math.max(0, Math.floor(Number(attempts) || 0));
    if (n >= 6) return 1;
    if (n >= 4) return 0.75;
    if (n >= 1) return 0.5;
    return 0;
}

export function scaleGuildWarPersonalRewardAmount(amount: number, mult: number): number {
    if (!Number.isFinite(amount) || amount <= 0 || mult <= 0) return 0;
    return Math.floor(amount * mult);
}
