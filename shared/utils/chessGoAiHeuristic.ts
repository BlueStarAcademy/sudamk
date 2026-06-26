import { Player } from '../types/enums.js';
import type { LiveGameSession, Point } from '../types/entities.js';
import {
    enumerateLegalChessMoves,
    getChessGoStoneCapturePointValue,
    getChessPieceCaptureValue,
    type ChessMoveCandidate,
} from './chessGoRules.js';

/** 이 점수 이상이면 무작위 스킵 없이 기물 이동을 시도한다 (따내기·아타리·구출 등). */
export const CHESS_AI_MEANINGFUL_MOVE_SCORE = 12;

/** 최고 수와 2위 점수 차가 이 값 이상이면 항상 최고 수를 선택한다. */
const CLEAR_BEST_MOVE_MARGIN = 10;

export function getChessMoveAttemptProbability(profileLevel: number): number {
    const clamped = Math.max(1, Math.min(10, Math.floor(profileLevel) || 1));
    return 0.35 + (clamped - 1) * (0.35 / 9);
}

export function shouldAttemptChessMoveThisTurn(profileLevel: number, random = Math.random()): boolean {
    return random < getChessMoveAttemptProbability(profileLevel);
}

type GroupAnalysis = {
    stones: Point[];
    liberties: number;
};

function analyzeGroupAt(
    board: LiveGameSession['boardState'],
    x: number,
    y: number,
): GroupAnalysis | null {
    const color = board[y]?.[x];
    if (color !== Player.Black && color !== Player.White) return null;
    const boardSize = board.length;
    const stones: Point[] = [];
    const q: Point[] = [{ x, y }];
    const visited = new Set<string>();
    const liberties = new Set<string>();

    while (q.length > 0) {
        const cur = q.shift()!;
        const key = `${cur.x},${cur.y}`;
        if (visited.has(key)) continue;
        visited.add(key);
        stones.push(cur);

        for (const [nx, ny] of [
            [cur.x - 1, cur.y],
            [cur.x + 1, cur.y],
            [cur.x, cur.y - 1],
            [cur.x, cur.y + 1],
        ] as const) {
            if (nx < 0 || ny < 0 || nx >= boardSize || ny >= boardSize) continue;
            const cell = board[ny]![nx]!;
            const adjKey = `${nx},${ny}`;
            if (cell === Player.None) liberties.add(adjKey);
            else if (cell === color && !visited.has(adjKey)) {
                q.push({ x: nx, y: ny });
            }
        }
    }

    return { stones, liberties: liberties.size };
}

function countGroupLiberties(board: LiveGameSession['boardState'], x: number, y: number): number {
    return analyzeGroupAt(board, x, y)?.liberties ?? 0;
}

function simulatePiecesAfterMove(
    session: Pick<LiveGameSession, 'chessPieces'>,
    move: ChessMoveCandidate,
): LiveGameSession['chessPieces'] {
    return session.chessPieces?.map((p) =>
        p.id === move.pieceId ? { ...p, x: move.to.x, y: move.to.y } : { ...p },
    );
}

function simulateBoardAfterMove(
    session: Pick<LiveGameSession, 'boardState' | 'chessPieces'>,
    move: ChessMoveCandidate,
): LiveGameSession['boardState'] {
    const board = session.boardState.map((row) => [...row]) as LiveGameSession['boardState'];
    const piece = session.chessPieces?.find((p) => p.id === move.pieceId);
    if (!piece) return board;
    board[piece.y]![piece.x] = Player.None;
    board[move.to.y]![move.to.x] = piece.owner;
    return board;
}

type CaptureEstimate = {
    capturePoints: number;
    kingCaptured: boolean;
    stoneCount: number;
};

function estimateImmediateCaptureFromBoard(
    slice: Pick<LiveGameSession, 'chessPieces'>,
    board: LiveGameSession['boardState'],
    capturer: Player.Black | Player.White,
): CaptureEstimate {
    const opponent = capturer === Player.Black ? Player.White : Player.Black;
    const boardSize = board.length;
    const processed = new Set<string>();
    let capturePoints = 0;
    let kingCaptured = false;
    let stoneCount = 0;

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (board[y]![x] !== opponent) continue;
            const key = `${x},${y}`;
            if (processed.has(key)) continue;

            const group = analyzeGroupAt(board, x, y);
            if (!group) continue;
            for (const s of group.stones) processed.add(`${s.x},${s.y}`);
            if (group.liberties > 0) continue;

            for (const s of group.stones) {
                stoneCount += 1;
                capturePoints += getChessGoStoneCapturePointValue(slice, s, opponent);
                const chessPiece = slice.chessPieces?.find(
                    (p) => p.x === s.x && p.y === s.y && p.owner === opponent,
                );
                if (chessPiece?.type === 'king') kingCaptured = true;
            }
        }
    }

    return { capturePoints, kingCaptured, stoneCount };
}

