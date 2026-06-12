import type { LiveGameSession } from '../types.js';
import { GameMode, Player } from '../types.js';
import { normalizeChessGoSession } from '../shared/utils/chessGoRules.js';

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

type BaseStonePoint = { x: number; y: number; player: number };

/**
 * 슬림 WS(수순만·boardState 생략)에서 포획 없이라도 착점·베이스돌은 보이게 한다.
 * 풀 boardState 패킷이 오면 resolveStrategicPvePlayingBoardAndMoveHistory가 교체한다.
 */
export function deriveBoardFromMoveHistoryAndBaseStones(
    session: LiveGameSession,
    existing?: LiveGameSession,
): LiveGameSession['boardState'] | undefined {
    const boardSize = session.settings?.boardSize;
    const moveHistoryToDerive = session.moveHistory;
    if (!boardSize || !moveHistoryToDerive?.length) return undefined;

    const derivedBoard: number[][] = Array(boardSize)
        .fill(null)
        .map(() => Array(boardSize).fill(Player.None));

    const baseListRaw: BaseStonePoint[] =
        Array.isArray((session as { baseStones?: BaseStonePoint[] }).baseStones) &&
        (session as { baseStones?: BaseStonePoint[] }).baseStones!.length > 0
            ? ((session as { baseStones?: BaseStonePoint[] }).baseStones as BaseStonePoint[])
            : Array.isArray(existing?.baseStones) && existing!.baseStones!.length > 0
              ? (existing!.baseStones as BaseStonePoint[])
              : [];

    for (const bs of baseListRaw) {
        if (
            bs &&
            typeof bs.x === 'number' &&
            typeof bs.y === 'number' &&
            typeof bs.player === 'number' &&
            bs.x >= 0 &&
            bs.x < boardSize &&
            bs.y >= 0 &&
            bs.y < boardSize &&
            (bs.player === Player.Black || bs.player === Player.White)
        ) {
            derivedBoard[bs.y][bs.x] = bs.player;
        }
    }

    for (const move of moveHistoryToDerive) {
        if (move && move.x >= 0 && move.x < boardSize && move.y >= 0 && move.y < boardSize) {
            derivedBoard[move.y][move.x] = move.player;
        }
    }

    return derivedBoard as LiveGameSession['boardState'];
}

/**
 * 모험·길드전 등 PVE 전략 대국 playing GAME_UPDATE:
 * 슬림 패킷(수순만·턴·시계)과 풀 보드 패킷이 섞일 때 판·수순을 한 쌍으로 맞춘다.
 * moveHistory만으로 판을 재구성하면 포획이 빠져 돌이 사라지거나 다른 교차점으로 보인다.
 */
export function resolveStrategicPvePlayingBoardAndMoveHistory(
    server: LiveGameSession,
    client: LiveGameSession | undefined,
): {
    boardState: LiveGameSession['boardState'];
    moveHistory: LiveGameSession['moveHistory'];
} {
    const clientSnap = client ?? server;
    const serverMhLen = wsSessionMoveHistoryLen(server);
    const clientMhLen = wsSessionMoveHistoryLen(clientSnap);
    const serverBoardOk = isSubstantiveBoardState(server.boardState);
    const clientBoardOk = isSubstantiveBoardState(clientSnap.boardState);

    let moveHistory: LiveGameSession['moveHistory'];
    if (serverMhLen > clientMhLen) {
        moveHistory = server.moveHistory;
    } else if (clientMhLen > serverMhLen) {
        moveHistory = clientSnap.moveHistory;
    } else if (serverMhLen > 0) {
        moveHistory = server.moveHistory ?? clientSnap.moveHistory;
    } else {
        moveHistory = clientSnap.moveHistory ?? server.moveHistory;
    }

    let boardState: LiveGameSession['boardState'];
    if (serverBoardOk && serverMhLen >= clientMhLen) {
        boardState = server.boardState;
    } else if (clientBoardOk && clientMhLen > serverMhLen) {
        boardState = clientSnap.boardState;
    } else if (serverMhLen > clientMhLen && !serverBoardOk) {
        // 서버 수순이 앞서는데 boardState가 빠진 슬림 패킷 — 낡은 클라 판을 쓰면 AI 돌이 안 보이다가 한꺼번에 나타남
        const derived = deriveBoardFromMoveHistoryAndBaseStones(server, clientSnap);
        boardState = isSubstantiveBoardState(derived) ? derived : clientBoardOk ? clientSnap.boardState : derived;
    } else if (serverBoardOk) {
        boardState = server.boardState;
    } else if (clientBoardOk) {
        boardState = clientSnap.boardState;
    } else {
        const derived = deriveBoardFromMoveHistoryAndBaseStones(server, clientSnap);
        boardState = derived ?? server.boardState ?? clientSnap.boardState;
    }

    return { boardState, moveHistory };
}

function chessSessionLastMovesMatch(a: LiveGameSession, b: LiveGameSession): boolean {
    const aLen = wsSessionMoveHistoryLen(a);
    const bLen = wsSessionMoveHistoryLen(b);
    if (aLen === 0 || bLen === 0) return aLen === bLen;
    const lastA = a.moveHistory![aLen - 1];
    const lastB = b.moveHistory![bLen - 1];
    return !!(lastA && lastB && lastA.x === lastB.x && lastA.y === lastB.y && lastA.player === lastB.player);
}

function pickChessPlayingAuthoritativeSnapshot(
    server: LiveGameSession,
    client: LiveGameSession,
): LiveGameSession {
    const serverMhLen = wsSessionMoveHistoryLen(server);
    const clientMhLen = wsSessionMoveHistoryLen(client);

    if (serverMhLen > clientMhLen) return server;
    if (clientMhLen > serverMhLen) return client;
    if (serverMhLen > 0 && !chessSessionLastMovesMatch(server, client)) return client;
    return server;
}

/**
 * 체스 바둑 PVE playing: 슬림·낡은 WS/HTTP 패킷이 moveHistory·chessPieces를 되돌리면
 * AI 바둑돌이 사라지거나 다른 교차점에 두는 것처럼 보인다.
 */
export function resolveChessPvePlayingSession(
    server: LiveGameSession,
    client: LiveGameSession | undefined,
): LiveGameSession {
    if (server.mode !== GameMode.Chess) return server;
    const clientSnap = client ?? server;
    const authoritative = pickChessPlayingAuthoritativeSnapshot(server, clientSnap);

    const merged: LiveGameSession = {
        ...clientSnap,
        ...server,
        moveHistory: authoritative.moveHistory,
        chessPieces: authoritative.chessPieces,
        chessGoRemovedPoints: authoritative.chessGoRemovedPoints,
        lastChessMove: authoritative.lastChessMove,
        chessPieceMovedThisTurn: authoritative.chessPieceMovedThisTurn,
        chessCaptureScore: authoritative.chessCaptureScore,
        koInfo: authoritative.koInfo,
        lastMove: authoritative.lastMove,
        captures: authoritative.captures,
    };

    return normalizeChessGoSession(merged);
}
