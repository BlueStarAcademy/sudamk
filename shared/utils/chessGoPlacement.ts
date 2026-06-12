import { Player } from '../types/enums.js';
import type { ChessPieceState, ChessPieceType, ChessSetupDraftPiece } from '../types/entities.js';

function setupPieceCaptureValue(type: ChessPieceType): number {
    switch (type) {
        case 'pawn': return 1;
        case 'knight':
        case 'bishop': return 3;
        case 'rook': return 5;
        case 'queen': return 9;
        default: return 0;
    }
}

function setupInitialRemainingMoves(type: ChessPieceType): number {
    return type === 'pawn' ? 10 : 5;
}

export type ChessGoLayout = {
    boardSize: number;
    colStart: number;
    colEnd: number;
    kingX: number;
    majorRow: number;
    pawnRow: number;
};

export const CHESS_SETUP_MAJOR_TYPES: Exclude<ChessPieceType, 'pawn' | 'king'>[] = [
    'rook',
    'knight',
    'bishop',
    'queen',
];

export const CHESS_SETUP_PIECE_LIMITS: Record<ChessPieceType, number> = {
    pawn: 3,
    rook: 1,
    knight: 1,
    bishop: 1,
    queen: 1,
    king: 1,
};

export function getChessGoLayout(boardSize: number, owner: Player.Black | Player.White): ChessGoLayout {
    const kingX = Math.floor(boardSize / 2);
    if (boardSize === 9) {
        const colStart = 1;
        const colEnd = 7;
        if (owner === Player.White) {
            return { boardSize, colStart, colEnd, kingX, majorRow: 1, pawnRow: 2 };
        }
        return { boardSize, colStart, colEnd, kingX, majorRow: 7, pawnRow: 6 };
    }
    const colStart = 3;
    const colEnd = 9;
    if (owner === Player.White) {
        return { boardSize, colStart, colEnd, kingX, majorRow: 1, pawnRow: 2 };
    }
    return { boardSize, colStart, colEnd, kingX, majorRow: 11, pawnRow: 10 };
}

export function getChessGoPlacementSlots(
    boardSize: number,
    owner: Player.Black | Player.White,
): { majorSlots: { x: number; y: number }[]; pawnSlots: { x: number; y: number }[]; kingSlot: { x: number; y: number } } {
    const layout = getChessGoLayout(boardSize, owner);
    const majorSlots: { x: number; y: number }[] = [];
    for (let x = layout.colStart; x <= layout.colEnd; x++) {
        if (x === layout.kingX) continue;
        majorSlots.push({ x, y: layout.majorRow });
    }
    const pawnSlots: { x: number; y: number }[] = [];
    for (let x = layout.colStart; x <= layout.colEnd; x++) {
        pawnSlots.push({ x, y: layout.pawnRow });
    }
    return {
        majorSlots,
        pawnSlots,
        kingSlot: { x: layout.kingX, y: layout.majorRow },
    };
}

function buildPieceState(
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
        remainingMoves: setupInitialRemainingMoves(type),
    };
}

export function buildFixedKingPiece(owner: Player.Black | Player.White, boardSize: number): ChessPieceState {
    const { kingSlot } = getChessGoPlacementSlots(boardSize, owner);
    const prefix = owner === Player.Black ? 'b' : 'w';
    return buildPieceState(`${prefix}-king-${kingSlot.x}-${kingSlot.y}`, 'king', owner, kingSlot.x, kingSlot.y);
}

export function computeChessSetupDraftScore(draft: ChessSetupDraftPiece[]): number {
    return draft.reduce((sum, p) => sum + setupPieceCaptureValue(p.type), 0);
}

export function countChessSetupDraftByType(draft: ChessSetupDraftPiece[]): Record<ChessPieceType, number> {
    const counts: Record<ChessPieceType, number> = {
        pawn: 0,
        rook: 0,
        knight: 0,
        bishop: 0,
        queen: 0,
        king: 0,
    };
    for (const p of draft) {
        counts[p.type] = (counts[p.type] ?? 0) + 1;
    }
    return counts;
}