/** 기물 이동 직후 활로0 그룹을 제거한 판·기물 — 안전도·압박 평가용 */
function resolveImmediateCapturesOnBoard(
    slice: Pick<LiveGameSession, 'chessPieces'>,
    board: LiveGameSession['boardState'],
    capturer: Player.Black | Player.White,
): {
    boardState: LiveGameSession['boardState'];
    chessPieces: LiveGameSession['chessPieces'];
    capture: CaptureEstimate;
} {
    const capture = estimateImmediateCaptureFromBoard(slice, board, capturer);
    const opponent = capturer === Player.Black ? Player.White : Player.Black;
    const boardSize = board.length;
    const nextBoard = board.map((row) => [...row]) as LiveGameSession['boardState'];
    const removedKeys = new Set<string>();
    const processed = new Set<string>();

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (nextBoard[y]![x] !== opponent) continue;
            const key = `${x},${y}`;
            if (processed.has(key)) continue;

            const group = analyzeGroupAt(nextBoard, x, y);
            if (!group) continue;
            for (const s of group.stones) processed.add(`${s.x},${s.y}`);
            if (group.liberties > 0) continue;

            for (const s of group.stones) {
                removedKeys.add(`${s.x},${s.y}`);
                nextBoard[s.y]![s.x] = Player.None;
            }
        }
    }

    const nextPieces = slice.chessPieces
        ?.filter((p) => !removedKeys.has(`${p.x},${p.y}`))
        .map((p) => ({ ...p }));

    return { boardState: nextBoard, chessPieces: nextPieces, capture };
}

function sumGroupStoneValue(
    slice: Pick<LiveGameSession, 'chessPieces'>,
    stones: Point[],
    owner: Player.Black | Player.White,
): number {
    let total = 0;
    for (const s of stones) {
        total += getChessGoStoneCapturePointValue(slice, s, owner);
    }
    return total;
}

function scoreOpponentLibertyPressure(
    beforeSlice: Pick<LiveGameSession, 'boardState' | 'chessPieces'>,
    afterSlice: Pick<LiveGameSession, 'boardState' | 'chessPieces'>,
    actingPlayer: Player.Black | Player.White,
): number {
    const opponent = actingPlayer === Player.Black ? Player.White : Player.Black;
    const beforeBoard = beforeSlice.boardState;
    const afterBoard = afterSlice.boardState;
    const boardSize = beforeBoard.length;
    const processed = new Set<string>();
    let score = 0;

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (beforeBoard[y]![x] !== opponent) continue;
            const key = `${x},${y}`;
            if (processed.has(key)) continue;

            const beforeGroup = analyzeGroupAt(beforeBoard, x, y);
            if (!beforeGroup) continue;
            for (const s of beforeGroup.stones) processed.add(`${s.x},${s.y}`);

            const anchor = beforeGroup.stones[0]!;
            const afterColor = afterBoard[anchor.y]?.[anchor.x];
            if (afterColor !== opponent) continue;

            const afterGroup = analyzeGroupAt(afterBoard, anchor.x, anchor.y);
            if (!afterGroup || afterGroup.liberties === 0) continue;

            const groupValue = sumGroupStoneValue(beforeSlice, beforeGroup.stones, opponent);
            const libertyDrop = beforeGroup.liberties - afterGroup.liberties;
            if (libertyDrop <= 0) continue;

            if (afterGroup.liberties === 1 && beforeGroup.liberties > 1) {
                score += groupValue * 4;
            } else {
                score += libertyDrop * Math.max(2, groupValue / beforeGroup.stones.length);
            }
        }
    }

    return score;
}

function scoreFriendlyRescue(
    session: Pick<LiveGameSession, 'boardState' | 'chessPieces'>,
    move: ChessMoveCandidate,
    afterBoard: LiveGameSession['boardState'],
    actingPlayer: Player.Black | Player.White,
): number {
    const beforeBoard = session.boardState;
    const boardSize = beforeBoard.length;
    const movingPiece = session.chessPieces?.find((p) => p.id === move.pieceId);
    const processed = new Set<string>();
    let score = 0;

    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (beforeBoard[y]![x] !== actingPlayer) continue;
            if (movingPiece && x === movingPiece.x && y === movingPiece.y) continue;
            const key = `${x},${y}`;
            if (processed.has(key)) continue;

            const beforeGroup = analyzeGroupAt(beforeBoard, x, y);
            if (!beforeGroup || beforeGroup.liberties > 1) continue;
            for (const s of beforeGroup.stones) processed.add(`${s.x},${s.y}`);

            const anchor = beforeGroup.stones[0]!;
            const afterColor = afterBoard[anchor.y]?.[anchor.x];
            if (afterColor !== actingPlayer) continue;

            const afterGroup = analyzeGroupAt(afterBoard, anchor.x, anchor.y);
            if (!afterGroup) continue;

            const gained = afterGroup.liberties - beforeGroup.liberties;
            if (gained <= 0) continue;

            const groupValue = sumGroupStoneValue(session, beforeGroup.stones, actingPlayer);
            score += gained * Math.max(3, groupValue * 2);
        }
    }

    return score;
}

