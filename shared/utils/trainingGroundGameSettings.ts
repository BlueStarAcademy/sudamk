import { GameMode } from '../types/enums.js';
import type { GameSettings } from '../types/entities.js';
import {
    DEFAULT_GAME_SETTINGS,
    getAiScoringTurnLimitByBoardSize,
    getDefaultChessKomiByBoardSize,
    getDefaultChessPieceTotalScore,
    getStrategicBoardSizesByMode,
    clampChessPieceTotalScore,
    clampChessScoringTurnLimit,
} from '../constants/gameSettings.js';
import {
    SPECIAL_GAME_MODES,
    filterPlayableLobbyGameModes,
    type LobbyGameModeDefinition,
} from '../constants/gameModes.js';
import {
    clampTrainingGroundBoardSize,
    isTrainingGroundKataLevel,
    isTrainingGroundSession,
    trainingGroundFixedKataLevel,
    type TrainingGroundBoardSize,
    type TrainingGroundGameMeta,
    type TrainingGroundTrack,
} from '../constants/trainingGround.js';
import { sanitizePairLobbyDraftModeSettings } from './pairLobbyGameSettingRows.js';
import { sanitizePvpGameSettings } from './sanitizePvpGameSettings.js';
import { clampAiLobbyStrategicItemCaps } from './strategicAiLobbyItemCaps.js';
import { mixIncludesCastle, mixIncludesChess } from './mixModeSettings.js';

const TRAINING_GROUND_NINETEEN_LINE = 19;

/** `trainingGround.kataLevel` → Kata `/move.level` 권위값 (40단계 고정 ladder) */
export function resolveTrainingGroundKataLevelFromSession(
    game: { settings?: GameSettings | null },
): number | undefined {
    if (!isTrainingGroundSession(game)) return undefined;
    const meta = game.settings?.trainingGround;
    if (!meta || typeof meta.kataLevel !== 'number' || !Number.isFinite(meta.kataLevel)) return undefined;
    const kataLevel = trainingGroundFixedKataLevel(meta.kataLevel);
    if (!isTrainingGroundKataLevel(kataLevel)) return undefined;
    if (game.settings && typeof game.settings === 'object') {
        game.settings.kataServerLevel = kataLevel;
        game.settings.trainingGround = { ...meta, kataLevel };
        delete (game.settings as { goAiBotLevel?: number }).goAiBotLevel;
        delete (game.settings as { aiDifficulty?: number }).aiDifficulty;
    }
    return kataLevel;
}

/** 훈련장 심법·단짝 수련에서 선택 가능한 게임 모드 (표시 순서) */
export const TRAINING_GROUND_SELECTABLE_GAME_MODE_ORDER: readonly GameMode[] = [
    GameMode.Standard,
    GameMode.Speed,
    GameMode.Capture,
    GameMode.Base,
    GameMode.Hidden,
    GameMode.Missile,
];

function modeIncludesCaptureRule(mode: GameMode, settings: Pick<GameSettings, 'mixedModes'>): boolean {
    return mode === GameMode.Capture || (mode === GameMode.Mix && Boolean(settings.mixedModes?.includes(GameMode.Capture)));
}

function normalizeTrainingGroundScoringTurnLimit(mode: GameMode, settings: GameSettings): GameSettings {
    if (!SPECIAL_GAME_MODES.some((m) => m.mode === mode)) return settings;
    const chessRule = mode === GameMode.Chess || mixIncludesChess(settings.mixedModes);
    const castleRule = mode === GameMode.Castle || mixIncludesCastle(settings.mixedModes);
    if (modeIncludesCaptureRule(mode, settings) || (castleRule && !chessRule)) {
        const next = { ...settings, scoringTurnLimit: 0 };
        delete (next as { autoScoringTurns?: number }).autoScoringTurns;
        if (!chessRule) return next;
        const bs = (next.boardSize === 9 ? 9 : 13) as GameSettings['boardSize'];
        return {
            ...next,
            boardSize: bs,
            komi: getDefaultChessKomiByBoardSize(bs),
            scoringTurnLimit: 0,
            chessPieceTotalScore: clampChessPieceTotalScore(
                next.chessPieceTotalScore ?? getDefaultChessPieceTotalScore(bs),
                bs,
            ),
        };
    }
    if (chessRule) {
        const bs = (settings.boardSize === 9 ? 9 : 13) as GameSettings['boardSize'];
        return {
            ...settings,
            boardSize: bs,
            komi: getDefaultChessKomiByBoardSize(bs),
            scoringTurnLimit: clampChessScoringTurnLimit(settings.scoringTurnLimit, bs),
            chessPieceTotalScore: clampChessPieceTotalScore(
                settings.chessPieceTotalScore ?? getDefaultChessPieceTotalScore(bs),
                bs,
            ),
        };
    }
    return {
        ...settings,
        scoringTurnLimit: getAiScoringTurnLimitByBoardSize(settings.boardSize || DEFAULT_GAME_SETTINGS.boardSize),
    };
}

