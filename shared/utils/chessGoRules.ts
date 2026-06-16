import { GameMode, Player } from '../types/enums.js';
import type { BoardState, ChessPieceState, ChessPieceType, LiveGameSession, Point, ChessLastMoveMarker } from '../types/entities.js';
import { CHESS_BOARD_SIZES } from '../constants/gameSettings.js';
import { mixIncludesChess } from './mixModeSettings.js';

export {
    getChessGoLayout,
    getChessGoPlacementSlots,
    buildFixedKingPiece,
    validateChessPlacementDraft,
    generateRandomChessSetupDraft,
    finalizeChessPiecesFromDrafts,
    draftToChessPieceStates,
    computeChessSetupDraftScore,
    countChessSetupDraftByType,
    getChessSetupBudgetFromSettings,
    CHESS_SETUP_PIECE_LIMITS,
    CHESS_SETUP_MAJOR_TYPES,
} from './chessGoPlacement.js';
export type { ChessGoLayout, ChessPlacementValidation } from './chessGoPlacement.js';

export type ChessGoSessionSlice = Pick<
    LiveGameSession,
    'chessPieces' | 'chessCaptureScore' | 'boardState' | 'settings' | 'captures' | 'chessGoRemovedPoints'
>;

/** 바둑 착수 규칙 검증용 — normalizeChessGoSession에 필요한 필드 */
export type ChessGoSessionForRules = Pick<
    LiveGameSession,
    | 'mode'
    | 'settings'
    | 'moveHistory'
    | 'boardState'
    | 'chessPieces'
    | 'chessCaptureScore'
    | 'chessPieceMovedThisTurn'
    | 'koInfo'
>;

export type ChessGoMoveResult = {
    isValid: boolean;
    newBoardState: BoardState;
    capturedStones: Point[];
    newKoInfo: LiveGameSession['koInfo'];
    reason?: 'ko' | 'suicide' | 'occupied';
};

export type ChessMoveCandidate = {
    pieceId: string;
    from: Point;
    to: Point;
};

export type ChessMoveValidation = {
    ok: boolean;
    reason?: 'not_owner' | 'already_moved' | 'no_moves_left' | 'invalid_pattern' | 'blocked' | 'occupied' | 'out_of_bounds' | 'not_found';
};

export function isChessMode(mode: unknown): boolean {
    return mode === GameMode.Chess;
}

/** 순수 체스 바둑 또는 믹스바둑에 체스 규칙이 포함된 세션 */
export function sessionUsesChessGo(
    session: Pick<LiveGameSession, 'mode' | 'settings'>,
): boolean {
    return (
        session.mode === GameMode.Chess ||
        (session.mode === GameMode.Mix && mixIncludesChess(session.settings?.mixedModes))
    );
}

export function pointKey(x: number, y: number): string {
    return `${x},${y}`;
}

export function recordChessGoRemovedPoints(
    session: Pick<LiveGameSession, 'chessGoRemovedPoints'>,
    points: Point[],
): void {
    if (!points.length) return;
    const existing = session.chessGoRemovedPoints ?? [];
    const keys = new Set(existing.map((p) => pointKey(p.x, p.y)));
    const next = [...existing];
    for (const p of points) {
        const k = pointKey(p.x, p.y);
        if (!keys.has(k)) {
            next.push({ x: p.x, y: p.y });
            keys.add(k);
        }
    }
    session.chessGoRemovedPoints = next;
}

export function clearChessGoRemovedPointAt(
    session: Pick<LiveGameSession, 'chessGoRemovedPoints'>,
    x: number,
    y: number,
): void {
    if (!session.chessGoRemovedPoints?.length) return;
    session.chessGoRemovedPoints = session.chessGoRemovedPoints.filter((p) => p.x !== x || p.y !== y);
}

/** 바둑 착수 확정 시: 새 착점 복원 + 따낸 돌 기록 */
export function commitChessGoPlacementCaptures(
    session: Pick<LiveGameSession, 'chessGoRemovedPoints'>,
    x: number,
    y: number,
    capturedStones: Point[],
): void {
    clearChessGoRemovedPointAt(session, x, y);
    recordChessGoRemovedPoints(session, capturedStones);
}

export function getChessPieceCaptureValue(type: ChessPieceType): number {
    switch (type) {
        case 'pawn':
            return 1;
        case 'knight':
        case 'bishop':
            return 3;
        case 'rook':
            return 5;
        case 'queen':
            return 9;
        case 'king':
            return 0;
        default:
            return 0;
    }
}

function findChessPieceAtPoint(
    chessPieces: ChessPieceState[] | undefined | null,
    stone: Point,
    stoneOwner?: Player.Black | Player.White,
): ChessPieceState | undefined {
    if (!chessPieces?.length) return undefined;
    return chessPieces.find(
        (p) =>
            p.x === stone.x &&
            p.y === stone.y &&
            (stoneOwner == null || p.owner === stoneOwner),
    );
}

/** 체스바둑: 교차점 따내기 점수 (체스 기물 돌은 기물별 가치, 일반 바둑돌은 1) */
export function getChessGoStoneCapturePointValue(
    session: Pick<ChessGoSessionSlice, 'chessPieces'>,
    stone: Point,
    stoneOwner?: Player.Black | Player.White,
): number {
    const chessPiece = findChessPieceAtPoint(session.chessPieces, stone, stoneOwner);
    if (chessPiece) {
        return getChessPieceCaptureValue(chessPiece.type);
    }
    return 1;
}

export type ChessGoPreservedScoringFields = {
    chessPieces?: ChessPieceState[] | null;
    chessGoRemovedPoints?: Point[] | null;
    chessCaptureScore?: { [key in Player]: number } | null;
};

