import { Player } from '../shared/types/enums.js';
import type { Point } from '../shared/types/enums.js';
import type {
    ChessPieceState,
    GameRecordBoardExtras,
    GameRecordSetupStone,
} from '../shared/types/entities.js';
import { applySgfMoveToBoard, createEmptyBoard, type SgfMoveLike } from './sgfBoardLogic.js';
import { detectAndConfirmTerritories, pointKey } from '../shared/utils/castleGoRules.js';
import type { GameSettings } from '../shared/types/index.js';

export type GameRecordReplayScanMarker = {
    x: number;
    y: number;
    success: boolean;
    player: Player;
};

export type GameRecordReplayState = {
    board: Player[][];
    baseKeys: Set<string>;
    hiddenKeys: Set<string>;
    missileMarkedKeys: Set<string>;
    scanMarkers: GameRecordReplayScanMarker[];
    castleStonePoints: Point[];
    territoryOwnerByPoint: Record<string, Player.Black | Player.White>;
    chessPieces: ChessPieceState[];
    uniformStoneDisplayColor: Player | null;
};

function cellKey(x: number, y: number): string {
    return `${x},${y}`;
}

function relocateOverlayKey(from: Point, to: Point, keys: Set<string>): void {
    const fk = cellKey(from.x, from.y);
    if (!keys.has(fk)) return;
    keys.delete(fk);
    keys.add(cellKey(to.x, to.y));
}

function cloneChessPieces(pieces: ChessPieceState[] | undefined): ChessPieceState[] {
    return (pieces ?? []).map((p) => ({ ...p }));
}

function placeSetupStones(board: Player[][], setup: GameRecordSetupStone[] | undefined, baseKeys: Set<string>): void {
    if (!setup?.length) return;
    for (const stone of setup) {
        if (stone.player !== Player.Black && stone.player !== Player.White) continue;
        if (board[stone.y]?.[stone.x] === undefined) continue;
        board[stone.y]![stone.x] = stone.player;
        if (stone.isBase !== false) baseKeys.add(cellKey(stone.x, stone.y));
    }
}

function applyMissileToBoard(
    board: Player[][],
    from: Point,
    to: Point,
    player: Player,
    captured: Point[] | undefined,
    overlaySets: Set<string>[],
    missileMarkedKeys: Set<string>,
): void {
    if (board[from.y]?.[from.x] === player) {
        board[from.y]![from.x] = Player.None;
    }
    if (board[to.y]?.[to.x] !== undefined) {
        board[to.y]![to.x] = player;
    }
    for (const set of overlaySets) {
        relocateOverlayKey(from, to, set);
    }
    missileMarkedKeys.add(cellKey(to.x, to.y));
    missileMarkedKeys.delete(cellKey(from.x, from.y));
    if (captured?.length) {
        for (const p of captured) {
            if (board[p.y]?.[p.x] !== undefined) board[p.y]![p.x] = Player.None;
            const k = cellKey(p.x, p.y);
            for (const set of overlaySets) set.delete(k);
            missileMarkedKeys.delete(k);
        }
    }
}

/**
 * SGF 수순 N개까지 재생한 보드와 특수 모드 오버레이.
 * `moveCount === 0`이면 베이스 배치만, 미사일/스캔은 afterNonPassCount === 0 인 것만 적용.
 */
export function applyGameRecordReplay(
    boardSize: number,
    moves: SgfMoveLike[],
    extras: GameRecordBoardExtras | undefined,
    moveCount: number,
): GameRecordReplayState {
    const board = createEmptyBoard(boardSize);
    const baseKeys = new Set<string>();
    const hiddenKeys = new Set<string>();
    const missileMarkedKeys = new Set<string>();
    placeSetupStones(board, extras?.setupStones, baseKeys);

    const n = Math.max(0, Math.min(moveCount, moves.length));
    const chessPieces = cloneChessPieces(extras?.chessSetup);
    const overlaySets = [baseKeys, hiddenKeys, missileMarkedKeys];

    const applyEventsAt = (afterNonPassCount: number) => {
        for (const ev of extras?.missileEvents ?? []) {
            if (ev.afterNonPassCount !== afterNonPassCount) continue;
            applyMissileToBoard(board, ev.from, ev.to, ev.player, ev.captured, overlaySets, missileMarkedKeys);
        }
        for (const ev of extras?.chessEvents ?? []) {
            if (ev.afterNonPassCount !== afterNonPassCount) continue;
            const piece = chessPieces.find((p) => p.id === ev.pieceId);
            if (!piece) continue;
            piece.x = ev.to.x;
            piece.y = ev.to.y;
            piece.remainingMoves = Math.max(0, piece.remainingMoves - 1);
        }
    };

    applyEventsAt(0);

    for (let i = 0; i < n; i++) {
        const move = moves[i]!;
        applySgfMoveToBoard(board, move, boardSize);
        if (extras?.hiddenMoveIndices?.includes(i)) {
            hiddenKeys.add(cellKey(move.x, move.y));
        }
        applyEventsAt(i + 1);
    }

    const scanMarkers: GameRecordReplayScanMarker[] = [];
    for (const ev of extras?.scanEvents ?? []) {
        if (ev.afterNonPassCount > n) continue;
        scanMarkers.push({ x: ev.x, y: ev.y, success: ev.success, player: ev.player });
    }

    const castleStonePoints = (extras?.castleStonePoints ?? []).map((p) => ({ x: p.x, y: p.y }));
    let territoryOwnerByPoint: Record<string, Player.Black | Player.White> = {};
    if (castleStonePoints.length > 0) {
        territoryOwnerByPoint = detectAndConfirmTerritories(
            {
                castleStonePoints,
                confirmedTerritoryOwnerByPoint: {},
                settings: { boardSize } as GameSettings,
                boardState: board,
            },
            board,
        );
    }

    const visibleChess = chessPieces.filter((p) => {
        const cell = board[p.y]?.[p.x];
        return cell === p.owner;
    });

    const uniform =
        extras?.uniformStoneDisplayColor === Player.Black || extras?.uniformStoneDisplayColor === Player.White
            ? extras.uniformStoneDisplayColor
            : null;

    return {
        board,
        baseKeys,
        hiddenKeys,
        missileMarkedKeys,
        scanMarkers,
        castleStonePoints,
        territoryOwnerByPoint,
        chessPieces: visibleChess,
        uniformStoneDisplayColor: uniform,
    };
}

export function replayCellHasTerritory(
    territoryOwnerByPoint: Record<string, Player.Black | Player.White>,
    x: number,
    y: number,
): Player.Black | Player.White | null {
    const owner = territoryOwnerByPoint[pointKey(x, y)];
    return owner === Player.Black || owner === Player.White ? owner : null;
}
