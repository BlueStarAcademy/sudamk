/**
 * 전략바둑 AI 로비 세션 판별 등 — 서버 `hidden.ts`·`scoringStonePoints.ts` 와 동기.
 * (히든·스캔·미사일·펫 힌트는 본인 차례에만 사용; 예전 "AI 응답 전 창" 헬퍼는 제거됨.)
 */

export function isStrategicAiGoSession(game: {
    isAiGame?: boolean | null;
    isSinglePlayer?: boolean | null;
    gameCategory?: string | null;
}): boolean {
    const cat = String(game.gameCategory ?? '');
    return (
        !!game.isAiGame &&
        !game.isSinglePlayer &&
        cat !== 'tower' &&
        cat !== 'singleplayer' &&
        cat !== 'guildwar'
    );
}
