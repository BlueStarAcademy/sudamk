import { GameMode, GameSettings } from '../types/index.js';
import {
    normalizeMainTimeControl,
    normalizeSpeedMainTimeControl,
    BASE_STONE_COUNTS,
    CAPTURE_TARGETS,
    CASTLE_BOARD_SIZES,
    CHESS_BOARD_SIZES,
    clampCastleCount,
    getDefaultCastleCountByBoardSize,
    DEFAULT_GAME_SETTINGS,
    getAiScoringTurnLimitByBoardSize,
    getDefaultChessKomiByBoardSize,
    getDefaultChessScoringTurnLimit,
    clampChessScoringTurnLimit,
    clampChessPieceTotalScore,
    getDefaultChessPieceTotalScore,
    getStrategicBoardSizesByMode,
    HIDDEN_STONE_COUNTS,
    MISSILE_COUNTS,
    SCAN_COUNTS,
} from '../constants/gameSettings.js';
import { SPECIAL_GAME_MODES } from '../constants/gameModes.js';
import { getRankedGameSettings } from '../constants/rankedGameSettings.js';
import { applyMixModeSettingsConstraints, getMixBoardSizeOptions, mixIncludesCastle, mixIncludesChess } from './mixModeSettings.js';

export function modeIncludesCaptureRuleForSettings(
    mode: GameMode,
    settings: Pick<GameSettings, 'mixedModes'>,
): boolean {
    return mode === GameMode.Capture || (mode === GameMode.Mix && Boolean(settings.mixedModes?.includes(GameMode.Capture)));
}

export function modeIncludesBaseRuleForSettings(
    mode: GameMode,
    settings: Pick<GameSettings, 'mixedModes'>,
): boolean {
    return mode === GameMode.Base || (mode === GameMode.Mix && Boolean(settings.mixedModes?.includes(GameMode.Base)));
}

export function modeIncludesSpeedRuleForSettings(
    mode: GameMode,
    settings: Pick<GameSettings, 'mixedModes'>,
): boolean {
    return mode === GameMode.Speed || (mode === GameMode.Mix && Boolean(settings.mixedModes?.includes(GameMode.Speed)));
}

/** human PVP: 수 제한 자동계가 금지 — 상호 패스만 계가 */
export function stripHumanPvpTurnLimitFields(settings: GameSettings): GameSettings {
    const next = { ...settings, scoringTurnLimit: 0 };
    delete (next as { autoScoringTurns?: number }).autoScoringTurns;
    return next;
}

export type SanitizePvpGameSettingsOptions = {
    isAiGame?: boolean;
    isRanked?: boolean;
};