/** 계가 직전 preservedGameState에서 체스바둑 필드를 세션에 복원한다. */
export function applyPreservedChessGoFieldsFromState(
    session: ChessGoSessionSlice & Pick<LiveGameSession, 'mode' | 'settings'>,
    preserved?: ChessGoPreservedScoringFields | Record<string, unknown> | null,
): void {
    if (!preserved || !sessionUsesChessGo(session)) return;
    const ps = preserved as ChessGoPreservedScoringFields;
    if (Array.isArray(ps.chessPieces) && ps.chessPieces.length > 0) {
        session.chessPieces = ps.chessPieces.map((p) => ({ ...p }));
    }
    if (Array.isArray(ps.chessGoRemovedPoints)) {
        session.chessGoRemovedPoints = ps.chessGoRemovedPoints.map((p) => ({ ...p }));
    }
    if (ps.chessCaptureScore && typeof ps.chessCaptureScore === 'object') {
        session.chessCaptureScore = { ...ps.chessCaptureScore };
    }
}

/** 계가·사석 점수 산정 직전: preserved 복원 후 chessPieces 기준으로 boardState를 맞춘다. */
export function prepareChessGoSessionForScoring<
    T extends ChessGoSessionSlice &
        Pick<LiveGameSession, 'mode' | 'settings' | 'moveHistory' | 'boardState' | 'gameStatus' | 'chessPieceMovedThisTurn'>,
>(session: T): T {
    if (!sessionUsesChessGo(session)) return session;
    applyPreservedChessGoFieldsFromState(
        session,
        (session as { preservedGameState?: Record<string, unknown> }).preservedGameState,
    );
    const normalized = normalizeChessGoSession(session);
    session.chessPieces = normalized.chessPieces;
    session.boardState = normalized.boardState;
    session.settings = normalized.settings;
    session.chessCaptureScore = normalized.chessCaptureScore;
    session.chessPieceMovedThisTurn = normalized.chessPieceMovedThisTurn;
    return session;
}

export function getInitialRemainingMoves(type: ChessPieceType): number {
    return type === 'pawn' ? 10 : 5;
}

export const MAJOR_ROW_TYPES: ChessPieceType[] = ['rook', 'knight', 'bishop', 'queen', 'bishop', 'knight', 'rook'];

/** @deprecated 레거시 28기물 자동 배치 — 신규 대국은 커스텀 배치 사용 */
export const CHESS_GO_BOARD_SIZE = 13;

/** 13×13 체스 바둑: 주요 기물 줄·폰 줄 (0-indexed) */
export const CHESS_BLACK_MAJOR_ROW = 11;
export const CHESS_BLACK_PAWN_ROW = 10;
export const CHESS_WHITE_MAJOR_ROW = 1;
export const CHESS_WHITE_PAWN_ROW = 2;
export const CHESS_PIECE_COL_START = 3;
export const CHESS_PIECE_COL_END = 9;

function buildPiece(
    id: string,
    type: ChessPieceType,
    owner: Player.Black | Player.White,
    x: number,
    y: number,
): ChessPieceState {
    return {
        id,
        type,
        owner,
        x,
        y,
        startX: x,
        startY: y,
        remainingMoves: getInitialRemainingMoves(type),
    };
}

function isPawnOnStartingSquare(piece: ChessPieceState): boolean {
    return piece.type === 'pawn' && piece.x === piece.startX && piece.y === piece.startY;
}

/** 13×13 초기 기물 배치 (킹·폰 1개 제외, 14개/색) */
export function generateChessGoInitialPieces(boardSize: number = CHESS_GO_BOARD_SIZE): ChessPieceState[] {
    if (boardSize !== CHESS_GO_BOARD_SIZE) return [];

    const pieces: ChessPieceState[] = [];
    const stableId = (prefix: 'b' | 'w', type: ChessPieceType, x: number, y: number) =>
        `${prefix}-${type}-${x}-${y}`;

    // Black (bottom): major y=11, pawns y=10 (룩~비숍 바로 앞 칸), x=3~9
    for (let i = 0; i < MAJOR_ROW_TYPES.length; i++) {
        const x = CHESS_PIECE_COL_START + i;
        pieces.push(buildPiece(stableId('b', MAJOR_ROW_TYPES[i]!, x, CHESS_BLACK_MAJOR_ROW), MAJOR_ROW_TYPES[i]!, Player.Black, x, CHESS_BLACK_MAJOR_ROW));
    }
    for (let x = CHESS_PIECE_COL_START; x <= CHESS_PIECE_COL_END; x++) {
        pieces.push(buildPiece(stableId('b', 'pawn', x, CHESS_BLACK_PAWN_ROW), 'pawn', Player.Black, x, CHESS_BLACK_PAWN_ROW));
    }

    // White (top): major y=1, pawns y=2, x=3~9
    for (let i = 0; i < MAJOR_ROW_TYPES.length; i++) {
        const x = CHESS_PIECE_COL_START + i;
        pieces.push(buildPiece(stableId('w', MAJOR_ROW_TYPES[i]!, x, CHESS_WHITE_MAJOR_ROW), MAJOR_ROW_TYPES[i]!, Player.White, x, CHESS_WHITE_MAJOR_ROW));
    }
    for (let x = CHESS_PIECE_COL_START; x <= CHESS_PIECE_COL_END; x++) {
        pieces.push(buildPiece(stableId('w', 'pawn', x, CHESS_WHITE_PAWN_ROW), 'pawn', Player.White, x, CHESS_WHITE_PAWN_ROW));
    }

    return pieces;
}

export function createEmptyBoardState(boardSize: number): BoardState {
    return Array.from({ length: boardSize }, () => Array(boardSize).fill(Player.None)) as BoardState;
}

export function applyChessPiecesToBoard(
    boardState: BoardState,
    pieces: ChessPieceState[],
): BoardState {
    const board = boardState.map((row) => [...row]) as BoardState;
    for (const piece of pieces) {
        board[piece.y]![piece.x] = piece.owner;
    }
    return board;
}

