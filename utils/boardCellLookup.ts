import type { BoardState, Move, Point } from '../types.js';
import { Player } from '../types.js';
import {
    findLatestMoveIndexAtExcludingRecordedBaseStones,
    type BaseStoneOverlayContext,
} from '../shared/utils/baseHiddenMoveIndex.js';

export type BoardCellStoneRenderFlags = {
    moveIndex: number;
    isHiddenMove: boolean;
    isPlainStoneReuseIntersection: boolean;
    atRecordedBaseStone: boolean;
    atAiInitialHiddenStone: boolean;
    isPermanentlyRevealed: boolean;
    softScanAtCurrentMove: boolean;
    isInRevealAnimation: boolean;
    hasBaseStoneHere: boolean;
    isPatternStone: boolean;
};

export type BuildBoardCellLookupInput = {
    moveHistory?: Move[];
    hiddenMoves?: { [moveIndex: number]: boolean };
    baseHiddenMoveCtx: BaseStoneOverlayContext | null;
    baseStones?: { x: number; y: number; player: Player }[];
    consumedPatternIntersections?: Point[];
    humanHiddenStonePoints?: Array<Point & { player?: Player }>;
    aiInitialHiddenStone?: Point | null;
    permanentlyRevealedStones?: Point[];
    myRevealedMoveIndices?: readonly number[];
    myRevealedStones?: Point[];
    myPlayerEnum: Player;
    blackPatternStones?: Point[];
    whitePatternStones?: Point[];
    revealAnimationStones?: Point[];
};

function pointKey(x: number, y: number): string {
    return `${x},${y}`;
}

function hasPoint(points: Point[] | undefined, x: number, y: number): boolean {
    return points?.some((p) => p.x === x && p.y === y) ?? false;
}

/**
 * GoBoard 셀 렌더에서 반복되는 moveIndex/hidden/base/pattern 판별을
 * 보드 레벨에서 한 번만 계산한다.
 */
function computeCellFlags(
    x: number,
    y: number,
    actualPlayer: Player,
    input: BuildBoardCellLookupInput,
): BoardCellStoneRenderFlags {
    const {
        moveHistory,
        hiddenMoves,
        baseHiddenMoveCtx,
        baseStones,
        consumedPatternIntersections,
        aiInitialHiddenStone,
        permanentlyRevealedStones,
        myRevealedMoveIndices,
        myRevealedStones,
        myPlayerEnum,
        blackPatternStones,
        whitePatternStones,
        revealAnimationStones,
    } = input;

    const atRecordedBaseStone = baseStones?.some((bs) => bs.x === x && bs.y === y) ?? false;
    const isPlainStoneReuseIntersection =
        !atRecordedBaseStone &&
        (consumedPatternIntersections?.some((p) => p.x === x && p.y === y) ?? false);

    const moveIndex = moveHistory
        ? findLatestMoveIndexAtExcludingRecordedBaseStones(
              moveHistory,
              x,
              y,
              actualPlayer,
              baseHiddenMoveCtx,
          )
        : -1;

    const histMove = moveIndex >= 0 && moveHistory ? moveHistory[moveIndex] : undefined;

    const isHiddenMoveByHistory = !!hiddenMoves && moveIndex !== -1 && !!hiddenMoves[moveIndex];
    const isHiddenMove = !isPlainStoneReuseIntersection && !!histMove && isHiddenMoveByHistory;

    const isInRevealAnimation = revealAnimationStones
        ? hasPoint(revealAnimationStones, x, y)
        : false;
    const isPermanentlyRevealed = hasPoint(permanentlyRevealedStones, x, y) || isInRevealAnimation;

    const atAiInitialHiddenStone =
        !isPlainStoneReuseIntersection &&
        !!aiInitialHiddenStone &&
        aiInitialHiddenStone.x === x &&
        aiInitialHiddenStone.y === y &&
        !isPermanentlyRevealed;

    const softScanAtCurrentMove =
        (moveIndex >= 0 &&
            myRevealedMoveIndices != null &&
            myRevealedMoveIndices.includes(moveIndex)) ||
        (myRevealedMoveIndices === undefined && hasPoint(myRevealedStones, x, y)) ||
        (moveIndex === -1 && atAiInitialHiddenStone && hasPoint(myRevealedStones, x, y));

    const hasBaseStoneHere =
        !isPlainStoneReuseIntersection && (baseStones?.some((bs) => bs.x === x && bs.y === y) ?? false);

    let isPatternStone = false;
    if (!isHiddenMove && !atAiInitialHiddenStone && !isPlainStoneReuseIntersection) {
        isPatternStone =
            (actualPlayer === Player.Black && hasPoint(blackPatternStones, x, y)) ||
            (actualPlayer === Player.White && hasPoint(whitePatternStones, x, y));
    }

    return {
        moveIndex,
        isHiddenMove,
        isPlainStoneReuseIntersection,
        atRecordedBaseStone,
        atAiInitialHiddenStone,
        isPermanentlyRevealed,
        softScanAtCurrentMove,
        isInRevealAnimation,
        hasBaseStoneHere,
        isPatternStone,
    };
}

export function buildBoardCellStoneLookup(
    displayBoardState: BoardState,
    input: BuildBoardCellLookupInput,
): Map<string, BoardCellStoneRenderFlags> {
    const lookup = new Map<string, BoardCellStoneRenderFlags>();
    for (let y = 0; y < displayBoardState.length; y++) {
        const row = displayBoardState[y];
        if (!row) continue;
        for (let x = 0; x < row.length; x++) {
            const player = row[x];
            if (player === Player.None) continue;
            lookup.set(pointKey(x, y), computeCellFlags(x, y, player, input));
        }
    }
    return lookup;
}
