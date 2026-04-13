import type { Point } from '../types/enums.js';
import { Player } from '../types/enums.js';

/**
 * 계가·사석 집계 시 사용: 착수 중 따냈을 때와 동일한 규칙으로, 해당 교차점 돌의 집 점수 가중치를 반환한다.
 * (게임 상태를 변경하지 않음)
 */
export type ScoringStoneSessionSlice = {
    isAiGame?: boolean;
    isSinglePlayer?: boolean;
    gameCategory?: string | null;
    moveHistory?: { x: number; y: number }[] | null;
    hiddenMoves?: Record<number, boolean> | null;
    blackPatternStones?: Point[] | null;
    whitePatternStones?: Point[] | null;
    baseStones?: Point[] | null;
    baseStones_p1?: Point[] | null;
    baseStones_p2?: Point[] | null;
    aiInitialHiddenStone?: Point | null;
};

function isBaseStoneAt(game: ScoringStoneSessionSlice, stone: Point): boolean {
    if (game.baseStones?.some((bs) => bs.x === stone.x && bs.y === stone.y)) return true;
    if ((game as { baseStones_p1?: Point[] }).baseStones_p1?.some((bs) => bs.x === stone.x && bs.y === stone.y)) return true;
    if ((game as { baseStones_p2?: Point[] }).baseStones_p2?.some((bs) => bs.x === stone.x && bs.y === stone.y)) return true;
    return false;
}

function isPatternStoneForOwner(game: ScoringStoneSessionSlice, stone: Point, stoneOwner: Player): boolean {
    if (stoneOwner === Player.Black) {
        return !!game.blackPatternStones?.some((p) => p.x === stone.x && p.y === stone.y);
    }
    if (stoneOwner === Player.White) {
        return !!game.whitePatternStones?.some((p) => p.x === stone.x && p.y === stone.y);
    }
    return false;
}

function wasHiddenPlacement(game: ScoringStoneSessionSlice, stone: Point): boolean {
    const mh = game.moveHistory;
    if (!mh?.length) return false;
    for (let i = mh.length - 1; i >= 0; i--) {
        const m = mh[i];
        if (m && m.x === stone.x && m.y === stone.y) {
            return !!game.hiddenMoves?.[i];
        }
    }
    return false;
}

function wasAiInitialHiddenStone(game: ScoringStoneSessionSlice, stone: Point): boolean {
    const h = game.aiInitialHiddenStone;
    return !!(h && h.x === stone.x && h.y === stone.y);
}

/**
 * strategic.ts / hidden.ts / towerPlayerHidden 등 착수 시 포획 점수 규칙과 동일한 우선순위.
 */
export function getStoneCapturePointValueForScoring(game: ScoringStoneSessionSlice, stone: Point, stoneOwner: Player): number {
    if (stoneOwner !== Player.Black && stoneOwner !== Player.White) return 1;

    if (isBaseStoneAt(game, stone)) return 5;

    const hidden = wasHiddenPlacement(game, stone);
    const aiInitial = wasAiInitialHiddenStone(game, stone);
    const pattern = isPatternStoneForOwner(game, stone, stoneOwner);

    const isStrategicAiGame =
        !!game.isAiGame &&
        !game.isSinglePlayer &&
        game.gameCategory !== 'tower' &&
        game.gameCategory !== 'singleplayer' &&
        game.gameCategory !== 'guildwar';

    const pvePatternFirst =
        !!game.isSinglePlayer || isStrategicAiGame || game.gameCategory === 'guildwar';

    if (pvePatternFirst) {
        if (pattern) return 2;
        if (hidden || aiInitial) return 5;
        return 1;
    }

    if (pattern) return 2;
    if (hidden || aiInitial) return 5;
    return 1;
}