/** 훈련장에서 선택 가능한 전략 게임 모드 */
export function trainingGroundSelectableGameModes(): LobbyGameModeDefinition[] {
    const playable = filterPlayableLobbyGameModes(SPECIAL_GAME_MODES);
    const byMode = new Map(playable.map((entry) => [entry.mode, entry]));
    return TRAINING_GROUND_SELECTABLE_GAME_MODE_ORDER.map((mode) => byMode.get(mode)).filter(
        (entry): entry is LobbyGameModeDefinition => Boolean(entry),
    );
}

export function trainingGroundModeSupportsNineteenLine(mode: GameMode): boolean {
    return getStrategicBoardSizesByMode(mode).includes(TRAINING_GROUND_NINETEEN_LINE);
}

/** @deprecated {@link trainingGroundSelectableGameModes} */
export function trainingGroundNineteenLineGameModes(): LobbyGameModeDefinition[] {
    return trainingGroundSelectableGameModes();
}

export function isTrainingGroundGameMode(mode: unknown): mode is GameMode {
    return typeof mode === 'string' && trainingGroundSelectableGameModes().some((entry) => entry.mode === mode);
}

export function isTrainingGroundModeCompatibleWithBoard(
    mode: GameMode,
    boardSize: TrainingGroundBoardSize,
): boolean {
    return getStrategicBoardSizesByMode(mode).includes(boardSize);
}

export function resolveTrainingGroundGameMode(raw: unknown): GameMode {
    if (isTrainingGroundGameMode(raw)) return raw;
    return GameMode.Standard;
}

export function buildTrainingGroundGameSettings(
    mode: GameMode,
    track: TrainingGroundTrack,
    kataLevel: number,
    boardSizeInput: unknown,
): GameSettings {
    const boardSize = clampTrainingGroundBoardSize(boardSizeInput);
    const fixedKataLevel = trainingGroundFixedKataLevel(kataLevel);
    const trainingGround: TrainingGroundGameMeta = { track, kataLevel: fixedKataLevel, boardSize, gameMode: mode };

    let settings: GameSettings = {
        ...DEFAULT_GAME_SETTINGS,
        boardSize,
        timeLimit: 0,
        byoyomiTime: 0,
        byoyomiCount: 0,
        timeIncrement: 0,
        kataServerLevel: fixedKataLevel,
        useClientSideAi: false,
        trainingGround,
    };
    if (mode === GameMode.Base) {
        settings.komi = 0.5;
    }

    settings = sanitizePairLobbyDraftModeSettings(mode, settings, 'strategic');
    settings = sanitizePvpGameSettings(mode, settings, { isAiGame: true });
    settings = clampAiLobbyStrategicItemCaps(mode, normalizeTrainingGroundScoringTurnLimit(mode, settings));
    settings.trainingGround = trainingGround;
    delete (settings as { pairGame?: unknown }).pairGame;
    delete (settings as { goAiBotLevel?: number }).goAiBotLevel;
    delete (settings as { aiDifficulty?: number }).aiDifficulty;
    return settings;
}

/** CONFIRM_AI_GAME_START 등에서 `DEFAULT_GAME_SETTINGS` 병합 전에 모드·룰 필드를 복구한다. */
export function refreshTrainingGroundLiveSessionSettings(
    game: { mode: GameMode; settings?: GameSettings | null },
): void {
    const meta = game.settings?.trainingGround;
    if (!meta) return;

    const resolvedMode =
        meta.gameMode && isTrainingGroundGameMode(meta.gameMode) ? meta.gameMode : game.mode;
    const fixedKataLevel = trainingGroundFixedKataLevel(meta.kataLevel);
    const rebuilt = buildTrainingGroundGameSettings(
        resolvedMode,
        meta.track,
        fixedKataLevel,
        meta.boardSize,
    );

    game.mode = resolvedMode;
    const preserved = game.settings ?? {};
    game.settings = {
        ...rebuilt,
        ...preserved,
        trainingGround: {
            ...meta,
            kataLevel: fixedKataLevel,
            gameMode: resolvedMode,
            boardSize: clampTrainingGroundBoardSize(rebuilt.boardSize ?? meta.boardSize),
        },
        boardSize: rebuilt.boardSize,
        hiddenStoneCount: rebuilt.hiddenStoneCount,
        scanCount: rebuilt.scanCount,
        missileCount: rebuilt.missileCount,
        captureTarget: rebuilt.captureTarget,
        baseStones: rebuilt.baseStones,
        scoringTurnLimit: rebuilt.scoringTurnLimit,
        komi: rebuilt.komi,
        timeLimit: rebuilt.timeLimit,
        byoyomiTime: rebuilt.byoyomiTime,
        byoyomiCount: rebuilt.byoyomiCount,
        timeIncrement: rebuilt.timeIncrement,
        kataServerLevel: fixedKataLevel,
        useClientSideAi: false,
    };
    delete (game.settings as { goAiBotLevel?: number }).goAiBotLevel;
    delete (game.settings as { aiDifficulty?: number }).aiDifficulty;
}
