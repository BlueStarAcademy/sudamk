import type { AdventureProfile } from '../types/entities.js';
import { ADVENTURE_STAGES } from '../constants/adventureConstants.js';
import { getAdventureCodexComprehensionLevel } from './adventureCodexComprehension.js';

export type AdventureCodexStageCompletion = {
    stageId: string;
    title: string;
    sumLevels: number;
    maxLevels: number;
    percent: number;
};

/** 각 몬스터 Lv10 = 만점. 전체 합 / (몬스터 수×10) × 100 */
export function getAdventureCodexCompletionBreakdown(profile: AdventureProfile | null | undefined): {
    stages: AdventureCodexStageCompletion[];
    totalSum: number;
    totalMax: number;
    overallPercent: number;
} {
    const counts = profile?.codexDefeatCounts ?? {};
    const stages: AdventureCodexStageCompletion[] = [];
    let totalSum = 0;
    let totalMax = 0;
    for (const s of ADVENTURE_STAGES) {
        const maxLevels = s.monsters.length * 10;
        let sumLevels = 0;
        for (const m of s.monsters) {
            const wins = Math.max(0, Math.floor(Number(counts[m.codexId]) || 0));
            sumLevels += getAdventureCodexComprehensionLevel(wins);
        }
        totalSum += sumLevels;
        totalMax += maxLevels;
        stages.push({
            stageId: s.id,
            title: s.title,
            sumLevels,
            maxLevels,
            percent: maxLevels > 0 ? Math.min(100, (sumLevels / maxLevels) * 100) : 0,
        });
    }
    const overallPercent = totalMax > 0 ? Math.min(100, (totalSum / totalMax) * 100) : 0;
    return { stages, totalSum, totalMax, overallPercent };
}
