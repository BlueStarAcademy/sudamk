import * as types from '../../types/index.js';
import { shouldEnforceTimeControl } from './shared.js';
import { isFischerStyleTimeControl, getFischerIncrementSeconds } from '../../shared/utils/gameTimeControl.js';

type PendingCap = NonNullable<types.LiveGameSession['pendingCapture']>;

/**
 * pendingCapture에 preserveDiscovererTurn + 스냅샷이 있으면 적용하고 true.
 * hidden.ts / 싱글·탑 전용 업데이트에서 동일 동작을 공유한다.
 */
export const applyPreserveDiscovererTurnIfPending = async (
    game: types.LiveGameSession,
    now: number,
    cap: PendingCap
): Promise<boolean> => {
    const capAny = cap as any;
    const preserveDiscovererTurn =
        !!capAny.preserveDiscovererTurn &&
        Array.isArray(capAny.boardStateBeforeReveal) &&
        capAny.boardStateBeforeReveal.length > 0;

    if (!preserveDiscovererTurn) return false;

    const myPlayerEnum = cap.move.player;
    const opponentPlayerEnum = myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;

    game.boardState = (capAny.boardStateBeforeReveal as types.Player[][]).map((row: types.Player[]) => [...row]);
    game.koInfo =
        capAny.koInfoBeforeReveal != null
            ? JSON.parse(JSON.stringify(capAny.koInfoBeforeReveal))
            : game.koInfo;
    game.passCount = capAny.passCountBeforeReveal ?? 0;
    const mh = game.moveHistory || [];
    if (mh.length > 0) {
        const last = mh[mh.length - 1];
        if (last && last.x === cap.move.x && last.y === cap.move.y && last.player === cap.move.player) {
            mh.pop();
        }
    }
    const prev = mh.length > 0 ? mh[mh.length - 1] : null;
    game.lastMove =
        prev && prev.x != null && prev.y != null && prev.x >= 0 && prev.y >= 0 ? { x: prev.x, y: prev.y } : null;
    for (let i = (game.moveHistory?.length ?? 0) - 1; i >= 0; i--) {
        const m = game.moveHistory![i];
        if (m && m.x === cap.move.x && m.y === cap.move.y && m.player === opponentPlayerEnum) {
            if (!game.hiddenMoves) game.hiddenMoves = {};
            delete game.hiddenMoves[i];
            break;
        }
    }
    if (!game.newlyRevealed) game.newlyRevealed = [];
    game.newlyRevealed.push(
        ...(cap.hiddenContributors || []).map((p: types.Point) => ({
            point: p,
            player: myPlayerEnum,
        }))
    );
    game.justCaptured = [];

    game.animation = null;
    game.gameStatus = 'playing';
    game.revealAnimationEndTime = undefined;
    game.pendingCapture = null;
    (game as any).pendingAiMoveAfterUserHiddenFullReveal = undefined;

    game.currentPlayer = myPlayerEnum;
    const cur = myPlayerEnum;
    if (game.pausedTurnTimeLeft !== undefined) {
        const timeKey = cur === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        const fischerIncrement = getFischerIncrementSeconds(game as any);
        game[timeKey] = game.pausedTurnTimeLeft + fischerIncrement;
    }
    if (
        shouldEnforceTimeControl(game) &&
        game.settings?.timeLimit > 0 &&
        game.pausedTurnTimeLeft !== undefined
    ) {
        const timeKey = cur === types.Player.Black ? 'blackTimeLeft' : 'whiteTimeLeft';
        const isFischer = isFischerStyleTimeControl(game as any);
        const byoyomiTime = game.settings.byoyomiTime ?? 0;
        const isNextInByoyomi = game[timeKey] <= 0 && game.settings.byoyomiCount > 0 && !isFischer;
        if (isNextInByoyomi && byoyomiTime > 0) {
            game.turnDeadline = now + byoyomiTime * 1000;
        } else {
            game.turnDeadline = now + (game[timeKey] ?? 0) * 1000;
        }
        game.turnStartTime = now;
    } else {
        game.turnDeadline = undefined;
        game.turnStartTime = undefined;
    }
    game.pausedTurnTimeLeft = undefined;
    if (game.isAiGame) {
        const { aiUserId } = await import('../aiPlayer.js');
        const curId = cur === types.Player.Black ? game.blackPlayerId : game.whitePlayerId;
        if (curId === aiUserId) {
            game.aiTurnStartTime = now;
        } else {
            game.aiTurnStartTime = undefined;
        }
    }
    return true;
};