/** 구(좌·우 변 x=0/12) 폰 배치 */
export function hasLegacyChessFlankPawnLayout(pieces: ChessPieceState[] | undefined): boolean {
    if (!pieces?.length) return false;
    return pieces.some(
        (p) =>
            p.type === 'pawn' &&
            (p.x < CHESS_PIECE_COL_START || p.x > CHESS_PIECE_COL_END),
    );
}

/** 레거시: 주요 기물이 보드 최상·최하단(y=0/12)에 있는 배치 */
export function hasLegacyChessEdgeMajorLayout(pieces: ChessPieceState[] | undefined): boolean {
    if (!pieces?.length) return false;
    const edgeY = CHESS_GO_BOARD_SIZE - 1;
    return pieces.some((p) => p.type !== 'pawn' && (p.y === 0 || p.y === edgeY));
}

/** 표준 배치가 아닌 레거시 chessPieces (측면 폰·가장자리 주요기물·오프닝 불일치). 기물 이동 후 배치는 레거시가 아님. */
export function isLegacyChessGoLayout(pieces: ChessPieceState[] | undefined): boolean {
    if (!pieces?.length) return true;
    if (hasLegacyChessFlankPawnLayout(pieces)) return true;
    if (hasLegacyChessEdgeMajorLayout(pieces)) return true;
    if (hasChessPiecesMovedFromStart(pieces)) return false;
    return !isStandardChessGoOpeningLayout(pieces);
}

export function isStandardChessGoPawnLayout(pieces: ChessPieceState[] | undefined): boolean {
    if (!pieces?.length) return false;
    const blackPawns = pieces.filter((p) => p.owner === Player.Black && p.type === 'pawn');
    const whitePawns = pieces.filter((p) => p.owner === Player.White && p.type === 'pawn');
    if (blackPawns.length !== 7 || whitePawns.length !== 7) return false;
    return (
        blackPawns.every((p) => p.y === CHESS_BLACK_PAWN_ROW && p.x >= CHESS_PIECE_COL_START && p.x <= CHESS_PIECE_COL_END) &&
        whitePawns.every((p) => p.y === CHESS_WHITE_PAWN_ROW && p.x >= CHESS_PIECE_COL_START && p.x <= CHESS_PIECE_COL_END)
    );
}

/** 주요 기물 줄 RNBQBNR (x=3~9) */
export function isStandardChessGoMajorLayout(pieces: ChessPieceState[] | undefined): boolean {
    if (!pieces?.length) return false;
    for (let i = 0; i < MAJOR_ROW_TYPES.length; i++) {
        const x = CHESS_PIECE_COL_START + i;
        const expected = MAJOR_ROW_TYPES[i]!;
        const black = pieces.find(
            (p) => p.owner === Player.Black && p.x === x && p.y === CHESS_BLACK_MAJOR_ROW,
        );
        const white = pieces.find(
            (p) => p.owner === Player.White && p.x === x && p.y === CHESS_WHITE_MAJOR_ROW,
        );
        if (!black || black.type !== expected || !white || white.type !== expected) return false;
    }
    return true;
}

export function isStandardChessGoOpeningLayout(pieces: ChessPieceState[] | undefined): boolean {
    return (
        pieces?.length === 28 &&
        isStandardChessGoPawnLayout(pieces) &&
        isStandardChessGoMajorLayout(pieces) &&
        !hasLegacyChessFlankPawnLayout(pieces)
    );
}

export function countChessGoPlacedMoves(session: Pick<LiveGameSession, 'moveHistory'>): number {
    return (session.moveHistory ?? []).filter((m) => m.x >= 0 && m.y >= 0).length;
}

/** 기물이 시작 칸에서 벗어났으면(합법 이동 포함) 레거시 초기 배치 교정을 하지 않는다. */
export function hasChessPiecesMovedFromStart(pieces: ChessPieceState[] | undefined): boolean {
    if (!pieces?.length) return false;
    return pieces.some((p) => p.x !== p.startX || p.y !== p.startY);
}

/** 표준 오프닝 기준으로 기물이 움직였는지 (레거시 배치 자체는 midgame으로 보지 않음). */
export function hasChessPiecesMovedFromStandardOpening(pieces: ChessPieceState[] | undefined): boolean {
    if (!pieces?.length || isLegacyChessGoLayout(pieces)) return false;
    return hasChessPiecesMovedFromStart(pieces);
}

/** 본게임 중 chessPieces·기물 이동을 초기 배치로 되돌리면 안 되는 상태 */
export function shouldPreserveChessGoMidgameState(
    session: Pick<LiveGameSession, 'mode' | 'chessPieces' | 'chessPieceMovedThisTurn'>,
): boolean {
    if (session.mode !== GameMode.Chess) return false;
    if (session.chessPieceMovedThisTurn === true) return true;
    return hasChessPiecesMovedFromStandardOpening(session.chessPieces);
}

export function buildChessGoOpeningBoardState(pieces: ChessPieceState[], boardSize: number): BoardState {
    return applyChessPiecesToBoard(createEmptyBoardState(boardSize), pieces);
}

const CHESS_OPENING_STONE_KEYS = (() => {
    const keys = new Set<string>();
    for (let x = CHESS_PIECE_COL_START; x <= CHESS_PIECE_COL_END; x++) {
        keys.add(pointKey(x, CHESS_WHITE_MAJOR_ROW));
        keys.add(pointKey(x, CHESS_WHITE_PAWN_ROW));
        keys.add(pointKey(x, CHESS_BLACK_PAWN_ROW));
        keys.add(pointKey(x, CHESS_BLACK_MAJOR_ROW));
    }
    return keys;
})();

/** 초기 배치: 돌은 x=3~9 주요·폰 줄에만 28개 있어야 함 (측면 x=0/12 레거시 판 거부) */
export function isStandardChessGoOpeningBoard(board: BoardState | undefined): boolean {
    if (!board || board.length !== CHESS_GO_BOARD_SIZE) return false;
    let stoneCount = 0;
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board.length; x++) {
            if (board[y]![x] === Player.None) continue;
            stoneCount += 1;
            if (!CHESS_OPENING_STONE_KEYS.has(pointKey(x, y))) return false;
        }
    }
    return stoneCount === 28;
}

