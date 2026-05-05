import type { SinglePlayerStageInfo } from '../types/entities.js';
import { getSinglePlayerStages } from '../constants/singlePlayerConstants.js';
import { resolveSinglePlayerAutoScoringTurnCap } from './singlePlayerStrategicRulePreset.js';

/** 싱글 라이브 세션에 대응하는 스테이지 행: 시작 시 스냅샷 → 서버와 동기화된 목록 순 */
export function resolveLiveSessionSinglePlayerStageRow(session: {
    stageId?: string | null;
    singlePlayerStageDisplay?: SinglePlayerStageInfo;
}): SinglePlayerStageInfo | undefined {
    const id = session.stageId;
    if (!id) return undefined;
    const display = session.singlePlayerStageDisplay;
    if (display && display.id === id) {
        return display;
    }
    return getSinglePlayerStages().find((s) => s.id === id);
}

/** 클라이언트에서 자동 계가 한도: settings → 스테이지 스냅샷/목록 (서버와 동일 우선순위) */
export function resolveSinglePlayerAutoScoringCapForClientSession(session: {
    isSinglePlayer?: boolean;
    stageId?: string | null;
    settings?: { autoScoringTurns?: number };
    singlePlayerStageDisplay?: SinglePlayerStageInfo;
}): number | undefined {
    if (!session.isSinglePlayer || !session.stageId) return undefined;
    const row = resolveLiveSessionSinglePlayerStageRow(session);
    return resolveSinglePlayerAutoScoringTurnCap(session.settings as { autoScoringTurns?: number } | undefined, row);
}
