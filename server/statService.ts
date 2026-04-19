

// FIX: Import missing types from the centralized types file.
import { User, CoreStat } from '../types/index.js';
import { calculateUserEffects } from './effectService.js';
import { computeCoreStatFinalFromBonuses } from '../shared/utils/coreStatComposition.js';
import type { StatTotalsContext } from '../shared/utils/totalStatsContext.js';
import { extraCorePercentAllStatsFromSpecials } from '../shared/utils/totalStatsContext.js';

const CORE_STAT_CAP = 1500;

// This function is moved from the client to the server.
export const calculateTotalStats = (
    user: User | null | undefined,
    context: StatTotalsContext = 'default'
): Record<CoreStat, number> => {
    const finalStats: Record<CoreStat, number> = {} as any;
    
    if (!user) {
        // Return all zeros if user is null/undefined
        for (const key of Object.values(CoreStat)) {
            finalStats[key] = 0;
        }
        return finalStats;
    }
    
    // 1. Start with base stats and spent points
    const baseWithSpent: Record<CoreStat, number> = {} as any;
    for (const key of Object.values(CoreStat)) {
        baseWithSpent[key] = (user.baseStats?.[key] || 0) + (user.spentStatPoints?.[key] || 0);
    }

    // 2. Get equipment bonuses from effect service
    const effects = calculateUserEffects(user);
    const bonuses = effects.coreStatBonuses;
    const contextualAllCorePct = extraCorePercentAllStatsFromSpecials(effects.specialStatBonuses, context);

    // 3. Calculate final stats
    for (const key of Object.values(CoreStat)) {
        const baseValue = baseWithSpent[key];
        const bonus = bonuses[key] || { flat: 0, percent: 0 };
        const flatBonus = Number(bonus.flat) || 0;
        const percentBonus = (Number(bonus.percent) || 0) + contextualAllCorePct;
        const finalValue = computeCoreStatFinalFromBonuses(baseValue, flatBonus, percentBonus);
        finalStats[key] = Math.min(CORE_STAT_CAP, Math.max(0, finalValue));
    }
    
    return finalStats;
};