export function boardMatchesChessPieces(
    board: BoardState | undefined,
    pieces: ChessPieceState[] | undefined,
    options?: { strictOpening?: boolean },
): boolean {
    if (!board?.length || !pieces?.length) return false;
    for (const piece of pieces) {
        if (board[piece.y]?.[piece.x] !== piece.owner) return false;
    }
    if (!options?.strictOpening) return true;
    let stoneCount = 0;
    for (const row of board) {
        for (const cell of row) {
            if (cell !== Player.None) stoneCount += 1;
        }
    }
    return stoneCount === pieces.length;
}

function rebuildChessGoBoardFromSession(
    session: Pick<LiveGameSession, 'moveHistory' | 'chessPieces' | 'chessGoRemovedPoints' | 'settings'>,
): BoardState {
    const boardSize = getSessionBoardSize(session);
    const board = createEmptyBoardState(boardSize);
    const removedKeys = new Set(
        (session.chessGoRemovedPoints ?? []).map((p) => pointKey(p.x, p.y)),
    );
    for (const move of session.moveHistory ?? []) {
        if (move.x >= 0 && move.y >= 0 && move.x < boardSize && move.y < boardSize) {
            if (removedKeys.has(pointKey(move.x, move.y))) continue;
            board[move.y]![move.x] = move.player;
        }
    }
    for (const piece of session.chessPieces ?? []) {
        if (
            piece.x >= 0 &&
            piece.y >= 0 &&
            piece.x < boardSize &&
            piece.y < boardSize
        ) {
            board[piece.y]![piece.x] = piece.owner;
        }
    }
    return board;
}

function getSessionBoardSize(session: Pick<LiveGameSession, 'settings'>): number {
    const size = session.settings?.boardSize ?? CHESS_GO_BOARD_SIZE;
    return (CHESS_BOARD_SIZES as readonly number[]).includes(size) ? size : CHESS_GO_BOARD_SIZE;
}

function applyChessGoBoardSizeSetting(session: Pick<LiveGameSession, 'settings'>): void {
    if (!session.settings) return;
    const size = getSessionBoardSize(session);
    if (session.settings.boardSize !== size) {
        session.settings = {
            ...session.settings,
            boardSize: size as LiveGameSession['settings']['boardSize'],
        };
    }
}

/**
 * 체스 바둑 세션 단일 진입점 — 서버 저장·캐시·WS 병합·클라 렌더 직전에 호출.
 * chessPieces가 진실원천이며 boardState는 chessPieces + moveHistory로 항상 재구성한다.
 */
export function normalizeChessGoSession<
    T extends Pick<
        LiveGameSession,
        | 'mode'
        | 'settings'
        | 'moveHistory'
        | 'boardState'
        | 'chessPieces'
        | 'chessCaptureScore'
        | 'chessPieceMovedThisTurn'
        | 'gameStatus'
    >,
>(session: T): T {
    if (!sessionUsesChessGo(session)) return session;

    const savedMovedFlag = session.chessPieceMovedThisTurn === true;
    const next: T = {
        ...session,
        chessPieces: session.chessPieces?.map((p) => ({ ...p })),
    };
    applyChessGoBoardSizeSetting(next);

    const goPlaced = countChessGoPlacedMoves(next);
    const inPlacement = next.gameStatus === 'chess_piece_placement';
    const piecesMovedFromStart = hasChessPiecesMovedFromStart(next.chessPieces);

    if (inPlacement) {
        next.chessPieceMovedThisTurn = false;
    } else if (goPlaced > 0 || savedMovedFlag || piecesMovedFromStart) {
        next.chessPieceMovedThisTurn = savedMovedFlag;
    } else {
        next.chessPieceMovedThisTurn = false;
    }

    if (!next.chessCaptureScore) {
        next.chessCaptureScore = createEmptyChessCaptureScore();
    }
    next.boardState = rebuildChessGoBoardFromSession(next);
    return next;
}

/** WS 송신·캐시·rejoin 직전: 세션 객체에 normalize 결과를 그대로 반영 */
export function applyNormalizedChessGoInPlace(
    game: Pick<
        LiveGameSession,
        | 'mode'
        | 'settings'
        | 'moveHistory'
        | 'boardState'
        | 'chessPieces'
        | 'chessCaptureScore'
        | 'chessPieceMovedThisTurn'
    >,
): void {
    if (!isChessMode(game.mode)) return;
    const normalized = normalizeChessGoSession(game as LiveGameSession);
    game.chessPieces = normalized.chessPieces;
    game.boardState = normalized.boardState;
    game.settings = normalized.settings;
    game.chessCaptureScore = normalized.chessCaptureScore;
    game.chessPieceMovedThisTurn = normalized.chessPieceMovedThisTurn;
}

/** @deprecated normalizeChessGoSession 사용 */
export function syncChessGoBoardFromPiecesAndMoves(
    session: Pick<LiveGameSession, 'mode' | 'settings' | 'moveHistory' | 'boardState' | 'chessPieces'>,
): void {
    if (session.mode !== GameMode.Chess || !session.chessPieces?.length) return;
    applyChessGoBoardSizeSetting(session);
    session.boardState = rebuildChessGoBoardFromSession(session);
}

