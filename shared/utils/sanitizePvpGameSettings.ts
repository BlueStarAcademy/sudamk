import { GameMode, GameSettings } from '../types/index.js';
import {
    applySpeedByoyomiDefaults,
    BASE_STONE_COUNTS,
    CAPTURE_TARGETS,
    DEFAULT_GAME_SETTINGS,
    getAiScoringTurnLimitByBoardSize,
    getStrategicBoardSizesByMode,
    HIDDEN_STONE_COUNTS,
    MISSILE_COUNTS,
    SCAN_COUNTS,
} from '../constants/gameSettings.js';
import { SPECIAL_GAME_MODES } from '../constants/gameModes.js';

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
};

export function sanitizePvpGameSettings(
    mode: GameMode,
    settings: GameSettings,
    options: SanitizePvpGameSettingsOptions = {},
): GameSettings {
    const { isAiGame = false } = options;
    let next: GameSettings = { ...DEFAULT_GAME_SETTINGS, ...settings };

    const validSizes = getStrategicBoardSizesByMode(mode);
    if (!validSizes.includes(next.boardSize as number)) {
        next.boardSize = validSizes[0] as GameSettings['boardSize'];
    }

    if (mode === GameMode.Base || modeIncludesBaseRuleForSettings(mode, next)) {
        next.komi = 0.5;
        const bs = next.baseStones ?? DEFAULT_GAME_SETTINGS.baseStones ?? 4;
        next.baseStones = BASE_STONE_COUNTS.includes(bs) ? bs : BASE_STONE_COUNTS[0];
    }

    if (mode === GameMode.Speed || modeIncludesSpeedRuleForSettings(mode, next)) {
        next = applySpeedByoyomiDefaults(next);
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

    const captureRule = modeIncludesCaptureRuleForSettings(mode, next);
    if (captureRule) {
        next = stripHumanPvpTurnLimitFields(next);
    }

    const isStrategic = SPECIAL_GAME_MODES.some((m) => m.mode === mode);
    if (isStrategic && !isAiGame) {
        next = stripHumanPvpTurnLimitFields(next);
    } else if (isStrategic && isAiGame && !captureRule) {
        const scoringTurnLimit = next.scoringTurnLimit;
        if (typeof scoringTurnLimit !== 'number' || !Number.isFinite(scoringTurnLimit) || scoringTurnLimit <= 0) {
            next.scoringTurnLimit = getAiScoringTurnLimitByBoardSize(next.boardSize ?? 19);
        }
        delete (next as { autoScoringTurns?: number }).autoScoringTurns;
    }

    return next;
}
