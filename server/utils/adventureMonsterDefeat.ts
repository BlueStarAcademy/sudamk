import type { User } from '../../types/index.js';
import { getAdventureStageById } from '../../constants/adventureConstants.js';
import { isAdventureChapterBossCodexId } from '../../constants/adventureMonstersCodex.js';
import {
    adventureMapSuppressKey,
    getAdventureMapSuppressUntilAfterDefeat,
} from '../../shared/utils/adventureMapSchedule.js';
import { getAdventureCodexIdSet } from '../../utils/adventureCodexComprehension.js';
import { normalizeAdventureProfile } from '../../utils/adventureUnderstanding.js';
import * as effectService from '../effectService.js';

const ALLOWED_MODES = new Set(['classic', 'capture', 'base', 'hidden', 'missile']);

/** RECORD / 배틀 시작 공통: 도감·스테이지·룰 검증. 오류 시 한글 메시지 반환 */
export function assertValidAdventureMonsterRef(params: {
    codexId?: string;
    stageId?: string;
    battleMode?: string;
}): string | null {
    const { codexId, stageId, battleMode } = params;
    if (!codexId || !stageId || !battleMode) {
        return '잘못된 요청입니다.';
    }
    if (!getAdventureCodexIdSet().has(codexId)) {
        return '알 수 없는 도감 몬스터입니다.';
    }
    const stage = getAdventureStageById(stageId);
    if (!stage || !stage.monsters.some((m) => m.codexId === codexId)) {
        return '스테이지와 몬스터가 일치하지 않습니다.';
    }
    if (!ALLOWED_MODES.has(battleMode)) {
        return '잘못된 경기 종류입니다.';
    }
    return null;
}

export function parseAdventureMonsterLevel(raw: unknown): number | null {
    const lv = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : NaN;
    if (!Number.isFinite(lv) || lv < 1 || lv > 99) {
        return null;
    }
    return Math.min(50, lv);
}

export function applyAdventureMonsterDefeatToProfile(
    user: User,
    params: { codexId: string; stageId: string; battleMode: string },
): void {
    const { codexId, stageId, battleMode } = params;
    const prev = normalizeAdventureProfile(user.adventureProfile);
    const counts = { ...(prev.codexDefeatCounts ?? {}) };
    counts[codexId] = (counts[codexId] ?? 0) + 1;

    const byMode = { ...(prev.monstersDefeatedByMode ?? {}) };
    byMode[battleMode] = (byMode[battleMode] ?? 0) + 1;

    const uniq = new Set(prev.uniqueMonsterIdsCaught ?? []);
    uniq.add(codexId);

    const uxp = { ...(prev.understandingXpByStage ?? {}) };
    uxp[stageId] = (uxp[stageId] ?? 0) + 12;

    const defeatAt = Date.now();
    const isBoss = isAdventureChapterBossCodexId(codexId);
    const suppressUntil = getAdventureMapSuppressUntilAfterDefeat(defeatAt, stageId, codexId, isBoss);
    const suppressKey = adventureMapSuppressKey(stageId, codexId);
    const adventureMapSuppressUntilByKey = { ...(prev.adventureMapSuppressUntilByKey ?? {}) };
    adventureMapSuppressUntilByKey[suppressKey] = suppressUntil;

    user.adventureProfile = {
        ...prev,
        codexDefeatCounts: counts,
        monstersDefeatedByMode: byMode,
        monstersDefeatedTotal: (prev.monstersDefeatedTotal ?? 0) + 1,
        uniqueMonsterIdsCaught: Array.from(uniq),
        understandingXpByStage: uxp,
        lastPlayedStageId: stageId,
        adventureMapSuppressUntilByKey,
    };

    try {
        effectService.syncActionPointsStateAfterEquipmentChange(user);
    } catch {
        /* ignore */
    }
}

/** 플레이어 패배 시: 도감/보상 없이 맵에서만 다음 출현까지 숨김(승리 시 처치 억제와 동일한 스케줄) */
export function applyAdventureMonsterMapSuppressAfterPlayerLoss(
    user: User,
    params: { codexId: string; stageId: string },
): void {
    const { codexId, stageId } = params;
    const prev = normalizeAdventureProfile(user.adventureProfile);
    const isBoss = isAdventureChapterBossCodexId(codexId);
    const at = Date.now();
    const suppressUntil = getAdventureMapSuppressUntilAfterDefeat(at, stageId, codexId, isBoss);
    const suppressKey = adventureMapSuppressKey(stageId, codexId);
    const adventureMapSuppressUntilByKey = { ...(prev.adventureMapSuppressUntilByKey ?? {}) };
    adventureMapSuppressUntilByKey[suppressKey] = suppressUntil;
    user.adventureProfile = {
        ...prev,
        adventureMapSuppressUntilByKey,
    };
}
