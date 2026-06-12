import { describe, expect, it } from 'vitest';
import { Player } from '../../../shared/types/enums.js';
import {
    buildFixedKingPiece,
    finalizeChessPiecesFromDrafts,
    generateRandomChessSetupDraft,
    generateRandomChessSetupDraftForRemainingBudget,
    getChessGoLayout,
    getChessGoPlacementSlots,
    validateChessPlacementDraft,
} from '../../../shared/utils/chessGoPlacement.js';
import { getChessPieceCaptureValue } from '../../../shared/utils/chessGoRules.js';

describe('chessGoPlacement', () => {
    it('layout rows for 9 and 13', () => {
        expect(getChessGoLayout(13, Player.White).majorRow).toBe(1);
        expect(getChessGoLayout(13, Player.White).pawnRow).toBe(2);
        expect(getChessGoLayout(13, Player.Black).majorRow).toBe(11);
        expect(getChessGoLayout(9, Player.White).colStart).toBe(1);
        expect(getChessGoLayout(9, Player.Black).pawnRow).toBe(6);
    });

    it('king fixed at center major row', () => {
        const king = buildFixedKingPiece(Player.White, 13);
        expect(king.type).toBe('king');
        expect(king.x).toBe(6);
        expect(king.y).toBe(1);
    });

    it('validates budget and piece limits', () => {
        const draft = [
            { type: 'queen' as const, x: 3, y: 1 },
            { type: 'pawn' as const, x: 3, y: 2 },
            { type: 'pawn' as const, x: 4, y: 2 },
        ];
        expect(validateChessPlacementDraft(draft, Player.White, 13, 15).ok).toBe(true);
        expect(validateChessPlacementDraft([...draft, { type: 'rook', x: 4, y: 1 }], Player.White, 13, 10).ok).toBe(false);
        expect(validateChessPlacementDraft([{ type: 'pawn', x: 3, y: 1 }], Player.White, 13, 15).ok).toBe(false);
    });

    it('random draft respects budget and slots', () => {
        for (let i = 0; i < 20; i++) {
            const draft = generateRandomChessSetupDraft(15, 13, Player.Black);
            const validation = validateChessPlacementDraft(draft, Player.Black, 13, 15);
            expect(validation.ok).toBe(true);
            const score = draft.reduce((s, p) => s + getChessPieceCaptureValue(p.type), 0);
            expect(score).toBeLessThanOrEqual(15);
            for (const p of draft) {
                const { majorSlots, pawnSlots } = getChessGoPlacementSlots(13, Player.Black);
                if (p.type === 'pawn') {
                    expect(pawnSlots.some((s) => s.x === p.x && s.y === p.y)).toBe(true);
                } else {
                    expect(majorSlots.some((s) => s.x === p.x && s.y === p.y)).toBe(true);
                }
            }
        }
    });

    it('finalize includes kings for both sides', () => {
        const pieces = finalizeChessPiecesFromDrafts(
            [{ type: 'pawn', x: 3, y: 2 }],
            [{ type: 'rook', x: 3, y: 1 }],
            13,
        );
        expect(pieces.filter((p) => p.type === 'king')).toHaveLength(2);
        expect(pieces.length).toBe(4);
    });

    it('fills remaining budget without exceeding total', () => {
        const existing = [{ type: 'pawn', x: 3, y: 2 }];
        for (let i = 0; i < 15; i++) {
            const draft = generateRandomChessSetupDraftForRemainingBudget(existing, 15, 13, Player.White);
            const validation = validateChessPlacementDraft(draft, Player.White, 13, 15);
            expect(validation.ok).toBe(true);
            expect(draft.some((p) => p.type === 'pawn' && p.x === 3 && p.y === 2)).toBe(true);
            const score = draft.reduce((s, p) => s + getChessPieceCaptureValue(p.type), 0);
            expect(score).toBeLessThanOrEqual(15);
        }
    });
});
