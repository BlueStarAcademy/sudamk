import { SpecialStat } from '../types/enums.js';

/** 코어 능력치 합산 시 장비 특수 옵션 중 맥락별로만 적용할 보너스 */
export type StatTotalsContext = 'default' | 'championshipVenue' | 'guildBoss';

export function extraCorePercentAllStatsFromSpecials(
    specialStatBonuses: Record<SpecialStat, { flat: number; percent: number }>,
    context: StatTotalsContext
): number {
    if (context === 'championshipVenue') {
        return specialStatBonuses[SpecialStat.ChampionshipVenueAllStats]?.percent ?? 0;
    }
    if (context === 'guildBoss') {
        return specialStatBonuses[SpecialStat.GuildBossBattleAllStats]?.percent ?? 0;
    }
    return 0;
}
