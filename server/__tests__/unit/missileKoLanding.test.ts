import { describe, expect, it } from 'vitest';
import { Player } from '../../../shared/types/enums.js';
import { resolveKoInfoAfterMissileLanding } from '../../../shared/utils/missileLandingCapture.js';
import { applyMissileLandingCaptures, isMissileLandingKoViolation } from '../../modes/missileBoardUtils.js';
import { processMove } from '../../goLogic.js';

const B = Player.Black;
const W = Player.White;
const _ = Player.None;

/**
 * 흑이 (2,1)에 두어 백 (1,1)을 따낸 직후의 패 모양. 백 차례이며 (1,1)은 패 금지점.
 *   y0: . B W . .
 *   y1: B . B W .
 *   y2: . B W . .
 *   y3: . . . . .
 *   y4: . . . . W
 */
function makeKoGame() {
    const boardState = [
        [_, B, W, _, _],
        [B, _, B, W, _],
        [_, B, W, _, _],
        [_, _, _, _, _],
        [_, _, _, _, W],
    ];
    const moveHistory = [
        { player: W, x: 4, y: 4 },
        { player: B, x: 2, y: 1 },
    ];
    return {
        id: 'ko-test',
        boardState,
        moveHistory,
        koInfo: { point: { x: 1, y: 1 }, turn: moveHistory.length },
        captures: { [Player.None]: 0, [B]: 0, [W]: 0 },
        settings: { boardSize: 5 },
    } as any;
}

describe('resolveKoInfoAfterMissileLanding', () => {
    const ko = { point: { x: 1, y: 1 }, turn: 2 };

    it('keeps the existing ko ban when the missile captures nothing', () => {
        expect(resolveKoInfoAfterMissileLanding(ko, [])).toBe(ko);
    });

    it('keeps the ban when captures are away from the ko point', () => {
        expect(resolveKoInfoAfterMissileLanding(ko, [{ x: 4, y: 4 }])).toBe(ko);
    });

    it('clears the ban when a stone adjacent to the ko point is captured', () => {
        expect(resolveKoInfoAfterMissileLanding(ko, [{ x: 2, y: 1 }])).toBeNull();
    });

    it('never creates a new ko ban', () => {
        expect(resolveKoInfoAfterMissileLanding(null, [{ x: 1, y: 1 }])).toBeNull();
    });
});

describe('missile landing keeps ko rule', () => {
    it('a non-capturing missile does not let the player retake ko right after', () => {
        const game = makeKoGame();
        const koBefore = game.koInfo;
        game.boardState[4][4] = _;
        game.boardState[0][4] = W;

        const captured = applyMissileLandingCaptures(game, { x: 4, y: 0 }, W);

        expect(captured).toEqual([]);
        expect(game.koInfo).toEqual(koBefore);
        const retake = processMove(game.boardState, { x: 1, y: 1, player: W }, game.koInfo, game.moveHistory.length);
        expect(retake.isValid).toBe(false);
        expect(retake.reason).toBe('ko');
    });

    it('rejects a missile landing on the forbidden ko point', () => {
        const game = makeKoGame();
        expect(isMissileLandingKoViolation(game, { x: 4, y: 4 }, { x: 1, y: 1 }, W)).toBe(true);
    });

    it('allows landing on the former ko point once the ban has expired', () => {
        const game = makeKoGame();
        game.koInfo = { point: { x: 1, y: 1 }, turn: game.moveHistory.length - 1 };
        expect(isMissileLandingKoViolation(game, { x: 4, y: 4 }, { x: 1, y: 1 }, W)).toBe(false);
    });

    it('does not flag ordinary landings', () => {
        const game = makeKoGame();
        expect(isMissileLandingKoViolation(game, { x: 4, y: 4 }, { x: 4, y: 0 }, W)).toBe(false);
    });
});
