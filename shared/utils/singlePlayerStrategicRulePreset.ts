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
    if (p && p !== 'auto') return p === 'survival' && (stage.survivalTurns ?? 0) > 0;
    return stage.survivalTurns !== undefined && stage.survivalTurns > 0;
};

export const resolveSinglePlayerHasAutoScoringTurns = (stage: SinglePlayerStageInfo): boolean => {
    const p = stage.strategicRulePreset;
    if (p === 'speed') return stage.autoScoringTurns !== undefined;
    if (p && p !== 'auto') return false;
    return stage.autoScoringTurns !== undefined;
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
