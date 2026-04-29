import * as types from '../../types/index.js';
import * as db from '../db.js';
import { aiUserId } from '../aiPlayer.js';
import { syncAiSession } from '../aiSessionManager.js';
import { resumeGameTimer } from './shared.js';
import {
    consumeOpponentPatternStoneIfAny,
    recordPatternStoneConsumed,
    stripPatternStonesAtConsumedIntersections,
} from '../../shared/utils/patternStoneConsume.js';
import {
    isIntersectionRecordedAsBaseStone,
    removeCapturedBaseStoneMarkersFromSession,
} from '../../shared/utils/removeCapturedBaseStoneMarkers.js';
import { applyPreserveDiscovererTurnIfPending } from './hiddenRevealPreserve.js';
import { tryEndGameWhenCaptureTargetReached } from '../utils/captureTargets.js';

export type TowerStyleHiddenRevealPostTurnHook = (game: types.LiveGameSession, now: number) => Promise<void>;

function isAiControlledSeat(game: types.LiveGameSession, playerEnum: types.Player): boolean {
    const id = playerEnum === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
    return id === aiUserId || (id != null && String(id).startsWith('dungeon-bot-'));
}

/** 연출 종료 직후 DB/캐시/브로드캐스트 반영 + AI 세션 동기화(히든 후 봇 미착수·턴 고착 방지) */
async function persistAfterHiddenRevealTransition(game: types.LiveGameSession, now: number): Promise<void> {
    if (isAiControlledSeat(game, game.currentPlayer)) {
        game.aiTurnStartTime = now;
    } else {
        game.aiTurnStartTime = undefined;
    }
    await db.saveGame(game);
    const { broadcastToGameParticipants } = await import('../socket.js');
    const { updateGameCache } = await import('../gameCache.js');
    updateGameCache(game);
    const payloadGame = { ...game };
    delete (payloadGame as any).boardState;
    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: payloadGame } }, game);
    syncAiSession(game, aiUserId);
}

/**
 * 도전의 탑 `updateTowerPlayerHiddenState`의 `hidden_reveal_animating` 분기와 동일한 처리.
 * 싱글플레이·전략 AI·길드전(AI)·모험(AI) 등에서 재사용한다.
 *
 * @returns 애니 종료 시점을 처리했으면 true(호출측에서 break), 해당 없으면 false
 */
