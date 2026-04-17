
// FIX: Import missing types from the centralized types file.
import { User, CoreStat, InventoryItem, SpecialStat, MythicStat } from '../types/index.js';
import { calculateUserEffects } from './effectService.js';
import { computeCoreStatFinalFromBonuses } from '../shared/utils/coreStatComposition.js';

const CORE_STAT_CAP = 1500;

// This function is moved from the client to the server.
export const calculateTotalStats = (user: User): Record<CoreStat, number> => {
    const finalStats: Record<CoreStat, number> = {} as any;
    
    // 1. Start with base stats and spent points
    const baseWithSpent: Record<CoreStat, number> = {} as any;
    for (const key of Object.values(CoreStat)) {
        baseWithSpent[key] = (user.baseStats?.[key] || 0) + (user.spentStatPoints?.[key] || 0);
    }

    // 2. Get equipment bonuses from effect service
    const effects = calculateUserEffects(user);
    const bonuses = effects.coreStatBonuses;

    // 3. Calculate final stats
    for (const key of Object.values(CoreStat)) {
        const baseValue = baseWithSpent[key];
        const bonus = bonuses[key] || { flat: 0, percent: 0 };
        const flatBonus = Number(bonus.flat) || 0;
        const percentBonus = Number(bonus.percent) || 0;
        const finalValue = computeCoreStatFinalFromBonuses(baseValue, flatBonus, percentBonus);
        finalStats[key] = Math.min(CORE_STAT_CAP, Math.max(0, finalValue));
    }
    
    return finalStats;
};