import type { Point } from '../types/index.js';
import { Player } from '../types/index.js';

export type PatternStoneConsumeSlice = {
    blackPatternStones?: Point[] | null;
    whitePatternStones?: Point[] | null;
    consumedPatternIntersections?: Point[] | null;
};

/** 한 번 문양돌로 따인 교차점은 같은 대국에서 다시 문양이 되지 않도록 기록 */
export function recordPatternStoneConsumed(game: PatternStoneConsumeSlice, point: Point): void {
    if (!game.consumedPatternIntersections) game.consumedPatternIntersections = [];
    if (!game.consumedPatternIntersections.some((p) => p.x === point.x && p.y === point.y)) {
        game.consumedPatternIntersections.push({ x: point.x, y: point.y });
    }
}

/** 상대 색 기준 문양 목록에서 제거 + 소모 기록. 문양이었으면 true */
export function consumeOpponentPatternStoneIfAny(
    game: PatternStoneConsumeSlice,
    point: Point,
    capturedPlayer: Player
): boolean {
    const list =
        capturedPlayer === Player.Black ? game.blackPatternStones : game.whitePatternStones;
    if (!list?.length) return false;
    const idx = list.findIndex((p) => p.x === point.x && p.y === point.y);
    if (idx === -1) return false;
    list.splice(idx, 1);
    recordPatternStoneConsumed(game, point);
    return true;
}

/** 소모된 교차점이 목록에 남아 있으면 제거 (세션 병합·구버그 방지) */
export function stripPatternStonesAtConsumedIntersections(game: PatternStoneConsumeSlice): void {
    const dead = game.consumedPatternIntersections;
    if (!dead?.length) return;
    const isDead = (p: Point) => dead.some((d) => d.x === p.x && d.y === p.y);
    if (game.blackPatternStones?.length) {
        game.blackPatternStones = game.blackPatternStones.filter((p) => !isDead(p));
    }
    if (game.whitePatternStones?.length) {
        game.whitePatternStones = game.whitePatternStones.filter((p) => !isDead(p));
    }
}

export function isPatternIntersectionPermanentlyConsumed(
    game: PatternStoneConsumeSlice,
    point: Point
): boolean {
    return !!game.consumedPatternIntersections?.some((p) => p.x === point.x && p.y === point.y);
}
