import * as types from '../../types/index.js';
import { processMove } from '../goLogic.js';
import { applyMissileCaptureProcessResult } from '../../shared/utils/missileLandingCapture.js';
import { recordPatternStoneConsumed, stripPatternStonesAtConsumedIntersections } from '../../shared/utils/patternStoneConsume.js';
import { findLatestMoveIndexAtExcludingRecordedBaseStones } from '../../shared/utils/baseHiddenMoveIndex.js';

/** 미사일 착지 후(이동 연출 종료 시점) 착점과 동일 규칙으로 따내기·점수 반영 */
export function applyMissileLandingCaptures(
    game: types.LiveGameSession,
    to: types.Point,
    myPlayerEnum: types.Player,
): void {
    const opponentEnum = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
    const boardForCapture = game.boardState.map((row) => [...row]);
    if (boardForCapture[to.y]?.[to.x] !== myPlayerEnum) return;
    boardForCapture[to.y][to.x] = types.Player.None;
    const captureResult = processMove(
        boardForCapture,
        { x: to.x, y: to.y, player: myPlayerEnum },
        game.koInfo ?? null,
        game.moveHistory.length,
        { opponentPlayer: opponentEnum },
    );
    applyMissileCaptureProcessResult(game, myPlayerEnum, opponentEnum, captureResult);
}

export type MissileFlightAnimationSnapshot = {
    type: 'missile' | 'hidden_missile';
    from?: types.Point;
    to?: types.Point;
    revealedHiddenStone?: types.Point | null;
    startTime: number;
    /** LAUNCH_MISSILE 직후 따내기를 반영했으면 애니 종료 시 재적용하지 않는다. */
    capturesAppliedAtLaunch?: boolean;
};

export function missileAnimationCapturesAppliedAtLaunch(
    anim: MissileFlightAnimationSnapshot | null | undefined,
): boolean {
    return !!anim?.capturesAppliedAtLaunch;
}

import { isMissileFlightAnimationType } from '../../shared/utils/itemPhaseAnimationTypes.js';

export { isMissileFlightAnimationType as isMissileFlightAnimation } from '../../shared/utils/itemPhaseAnimationTypes.js';

const isMissileFlightAnimation = isMissileFlightAnimationType;

function findLatestOwnedMoveIndexAt(
    game: types.LiveGameSession,
    point: types.Point,
    player: types.Player,
): number {
    return findLatestMoveIndexAtExcludingRecordedBaseStones(game.moveHistory, point.x, point.y, player, game);
}

export function relocateMissileStoneMetadata(
    game: types.LiveGameSession,
    from: types.Point,
    to: types.Point,
    player: types.Player,
): void {
    const patternKey = player === types.Player.Black ? 'blackPatternStones' : 'whitePatternStones';
    const patternStones = (game as any)[patternKey] as types.Point[] | undefined;
    if (patternStones?.length) {
        const idx = patternStones.findIndex((p) => p.x === from.x && p.y === from.y);
        if (idx !== -1) {
            recordPatternStoneConsumed(game as any, from);
            patternStones[idx] = { x: to.x, y: to.y };
        }
    }
    stripPatternStonesAtConsumedIntersections(game as any);

    if (game.permanentlyRevealedStones?.length) {
        const ridx = game.permanentlyRevealedStones.findIndex((p) => p.x === from.x && p.y === from.y);
        if (ridx !== -1) {
            game.permanentlyRevealedStones[ridx] = { x: to.x, y: to.y };
        }
    }

    const movedIdx = findLatestOwnedMoveIndexAt(game, from, player);
    if (movedIdx !== -1 && game.moveHistory[movedIdx]) {
        const cur = game.moveHistory[movedIdx];
        game.moveHistory[movedIdx] = { ...cur, x: to.x, y: to.y };
    }
}