export const runTowerStyleHiddenRevealAnimatingIfDue = async (
    game: types.LiveGameSession,
    now: number,
    options: { logPrefix: string; onPostTurnSwitch?: TowerStyleHiddenRevealPostTurnHook }
): Promise<boolean> => {
    if (game.gameStatus !== 'hidden_reveal_animating') return false;
    if (!game.revealAnimationEndTime || now < game.revealAnimationEndTime) return false;

    const { logPrefix, onPostTurnSwitch } = options;
    const cap = game.pendingCapture;
    const isAiTurnCancelled = (game as any).isAiTurnCancelledAfterReveal;

    if (!cap) {
        const pendingAiAfterUserHiddenReveal = (game as any).pendingAiMoveAfterUserHiddenFullReveal;
        (game as any).pendingAiMoveAfterUserHiddenFullReveal = undefined;
        game.animation = null;
        game.gameStatus = 'playing';
        game.revealAnimationEndTime = undefined;
        game.pendingCapture = null;
        (game as any).isAiTurnCancelledAfterReveal = undefined;
        const cur = game.currentPlayer;
        if (game.settings?.timeLimit > 0 && game.pausedTurnTimeLeft !== undefined) {
            const timeKey = cur === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
            game[timeKey] = game.pausedTurnTimeLeft;
            game.turnDeadline = now + (game[timeKey] ?? 0) * 1000;
            game.turnStartTime = now;
        } else {
            game.turnDeadline = undefined;
            game.turnStartTime = undefined;
        }
        game.pausedTurnTimeLeft = undefined;
        if (pendingAiAfterUserHiddenReveal) {
            // 즉시 makeAiMove는 AI 세션 락·메인루프 setImmediate와 경합해 스킵될 수 있음 → hidden.ts와 동일하게 aiTurnStartTime만 설정
            await persistAfterHiddenRevealTransition(game, now);
            return true;
        }
        await persistAfterHiddenRevealTransition(game, now);
        return true;
    }

    if (await applyPreserveDiscovererTurnIfPending(game, now, cap)) {
        (game as any).isAiTurnCancelledAfterReveal = undefined;
        await persistAfterHiddenRevealTransition(game, now);
        return true;
    }

    game.gameStatus = 'playing';
    const myPlayerEnum = cap.move.player;
    resumeGameTimer(game, now, myPlayerEnum);

    {
        const myP = cap.move.player;
        const opponentP = myP === types.Player.Black ? types.Player.White : types.Player.Black;
        game.justCaptured = [];
        for (const stone of cap.stones) {
            game.boardState[stone.y][stone.x] = types.Player.None;
            const isBaseStone = isIntersectionRecordedAsBaseStone(game, stone.x, stone.y);
            let moveIndex = -1;
            for (let i = (game.moveHistory?.length ?? 0) - 1; i >= 0; i--) {
                const m = game.moveHistory![i];
                if (m.x === stone.x && m.y === stone.y && m.player === opponentP) {
                    moveIndex = i;
                    break;
                }
            }
            const wasHidden = moveIndex !== -1 && !!game.hiddenMoves?.[moveIndex];
            const wasAiInitialHidden =
                (game as any).aiInitialHiddenStone &&
                (game as any).aiInitialHiddenStone.x === stone.x &&
                (game as any).aiInitialHiddenStone.y === stone.y;
            const wasRevealedHidden = !!game.permanentlyRevealedStones?.some(
                (p) => p.x === stone.x && p.y === stone.y
            );
            if (wasAiInitialHidden) (game as any).aiInitialHiddenStone = undefined;
            let points = 1;
            let wasHiddenForEntry = false;
            if (isBaseStone) {
                game.baseStoneCaptures[myP]++;
                points = 5;
                recordPatternStoneConsumed(game, stone);
            } else if (consumeOpponentPatternStoneIfAny(game, stone, opponentP)) {
                points = 2;
            } else if (wasHidden || wasAiInitialHidden || wasRevealedHidden) {
                game.hiddenStoneCaptures[myP] = (game.hiddenStoneCaptures[myP] || 0) + 1;
                points = 5;
                wasHiddenForEntry = true;
                recordPatternStoneConsumed(game, stone);
            }
            game.captures[myP] += points;
            game.justCaptured.push({
                point: stone,
                player: opponentP,
                wasHidden: wasHiddenForEntry || wasAiInitialHidden || wasRevealedHidden,
                capturePoints: points,
                ...(isBaseStone ? { wasBaseStone: true as const } : {}),
            });
            if (moveIndex !== -1 && game.hiddenMoves?.[moveIndex]) {
                delete game.hiddenMoves[moveIndex];
            }
        }
        stripPatternStonesAtConsumedIntersections(game);
        removeCapturedBaseStoneMarkersFromSession(game, cap.stones);
        if (cap.move && typeof cap.move.x === 'number' && typeof cap.move.y === 'number') {
            game.boardState[cap.move.y][cap.move.x] = myP;
        }
        // hidden_reveal 연출과 본판 newlyRevealed 스파클 이중 재생 방지 (permanentlyRevealed로 충분)
        game.newlyRevealed = [];
        if (await tryEndGameWhenCaptureTargetReached(game, myP)) {
            game.animation = null;
            game.revealAnimationEndTime = undefined;
            game.pendingCapture = null;
            (game as any).isAiTurnCancelledAfterReveal = undefined;
            (game as any).pendingAiMoveAfterUserHiddenFullReveal = undefined;
            return true;
        }
    }

    game.animation = null;
    game.revealAnimationEndTime = undefined;
    game.pendingCapture = null;
    (game as any).isAiTurnCancelledAfterReveal = undefined;
    (game as any).pendingAiMoveAfterUserHiddenFullReveal = undefined;

    if (isAiTurnCancelled) {
        game.gameStatus = 'playing';
        if (game.settings?.timeLimit > 0 && game.pausedTurnTimeLeft != null) {
            const aiTimeKey = game.currentPlayer === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
            (game as any)[aiTimeKey] = game.pausedTurnTimeLeft;
        }
        game.pausedTurnTimeLeft = undefined;
        await persistAfterHiddenRevealTransition(game, now);
        return true;
    }

    game.gameStatus = 'playing';
    const playerWhoMoved = cap.move.player;
    const nextPlayer = playerWhoMoved === types.Player.Black ? types.Player.White : types.Player.Black;
    game.currentPlayer = nextPlayer;
    if (isAiControlledSeat(game, nextPlayer)) {
        // 히든 공개 직후 AI가 바로 착수하는 흐름에서는 직전 캡처 justCaptured가
        // 다음 착수 렌더 트리거에 재사용되어 점수 플로트가 한 번 더 재생될 수 있다.
        game.justCaptured = [];
    }
    game.pausedTurnTimeLeft = undefined;

    if (onPostTurnSwitch) {
        await onPostTurnSwitch(game, now);
    }

    await persistAfterHiddenRevealTransition(game, now);
    return true;
};
