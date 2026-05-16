import type { AdventureProfile } from '../types/entities.js';

export type AdventureHuntingScoreSnapshot = {
    score: number;
    /** 동점 시 먼저 달성한 순 — 값이 작을수록 상위 */
    reachedAt: number;
};

export function getAdventureHuntingScore(profile: AdventureProfile | null | undefined): AdventureHuntingScoreSnapshot {
    const score = Math.max(0, Math.floor(Number(profile?.huntingScoreTotal) || 0));
    const reachedAt =
        score > 0 && typeof profile?.huntingScoreReachedAt === 'number' && Number.isFinite(profile.huntingScoreReachedAt)
            ? profile.huntingScoreReachedAt
            : Number.MAX_SAFE_INTEGER;
    return { score, reachedAt };
}

/** 몬스터 처치 시 사냥 점수(해당 몬스터 레벨) 누적 및 동점용 달성 시각 갱신 */
export function bumpAdventureHuntingScoreOnDefeat(
    profile: AdventureProfile,
    monsterLevel: number,
    atMs: number = Date.now(),
): AdventureProfile {
    const level = Math.max(1, Math.min(50, Math.floor(monsterLevel)));
    const prev = getAdventureHuntingScore(profile);
    const nextScore = prev.score + level;
    return {
        ...profile,
        huntingScoreTotal: nextScore,
        huntingScoreReachedAt: atMs,
    };
}
