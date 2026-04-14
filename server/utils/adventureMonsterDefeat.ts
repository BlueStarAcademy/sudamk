import type { User } from '../../types/index.js';
import { getAdventureStageById } from '../../constants/adventureConstants.js';
import { isAdventureChapterBossCodexId } from '../../constants/adventureMonstersCodex.js';
import {
    adventureMapSuppressKey,
    getAdventureMapSuppressUntilAfterDefeat,
} from '../../shared/utils/adventureMapSchedule.js';
import {
    getRegionalMapMonsterDwellMultiplierForStage,
    getRegionalMapMonsterRespawnOffMultiplierForStage,
} from '../../utils/adventureRegionalSpecialtyBuff.js';
import {
    getAdventureCodexComprehensionLevel,
    getAdventureCodexIdSet,
} from '../../utils/adventureCodexComprehension.js';
import { normalizeAdventureProfile } from '../../utils/adventureUnderstanding.js';
import { applyRegionalSpecialtyBuffTierGrants } from '../../utils/adventureRegionalSpecialtyBuff.js';
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
    /** 지역 이해도: 기본 + 해당 몬스터 도감 이해도 레벨(승리 후)만큼 추가 — 도감과 영구 연동 */
    const codexLevelAfter = getAdventureCodexComprehensionLevel(counts[codexId] ?? 0);
    const understandingXpBefore = uxp[stageId] ?? 0;
    uxp[stageId] = understandingXpBefore + 12 + codexLevelAfter;
    const understandingXpAfter = uxp[stageId]!;

    const defeatAt = Date.now();
    const isBoss = isAdventureChapterBossCodexId(codexId);
    const mapDwellMult = getRegionalMapMonsterDwellMultiplierForStage(prev, stageId);
    const mapOffMult = getRegionalMapMonsterRespawnOffMultiplierForStage(prev, stageId);
    const suppressUntil = getAdventureMapSuppressUntilAfterDefeat(
        defeatAt,
        stageId,
        codexId,
        isBoss,
        mapDwellMult,
        mapOffMult,
    );
    const suppressKey = adventureMapSuppressKey(stageId, codexId);
    const adventureMapSuppressUntilByKey = { ...(prev.adventureMapSuppressUntilByKey ?? {}) };
    adventureMapSuppressUntilByKey[suppressKey] = suppressUntil;

    let nextProfile = {
        ...prev,
        codexDefeatCounts: counts,
        monstersDefeatedByMode: byMode,
        monstersDefeatedTotal: (prev.monstersDefeatedTotal ?? 0) + 1,
        uniqueMonsterIdsCaught: Array.from(uniq),
        understandingXpByStage: uxp,
        lastPlayedStageId: stageId,
        adventureMapSuppressUntilByKey,
    };
    nextProfile = applyRegionalSpecialtyBuffTierGrants(nextProfile, stageId, understandingXpBefore, understandingXpAfter);
    user.adventureProfile = nextProfile;

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
    const mapDwellMult = getRegionalMapMonsterDwellMultiplierForStage(prev, stageId);
    const mapOffMult = getRegionalMapMonsterRespawnOffMultiplierForStage(prev, stageId);
    const suppressUntil = getAdventureMapSuppressUntilAfterDefeat(at, stageId, codexId, isBoss, mapDwellMult, mapOffMult);
    const suppressKey = adventureMapSuppressKey(stageId, codexId);
    const adventureMapSuppressUntilByKey = { ...(prev.adventureMapSuppressUntilByKey ?? {}) };
    adventureMapSuppressUntilByKey[suppressKey] = suppressUntil;
    user.adventureProfile = {
        ...prev,
        adventureMapSuppressUntilByKey,
    };
}