export type ChessPlacementValidation = { ok: true } | { ok: false; reason: string };

export function validateChessPlacementDraft(
    draft: ChessSetupDraftPiece[],
    owner: Player.Black | Player.White,
    boardSize: number,
    budget: number,
): ChessPlacementValidation {
    const { majorSlots, pawnSlots, kingSlot } = getChessGoPlacementSlots(boardSize, owner);
    const majorKeys = new Set(majorSlots.map((s) => `${s.x},${s.y}`));
    const pawnKeys = new Set(pawnSlots.map((s) => `${s.x},${s.y}`));
    const kingKey = `${kingSlot.x},${kingSlot.y}`;
    const counts = countChessSetupDraftByType(draft);
    const score = computeChessSetupDraftScore(draft);

    if (score > budget) return { ok: false, reason: 'budget_exceeded' };
    if (counts.king > 0) return { ok: false, reason: 'king_in_draft' };
    for (const type of CHESS_SETUP_MAJOR_TYPES) {
        if (counts[type] > CHESS_SETUP_PIECE_LIMITS[type]) {
            return { ok: false, reason: 'piece_limit' };
        }
    }
    if (counts.pawn > CHESS_SETUP_PIECE_LIMITS.pawn) {
        return { ok: false, reason: 'pawn_limit' };
    }

    const occupied = new Set<string>();
    for (const p of draft) {
        const key = `${p.x},${p.y}`;
        if (occupied.has(key)) return { ok: false, reason: 'duplicate_slot' };
        occupied.add(key);
        if (key === kingKey) return { ok: false, reason: 'king_slot' };
        if (p.type === 'pawn') {
            if (!pawnKeys.has(key)) return { ok: false, reason: 'invalid_pawn_row' };
        } else {
            if (!majorKeys.has(key)) return { ok: false, reason: 'invalid_major_row' };
        }
    }
    return { ok: true };
}

export function draftToChessPieceStates(
    draft: ChessSetupDraftPiece[],
    owner: Player.Black | Player.White,
    boardSize: number,
): ChessPieceState[] {
    const prefix = owner === Player.Black ? 'b' : 'w';
    const king = buildFixedKingPiece(owner, boardSize);
    const pieces: ChessPieceState[] = [king];
    for (const p of draft) {
        pieces.push(
            buildPieceState(`${prefix}-${p.type}-${p.x}-${p.y}`, p.type, owner, p.x, p.y),
        );
    }
    return pieces;
}

export function finalizeChessPiecesFromDrafts(
    blackDraft: ChessSetupDraftPiece[],
    whiteDraft: ChessSetupDraftPiece[],
    boardSize: number,
): ChessPieceState[] {
    return [
        ...draftToChessPieceStates(blackDraft, Player.Black, boardSize),
        ...draftToChessPieceStates(whiteDraft, Player.White, boardSize),
    ];
}

const SETUP_PIECE_TYPES: Exclude<ChessPieceType, 'king'>[] = ['pawn', 'rook', 'knight', 'bishop', 'queen'];

