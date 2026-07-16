import * as types from '../../types/index.js';
import { PVE_AI_HIDDEN_REVEAL_DURATION_MS } from '../../shared/constants/gameSettings.js';
import { expandToAllUnrevealedHiddenStonesForPlayers } from '../../shared/utils/expandHiddenRevealStones.js';
import { isUnrevealedOpponentHiddenStoneAt } from '../../shared/utils/hiddenStonePlacementOccupancy.js';
import { freezeMainTurnClock, shouldEnforceTimeControl } from './shared.js';
import { allowsServerRevealOnlyOpponentHiddenAttack } from './hiddenRevealPolicy.js';
import { markItemPhaseStateChanged } from './finalizeItemPhase.js';
import { aiUserId } from '../aiPlayer.js';

function resolveOpponentPlayerEnum(myPlayerEnum: types.Player): types.Player {
    return myPlayerEnum === types.Player.Black ? types.Player.White : types.Player.Black;
}

function resolveAiPlayerEnum(game: types.LiveGameSession): types.Player {
    if (game.blackPlayerId === aiUserId) return types.Player.Black;
    if (game.whitePlayerId === aiUserId) return types.Player.White;
    return types.Player.None;
}

/**
 * 상대 미공개 히든 칸 클릭/착수 시도: 돌은 두지 않고 전체공개 연출만 시작한다.
 * @returns 연출을 시작했으면 true
 */
export function tryStartRevealOnlyOpponentHiddenAttack(
    game: types.LiveGameSession,
    myPlayerEnum: types.Player,
    x: number,
    y: number,
    now: number,
): boolean {
    if (!allowsServerRevealOnlyOpponentHiddenAttack(game)) return false;
    if (myPlayerEnum !== types.Player.Black && myPlayerEnum !== types.Player.White) return false;
    if (game.gameStatus !== 'playing' && game.gameStatus !== 'hidden_placing') return false;
    if (!isUnrevealedOpponentHiddenStoneAt(game.boardState, game, x, y, myPlayerEnum)) return false;

    const opponentPlayerEnum = resolveOpponentPlayerEnum(myPlayerEnum);
    const seed = [{ point: { x, y }, player: opponentPlayerEnum }];
    const stones = expandToAllUnrevealedHiddenStonesForPlayers(game, seed, {
        aiPlayerEnum: resolveAiPlayerEnum(game),
        // 몰래공개(스캔)된 돌도 클릭 전체공개에 포함
        isHiddenMoveIndexSoftRevealed: () => false,
    });
    const stonesToReveal = stones.length > 0 ? stones : seed;

    const returnStatus = game.gameStatus;
    if (returnStatus === 'playing' && shouldEnforceTimeControl(game)) {
        freezeMainTurnClock(game, now);
    }

    if (!game.permanentlyRevealedStones) game.permanentlyRevealedStones = [];
    for (const stone of stonesToReveal) {
        if (!game.permanentlyRevealedStones.some((p) => p.x === stone.point.x && p.y === stone.point.y)) {
            game.permanentlyRevealedStones.push({ ...stone.point });
        }
    }

    const involvesAi = stonesToReveal.some((s) => s.player === resolveAiPlayerEnum(game));
    const durationMs = involvesAi ? PVE_AI_HIDDEN_REVEAL_DURATION_MS : 1500;

    (game as any).pvpHiddenRevealReturnStatus = returnStatus;
    game.pendingCapture = null;
    game.gameStatus = 'hidden_reveal_animating';
    game.animation = {
        type: 'hidden_reveal',
        stones: stonesToReveal,
        startTime: now,
        duration: durationMs,
    };
    game.revealAnimationEndTime = now + durationMs;
    // 모험/AI: 연출 종료 후에도 발견한 쪽 턴 유지
    (game as any).isAiTurnCancelledAfterReveal = true;
    markItemPhaseStateChanged(game);
    return true;
}