/** 수순 0·레거시 오프닝을 표준 28기물로 교정 (normalizeChessGoSession 래퍼) */
export function ensureChessGoOpeningLayout(
    session: Pick<
        LiveGameSession,
        'mode' | 'settings' | 'moveHistory' | 'boardState' | 'chessPieces' | 'chessCaptureScore' | 'chessPieceMovedThisTurn'
    >,
): boolean {
    if (session.mode !== GameMode.Chess) return false;
    if (countChessGoPlacedMoves(session) > 0) return false;
    if (hasChessPiecesMovedFromStandardOpening(session.chessPieces)) return false;
    const beforePieces = JSON.stringify(session.chessPieces ?? []);
    const beforeBoard = JSON.stringify(session.boardState ?? []);
    const normalized = normalizeChessGoSession(session as LiveGameSession);
    session.chessPieces = normalized.chessPieces;
    session.boardState = normalized.boardState;
    session.settings = normalized.settings;
    session.chessCaptureScore = normalized.chessCaptureScore;
    session.chessPieceMovedThisTurn = normalized.chessPieceMovedThisTurn;
    return (
        beforePieces !== JSON.stringify(session.chessPieces ?? []) ||
        beforeBoard !== JSON.stringify(session.boardState ?? [])
    );
}

/** 레거시 측면 폰 chessPieces를 표준 폰 줄(x=3~9)로 옮긴다(아직 안 움직인 폰만). */
export function migrateUnmovedLegacyFlankPawns(pieces: ChessPieceState[]): boolean {
    if (!hasLegacyChessFlankPawnLayout(pieces)) return false;
    let changed = false;
    const migrateColor = (
        owner: Player.Black | Player.White,
        pawnRow: number,
        isFlank: (p: ChessPieceState) => boolean,
    ) => {
        const flankPawns = pieces
            .filter(
                (p) =>
                    p.owner === owner &&
                    p.type === 'pawn' &&
                    isFlank(p) &&
                    p.x === p.startX &&
                    p.y === p.startY,
            )
            .sort((a, b) => a.y - b.y);
        for (let i = 0; i < flankPawns.length && i < 7; i++) {
            const x = CHESS_PIECE_COL_START + i;
            const pawn = flankPawns[i]!;
            if (pawn.x !== x || pawn.y !== pawnRow) {
                pawn.x = x;
                pawn.y = pawnRow;
                pawn.startX = x;
                pawn.startY = pawnRow;
                changed = true;
            }
        }
    };
    migrateColor(Player.White, CHESS_WHITE_PAWN_ROW, (p) => p.x < CHESS_PIECE_COL_START);
    migrateColor(Player.Black, CHESS_BLACK_PAWN_ROW, (p) => p.x > CHESS_PIECE_COL_END);
    return changed;
}

/** chessPieces 좌표에 맞게 기물 돌만 보드에 반영(바둑 착수·이동 전 옛 자리 정리). */
export function patchChessStonesOnBoard(
    session: Pick<LiveGameSession, 'boardState' | 'chessPieces' | 'moveHistory'>,
): void {
    if (!session.chessPieces?.length || !session.boardState?.length) return;
    if (hasLegacyChessFlankPawnLayout(session.chessPieces)) return;

    const goStoneKeys = new Set(
        (session.moveHistory ?? [])
            .filter((m) => m.x >= 0 && m.y >= 0)
            .map((m) => pointKey(m.x, m.y)),
    );
    const currentPieceKeys = new Set(session.chessPieces.map((p) => pointKey(p.x, p.y)));
    const board = session.boardState.map((row) => [...row]) as BoardState;

    for (const key of CHESS_OPENING_STONE_KEYS) {
        if (currentPieceKeys.has(key) || goStoneKeys.has(key)) continue;
        const [x, y] = key.split(',').map(Number) as [number, number];
        board[y]![x] = Player.None;
    }

    for (const piece of session.chessPieces) {
        board[piece.y]![piece.x] = piece.owner;
    }
    session.boardState = board;
}

export function boardHasStrayLegacyFlankStones(
    session: Pick<LiveGameSession, 'boardState' | 'chessPieces' | 'moveHistory'>,
): boolean {
    if (!session.boardState?.length) return false;
    const pieceKeys = new Set(session.chessPieces?.map((p) => pointKey(p.x, p.y)) ?? []);
    const goStoneKeys = new Set(
        (session.moveHistory ?? [])
            .filter((m) => m.x >= 0 && m.y >= 0)
            .map((m) => pointKey(m.x, m.y)),
    );
    for (let y = 0; y < session.boardState.length; y++) {
        for (let x = 0; x < session.boardState.length; x++) {
            if (session.boardState[y]![x] === Player.None) continue;
            const key = pointKey(x, y);
            if (pieceKeys.has(key) || goStoneKeys.has(key)) continue;
            if (x < CHESS_PIECE_COL_START || x > CHESS_PIECE_COL_END) return true;
        }
    }
    return false;
}

function rebuildChessGoBoardPreservingGoStones(
    session: Pick<LiveGameSession, 'moveHistory' | 'chessPieces'>,
    pieces: ChessPieceState[],
): BoardState {
    return rebuildChessGoBoardFromSession({ ...session, chessPieces: pieces });
}

/**
 * @deprecated normalizeChessGoSession 사용
 */
export function repairChessOpeningWhilePreservingGoStones(
    session: Pick<
        LiveGameSession,
        'mode' | 'settings' | 'moveHistory' | 'boardState' | 'chessPieces' | 'chessCaptureScore' | 'chessPieceMovedThisTurn'
    >,
): boolean {
    if (session.mode !== GameMode.Chess) return false;
    if (shouldPreserveChessGoMidgameState(session)) return false;
    const before = JSON.stringify(session.chessPieces ?? []);
    const normalized = normalizeChessGoSession(session as LiveGameSession);
    session.chessPieces = normalized.chessPieces;
    session.boardState = normalized.boardState;
    session.settings = normalized.settings;
    session.chessCaptureScore = normalized.chessCaptureScore;
    return before !== JSON.stringify(session.chessPieces ?? []);
}