function pickRandom<T>(arr: T[]): T | undefined {
    if (!arr.length) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

/** 예산·슬롯·개수 제한 내 순수 랜덤 draft 생성 */
export function generateRandomChessSetupDraft(
    budget: number,
    boardSize: number,
    owner: Player.Black | Player.White,
): ChessSetupDraftPiece[] {
    const { majorSlots, pawnSlots } = getChessGoPlacementSlots(boardSize, owner);
    const draft: ChessSetupDraftPiece[] = [];
    let remainingBudget = budget;
    const counts = countChessSetupDraftByType(draft);
    const usedMajor = new Set<string>();
    const usedPawn = new Set<string>();

    const availableTypes = (): Exclude<ChessPieceType, 'king'>[] =>
        SETUP_PIECE_TYPES.filter((t) => {
            if (counts[t] >= CHESS_SETUP_PIECE_LIMITS[t]) return false;
            return setupPieceCaptureValue(t) <= remainingBudget;
        });

    let safety = 200;
    while (safety-- > 0) {
        const types = availableTypes();
        if (!types.length) break;
        const type = pickRandom(types)!;
        const cost = setupPieceCaptureValue(type);
        if (cost > remainingBudget) break;

        if (type === 'pawn') {
            const free = pawnSlots.filter((s) => !usedPawn.has(`${s.x},${s.y}`));
            const slot = pickRandom(free);
            if (!slot) break;
            draft.push({ type, x: slot.x, y: slot.y });
            usedPawn.add(`${slot.x},${slot.y}`);
        } else {
            const free = majorSlots.filter((s) => !usedMajor.has(`${s.x},${s.y}`));
            const slot = pickRandom(free);
            if (!slot) break;
            draft.push({ type, x: slot.x, y: slot.y });
            usedMajor.add(`${slot.x},${slot.y}`);
        }
        counts[type] += 1;
        remainingBudget -= cost;

        if (Math.random() < 0.35) break;
    }

    return draft;
}

/** 기존 draft를 유지한 채 남은 예산 범위에서 무작위로 기물을 추가한다. */
export function generateRandomChessSetupDraftForRemainingBudget(
    existingDraft: ChessSetupDraftPiece[],
    totalBudget: number,
    boardSize: number,
    owner: Player.Black | Player.White,
): ChessSetupDraftPiece[] {
    const draft = [...existingDraft];
    let remainingBudget = Math.max(0, totalBudget - computeChessSetupDraftScore(draft));
    const counts = countChessSetupDraftByType(draft);
    const { majorSlots, pawnSlots } = getChessGoPlacementSlots(boardSize, owner);
    const usedMajor = new Set(draft.filter((p) => p.type !== 'pawn').map((p) => `${p.x},${p.y}`));
    const usedPawn = new Set(draft.filter((p) => p.type === 'pawn').map((p) => `${p.x},${p.y}`));

    const availableTypes = (): Exclude<ChessPieceType, 'king'>[] =>
        SETUP_PIECE_TYPES.filter((t) => {
            if (counts[t] >= CHESS_SETUP_PIECE_LIMITS[t]) return false;
            return setupPieceCaptureValue(t) <= remainingBudget;
        });

    let safety = 200;
    while (safety-- > 0 && remainingBudget > 0) {
        const types = availableTypes();
        if (!types.length) break;
        const type = pickRandom(types)!;
        const cost = setupPieceCaptureValue(type);
        if (cost > remainingBudget) break;

        if (type === 'pawn') {
            const free = pawnSlots.filter((s) => !usedPawn.has(`${s.x},${s.y}`));
            const slot = pickRandom(free);
            if (!slot) break;
            draft.push({ type, x: slot.x, y: slot.y });
            usedPawn.add(`${slot.x},${slot.y}`);
        } else {
            const free = majorSlots.filter((s) => !usedMajor.has(`${s.x},${s.y}`));
            const slot = pickRandom(free);
            if (!slot) break;
            draft.push({ type, x: slot.x, y: slot.y });
            usedMajor.add(`${slot.x},${slot.y}`);
        }
        counts[type] += 1;
        remainingBudget -= cost;
        if (Math.random() < 0.35) break;
    }

    return draft;
}

export function getChessSetupBudgetFromSettings(
    boardSize: number,
    chessPieceTotalScore: number | undefined,
    isRanked = false,
): number {
    if (boardSize === 9) return 9;
    if (isRanked) return 15;
    const score = chessPieceTotalScore ?? 15;
    return Math.min(23, Math.max(9, score));
}
