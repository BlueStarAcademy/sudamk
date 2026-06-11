import * as types from '../../types/index.js';
import { GameCategory } from '../../types/enums.js';
import { resolveArenaSessionPolicy } from '../../shared/utils/liveSessionArenaKind.js';
import { isRankedFixedTurnScoringSession } from '../../shared/utils/rankedFixedTurnScoring.js';
import {
    sanitizePvpGameSettings,
    stripHumanPvpTurnLimitFields,
} from '../../shared/utils/sanitizePvpGameSettings.js';

/** human 1v1 전략 PVP (페어·AI·PVE 제외) */
export function isHumanOneVsOnePvpStrategic(game: types.LiveGameSession): boolean {
    if (game.isAiGame || game.isSinglePlayer) return false;
    const policy = resolveArenaSessionPolicy(game);
    return policy.matchAxis === 'pvp' && policy.kind === GameCategory.Normal && !policy.isPairGame;
}

export function applyHumanPvpStrategicSettingsInvariants(game: types.LiveGameSession): void {
    if (!isHumanOneVsOnePvpStrategic(game)) return;
    game.settings = sanitizePvpGameSettings(game.mode, game.settings, { isAiGame: false });
}

export function humanPvpAllowsMoveCountAutoScoring(game: types.LiveGameSession): boolean {
    if (isRankedFixedTurnScoringSession(game)) return true;
    return !isHumanOneVsOnePvpStrategic(game);
}

export function stripNegotiationSettingsForHumanPvp(
    mode: types.GameMode,
    settings: types.GameSettings,
    opponentIsAi: boolean,
): types.GameSettings {
    return sanitizePvpGameSettings(mode, settings, { isAiGame: opponentIsAi });
}

export { stripHumanPvpTurnLimitFields };
