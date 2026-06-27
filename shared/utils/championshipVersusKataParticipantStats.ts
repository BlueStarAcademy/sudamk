import { CoreStat } from '../types/enums.js';
import type { PairPetCoreStatsSix } from '../constants/pairArena.js';
import { pairPetKataAbilityScore } from '../constants/pairArena.js';
import type { ChampionshipAbilityKataLadderRow } from '../constants/championshipRealMatch.js';
import {
    CHAMPIONSHIP_ABILITY_KATA_LADDER,
    championshipKataLevelForPly,
    CHAMPIONSHIP_REAL_MATCH_RULES_19,
} from '../constants/championshipRealMatch.js';
import { coreStatsRecordToPairPetSix } from './championshipVersusKataResolve.js';

const VERSUS_PAIR_CORE_STAT_CAP = 1500;

/** 펫 6코어 → 챔피언십 KATA와 동일 키(`CoreStat` 문자열) 맵 */
export function pairPetCoreStatsSixToCoreRecord(six: PairPetCoreStatsSix): Record<string, number> {
    return {
        [CoreStat.Concentration]: six.concentration,
        [CoreStat.ThinkingSpeed]: six.thinkingSpeed,
        [CoreStat.Judgment]: six.judgment,
        [CoreStat.Calculation]: six.calculation,
        [CoreStat.CombatPower]: six.combatPower,
        [CoreStat.Stability]: six.stability,
    };
}

/** 페어 챔피언십: 유저(장비) + 대표펫 6코어 합산, 코어당 상한 */
export function mergeChampionshipVersusPairUserPetCoreStats(
    userCore: Record<string, number>,
    petCore: Record<string, number>,
    cap = VERSUS_PAIR_CORE_STAT_CAP,
): Record<string, number> {
    const keys = [
        CoreStat.Concentration,
        CoreStat.ThinkingSpeed,
        CoreStat.Judgment,
        CoreStat.Calculation,
        CoreStat.CombatPower,
        CoreStat.Stability,
    ] as const;
    return Object.fromEntries(
        keys.map((k) => {
            const sum = Math.round((Number(userCore[k]) || 0) + (Number(petCore[k]) || 0));
            return [k, Math.min(cap, sum)];
        }),
    ) as Record<string, number>;
}

export type ChampionshipVersusAbilitySnapshot = {
    totalGoPower: number;
    coreStats: Record<string, number>;
    openingAbility: number;
    midgameAbility: number;
    endgameAbility: number;
};

/** 펫 6코어 — 페어 펫 KATA 가중치(표시용 구간 능력치 점수) */
export function championshipVersusAbilitySnapshotFromPairPetCoreStats(
    stats: Record<string, number>,
): ChampionshipVersusAbilitySnapshot {
    const six = coreStatsRecordToPairPetSix(stats);
    let sum = 0;
    for (const k of Object.keys(stats)) {
        sum += Number(stats[k]) || 0;
    }
    return {
        totalGoPower: Math.round(sum),
        coreStats: { ...stats },
        openingAbility: pairPetKataAbilityScore('opening', six),
        midgameAbility: pairPetKataAbilityScore('midgame', six),
        endgameAbility: pairPetKataAbilityScore('endgame', six),
    };
}

export function championshipVersusAbilitySnapshotFromCoreStats(
    stats: Record<string, number>,
    userAbilityKataLadder: readonly ChampionshipAbilityKataLadderRow[] = CHAMPIONSHIP_ABILITY_KATA_LADDER,
): ChampionshipVersusAbilitySnapshot {
    const rules = CHAMPIONSHIP_REAL_MATCH_RULES_19;
    const oPly = rules.phasePly.opening.to;
    const mPly = rules.phasePly.midgame.to;
    const ePly = rules.phasePly.endgame.to;
    const opening = championshipKataLevelForPly(oPly, stats as any, undefined, userAbilityKataLadder);
    const midgame = championshipKataLevelForPly(mPly, stats as any, undefined, userAbilityKataLadder);
    const endgame = championshipKataLevelForPly(ePly, stats as any, undefined, userAbilityKataLadder);
    let sum = 0;
    for (const k of Object.keys(stats)) {
        sum += Number(stats[k]) || 0;
    }
    return {
        totalGoPower: Math.round(sum),
        coreStats: { ...stats },
        openingAbility: opening.abilityScore,
        midgameAbility: midgame.abilityScore,
        endgameAbility: endgame.abilityScore,
    };
}