function revealMissileHiddenStone(game: types.LiveGameSession, revealedHiddenStone: types.Point): void {
    const rs = revealedHiddenStone;
    const moveIndex = game.moveHistory.findIndex((m) => m.x === rs.x && m.y === rs.y);
    if (moveIndex === -1) return;
    if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
    if (!game.permanentlyRevealedStones.some((p) => p.x === rs.x && p.y === rs.y)) {
        game.permanentlyRevealedStones.push({ x: rs.x, y: rs.y });
    }
}

/**
 * 미사일 비행 종료 시 보드·수순·따내기 반영(LAUNCH에서 이미 옮긴 경우 skipBoardRelocation).
 */
export function applyMissileFlightBoardFromAnimation(
    game: types.LiveGameSession,
    anim: MissileFlightAnimationSnapshot,
    playerWhoMoved: types.Player,
    options?: { skipBoardRelocation?: boolean },
): void {
    if (anim.revealedHiddenStone) {
        revealMissileHiddenStone(game, anim.revealedHiddenStone);
    }

    if (options?.skipBoardRelocation) {
        if (anim.to && !missileAnimationCapturesAppliedAtLaunch(anim)) {
            applyMissileLandingCaptures(game, anim.to, playerWhoMoved);
        }
        return;
    }

    const animationFrom = anim.from;
    const animationTo = anim.to;
    if (animationFrom && animationTo) {
        const af = animationFrom;
        const at = animationTo;
        const stoneAtFrom = game.boardState[af.y]?.[af.x];
        if (stoneAtFrom === playerWhoMoved) {
            game.boardState[af.y][af.x] = types.Player.None;
        }
        game.boardState[at.y][at.x] = playerWhoMoved;

        if (game.baseStones) {
            const baseStoneIndex = game.baseStones.findIndex((bs) => bs.x === af.x && bs.y === af.y);
            if (baseStoneIndex !== -1) {
                game.baseStones[baseStoneIndex].x = at.x;
                game.baseStones[baseStoneIndex].y = at.y;
            }
        }

        const playerId = playerWhoMoved === types.Player.Black ? game.blackPlayerId! : game.whitePlayerId!;
        const baseStonesKey = playerId === game.player1.id ? 'baseStones_p1' : 'baseStones_p2';
        const baseStonesArray = (game as any)[baseStonesKey] as types.Point[] | undefined;
        if (baseStonesArray) {
            const baseStoneIndex = baseStonesArray.findIndex((bs) => bs.x === af.x && bs.y === af.y);
            if (baseStoneIndex !== -1) {
                baseStonesArray[baseStoneIndex].x = at.x;
                baseStonesArray[baseStoneIndex].y = at.y;
            }
        }

        let moveIndexToUpdate = -1;
        for (let i = game.moveHistory.length - 1; i >= 0; i--) {
            const move = game.moveHistory[i];
            if (move.x === af.x && move.y === af.y) {
                if (game.boardState[at.y]?.[at.x] === move.player) {
                    moveIndexToUpdate = i;
                    break;
                }
            }
        }
        if (moveIndexToUpdate !== -1) {
            game.moveHistory[moveIndexToUpdate].x = at.x;
            game.moveHistory[moveIndexToUpdate].y = at.y;
        }

        relocateMissileStoneMetadata(game, af, at, playerWhoMoved);
    }

    if (animationTo && !missileAnimationCapturesAppliedAtLaunch(anim)) {
        applyMissileLandingCaptures(game, animationTo, playerWhoMoved);
    }
}

export function snapshotMissileFlightAnimation(
    game: types.LiveGameSession,
): MissileFlightAnimationSnapshot | null {
    const anim = game.animation;
    if (!isMissileFlightAnimation(anim)) return null;
    return {
        type: anim.type,
        from: (anim as any).from as types.Point | undefined,
        to: (anim as any).to as types.Point | undefined,
        revealedHiddenStone: (anim as any).revealedHiddenStone as types.Point | null | undefined,
        startTime: anim.startTime,
        capturesAppliedAtLaunch: (anim as { capturesAppliedAtLaunch?: boolean }).capturesAppliedAtLaunch,
    };
}
