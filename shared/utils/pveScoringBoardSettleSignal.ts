/**
 * PVE 클라이언트가 자동계가 전환 전에 이미 BOARD_SETTLE 대기를 마친 경우,
 * `useScoringOverlayPresentation`에서 동일 대기를 반복하지 않도록 표시한다.
 */
const settledGameIds = new Set<string>();

export function markPveBoardSettledForScoring(gameId: string): void {
    if (!gameId) return;
    settledGameIds.add(gameId);
}

/** true면 이번 scoring 진입에 대한 보드 정착 대기는 이미 끝난 것으로 본다(1회 소비). */
export function consumePveBoardSettledForScoring(gameId: string): boolean {
    if (!gameId || !settledGameIds.has(gameId)) return false;
    settledGameIds.delete(gameId);
    return true;
}

export function clearPveBoardSettledForScoring(gameId: string): void {
    if (!gameId) return;
    settledGameIds.delete(gameId);
}
