import { Player } from '../types/enums.js';
import type { LiveGameSession } from '../types/entities.js';
import {
    enumerateLegalChessMoves,
    getChessPieceCaptureValue,
    type ChessMoveCandidate,
} from './chessGoRules.js';

export function getChessMoveAttemptProbability(profileLevel: number): number {
    const clamped = Math.max(1, Math.min(10, Math.floor(profileLevel) || 1));
    return 0.3 + (clamped - 1) * (0.4 / 9);
}

export function shouldAttemptChessMoveThisTurn(profileLevel: number, random = Math.random()): boolean {
    return random < getChessMoveAttemptProbability(profileLevel);
}

function countGroupLiberties(
    board: LiveGameSession['boardState'],
    x: number,
    y: number,
): number {
    const color = board[y]?.[x];
    if (color !== Player.Black && color !== Player.White) return 0;
    const boardSize = board.length;
    const q: { x: number; y: number }[] = [{ x, y }];
    const visited = new Set<string>([`${x},${y}`]);
    const liberties = new Set<string>();

    while (q.length > 0) {
        const cur = q.shift()!;
        for (const [nx, ny] of [
            [cur.x - 1, cur.y],
            [cur.x + 1, cur.y],
            [cur.x, cur.y - 1],
            [cur.x, cur.y + 1],
        ] as const) {
            if (nx < 0 || ny < 0 || nx >= boardSize || ny >= boardSize) continue;
            const cell = board[ny]![nx]!;
            const key = `${nx},${ny}`;
            if (cell === Player.None) liberties.add(key);
            else if (cell === color && !visited.has(key)) {
                visited.add(key);
                q.push({ x: nx, y: ny });
            }
        }
    }
    return liberties.size;
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

export function scoreChessMoveCandidate(
    session: Pick<LiveGameSession, 'boardState' | 'chessPieces'>,
    move: ChessMoveCandidate,
    actingPlayer: Player.Black | Player.White,
): number {
    const piece = session.chessPieces?.find((p) => p.id === move.pieceId);
    if (!piece) return -Infinity;

    const afterBoard = simulateBoardAfterMove(session, move);
    const beforeLib = countGroupLiberties(session.boardState, piece.x, piece.y);
    const afterLib = countGroupLiberties(afterBoard, move.to.x, move.to.y);
    const pieceValue = getChessPieceCaptureValue(piece.type);

    let score = 0;
    if (beforeLib <= 1 && afterLib > beforeLib) score += pieceValue * 4;
    score += (afterLib - beforeLib) * 2;

    const opponent = actingPlayer === Player.Black ? Player.White : Player.Black;
    for (const opp of session.chessPieces ?? []) {
        if (opp.owner !== opponent) continue;
        const oppBefore = countGroupLiberties(session.boardState, opp.x, opp.y);
        const oppAfter = countGroupLiberties(afterBoard, opp.x, opp.y);
        if (oppAfter < oppBefore) {
            score += (oppBefore - oppAfter) * getChessPieceCaptureValue(opp.type);
        }
    }

    if (piece.remainingMoves <= 2) score -= pieceValue;
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
    if (!shouldAttemptChessMoveThisTurn(profileLevel, random)) return null;
    return pickBestChessMoveFromCandidates(session, legalMoves, actingPlayer, profileLevel);
}
