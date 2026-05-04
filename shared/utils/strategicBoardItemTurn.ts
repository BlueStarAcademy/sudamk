import type { Player } from '../types/enums.js';

/**
 * 히든·스캔·미사일 등 “보드 아이템” 사용 가능 턴 창: 서버 `hidden.ts` / `missile.ts` 와 클라이언트 `GameControls` 가
 * 이 모듈만 참조하도록 하여 AI 대국·PVE·PVP 간에 되는 곳/안 되는 곳이 갈리지 않게 한다.
 */

/**
 * 전략바둑 AI 대국(대기실 AI·모험 등): 싱글/탑/싱글플레이 스테이지/길드전(PVP)이 아닌 경우.
 * 서버 `server/modes/hidden.ts` · `server/modes/missile.ts` 의 `isStrategicAiGame` 과 동일해야 한다.
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

/**
 * 싱글/탑/길드전(PVE·AI전)/전략AI대국: 방금 내가 두었고 아직 상대(AI)가 두기 전이면
 * 히든·스캔·미사일 등 보드 아이템 사용 가능(서버와 클라이언트 버튼 상태 동기화용).
 *
 * PVP 일반 대국에서는 항상 false(내 턴에만 아이템).
 */
export function allowsBoardItemAfterOwnMoveBeforeOpponentActs(
    game: {
        isSinglePlayer?: boolean | null;
        gameCategory?: string | null;
        gameStatus?: string | null;
        moveHistory?: ReadonlyArray<{ player?: number } | null | undefined> | null;
        isAiGame?: boolean | null;
    },
    myPlayerEnum: Player,
    /** 페어 바둑 등은 호출부에서 `game.currentPlayer` 와 일치하도록 계산한 값을 넘긴다. */
    isMyTurn: boolean,
): boolean {
    if (game.gameStatus !== 'playing') return false;
    const mh = game.moveHistory;
    const last = mh?.length ? mh[mh.length - 1] : null;
    const lastMoveWasMine = !!(last && typeof last.player === 'number' && last.player === myPlayerEnum);
    if (!lastMoveWasMine || isMyTurn) return false;
    const cat = String(game.gameCategory ?? '');
    return (
        !!game.isSinglePlayer ||
        cat === 'tower' ||
        cat === 'guildwar' ||
        isStrategicAiGoSession(game)
    );
}

/** 서버 `canUseItem` 과 동일: 내 턴이거나, AI 응답 전 창구 */
export function canUseBoardItemTurnWindow(
    game: Parameters<typeof allowsBoardItemAfterOwnMoveBeforeOpponentActs>[0],
    myPlayerEnum: Player,
    isMyTurn: boolean,
): boolean {
    return isMyTurn || allowsBoardItemAfterOwnMoveBeforeOpponentActs(game, myPlayerEnum, isMyTurn);
}
