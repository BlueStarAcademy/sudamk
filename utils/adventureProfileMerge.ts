import type { AdventureProfile } from '../types/entities.js';
import { getAdventureHuntingScore } from '../shared/utils/adventureHuntingScore.js';
import { normalizeAdventureProfile } from './adventureUnderstanding.js';

/**
 * 모험 프로필 저장·클라이언트 상태 병합 공통.
 * 지역 특화 효과(regionalSpecialtyBuffsByStageId)는 스테이지 키 단위로만 덮어써서
 * 한 지역 변경 시 다른 지역 배열이 통째로 사라지지 않게 한다.
 */
export function mergeAdventureProfileForPersistence(
    incoming: AdventureProfile | null | undefined,
    existing: AdventureProfile | null | undefined,
): AdventureProfile | undefined {
    if (!incoming && !existing) return undefined;
    if (!incoming) return existing ?? undefined;
    if (!existing) return incoming;

    const next = normalizeAdventureProfile(incoming);
    const prev = normalizeAdventureProfile(existing);

    const mergedCodexDefeatCounts = { ...(prev.codexDefeatCounts ?? {}) } as Record<string, number>;
    for (const [codexId, wins] of Object.entries(next.codexDefeatCounts ?? {})) {
        const prevWins = Math.max(0, Math.floor(mergedCodexDefeatCounts[codexId] ?? 0));
        const nextWins = Math.max(0, Math.floor(wins ?? 0));
        mergedCodexDefeatCounts[codexId] = Math.max(prevWins, nextWins);
    }

    const mergedCodexDefeatCountReachedAtByCodexId = {
        ...(prev.codexDefeatCountReachedAtByCodexId ?? {}),
    } as Record<string, number>;
    const allCodexIds = new Set([
        ...Object.keys(prev.codexDefeatCounts ?? {}),
        ...Object.keys(next.codexDefeatCounts ?? {}),
    ]);
    for (const codexId of allCodexIds) {
        const prevWins = Math.max(0, Math.floor(prev.codexDefeatCounts?.[codexId] ?? 0));
        const nextWins = Math.max(0, Math.floor(next.codexDefeatCounts?.[codexId] ?? 0));
        const mergedWins = Math.max(0, Math.floor(mergedCodexDefeatCounts[codexId] ?? 0));
        if (mergedWins <= 0) {
            delete mergedCodexDefeatCountReachedAtByCodexId[codexId];
            continue;
        }
        const prevAt = prev.codexDefeatCountReachedAtByCodexId?.[codexId];
        const nextAt = next.codexDefeatCountReachedAtByCodexId?.[codexId];
        if (nextWins > prevWins && typeof nextAt === 'number' && Number.isFinite(nextAt)) {
            mergedCodexDefeatCountReachedAtByCodexId[codexId] = nextAt;
        } else if (prevWins > nextWins && typeof prevAt === 'number' && Number.isFinite(prevAt)) {
            mergedCodexDefeatCountReachedAtByCodexId[codexId] = prevAt;
        } else if (typeof prevAt === 'number' && typeof nextAt === 'number') {
            mergedCodexDefeatCountReachedAtByCodexId[codexId] = Math.min(prevAt, nextAt);
        } else if (typeof nextAt === 'number' && Number.isFinite(nextAt)) {
            mergedCodexDefeatCountReachedAtByCodexId[codexId] = nextAt;
        } else if (typeof prevAt === 'number' && Number.isFinite(prevAt)) {
            mergedCodexDefeatCountReachedAtByCodexId[codexId] = prevAt;
        }
    }

    const mergedUnderstandingXpByStage = { ...(prev.understandingXpByStage ?? {}) } as Record<string, number>;
    for (const [stageId, xp] of Object.entries(next.understandingXpByStage ?? {})) {
        const prevXp = Math.max(0, Math.floor(mergedUnderstandingXpByStage[stageId] ?? 0));
        const nextXp = Math.max(0, Math.floor(xp ?? 0));
        mergedUnderstandingXpByStage[stageId] = Math.max(prevXp, nextXp);
    }

    const mergedSuppressUntilByKey = { ...(prev.adventureMapSuppressUntilByKey ?? {}) } as Record<string, number>;
    for (const [key, until] of Object.entries(next.adventureMapSuppressUntilByKey ?? {})) {
        const prevUntil = Math.max(0, Math.floor(mergedSuppressUntilByKey[key] ?? 0));
        const nextUntil = Math.max(0, Math.floor(until ?? 0));
        mergedSuppressUntilByKey[key] = Math.max(prevUntil, nextUntil);
    }

    const mergedByMode = { ...(prev.monstersDefeatedByMode ?? {}) } as Record<string, number>;
    for (const [mode, n] of Object.entries(next.monstersDefeatedByMode ?? {})) {
        const prevN = Math.max(0, Math.floor(mergedByMode[mode] ?? 0));
        const nextN = Math.max(0, Math.floor(n ?? 0));
        mergedByMode[mode] = Math.max(prevN, nextN);
    }

    const mergedRegionalSpecialtyBuffsByStageId: Record<string, unknown> = {
        ...(prev.regionalSpecialtyBuffsByStageId ?? {}),
    };
    for (const [stageId, entries] of Object.entries(next.regionalSpecialtyBuffsByStageId ?? {})) {
        mergedRegionalSpecialtyBuffsByStageId[stageId] = Array.isArray(entries)
            ? entries.map((entry) => {
                  if (entry == null) return null;
                  if (typeof entry !== 'object') return null;
                  return { ...(entry as Record<string, unknown>) };
              })
            : [];
    }

    const mergedRegionalBuffEnhancePointsByStageId = {
        ...(prev.regionalBuffEnhancePointsByStageId ?? {}),
    } as Record<string, number>;
    for (const [stageId, pts] of Object.entries(next.regionalBuffEnhancePointsByStageId ?? {})) {
        if (typeof pts === 'number' && Number.isFinite(pts)) {
            mergedRegionalBuffEnhancePointsByStageId[stageId] = Math.floor(pts);
        }
    }

    const mergedUniqueMonsterIdsCaught = Array.from(
        new Set([...(prev.uniqueMonsterIdsCaught ?? []), ...(next.uniqueMonsterIdsCaught ?? [])]),
    );

    const prevHunt = getAdventureHuntingScore(prev);
    const nextHunt = getAdventureHuntingScore(next);
    let huntingScoreTotal = prevHunt.score;
    let huntingScoreReachedAt = prev.huntingScoreReachedAt;
    if (nextHunt.score > prevHunt.score) {
        huntingScoreTotal = nextHunt.score;
        huntingScoreReachedAt = next.huntingScoreReachedAt ?? prev.huntingScoreReachedAt;
    } else if (nextHunt.score === prevHunt.score && nextHunt.score > 0) {
        const prevAt = prev.huntingScoreReachedAt ?? Number.MAX_SAFE_INTEGER;
        const nextAt = next.huntingScoreReachedAt ?? Number.MAX_SAFE_INTEGER;
        huntingScoreReachedAt = Math.min(prevAt, nextAt);
    }

    return {
        ...prev,
        ...next,
        codexDefeatCounts: mergedCodexDefeatCounts,
        codexDefeatCountReachedAtByCodexId: mergedCodexDefeatCountReachedAtByCodexId,
        understandingXpByStage: mergedUnderstandingXpByStage,
        adventureMapSuppressUntilByKey: mergedSuppressUntilByKey,
        monstersDefeatedByMode: mergedByMode,
        monstersDefeatedTotal: Math.max(
            Math.max(0, Math.floor(prev.monstersDefeatedTotal ?? 0)),
            Math.max(0, Math.floor(next.monstersDefeatedTotal ?? 0)),
        ),
        uniqueMonsterIdsCaught: mergedUniqueMonsterIdsCaught,
        huntingScoreTotal,
        huntingScoreReachedAt,
        regionalSpecialtyBuffsByStageId:
            mergedRegionalSpecialtyBuffsByStageId as AdventureProfile['regionalSpecialtyBuffsByStageId'],
        regionalBuffEnhancePointsByStageId: mergedRegionalBuffEnhancePointsByStageId,
    };
}
