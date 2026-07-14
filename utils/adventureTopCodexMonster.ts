import { getAdventureCodexMonsterById, getAdventureMonsterPortraitUrl } from '../constants/adventureMonstersCodex.js';
import type { AdventureProfile } from '../types/entities.js';
import { getAdventureCodexComprehensionLevel } from './adventureCodexComprehension.js';
import { normalizeAdventureProfile } from './adventureUnderstanding.js';

export type AdventureTopCodexMonster = {
    codexId: string;
    name: string;
    imageWebp: string;
    wins: number;
    comprehensionLevel: number;
};

/** 도감 승리 수 최다 몬스터 — 동점 시 현재 승리 수에 먼저 도달한 순 */
export function getTopAdventureCodexMonsterByWins(
    profile: AdventureProfile | null | undefined,
): AdventureTopCodexMonster | null {
    const p = normalizeAdventureProfile(profile);
    const counts = p.codexDefeatCounts ?? {};
    const reachedAt = p.codexDefeatCountReachedAtByCodexId ?? {};

    let bestCodexId: string | null = null;
    let bestWins = 0;
    let bestReachedAt = Number.MAX_SAFE_INTEGER;

    for (const [codexId, rawWins] of Object.entries(counts)) {
        const wins = Math.max(0, Math.floor(rawWins ?? 0));
        if (wins <= 0) continue;
        const at =
            typeof reachedAt[codexId] === 'number' && Number.isFinite(reachedAt[codexId])
                ? reachedAt[codexId]!
                : Number.MAX_SAFE_INTEGER;

        if (wins > bestWins || (wins === bestWins && at < bestReachedAt)) {
            bestWins = wins;
            bestCodexId = codexId;
            bestReachedAt = at;
        } else if (wins === bestWins && at === bestReachedAt && bestCodexId != null && codexId < bestCodexId) {
            bestCodexId = codexId;
        }
    }

    if (!bestCodexId || bestWins <= 0) return null;
    const entry = getAdventureCodexMonsterById(bestCodexId);
    if (!entry) return null;

    return {
        codexId: bestCodexId,
        name: entry.name,
        imageWebp: getAdventureMonsterPortraitUrl(entry),
        wins: bestWins,
        comprehensionLevel: getAdventureCodexComprehensionLevel(bestWins),
    };
}