/** 레거시 측면(x=0/12) 폰 돌 제거 — 실제 바둑 착수·기물 위치는 유지. */
export function stripLegacyChessFlankBoardStones(
    session: Pick<LiveGameSession, 'boardState' | 'chessPieces' | 'moveHistory'>,
): void {
    if (!session.boardState?.length || !session.chessPieces?.length) return;
    const pieceKeys = new Set(session.chessPieces.map((p) => pointKey(p.x, p.y)));
    const goStoneKeys = new Set(
        (session.moveHistory ?? [])
            .filter((m) => m.x >= 0 && m.y >= 0)
            .map((m) => pointKey(m.x, m.y)),
    );
    const board = session.boardState.map((row) => [...row]) as BoardState;
    for (let y = 0; y < board.length; y++) {
        for (let x = 0; x < board.length; x++) {
            const key = pointKey(x, y);
            if (pieceKeys.has(key) || goStoneKeys.has(key)) continue;
            if (x < CHESS_PIECE_COL_START || x > CHESS_PIECE_COL_END) {
                board[y]![x] = Player.None;
            }
        }
    }
    session.boardState = board;
}

/** @deprecated normalizeChessGoSession 사용 */
export function needsChessGoLayoutRepair(
    session: Pick<LiveGameSession, 'settings' | 'moveHistory' | 'boardState' | 'chessPieces'>,
): boolean {
    if (hasChessPiecesMovedFromStandardOpening(session.chessPieces)) return false;
    return (
        session.settings?.boardSize !== CHESS_GO_BOARD_SIZE ||
        isLegacyChessGoLayout(session.chessPieces) ||
        session.boardState?.length !== CHESS_GO_BOARD_SIZE ||
        boardHasStrayLegacyFlankStones(session) ||
        !boardMatchesChessPieces(session.boardState, session.chessPieces)
    );
}

/** @deprecated normalizeChessGoSession 사용 */
export function reconcileChessGoClientSession<
    T extends Pick<
        LiveGameSession,
        'mode' | 'settings' | 'moveHistory' | 'boardState' | 'chessPieces' | 'chessCaptureScore' | 'chessPieceMovedThisTurn'
    >,
>(session: T): T {
    return normalizeChessGoSession(session);
}

