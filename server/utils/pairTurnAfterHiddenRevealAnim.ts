import * as types from '../../types/index.js';
import { advancePairTurn, isPairClassicGame } from '../../shared/utils/pairGameTurn.js';
import { schedulePairAiTurnIfNeeded } from './pairAiTurnSchedule.js';

/**
 * 페어 클래식: hidden_reveal_animating에서 pendingCapture 해소 후
 * `currentPlayer`만 흑/백 토글하면 pairGame 턴 인덱스와 어긋나 AI가 멈춘다.
 * standard.ts의 advancePairTurnAfterAction + schedulePairAiTurnIfNeeded와 동일한 효과.
 */
export function applyPairTurnAfterHiddenRevealCaptureResolved(
    game: types.LiveGameSession,
    now: number,
    preserveTurnAfterOpponentHiddenReveal: boolean,
    playerWhoMoved: types.Player
): void {
    if (!isPairClassicGame(game.settings, game.mode)) return;

    if (preserveTurnAfterOpponentHiddenReveal) {
        game.currentPlayer = playerWhoMoved;
    } else {
        const nextSeat = advancePairTurn(game.settings);
        if (nextSeat) {
            game.currentPlayer = nextSeat.player;
        }
    }

    schedulePairAiTurnIfNeeded(game, now);
}
