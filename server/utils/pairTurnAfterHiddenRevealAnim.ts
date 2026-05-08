import * as types from '../../types/index.js';
import { GameCategory } from '../../types/enums.js';
import {
    advancePairTurn,
    getCurrentPairTurnSeat,
    isPairAiSeat,
    isPairClassicGame,
} from '../../shared/utils/pairGameTurn.js';
import { PVE_STRATEGIC_SERVER_AI_POST_HUMAN_DELAY_MS } from '../constants/pveStrategicAiSchedule.js';

const STRATEGIC_GO_SERVER_AI_MODES: types.GameMode[] = [
    types.GameMode.Standard,
    types.GameMode.Capture,
    types.GameMode.Speed,
    types.GameMode.Base,
    types.GameMode.Hidden,
    types.GameMode.Missile,
    types.GameMode.Mix,
];

function nextAiTurnStartTimeAfterHumanStrategicMove(game: types.LiveGameSession, now: number): number {
    const isGo = STRATEGIC_GO_SERVER_AI_MODES.includes(game.mode);
    if (
        game.isAiGame &&
        !game.isSinglePlayer &&
        isGo &&
        (game.gameCategory === GameCategory.Adventure || game.gameCategory === GameCategory.GuildWar)
    ) {
        return now + PVE_STRATEGIC_SERVER_AI_POST_HUMAN_DELAY_MS;
    }
    return now;
}

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

    const seat = getCurrentPairTurnSeat(game.settings);
    if (isPairAiSeat(seat)) {
        game.aiTurnStartTime = nextAiTurnStartTimeAfterHumanStrategicMove(game, now);
    } else {
        game.aiTurnStartTime = undefined;
    }
}