export function createEmptyChessCaptureScore(): { [Player.Black]: number; [Player.White]: number; [Player.None]: number } {
    return { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
}

export function getChessPieceAt(session: ChessGoSessionSlice, x: number, y: number): ChessPieceState | undefined {
    return session.chessPieces?.find((p) => p.x === x && p.y === y);
}

function getNeighbors(x: number, y: number, boardSize: number): Point[] {
    const neighbors: Point[] = [];
    if (x > 0) neighbors.push({ x: x - 1, y });
    if (x < boardSize - 1) neighbors.push({ x: x + 1, y });
    if (y > 0) neighbors.push({ x, y: y - 1 });
    if (y < boardSize - 1) neighbors.push({ x, y: y + 1 });
    return neighbors;
}

function findGroup(
    board: BoardState,
    startX: number,
    startY: number,
    color: Player.Black | Player.White,
): { stones: Point[]; liberties: number } | null {
    if (board[startY]?.[startX] !== color) return null;
    const boardSize = board.length;
    const q: Point[] = [{ x: startX, y: startY }];
    const visited = new Set<string>([pointKey(startX, startY)]);
    const liberties = new Set<string>();
    const stones: Point[] = [{ x: startX, y: startY }];

    while (q.length > 0) {
        const { x: cx, y: cy } = q.shift()!;
        for (const n of getNeighbors(cx, cy, boardSize)) {
            const key = pointKey(n.x, n.y);
            const cell = board[n.y]![n.x]!;
            if (cell === Player.None) {
                liberties.add(key);
            } else if (cell === color && !visited.has(key)) {
                visited.add(key);
                q.push(n);
                stones.push(n);
            }
        }
    }
    return { stones, liberties: liberties.size };
}

export function isPlayableChessGoIntersection(
    session: ChessGoSessionForRules,
    x: number,
    y: number,
): boolean {
    const normalized = normalizeChessGoSession(session as LiveGameSession);
    const board = normalized.boardState;
    if (!board?.length || y < 0 || x < 0 || y >= board.length || x >= board.length) return false;
    return board[y]![x] === Player.None;
}

export function processChessGoMove(
    session: ChessGoSessionForRules,
    move: { x: number; y: number; player: Player.Black | Player.White },
    koInfo: LiveGameSession['koInfo'],
    moveHistoryLength: number,
): ChessGoMoveResult {
    const normalized = normalizeChessGoSession(session as LiveGameSession);
    const boardState = normalized.boardState;
    const { x, y, player } = move;
    const boardSize = boardState.length;
    const opponent = player === Player.Black ? Player.White : Player.Black;

    if (y < 0 || y >= boardSize || x < 0 || x >= boardSize) {
        return { isValid: false, reason: 'occupied', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
    }

    if (!isPlayableChessGoIntersection(normalized, x, y)) {
        return { isValid: false, reason: 'occupied', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
    }

    if (koInfo && koInfo.point.x === x && koInfo.point.y === y && koInfo.turn === moveHistoryLength) {
        return { isValid: false, reason: 'ko', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
    }

    const tempBoard = boardState.map((row) => [...row]) as BoardState;
    tempBoard[y]![x] = player;

    let capturedStones: Point[] = [];
    let singleCapturePoint: Point | null = null;
    const checkedOpponentNeighbors = new Set<string>();

    for (const n of getNeighbors(x, y, boardSize)) {
        const key = pointKey(n.x, n.y);
        if (tempBoard[n.y]![n.x] === opponent && !checkedOpponentNeighbors.has(key)) {
            const group = findGroup(tempBoard, n.x, n.y, opponent);
            if (group && group.liberties === 0) {
                capturedStones.push(...group.stones);
                if (group.stones.length === 1) {
                    singleCapturePoint = group.stones[0]!;
                }
                group.stones.forEach((s) => checkedOpponentNeighbors.add(pointKey(s.x, s.y)));
            }
        }
    }

    if (capturedStones.length > 0) {
        for (const stone of capturedStones) {
            tempBoard[stone.y]![stone.x] = Player.None;
        }
    }

    const myGroup = findGroup(tempBoard, x, y, player);
    if (myGroup && myGroup.liberties === 0) {
        return { isValid: false, reason: 'suicide', newBoardState: boardState, capturedStones: [], newKoInfo: koInfo };
    }

    let newKoInfo: LiveGameSession['koInfo'] = null;
    if (
        myGroup &&
        capturedStones.length === 1 &&
        myGroup.stones.length === 1 &&
        myGroup.liberties === 1 &&
        singleCapturePoint != null
    ) {
        newKoInfo = { point: singleCapturePoint, turn: moveHistoryLength + 1 };
    }
    if (capturedStones.length !== 1) {
        newKoInfo = null;
    }

    return { isValid: true, newBoardState: tempBoard, capturedStones, newKoInfo };
}

export function enumerateLegalChessGoStonePlacements(
    session: ChessGoSessionForRules,
    player: Player.Black | Player.White,
): Point[] {
    const normalized = normalizeChessGoSession(session as LiveGameSession);
    const board = normalized.boardState;
    if (!board?.length) return [];
    const boardSize = board.length;
    const koInfo = session.koInfo ?? null;
    const moveHistoryLength = session.moveHistory?.length ?? 0;
    const moves: Point[] = [];

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (!isPlayableChessGoIntersection(normalized, x, y)) continue;
            const result = processChessGoMove(session, { x, y, player }, koInfo, moveHistoryLength);
            if (result.isValid) {
                moves.push({ x, y });
            }
        }
    }

    return moves;
}

function pawnForwardDelta(owner: Player.Black | Player.White): number {
    return owner === Player.Black ? -1 : 1;
}

function isCellEmpty(board: BoardState, x: number, y: number): boolean {
    return board[y]?.[x] === Player.None;
}

function isPathClear(board: BoardState, fromX: number, fromY: number, toX: number, toY: number): boolean {
    const dx = Math.sign(toX - fromX);
    const dy = Math.sign(toY - fromY);
    let cx = fromX + dx;
    let cy = fromY + dy;
    while (cx !== toX || cy !== toY) {
        if (!isCellEmpty(board, cx, cy)) return false;
        cx += dx;
        cy += dy;
    }
    return true;
}

function isValidChessDestination(
    board: BoardState,
    piece: ChessPieceState,
    toX: number,
    toY: number,
    boardSize: number,
): boolean {
    if (toX < 0 || toY < 0 || toX >= boardSize || toY >= boardSize) return false;
    if (!isCellEmpty(board, toX, toY)) return false;

    const dx = toX - piece.x;
    const dy = toY - piece.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    switch (piece.type) {
        case 'pawn': {
            const forward = pawnForwardDelta(piece.owner);
            if (dx !== 0) return false;
            if (dy === forward) return true;
            if (dy === 2 * forward && isPawnOnStartingSquare(piece)) {
                const midY = piece.y + forward;
                return isCellEmpty(board, piece.x, midY) && isPathClear(board, piece.x, piece.y, toX, toY);
            }
            return false;
        }
        case 'rook':
            if (dx !== 0 && dy !== 0) return false;
            return isPathClear(board, piece.x, piece.y, toX, toY);
        case 'bishop':
            if (adx !== ady || adx === 0) return false;
            return isPathClear(board, piece.x, piece.y, toX, toY);
        case 'queen':
            if (dx !== 0 && dy !== 0 && adx !== ady) return false;
            if (dx === 0 && dy === 0) return false;
            return isPathClear(board, piece.x, piece.y, toX, toY);
        case 'knight':
            return (adx === 1 && ady === 2) || (adx === 2 && ady === 1);
        case 'king':
            return adx <= 1 && ady <= 1 && (adx + ady > 0);
        default:
            return false;
    }
}

export function validateChessMove(
    session: ChessGoSessionSlice & { chessPieceMovedThisTurn?: boolean },
    pieceId: string,
    toX: number,
    toY: number,
    actingPlayer: Player.Black | Player.White,
): ChessMoveValidation {
    const piece = session.chessPieces?.find((p) => p.id === pieceId);
    if (!piece) return { ok: false, reason: 'not_found' };
    if (piece.owner !== actingPlayer) return { ok: false, reason: 'not_owner' };
    if (session.chessPieceMovedThisTurn) return { ok: false, reason: 'already_moved' };
    if (piece.remainingMoves <= 0) return { ok: false, reason: 'no_moves_left' };

    const boardSize = session.boardState.length;
    if (toX < 0 || toY < 0 || toX >= boardSize || toY >= boardSize) {
        return { ok: false, reason: 'out_of_bounds' };
    }
    if (!isCellEmpty(session.boardState, toX, toY)) {
        return { ok: false, reason: 'occupied' };
    }
    if (!isValidChessDestination(session.boardState, piece, toX, toY, boardSize)) {
        return { ok: false, reason: 'invalid_pattern' };
    }
    return { ok: true };
}

export function enumerateLegalChessMoves(
    session: ChessGoSessionSlice & { chessPieceMovedThisTurn?: boolean },
    actingPlayer: Player.Black | Player.White,
): ChessMoveCandidate[] {
    if (session.chessPieceMovedThisTurn) return [];
    const boardSize = session.boardState.length;
    const moves: ChessMoveCandidate[] = [];
    for (const piece of session.chessPieces ?? []) {
        if (piece.owner !== actingPlayer || piece.remainingMoves <= 0) continue;
        for (let y = 0; y < boardSize; y++) {
            for (let x = 0; x < boardSize; x++) {
                if (x === piece.x && y === piece.y) continue;
                const v = validateChessMove(session, piece.id, x, y, actingPlayer);
                if (v.ok) {
                    moves.push({ pieceId: piece.id, from: { x: piece.x, y: piece.y }, to: { x, y } });
                }
            }
        }
    }
    return moves;
}

export function applyChessMoveToSession(
    session: ChessGoSessionSlice & { chessPieceMovedThisTurn?: boolean; lastChessMove?: ChessLastMoveMarker | null },
    pieceId: string,
    toX: number,
    toY: number,
    actingPlayer?: Player.Black | Player.White,
): boolean {
    const piece = session.chessPieces?.find((p) => p.id === pieceId);
    if (!piece) return false;

    const from = { x: piece.x, y: piece.y };

    const board = session.boardState.map((row) => [...row]) as BoardState;
    board[piece.y]![piece.x] = Player.None;
    board[toY]![toX] = piece.owner;
    session.boardState = board;

    piece.x = toX;
    piece.y = toY;
    piece.remainingMoves = Math.max(0, piece.remainingMoves - 1);

    if (actingPlayer != null) {
        session.lastChessMove = { from, to: { x: toX, y: toY }, player: actingPlayer };
    }
    return true;
}

export type ChessCaptureResult = {
    capturedStones: Point[];
    capturedChessPieces: ChessPieceState[];
    chessPointsAwarded: { capturer: Player.Black | Player.White; points: number }[];
    kingCaptured: boolean;
    kingCapturer: Player.Black | Player.White | null;
};

/** 활로 0인 모든 그룹 제거. chess 기물 포함 시 chessCaptureScore 가산. */
export function resolveChessCapturesByLiberty(
    session: ChessGoSessionSlice,
    lastMover: Player.Black | Player.White,
): ChessCaptureResult {
    const board = session.boardState.map((row) => [...row]) as BoardState;
    const boardSize = board.length;
    const opponent = lastMover === Player.Black ? Player.White : Player.Black;
    const capturedStones: Point[] = [];
    const capturedChessPieces: ChessPieceState[] = [];
    const chessPointsAwarded: { capturer: Player.Black | Player.White; points: number }[] = [];
    let kingCaptured = false;

    if (!session.chessCaptureScore) {
        session.chessCaptureScore = createEmptyChessCaptureScore();
    }
    if (!session.captures) {
        session.captures = { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
    }

    const checked = new Set<string>();

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            const color = board[y]![x]!;
            if (color !== opponent) continue;
            const key = pointKey(x, y);
            if (checked.has(key)) continue;

            const group = findGroup(board, x, y, opponent);
            if (!group || group.liberties > 0) {
                group?.stones.forEach((s) => checked.add(pointKey(s.x, s.y)));
                continue;
            }

            let chessPointsThisGroup = 0;
            let groupCapturePoints = 0;
            for (const stone of group.stones) {
                capturedStones.push(stone);
                board[stone.y]![stone.x] = Player.None;
                checked.add(pointKey(stone.x, stone.y));

                const stonePoints = getChessGoStoneCapturePointValue(session, stone);
                groupCapturePoints += stonePoints;

                const chessPiece = session.chessPieces?.find((p) => p.x === stone.x && p.y === stone.y);
                if (chessPiece) {
                    capturedChessPieces.push(chessPiece);
                    if (chessPiece.type === 'king') {
                        kingCaptured = true;
                    } else {
                        chessPointsThisGroup += stonePoints;
                    }
                }
            }

            session.captures[lastMover] = (session.captures[lastMover] ?? 0) + groupCapturePoints;
            if (chessPointsThisGroup > 0) {
                session.chessCaptureScore[lastMover] = (session.chessCaptureScore[lastMover] ?? 0) + chessPointsThisGroup;
                chessPointsAwarded.push({ capturer: lastMover, points: chessPointsThisGroup });
            }
        }
    }

    if (capturedChessPieces.length > 0 && session.chessPieces) {
        const capturedIds = new Set(capturedChessPieces.map((p) => p.id));
        session.chessPieces = session.chessPieces.filter((p) => !capturedIds.has(p.id));
    }

    if (capturedStones.length > 0) {
        recordChessGoRemovedPoints(session, capturedStones);
    }

    session.boardState = board;
    return {
        capturedStones,
        capturedChessPieces,
        chessPointsAwarded,
        kingCaptured,
        kingCapturer: kingCaptured ? lastMover : null,
    };
}

export type ChessRemovedCaptureResult = {
    totalPoints: number;
    kingCaptured: boolean;
};

/** processMove 후 따낸 돌 중 체스 기물 돌을 세션에서 제거하고 킹 포획 여부를 반환한다. */
export function applyChessCaptureScoreForRemovedStones(
    session: ChessGoSessionSlice,
    capturedStones: Point[],
    _capturer: Player.Black | Player.White,
): ChessRemovedCaptureResult {
    if (!capturedStones.length) return { totalPoints: 0, kingCaptured: false };

    let totalPoints = 0;
    let kingCaptured = false;
    const removedIds = new Set<string>();

    for (const stone of capturedStones) {
        const chessPiece = session.chessPieces?.find((p) => p.x === stone.x && p.y === stone.y);
        if (chessPiece) {
            if (chessPiece.type === 'king') {
                kingCaptured = true;
            } else {
                totalPoints += getChessPieceCaptureValue(chessPiece.type);
            }
            removedIds.add(chessPiece.id);
        }
    }

    if (removedIds.size > 0 && session.chessPieces) {
        session.chessPieces = session.chessPieces.filter((p) => !removedIds.has(p.id));
    }
    return { totalPoints, kingCaptured };
}

export function scoreChessGameTotals(
    session: ChessGoSessionSlice,
    territoryBlack: number,
    territoryWhite: number,
    komi: number,
): { black: number; white: number; chessBonusBlack: number; chessBonusWhite: number } {
    const chessBonusBlack = session.chessCaptureScore?.[Player.Black] ?? 0;
    const chessBonusWhite = session.chessCaptureScore?.[Player.White] ?? 0;
    return {
        black: territoryBlack + chessBonusBlack,
        white: territoryWhite + komi + chessBonusWhite,
        chessBonusBlack,
        chessBonusWhite,
    };
}
