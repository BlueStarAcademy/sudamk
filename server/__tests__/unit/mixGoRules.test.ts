import { describe, expect, it } from 'vitest';
import { GameMode } from '../../../shared/types/enums.js';
import {
    mixGoIsCombinableSubMode,
    mixGoIsMixWithEverySubMode,
    mixGoIsPveHiddenItemSelectionStatus,
    mixGoOrPureModeIncludes,
    mixGoSessionHasHiddenItems,
    mixGoPveHiddenPlacementAlreadyCommitted,
    mixGoShouldUnstickHiddenItemSelectionPhase,
    mixGoTreatMoveAsHiddenPlacement,
    mixGoUniqueCombinableModes,
} from '../../../shared/utils/mixGoRules.js';
import { Player } from '../../../shared/types/enums.js';

describe('mixGoRules', () => {
    it('mixGoOrPureModeIncludes: pure or mix member', () => {
        expect(mixGoOrPureModeIncludes(GameMode.Hidden, [], GameMode.Hidden)).toBe(true);
        expect(mixGoOrPureModeIncludes(GameMode.Mix, [GameMode.Hidden], GameMode.Hidden)).toBe(true);
        expect(mixGoOrPureModeIncludes(GameMode.Mix, [GameMode.Capture], GameMode.Hidden)).toBe(false);
        expect(mixGoOrPureModeIncludes(GameMode.Standard, undefined, GameMode.Capture)).toBe(false);
    });

    it('mixGoIsMixWithEverySubMode', () => {
        expect(
            mixGoIsMixWithEverySubMode(GameMode.Mix, [GameMode.Base, GameMode.Capture], [GameMode.Base, GameMode.Capture]),
        ).toBe(true);
        expect(mixGoIsMixWithEverySubMode(GameMode.Mix, [GameMode.Base], [GameMode.Base, GameMode.Capture])).toBe(false);
        expect(mixGoIsMixWithEverySubMode(GameMode.Base, [GameMode.Base], [GameMode.Base])).toBe(false);
        expect(mixGoIsMixWithEverySubMode(GameMode.Mix, [], [])).toBe(false);
    });

    it('mixGoUniqueCombinableModes filters non-go playful modes', () => {
        expect(
            mixGoUniqueCombinableModes([GameMode.Capture, GameMode.Dice, GameMode.Capture, GameMode.Hidden]),
        ).toEqual([GameMode.Capture, GameMode.Hidden]);
    });

    it('mixGoIsCombinableSubMode', () => {
        expect(mixGoIsCombinableSubMode(GameMode.Missile)).toBe(true);
        expect(mixGoIsCombinableSubMode(GameMode.Dice)).toBe(false);
    });

    it('mixGoSessionHasHiddenItems: pure, mix, or stage count', () => {
        expect(mixGoSessionHasHiddenItems(GameMode.Hidden, {})).toBe(true);
        expect(mixGoSessionHasHiddenItems(GameMode.Mix, { mixedModes: [GameMode.Hidden] })).toBe(true);
        expect(mixGoSessionHasHiddenItems(GameMode.Standard, { hiddenStoneCount: 1 })).toBe(true);
        expect(mixGoSessionHasHiddenItems(GameMode.Mix, { mixedModes: [GameMode.Capture] })).toBe(false);
    });

    it('mixGoShouldUnstickHiddenItemSelectionPhase when deadline missing', () => {
        expect(
            mixGoShouldUnstickHiddenItemSelectionPhase({ gameStatus: 'hidden_placing', itemUseDeadline: undefined }),
        ).toBe(true);
        expect(
            mixGoShouldUnstickHiddenItemSelectionPhase({
                gameStatus: 'hidden_placing',
                itemUseDeadline: Date.now() + 5000,
            }),
        ).toBe(false);
        expect(mixGoShouldUnstickHiddenItemSelectionPhase({ gameStatus: 'playing', itemUseDeadline: undefined })).toBe(
            false,
        );
    });

    it('mixGoTreatMoveAsHiddenPlacement forces hidden_placing moves', () => {
        expect(mixGoTreatMoveAsHiddenPlacement('hidden_placing', false, false)).toBe(true);
        expect(mixGoTreatMoveAsHiddenPlacement('playing', false, false)).toBe(false);
        expect(mixGoTreatMoveAsHiddenPlacement('hidden_placing', true, true)).toBe(false);
    });

    it('mixGoIsPveHiddenItemSelectionStatus', () => {
        expect(mixGoIsPveHiddenItemSelectionStatus('hidden_placing')).toBe(true);
        expect(mixGoIsPveHiddenItemSelectionStatus('scanning')).toBe(true);
        expect(mixGoIsPveHiddenItemSelectionStatus('playing')).toBe(false);
    });

    it('mixGoPveHiddenPlacementAlreadyCommitted detects client-authoritative hidden move', () => {
        const board = Array.from({ length: 5 }, () => Array(5).fill(Player.None));
        board[2][2] = Player.Black;
        expect(
            mixGoPveHiddenPlacementAlreadyCommitted(
                {
                    gameStatus: 'hidden_placing',
                    boardState: board,
                    moveHistory: [{ x: 2, y: 2, player: Player.Black }],
                },
                2,
                2,
                Player.Black,
            ),
        ).toBe(true);
        expect(
            mixGoPveHiddenPlacementAlreadyCommitted(
                {
                    gameStatus: 'hidden_placing',
                    boardState: board,
                    moveHistory: [{ x: 1, y: 1, player: Player.Black }],
                },
                2,
                2,
                Player.Black,
            ),
        ).toBe(false);
    });
});
