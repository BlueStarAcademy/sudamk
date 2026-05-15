/**
 * 싱글/탑 등 계가 연출(ScoringOverlay): 같은 처리 스택에서 `await getGameResult`까지 끝내면
 * 브로드캐스트·HTTP 응답이 곧바로 `ended`만 전달되어 `scoring` 프레임이 소실될 수 있다.
 * 다음 이벤트 루프 틱에서 계가 완료를 실행한다.
 */
export function deferGetGameResultForScoringOverlay(gameId: string, reason: string): void {
    setTimeout(() => {
        void (async () => {
            try {
                const { getCachedGame } = await import('../gameCache.js');
                const { getGameResult } = await import('../gameModes.js');
                const g = await getCachedGame(gameId);
                if (!g) {
                    console.warn(`[deferGetGameResultForScoringOverlay] ${reason}: skipped (no cache) game=${gameId}`);
                    return;
                }
                if (g.gameStatus === 'ended' || g.gameStatus === 'no_contest') return;
                await getGameResult(g);
            } catch (e: any) {
                console.error(`[deferGetGameResultForScoringOverlay] ${reason}: failed game=${gameId}:`, e?.message ?? e);
            }
        })();
    }, 0);
}
