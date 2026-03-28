/**
 * 길드전 한 칸(경기장)의 점령 길드 판정 — 양 길드의 최고 기록(`guild1BestResult` vs `guild2BestResult`) 비교.
 * 1) 획득 별 수가 많은 길드
 * 2) 동점이면 해당 칸 기록의 집점수(`score`, 계가·시간 보너스 반영값)
 * 3) 집점수도 동점(또는 한쪽만 score 없음)이면 먼저 기록을 남긴 쪽(`completedAt` 작을수록 우선)
 */
export function isGuildWarAttemptStrictlyBetter(
    prev: { stars: number; score?: number; completedAt?: number },
    cand: { stars: number; score?: number; completedAt?: number }
): boolean {
    if (cand.stars !== prev.stars) return cand.stars > prev.stars;
    const cs = cand.score ?? -1e15;
    const ps = prev.score ?? -1e15;
    if (cs !== ps) return cs > ps;
    return false;
}

export function getGuildWarBoardOwnerGuildId(
    board: { guild1BestResult?: GuildWarSideBest | null; guild2BestResult?: GuildWarSideBest | null } | null | undefined,
    guild1Id: string,
    guild2Id: string
): string | undefined {
    if (!board) return undefined;
    const r1 = board.guild1BestResult;
    const r2 = board.guild2BestResult;
    if (r1 && !r2) return guild1Id;
    if (!r1 && r2) return guild2Id;
    if (!r1 || !r2) return undefined;

    const stars1 = Number(r1.stars ?? 0) || 0;
    const stars2 = Number(r2.stars ?? 0) || 0;
    if (stars1 !== stars2) {
        return stars1 > stars2 ? guild1Id : guild2Id;
    }

    const s1 = typeof r1.score === 'number' && !Number.isNaN(r1.score) ? r1.score : null;
    const s2 = typeof r2.score === 'number' && !Number.isNaN(r2.score) ? r2.score : null;
    if (s1 !== null && s2 !== null) {
        if (s1 > s2) return guild1Id;
        if (s2 > s1) return guild2Id;
    }

    const c1 = Number(r1.completedAt) || 0;
    const c2 = Number(r2.completedAt) || 0;
    return c1 <= c2 ? guild1Id : guild2Id;
}

type GuildWarSideBest = {
    stars?: number;
    score?: number;
    completedAt?: number;
};
