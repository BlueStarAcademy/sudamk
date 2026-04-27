import { Player } from '../types/index.js';
import type { BoardState, LiveGameSession, Point } from '../types/index.js';
import {
    consumeOpponentPatternStoneIfAny,
    stripPatternStonesAtConsumedIntersections,
} from './patternStoneConsume.js';
import { bumpGuildWarMaxSingleCapturePointsForPlayer } from './guildWarMaxSingleCapturePoints.js';
import { isIntersectionRecordedAsBaseStone } from './removeCapturedBaseStoneMarkers.js';

export type MissileCaptureProcessResult = {
    isValid: boolean;
    newBoardState: BoardState;
    capturedStones: Point[];
    newKoInfo: LiveGameSession['koInfo'];
};

function removeCapturedBaseStoneMarkers(game: LiveGameSession, capturedStones: Point[]): void {
    if (!game.baseStones?.length || !capturedStones.length) return;
    const capturedKeys = new Set(capturedStones.map((s) => `${s.x},${s.y}`));
    game.baseStones = game.baseStones.filter((s) => !capturedKeys.has(`${s.x},${s.y}`));
}

function isPveLikeForMissileCaptures(game: LiveGameSession): boolean {
    return (
        !!game.isSinglePlayer ||
        (game as { gameCategory?: string }).gameCategory === 'guildwar' ||
        (game as { gameCategory?: string }).gameCategory === 'tower'
    );
}

/**
 * 미사일 착지 후 `processMove` / `processMoveClient` 결과를 세션에 반영한다.
 * 일반 착수와 동일하게 문양돌·배치돌·히든 따내기 점수 및 `consumedPatternIntersections`를 갱신한다.
 */
export function applyMissileCaptureProcessResult(
    game: LiveGameSession,
    myPlayerEnum: Player,
    opponentEnum: Player,
    captureResult: MissileCaptureProcessResult
): void {
    if (!captureResult.isValid) return;

    if (captureResult.capturedStones.length === 0) {
        game.boardState = captureResult.newBoardState;
        game.koInfo = captureResult.newKoInfo ?? null;
        return;
    }

    game.boardState = captureResult.newBoardState;
    if (!game.captures) {
        game.captures = { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
    }
    if (!game.justCaptured) game.justCaptured = [];

    const pveLike = isPveLikeForMissileCaptures(game);
    const captureCountThisMove = captureResult.capturedStones.length;
    const maxSingleCaptureByPlayer = ((game as any).maxSingleCaptureByPlayer ??= {});
    const prevMaxForPlayer = Number(maxSingleCaptureByPlayer[myPlayerEnum] ?? 0) || 0;
    if (captureCountThisMove > prevMaxForPlayer) {
        maxSingleCaptureByPlayer[myPlayerEnum] = captureCountThisMove;
    }

    let guildWarCapturePointsThisMove = 0;
    for (const stone of captureResult.capturedStones) {
        const capturedPlayerEnum = opponentEnum;
        let points = 1;
        let wasHiddenForJustCaptured = false;
        let isBaseStone = false;

        if (pveLike) {
            isBaseStone = isIntersectionRecordedAsBaseStone(game, stone.x, stone.y);
            if (isBaseStone) {
                if (!game.baseStoneCaptures) {
                    game.baseStoneCaptures = { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
                }
                game.baseStoneCaptures[myPlayerEnum]++;
                points = 5;
            } else if (consumeOpponentPatternStoneIfAny(game, stone, capturedPlayerEnum)) {
                points = 2;
            }
        } else {
            isBaseStone = isIntersectionRecordedAsBaseStone(game, stone.x, stone.y);
            const moveIndex = game.moveHistory.findIndex((m) => m.x === stone.x && m.y === stone.y);
            const wasHidden = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
            wasHiddenForJustCaptured = wasHidden;

            if (isBaseStone) {
                if (!game.baseStoneCaptures) {
                    game.baseStoneCaptures = { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
                }
                game.baseStoneCaptures[myPlayerEnum]++;
                points = 5;
            } else if (wasHidden) {
                if (!game.hiddenStoneCaptures) {
                    game.hiddenStoneCaptures = { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 };
                }
                game.hiddenStoneCaptures[myPlayerEnum]++;
                points = 5;
                if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
                if (!game.permanentlyRevealedStones.some((p) => p.x === stone.x && p.y === stone.y)) {
                    game.permanentlyRevealedStones.push(stone);
                }
            }
        }

        game.captures[myPlayerEnum] = (game.captures[myPlayerEnum] ?? 0) + points;
        guildWarCapturePointsThisMove += points;
        game.justCaptured.push({
            point: stone,
            player: capturedPlayerEnum,
            wasHidden: wasHiddenForJustCaptured,
            capturePoints: points,
            ...(isBaseStone ? { wasBaseStone: true as const } : {}),
        });
    }

    bumpGuildWarMaxSingleCapturePointsForPlayer(game as any, myPlayerEnum, guildWarCapturePointsThisMove);
    stripPatternStonesAtConsumedIntersections(game);
    removeCapturedBaseStoneMarkers(game, captureResult.capturedStones);
    game.koInfo = captureResult.newKoInfo ?? null;
}