export function scoreChessMoveCandidate(
    session: Pick<LiveGameSession, 'boardState' | 'chessPieces'>,
    move: ChessMoveCandidate,
    actingPlayer: Player.Black | Player.White,
): number {
    const piece = session.chessPieces?.find((p) => p.id === move.pieceId);
    if (!piece) return -Infinity;

    const afterBoard = simulateBoardAfterMove(session, move);
    const afterPieces = simulatePiecesAfterMove(session, move);
    const afterSlice = { boardState: afterBoard, chessPieces: afterPieces };
    const resolved = resolveImmediateCapturesOnBoard(afterSlice, afterBoard, actingPlayer);
    const immediate = resolved.capture;
    const boardAfterCapture = resolved.boardState;
    const sliceAfterCapture = {
        boardState: boardAfterCapture,
        chessPieces: resolved.chessPieces,
    };

    const beforeLib = countGroupLiberties(session.boardState, piece.x, piece.y);
    const afterLib = countGroupLiberties(boardAfterCapture, move.to.x, move.to.y);
    const pieceValue = getChessPieceCaptureValue(piece.type);

    let score = 0;

    if (immediate.kingCaptured) score += 10_000;
    score += immediate.capturePoints * 30;
    score += immediate.stoneCount * 4;

    if (beforeLib <= 1 && afterLib > beforeLib) score += pieceValue * 15;
    score += (afterLib - beforeLib) * 4;

    score += scoreOpponentLibertyPressure(session, sliceAfterCapture, actingPlayer);
    score += scoreFriendlyRescue(session, move, boardAfterCapture, actingPlayer);

    if (
        piece.remainingMoves <= 2 &&
        immediate.capturePoints === 0 &&
        afterLib <= beforeLib &&
        score < CHESS_AI_MEANINGFUL_MOVE_SCORE
    ) {
        score -= pieceValue * 2;
    }

    return score;
}

export function pickBestChessMoveFromCandidates(
    session: Pick<LiveGameSession, 'boardState' | 'chessPieces'>,
    legalMoves: ChessMoveCandidate[],
    actingPlayer: Player.Black | Player.White,
    profileLevel: number,
): ChessMoveCandidate | null {
    if (legalMoves.length === 0) return null;
    const scored = legalMoves
        .map((move) => ({ move, score: scoreChessMoveCandidate(session, move, actingPlayer) }))
        .sort((a, b) => b.score - a.score);

    const best = scored[0];
    const second = scored[1];
    if (
        best &&
        (best.score >= CHESS_AI_MEANINGFUL_MOVE_SCORE ||
            best.score - (second?.score ?? -Infinity) >= CLEAR_BEST_MOVE_MARGIN)
    ) {
        return best.move;
    }

    const topN = profileLevel >= 8 ? 1 : profileLevel >= 5 ? 2 : 3;
    const pool = scored.slice(0, Math.min(topN, scored.length));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    return pick?.move ?? null;
}

export function pickAiChessMoveIfAny(
    session: Pick<LiveGameSession, 'boardState' | 'chessPieces' | 'chessPieceMovedThisTurn'>,
    actingPlayer: Player.Black | Player.White,
    profileLevel: number,
    random = Math.random(),
): ChessMoveCandidate | null {
    if (session.chessPieceMovedThisTurn) return null;
    const legalMoves = enumerateLegalChessMoves(session, actingPlayer);
    if (legalMoves.length === 0) return null;

    const bestScore = Math.max(
        ...legalMoves.map((move) => scoreChessMoveCandidate(session, move, actingPlayer)),
    );
    const hasMeaningfulMove = bestScore >= CHESS_AI_MEANINGFUL_MOVE_SCORE;

    if (!hasMeaningfulMove && !shouldAttemptChessMoveThisTurn(profileLevel, random)) {
        return null;
    }

    return pickBestChessMoveFromCandidates(session, legalMoves, actingPlayer, profileLevel);
}
