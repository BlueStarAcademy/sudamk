import { GameMode } from '../types/enums.js';
import type { GameSettings } from '../types/entities.js';
import { clampGameInt } from './gameIntegerField.js';

/** 전략·페어 「AI와 대결」 방 설정: 히든 아이템 고정 개수 */
export const AI_LOBBY_HIDDEN_ITEM_FIXED = 1;
/** 스캔·미사일 아이템 상한(4개 이상 불가 → 최대 3) */
export const AI_LOBBY_SCAN_MAX = 3;
export const AI_LOBBY_MISSILE_MAX = 3;
/** AI와 대결하기(`clampAiLobbyStrategicItemCaps`): 덤 정수부 허용 구간 (UI는 N + 0.5 집). 베이스 모드는 덤 입찰용으로 별도라 클램프 제외 */
export const AI_LOBBY_KOMI_MIN_INTEGER = 3;
export const AI_LOBBY_KOMI_MAX_INTEGER = 8;

function modeUsesHiddenRule(mode: GameMode, settings: Pick<GameSettings, 'mixedModes'>): boolean {
    return mode === GameMode.Hidden || (mode === GameMode.Mix && Boolean(settings.mixedModes?.includes(GameMode.Hidden)));
}

function modeUsesMissileRule(mode: GameMode, settings: Pick<GameSettings, 'mixedModes'>): boolean {
    return mode === GameMode.Missile || (mode === GameMode.Mix && Boolean(settings.mixedModes?.includes(GameMode.Missile)));
}

/**
 * 전략 대기실 AI 대국·페어 경기장 AI 대결 방에서 히든/스캔/미사일 아이템 상한을 적용한다.
 */
export function clampAiLobbyStrategicItemCaps(mode: GameMode, settings: GameSettings): GameSettings {
    const next: GameSettings = { ...settings };
    if (modeUsesHiddenRule(mode, next)) {
        next.hiddenStoneCount = AI_LOBBY_HIDDEN_ITEM_FIXED;
        next.scanCount = clampGameInt(next.scanCount ?? 5, { min: 0, max: AI_LOBBY_SCAN_MAX });
    }
    if (modeUsesMissileRule(mode, next)) {
        next.missileCount = clampGameInt(next.missileCount ?? 5, { min: 0, max: AI_LOBBY_MISSILE_MAX });
    }
    const rawKomi = Number(next.komi);
    if (mode !== GameMode.Base && Number.isFinite(rawKomi)) {
        const intPart = Math.floor(rawKomi);
        next.komi = clampGameInt(intPart, { min: AI_LOBBY_KOMI_MIN_INTEGER, max: AI_LOBBY_KOMI_MAX_INTEGER }) + 0.5;
    }
    return next;
}
