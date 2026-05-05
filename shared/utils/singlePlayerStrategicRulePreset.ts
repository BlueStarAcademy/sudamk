import type { SinglePlayerStageInfo, SinglePlayerStrategicRulePreset } from '../types/entities.js';
import { GameMode } from '../types/enums.js';

export type { SinglePlayerStrategicRulePreset };

/** 기존 스테이지 필드 조합으로 서버가 쓰던 `GameMode` 추론 (targetScore 객체는 항상 truthy이므로 `targetScore` 단독 조건은 쓰지 않음) */
export const inferLegacySinglePlayerGameMode = (stage: SinglePlayerStageInfo): GameMode => {
    const isSpeedTime = stage.timeControl?.type === 'fischer';
    if (stage.hiddenCount !== undefined) return GameMode.Hidden;
    if (stage.missileCount !== undefined) return GameMode.Missile;
    if (stage.autoScoringTurns !== undefined) return GameMode.Speed;
    // targetScore 객체는 항상 있어 truthy — 기존 서버와 동일하게 유지
    if (stage.blackTurnLimit !== undefined || stage.targetScore) return GameMode.Capture;
    if (isSpeedTime) return GameMode.Speed;
    return GameMode.Standard;
};

/** UI 기본값·표시용: `strategicRulePreset`이 없거나 auto일 때의 규칙 프리셋 */
export const inferSinglePlayerStrategicRulePreset = (stage: SinglePlayerStageInfo): Exclude<SinglePlayerStrategicRulePreset, 'auto'> => {
    const p = stage.strategicRulePreset;
    if (p && p !== 'auto') {
        if (p === 'survival' && (!stage.survivalTurns || stage.survivalTurns <= 0)) return 'capture';
        return p as Exclude<SinglePlayerStrategicRulePreset, 'auto'>;
    }
    const mode = inferLegacySinglePlayerGameMode(stage);
    if (mode === GameMode.Hidden) return 'hidden';
    if (mode === GameMode.Missile) return 'missile';
    if (mode === GameMode.Speed) return 'speed';
    if (mode === GameMode.Standard) return 'classic';
    if (mode === GameMode.Capture && stage.survivalTurns != null && stage.survivalTurns > 0) return 'survival';
    return 'capture';
};

export const resolveSinglePlayerStrategicGameMode = (stage: SinglePlayerStageInfo): GameMode => {
    const p = stage.strategicRulePreset;
    if (!p || p === 'auto') return inferLegacySinglePlayerGameMode(stage);
    switch (p) {
        case 'classic':
            return GameMode.Standard;
        case 'capture':
        case 'survival':
            return GameMode.Capture;
        case 'speed':
            return GameMode.Speed;
        case 'base':
            return GameMode.Base;
        case 'hidden':
            return GameMode.Hidden;
        case 'missile':
            return GameMode.Missile;
        case 'mix':
            return GameMode.Mix;
        default:
            return inferLegacySinglePlayerGameMode(stage);
    }
};

export const resolveSinglePlayerSpeedTimeMode = (stage: SinglePlayerStageInfo): boolean => {
    const p = stage.strategicRulePreset;
    if (p && p !== 'auto') return p === 'speed';
    return stage.timeControl?.type === 'fischer';
};

export const resolveSinglePlayerSurvivalMode = (stage: SinglePlayerStageInfo): boolean => {
    const p = stage.strategicRulePreset;
    if (p && p !== 'auto') return p === 'survival';
    return stage.survivalTurns !== undefined && stage.survivalTurns > 0;
};

/**
 * 대국 세션 기준 살리기 여부. `settings.isSurvivalMode`가 명시되면 그것만 신뢰한다.
 * (KV는 클래식인데 번들 `SINGLE_PLAYER_STAGES`에만 `survivalTurns`가 남아 있으면 UI가 살리기로 오인하는 것을 막음)
 */
export const resolveSinglePlayerSurvivalModeForSession = (
    session: { settings?: { isSurvivalMode?: boolean; survivalTurns?: number } },
    stage: SinglePlayerStageInfo
): boolean => {
    const explicit = session.settings?.isSurvivalMode;
    if (explicit === false) return false;
    if (explicit === true) return true;
    return resolveSinglePlayerSurvivalMode(stage);
};

/** 살리기 바둑: 백(봇) 턴 한도. `survivalTurns` 우선, 없으면 `blackTurnLimit`, 둘 다 없으면 15. */
export const resolveSinglePlayerSurvivalTurnCount = (stage: SinglePlayerStageInfo): number => {
    const s = Math.max(0, Math.floor(Number(stage.survivalTurns ?? 0)));
    if (s > 0) return s;
    const b = Math.max(0, Math.floor(Number(stage.blackTurnLimit ?? 0)));
    if (b > 0) return b;
    return 15;
};

const pickPositiveAutoScoringTurns = (row?: { autoScoringTurns?: number }): number | undefined => {
    const n = typeof row?.autoScoringTurns === 'number' && Number.isFinite(row.autoScoringTurns) ? Math.floor(row.autoScoringTurns) : undefined;
    return n != null && n > 0 ? n : undefined;
};

export const resolveSinglePlayerHasAutoScoringTurns = (stage: SinglePlayerStageInfo): boolean => {
    if (pickPositiveAutoScoringTurns(stage) == null) return false;
    const p = stage.strategicRulePreset;
    if (!p || p === 'auto') return true;
    if (p === 'capture' || p === 'survival') return false;
    if (p === 'mix') {
        const modes = resolveSinglePlayerMixedModes(stage);
        return !modes.includes(GameMode.Capture);
    }
    // speed, classic, base, hidden, missile — 스테이지에 계가 수가 있으면 대국 settings에 스냅샷한다.
    return true;
};

/**
 * 자동 계가까지 수순 상한. 진행 중 대국은 `settings.autoScoringTurns`(시작 시 스냅샷)를 최우선으로 하고,
 * 없을 때만 스테이지 정의(관리자 KV 등)를 사용한다. 관리자가 스테이지를 나중에 바꿔도 진행 중 경기 한도가 어긋나지 않게 한다.
 */
export const resolveSinglePlayerAutoScoringTurnCap = (
    settings: { autoScoringTurns?: number } | undefined,
    ...stageFallbacks: Array<SinglePlayerStageInfo | undefined>
): number | undefined => {
    const fromSettings = pickPositiveAutoScoringTurns(settings);
    if (fromSettings != null) return fromSettings;
    for (const st of stageFallbacks) {
        const v = pickPositiveAutoScoringTurns(st);
        if (v != null) return v;
    }
    return undefined;
};

const DEFAULT_MIX: GameMode[] = [GameMode.Speed, GameMode.Capture];

export const resolveSinglePlayerMixedModes = (stage: SinglePlayerStageInfo): GameMode[] => {
    const raw = stage.mixedStrategicModes;
    if (Array.isArray(raw) && raw.length >= 2) {
        const allowed = new Set(Object.values(GameMode));
        const cleaned = raw.filter((m): m is GameMode => allowed.has(m as GameMode));
        if (cleaned.length >= 2) return cleaned.slice(0, 5);
    }
    return [...DEFAULT_MIX];
};