export function sanitizePvpGameSettings(
    mode: GameMode,
    settings: GameSettings,
    options: SanitizePvpGameSettingsOptions = {},
): GameSettings {
    const { isAiGame = false, isRanked = false } = options;

    if (mode === GameMode.Castle && isRanked) {
        return { ...getRankedGameSettings(GameMode.Castle) };
    }

    if (mode === GameMode.Chess && isRanked) {
        return { ...getRankedGameSettings(GameMode.Chess) };
    }

    let next: GameSettings = { ...DEFAULT_GAME_SETTINGS, ...settings };

    if (mode === GameMode.Mix) {
        next = applyMixModeSettingsConstraints(next);
    }

    const validSizes =
        mode === GameMode.Mix ? getMixBoardSizeOptions(next.mixedModes) : getStrategicBoardSizesByMode(mode);
    if (!validSizes.includes(next.boardSize as number)) {
        next.boardSize = validSizes[0] as GameSettings['boardSize'];
    }

    if (mode === GameMode.Base || modeIncludesBaseRuleForSettings(mode, next)) {
        next.komi = 0.5;
        const bs = next.baseStones ?? DEFAULT_GAME_SETTINGS.baseStones ?? 4;
        next.baseStones = BASE_STONE_COUNTS.includes(bs) ? bs : BASE_STONE_COUNTS[0];
    }

    if (mode === GameMode.Speed || modeIncludesSpeedRuleForSettings(mode, next)) {
        next = normalizeSpeedMainTimeControl(next);
    } else if ((next.timeIncrement ?? 0) > 0) {
        next = normalizeMainTimeControl(next);
    } else if ((next.timeLimit ?? 0) > 0 || ((next.byoyomiCount ?? 0) > 0 && (next.byoyomiTime ?? 0) > 0)) {
        next = { ...next, timeIncrement: 0 };
    }

    if (mode === GameMode.Capture || modeIncludesCaptureRuleForSettings(mode, next)) {
        const target = next.captureTarget ?? 20;
        next.captureTarget = CAPTURE_TARGETS.includes(target) ? target : 20;
    }

    if (mode === GameMode.Hidden || (mode === GameMode.Mix && next.mixedModes?.includes(GameMode.Hidden))) {
        const h = next.hiddenStoneCount ?? 1;
        next.hiddenStoneCount = HIDDEN_STONE_COUNTS.includes(h) ? h : HIDDEN_STONE_COUNTS[0];
        const s = next.scanCount ?? 1;
        next.scanCount = SCAN_COUNTS.includes(s) ? s : SCAN_COUNTS[0];
    }

    if (mode === GameMode.Missile || (mode === GameMode.Mix && next.mixedModes?.includes(GameMode.Missile))) {
        const m = next.missileCount ?? 1;
        next.missileCount = MISSILE_COUNTS.includes(m) ? m : MISSILE_COUNTS[0];
    }

    const castleRule = mode === GameMode.Castle || mixIncludesCastle(next.mixedModes);
    const chessRule = mode === GameMode.Chess || mixIncludesChess(next.mixedModes);

    if (castleRule) {
        if (!CASTLE_BOARD_SIZES.includes(next.boardSize as number) && mode === GameMode.Castle) {
            next.boardSize = CASTLE_BOARD_SIZES[0] as GameSettings['boardSize'];
        }
        next.castleCount = clampCastleCount(
            next.castleCount ?? getDefaultCastleCountByBoardSize(next.boardSize ?? 13),
            next.boardSize ?? 13,
        );
        if (!chessRule) {
            next = stripHumanPvpTurnLimitFields(next);
        }
    }

    if (chessRule) {
        if (!CHESS_BOARD_SIZES.includes(next.boardSize as number)) {
            next.boardSize = CHESS_BOARD_SIZES[0] as GameSettings['boardSize'];
        }
        next.komi = getDefaultChessKomiByBoardSize(next.boardSize ?? 13);
        next.chessPieceTotalScore = clampChessPieceTotalScore(
            next.chessPieceTotalScore,
            next.boardSize ?? 13,
            isRanked,
        );
        const chessBoard = next.boardSize === 9 ? 9 : 13;
        if (isAiGame) {
            next.scoringTurnLimit = clampChessScoringTurnLimit(next.scoringTurnLimit, chessBoard);
        } else if (!isRanked) {
            next = stripHumanPvpTurnLimitFields(next);
        } else {
            next.scoringTurnLimit = clampChessScoringTurnLimit(next.scoringTurnLimit, chessBoard);
        }
    }

    const captureRule = modeIncludesCaptureRuleForSettings(mode, next);
    if (captureRule) {
        next = stripHumanPvpTurnLimitFields(next);
    }

    const isStrategic = SPECIAL_GAME_MODES.some((m) => m.mode === mode);
    if (isStrategic && !isAiGame && !castleRule) {
        const scoringTurnLimit = next.scoringTurnLimit;
        if (
            typeof scoringTurnLimit === 'number' &&
            Number.isFinite(scoringTurnLimit) &&
            scoringTurnLimit > 0
        ) {
            delete (next as { autoScoringTurns?: number }).autoScoringTurns;
        } else {
            next = stripHumanPvpTurnLimitFields(next);
        }
    } else if (isStrategic && isAiGame && !captureRule && !castleRule) {
        const scoringTurnLimit = next.scoringTurnLimit;
        if (typeof scoringTurnLimit !== 'number' || !Number.isFinite(scoringTurnLimit) || scoringTurnLimit <= 0) {
            next.scoringTurnLimit = chessRule
                ? clampChessScoringTurnLimit(scoringTurnLimit, next.boardSize === 9 ? 9 : 13)
                : getAiScoringTurnLimitByBoardSize(next.boardSize ?? 19);
        }
        delete (next as { autoScoringTurns?: number }).autoScoringTurns;
    } else if (castleRule && !chessRule) {
        next = stripHumanPvpTurnLimitFields(next);
    }

    if (isAiGame) {
        next = {
            ...next,
            timeLimit: 0,
            byoyomiTime: 0,
            byoyomiCount: 0,
            timeIncrement: 0,
        };
    }

    return next;
}
