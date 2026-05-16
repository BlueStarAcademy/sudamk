import type { LiveGameSession } from '../types.js';

/** moveHistory 길이로 “한 수 앞선” 지연 표시 스냅샷을 고른다 (PASS 포함 전체 길이). */
export function wsSessionMoveHistoryLen(session: LiveGameSession | null | undefined): number {
    const mh = session?.moveHistory;
    return Array.isArray(mh) ? mh.length : 0;
}

/**
 * AI 수 WS 지연 적용 중 서버가 먼저 `scoring`만 보낼 때,
 * React state보다 긴 수순을 가진 pending 스냅샷을 선택해 마지막 착점·판면이 사라지지 않게 한다.
 */
export function pickRicherWsBoardSnapshot(
    client: LiveGameSession | null | undefined,
    pendingDeferred: LiveGameSession | null | undefined,
): LiveGameSession | null | undefined {
    if (!pendingDeferred) return client ?? undefined;
    if (!client) return pendingDeferred;
    return wsSessionMoveHistoryLen(pendingDeferred) > wsSessionMoveHistoryLen(client) ? pendingDeferred : client;
}

function isSubstantiveBoardState(boardState: LiveGameSession['boardState'] | undefined): boolean {
    return !!(
        boardState &&
        Array.isArray(boardState) &&
        boardState.length > 0 &&
        boardState[0] &&
        Array.isArray(boardState[0]) &&
        boardState[0].length > 0 &&
        boardState.some(
            (row) => row && Array.isArray(row) && row.some((cell) => cell !== 0 && cell !== null && cell !== undefined),
        )
    );
}

/**
 * PVE 계가 GAME_UPDATE: 서버가 한 수 짧은 수순/보드를내도 클라(마지막 인간 착수 반영)를 우선한다.
 */
export function resolvePveScoringBoardAndMoveHistory(
    server: LiveGameSession,
    client: LiveGameSession,
): {
    boardState: LiveGameSession['boardState'];
    moveHistory: LiveGameSession['moveHistory'];
} {
    const serverMhLen = wsSessionMoveHistoryLen(server);
    const clientMhLen = wsSessionMoveHistoryLen(client);
    const serverBoardOk = isSubstantiveBoardState(server.boardState);
    const clientBoardOk = isSubstantiveBoardState(client.boardState);

    let moveHistory: LiveGameSession['moveHistory'];
    if (clientMhLen > serverMhLen) {
        moveHistory = client.moveHistory;
    } else if (serverMhLen > clientMhLen) {
        moveHistory = server.moveHistory;
    } else if (serverMhLen > 0) {
        moveHistory = server.moveHistory;
    } else {
        moveHistory = client.moveHistory ?? server.moveHistory;
    }

    let boardState: LiveGameSession['boardState'];
    if (clientMhLen > serverMhLen && clientBoardOk) {
        boardState = client.boardState;
    } else if (serverBoardOk) {
        boardState = server.boardState;
    } else if (clientBoardOk) {
        boardState = client.boardState;
    } else {
        boardState = server.boardState ?? client.boardState;
    }

    return { boardState, moveHistory };
}
