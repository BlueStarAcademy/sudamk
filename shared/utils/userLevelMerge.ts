import { getXpRequirementForLevel } from './strategyLevelXp.js';

/** 레벨 L·현재 바 XP를 누적 총 XP로 환산 */
export function totalAccumulatedXpFromLevelAndBar(level: number, xpInCurrentBar: number): number {
    const L = Math.max(1, Math.floor(level) || 1);
    const bar = Math.max(0, Math.floor(xpInCurrentBar) || 0);
    let sum = bar;
    for (let l = 1; l < L; l += 1) {
        sum += getXpRequirementForLevel(l);
    }
    return sum;
}

/** 총 누적 XP → (level, bar) */
export function levelAndBarFromTotalAccumulatedXp(total: number): { userLevel: number; userXp: number } {
    let t = Math.max(0, Math.floor(total));
    let level = 1;
    while (level < 500) {
        const need = getXpRequirementForLevel(level);
        if (t < need) return { userLevel: level, userXp: t };
        t -= need;
        level += 1;
    }
    return { userLevel: level, userXp: 0 };
}

export function mergeLegacyStrategyPlayfulIntoUserLevelXp(
    strategyLevel: number,
    strategyXp: number,
    playfulLevel: number,
    playfulXp: number,
): { userLevel: number; userXp: number } {
    const a = totalAccumulatedXpFromLevelAndBar(strategyLevel, strategyXp);
    const b = totalAccumulatedXpFromLevelAndBar(playfulLevel, playfulXp);
    return levelAndBarFromTotalAccumulatedXp(a + b);
}

/**
 * 통합 유저 레벨/XP 확정.
 * - `userLevel` / `userXp`가 유효하면 그대로 사용.
 * - 없거나 비정상이면 **구 전략바둑 레벨·경험치**를 유저 레벨·경험치로 간주(제품 정의).
 */
export function coerceUserLevelXpFromPayload(u: Record<string, unknown>): { userLevel: number; userXp: number } {
    const ul0 = Number(u.userLevel);
    const ux0 = Number(u.userXp);
    if (Number.isFinite(ul0) && ul0 >= 1) {
        const bar = Number.isFinite(ux0) && ux0 >= 0 ? Math.floor(ux0) : 0;
        return { userLevel: Math.floor(ul0), userXp: bar };
    }
    const sl = Number((u as { strategyLevel?: unknown }).strategyLevel);
    const sx = Number((u as { strategyXp?: unknown }).strategyXp);
    if (Number.isFinite(sl) && sl >= 1) {
        const bar = Number.isFinite(sx) && sx >= 0 ? Math.floor(sx) : 0;
        return { userLevel: Math.floor(sl), userXp: bar };
    }
    return { userLevel: 1, userXp: 0 };
}
