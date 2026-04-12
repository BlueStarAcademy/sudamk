/** 알까기 돌 id: JSON/부동소수점·정수 혼용에도 동일 돌을 찾기 */
export function findAlkkagiStoneById<T extends { id: number }>(stones: T[], stoneId: number): T | undefined {
    const exact = stones.find((s) => s.id === stoneId);
    if (exact) return exact;
    const n = Number(stoneId);
    if (!Number.isFinite(n)) return undefined;
    return stones.find((s) => Number(s.id) === n);
}

/** 새 돌 id: 부동소수(Date.now()+random)로 인한 클라이언트·DB 불일치 방지 */
export function nextAlkkagiStoneId(game: {
    alkkagiStones?: { id: number }[];
    alkkagiStones_p1?: { id: number }[];
    alkkagiStones_p2?: { id: number }[];
}): number {
    const all = [
        ...(game.alkkagiStones ?? []),
        ...(game.alkkagiStones_p1 ?? []),
        ...(game.alkkagiStones_p2 ?? []),
    ];
    const maxId = all.reduce((m, s) => {
        const v = Math.floor(Number(s.id));
        return Number.isFinite(v) ? Math.max(m, v) : m;
    }, 0);
    return maxId + 1;
}
