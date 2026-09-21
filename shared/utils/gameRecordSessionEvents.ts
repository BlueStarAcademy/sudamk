import { Player } from '../types/enums.js';
import type { Point } from '../types/enums.js';
import type {
    ChessPieceState,
    GameRecordChessEvent,
    GameRecordMissileEvent,
    GameRecordScanEvent,
    LiveGameSession,
} from '../types/entities.js';

export function isPassMove(move: { x: number; y: number } | null | undefined): boolean {
    if (!move) return true;
    return move.x === -1 && move.y === -1;
}

export function countNonPassMoves(moveHistory: LiveGameSession['moveHistory'] | null | undefined): number {
    if (!Array.isArray(moveHistory) || moveHistory.length === 0) return 0;
    let n = 0;
    for (const move of moveHistory) {
        if (!isPassMove(move)) n += 1;
    }
    return n;
}

function samePoint(a: Point, b: Point): boolean {
    return a.x === b.x && a.y === b.y;
}

export function recordMissileEvent(
    game: Pick<LiveGameSession, 'missileEvents' | 'moveHistory'>,
    event: GameRecordMissileEvent,
): void {
    if (!Number.isFinite(event.from.x) || !Number.isFinite(event.to.x)) return;
    if (samePoint(event.from, event.to)) return;
    const list = game.missileEvents ?? (game.missileEvents = []);
    const last = list[list.length - 1];
    if (
        last &&
        last.player === event.player &&
        last.afterNonPassCount === event.afterNonPassCount &&
        last.moveIndex === event.moveIndex &&
        samePoint(last.from, event.from) &&
        samePoint(last.to, event.to)
    ) {
        if (event.captured?.length && !last.captured?.length) {
            last.captured = event.captured.map((p) => ({ x: p.x, y: p.y }));
        }
        return;
    }
    list.push({
        moveIndex: event.moveIndex,
        afterNonPassCount: event.afterNonPassCount,
        player: event.player,
        from: { x: event.from.x, y: event.from.y },
        to: { x: event.to.x, y: event.to.y },
        captured: event.captured?.map((p) => ({ x: p.x, y: p.y })),
    });
}

export function recordScanEvent(
    game: Pick<LiveGameSession, 'scanEvents'>,
    event: GameRecordScanEvent,
): void {
    if (!Number.isFinite(event.x) || !Number.isFinite(event.y)) return;
    const list = game.scanEvents ?? (game.scanEvents = []);
    list.push({
        afterNonPassCount: event.afterNonPassCount,
        player: event.player,
        x: event.x,
        y: event.y,
        success: !!event.success,
    });
}

function cloneChessPiece(piece: ChessPieceState): ChessPieceState {
    return { ...piece };
}

export function snapshotChessSetupIfNeeded(
    session: {
        chessPieces?: ChessPieceState[];
        chessSetup?: ChessPieceState[];
    },
): void {
    if (session.chessSetup && session.chessSetup.length > 0) return;
    if (!session.chessPieces?.length) return;
    session.chessSetup = session.chessPieces.map(cloneChessPiece);
}

export function recordChessEvent(
    session: {
        chessEvents?: GameRecordChessEvent[];
        chessPieces?: ChessPieceState[];
        chessSetup?: ChessPieceState[];
        moveHistory?: LiveGameSession['moveHistory'];
    },
    event: Omit<GameRecordChessEvent, 'afterNonPassCount'> & { afterNonPassCount?: number },
): void {
    snapshotChessSetupIfNeeded(session);
    const list = session.chessEvents ?? (session.chessEvents = []);
    const afterNonPassCount = event.afterNonPassCount ?? countNonPassMoves(session.moveHistory);
    const last = list[list.length - 1];
    if (
        last &&
        last.pieceId === event.pieceId &&
        last.afterNonPassCount === afterNonPassCount &&
        samePoint(last.from, event.from) &&
        samePoint(last.to, event.to)
    ) {
        return;
    }
    list.push({
        afterNonPassCount,
        pieceId: event.pieceId,
        from: { x: event.from.x, y: event.from.y },
        to: { x: event.to.x, y: event.to.y },
    });
}

export function isBlackOrWhite(player: Player | null | undefined): player is Player.Black | Player.White {
    return player === Player.Black || player === Player.White;
}
