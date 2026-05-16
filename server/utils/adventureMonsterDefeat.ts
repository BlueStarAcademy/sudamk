import type { User, AdventureProfile } from '../../types/index.js';
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
import {
    bumpAdventureHuntingScoreOnDefeat,
    reduceAdventureHuntingScoreOnLoss,
} from '../../shared/utils/adventureHuntingScore.js';
import { bumpAdventureMapKeyProgressOnMonsterDefeat } from './adventureMapKeysAndTreasure.js';

const ALLOWED_MODES = new Set(['classic', 'capture', 'base', 'hidden', 'missile', 'speed']);

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

export async function applyAdventureMonsterDefeatToProfile(
    user: User,
    params: { codexId: string; stageId: string; battleMode: string; monsterLevel?: number },
): Promise<void> {
    const { codexId, stageId, battleMode, monsterLevel } = params;
    const prev = normalizeAdventureProfile(user.adventureProfile);
    const defeatAt = Date.now();
    const counts = { ...(prev.codexDefeatCounts ?? {}) };
    counts[codexId] = (counts[codexId] ?? 0) + 1;
    const codexDefeatCountReachedAtByCodexId = { ...(prev.codexDefeatCountReachedAtByCodexId ?? {}) };
    codexDefeatCountReachedAtByCodexId[codexId] = defeatAt;

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

    const parsedMonsterLevel =
        typeof monsterLevel === 'number' && Number.isFinite(monsterLevel)
            ? parseAdventureMonsterLevel(monsterLevel)
            : null;
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

    let nextProfile: AdventureProfile = {
        ...prev,
        codexDefeatCounts: counts,
        codexDefeatCountReachedAtByCodexId,
        monstersDefeatedByMode: byMode,
        monstersDefeatedTotal: (prev.monstersDefeatedTotal ?? 0) + 1,
        uniqueMonsterIdsCaught: Array.from(uniq),
        understandingXpByStage: uxp,
        lastPlayedStageId: stageId,
        adventureMapSuppressUntilByKey,
    } as AdventureProfile;
    if (parsedMonsterLevel != null) {
        nextProfile = bumpAdventureHuntingScoreOnDefeat(nextProfile, parsedMonsterLevel, defeatAt);
    }
    nextProfile = applyRegionalSpecialtyBuffTierGrants(
        nextProfile,
        stageId,
        understandingXpBefore,
        understandingXpAfter,
    );
    user.adventureProfile = nextProfile;
    bumpAdventureMapKeyProgressOnMonsterDefeat(user, stageId, { isBoss });

    try {
        await effectService.syncActionPointsStateAfterEquipmentChange(user);
    } catch {
        /* ignore */
    }
}

/** 플레이어 패배 시: 맵 억제, 모드별 패배·놓침 전적, 사냥 점수 감점 */
export function applyAdventureMonsterBattleLossToProfile(
    user: User,
    params: { codexId: string; stageId: string; battleMode?: string | null; monsterLevel?: number },
): void {
    const { codexId, stageId, battleMode, monsterLevel } = params;
    const prev = normalizeAdventureProfile(user.adventureProfile);
    const isBoss = isAdventureChapterBossCodexId(codexId);
    const at = Date.now();
    const mapDwellMult = getRegionalMapMonsterDwellMultiplierForStage(prev, stageId);
    const mapOffMult = getRegionalMapMonsterRespawnOffMultiplierForStage(prev, stageId);
    const suppressUntil = getAdventureMapSuppressUntilAfterDefeat(at, stageId, codexId, isBoss, mapDwellMult, mapOffMult);
    const suppressKey = adventureMapSuppressKey(stageId, codexId);
    const adventureMapSuppressUntilByKey = { ...(prev.adventureMapSuppressUntilByKey ?? {}) };
    adventureMapSuppressUntilByKey[suppressKey] = suppressUntil;

    let nextProfile: AdventureProfile = {
        ...prev,
        adventureMapSuppressUntilByKey,
        lastPlayedStageId: stageId,
    };

    if (battleMode && ALLOWED_MODES.has(battleMode)) {
        const missedByMode = { ...(prev.monstersMissedByMode ?? {}) };
        missedByMode[battleMode] = (missedByMode[battleMode] ?? 0) + 1;
        nextProfile = {
            ...nextProfile,
            monstersMissedByMode: missedByMode,
            monstersMissedTotal: (prev.monstersMissedTotal ?? 0) + 1,
        };
    }

    const parsedMonsterLevel =
        typeof monsterLevel === 'number' && Number.isFinite(monsterLevel)
            ? parseAdventureMonsterLevel(monsterLevel)
            : null;
    if (parsedMonsterLevel != null) {
        nextProfile = reduceAdventureHuntingScoreOnLoss(nextProfile, parsedMonsterLevel);
    }

    user.adventureProfile = nextProfile;
}

/** @deprecated `applyAdventureMonsterBattleLossToProfile` 사용 */
export function applyAdventureMonsterMapSuppressAfterPlayerLoss(
    user: User,
    params: { codexId: string; stageId: string },
): void {
    applyAdventureMonsterBattleLossToProfile(user, params);
}
