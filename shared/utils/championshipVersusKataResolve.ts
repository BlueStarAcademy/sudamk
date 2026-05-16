import { CoreStat } from '../types/enums.js';
import type { ChampionshipAbilityKataLadderRow, ChampionshipKataPhase, ChampionshipRealMatchRules } from '../constants/championshipRealMatch.js';
import { championshipKataLevelForPly } from '../constants/championshipRealMatch.js';
import type { PairPetAbilityKataLadderRow, PairPetCoreStatsSix, PairPetKataPhase } from '../constants/pairArena.js';
import {
    DEFAULT_PAIR_PET_ABILITY_KATA_LADDER,
    pairPetKataAbilityScore,
    pairPetKataLevelFromAbilityScoreWithLadder,
    pairPetKataPhaseFromTotalPly,
} from '../constants/pairArena.js';
import type { PairGameTurnSeat } from './pairGameTurn.js';

export type ChampionshipVersusKataConfig =
    | { mode: 'userOnly'; userLadder: readonly ChampionshipAbilityKataLadderRow[] }
    | { mode: 'petOnly'; pairPetLadder: readonly PairPetAbilityKataLadderRow[] }
    | {
          mode: 'petPairSplit';
          userLadder: readonly ChampionshipAbilityKataLadderRow[];
          pairPetLadder: readonly PairPetAbilityKataLadderRow[];
          userCoreByUserId: Record<string, Record<string, number>>;
          petSixByUserId: Record<string, PairPetCoreStatsSix>;
      };

export function coreStatsRecordToPairPetSix(core: Record<string, number>): PairPetCoreStatsSix {
    return {
        concentration: Math.round(Number(core[CoreStat.Concentration]) || 0),
        thinkingSpeed: Math.round(Number(core[CoreStat.ThinkingSpeed]) || 0),
        judgment: Math.round(Number(core[CoreStat.Judgment]) || 0),
        calculation: Math.round(Number(core[CoreStat.Calculation]) || 0),
        combatPower: Math.round(Number(core[CoreStat.CombatPower]) || 0),
        stability: Math.round(Number(core[CoreStat.Stability]) || 0),
    };
}

export type VersusKataLevelResolveResult = {
    kataLevel: number;
    abilityScore: number;
    phase: ChampionshipKataPhase | PairPetKataPhase;
};

/** 장내 챔피언십 한 수(ply)의 KATA 레벨 — 유저/펫 사다리 분리 */
export function resolveChampionshipVersusKataForPly(params: {
    ply: number;
    boardSize: number;
    rules: ChampionshipRealMatchRules;
    config: ChampionshipVersusKataConfig;
    actorUserId: string;
    actorStats: Record<string, number>;
    seat: Pick<PairGameTurnSeat, 'kind'> | null;
}): VersusKataLevelResolveResult {
    const { ply, boardSize, rules, config, actorUserId, actorStats, seat } = params;

    if (config.mode === 'petOnly') {
        const six = coreStatsRecordToPairPetSix(actorStats);
        const phase = pairPetKataPhaseFromTotalPly(boardSize, ply);
        const abilityScore = pairPetKataAbilityScore(phase, six);
        const kataLevel = pairPetKataLevelFromAbilityScoreWithLadder(abilityScore, config.pairPetLadder);
        return { kataLevel, abilityScore, phase };
    }

    if (config.mode === 'petPairSplit' && seat?.kind === 'pet') {
        const six = config.petSixByUserId[actorUserId];
        if (six) {
            const phase = pairPetKataPhaseFromTotalPly(boardSize, ply);
            const abilityScore = pairPetKataAbilityScore(phase, six);
            const kataLevel = pairPetKataLevelFromAbilityScoreWithLadder(abilityScore, config.pairPetLadder);
            return { kataLevel, abilityScore, phase };
        }
    }

    if (config.mode === 'petPairSplit' && seat?.kind === 'user') {
        const userCore = config.userCoreByUserId[actorUserId] ?? actorStats;
        const levelInfo = championshipKataLevelForPly(ply, userCore as Partial<Record<CoreStat, number>>, rules, config.userLadder);
        return { kataLevel: levelInfo.kataLevel, abilityScore: levelInfo.abilityScore, phase: levelInfo.phase };
    }

    const userLadder = config.mode === 'userOnly' ? config.userLadder : config.userLadder;
    const levelInfo = championshipKataLevelForPly(
        ply,
        actorStats as Partial<Record<CoreStat, number>>,
        rules,
        userLadder,
    );
    return { kataLevel: levelInfo.kataLevel, abilityScore: levelInfo.abilityScore, phase: levelInfo.phase };
}

/** UI 패널: 블록별(유저/펫) 구간 능력치·KATA 표시 */
export function resolveChampionshipVersusPhaseAbilityDisplay(params: {
    boardSize: number;
    ply: number;
    blockStats: Record<string, number>;
    statKind: 'user' | 'pet';
    rules?: ChampionshipRealMatchRules;
    userLadder: readonly ChampionshipAbilityKataLadderRow[];
    pairPetLadder?: readonly PairPetAbilityKataLadderRow[];
}): VersusKataLevelResolveResult {
    const ladder = params.pairPetLadder ?? DEFAULT_PAIR_PET_ABILITY_KATA_LADDER;
    if (params.statKind === 'pet') {
        const six = coreStatsRecordToPairPetSix(params.blockStats);
        const phase = pairPetKataPhaseFromTotalPly(params.boardSize, params.ply);
        const abilityScore = pairPetKataAbilityScore(phase, six);
        const kataLevel = pairPetKataLevelFromAbilityScoreWithLadder(abilityScore, ladder);
        return { kataLevel, abilityScore, phase };
    }
    const rules = params.rules;
    if (!rules) {
        const phase = pairPetKataPhaseFromTotalPly(params.boardSize, params.ply) as ChampionshipKataPhase;
        return { kataLevel: -30, abilityScore: 0, phase };
    }
    const levelInfo = championshipKataLevelForPly(params.ply, params.blockStats as Partial<Record<CoreStat, number>>, rules, params.userLadder);
    return { kataLevel: levelInfo.kataLevel, abilityScore: levelInfo.abilityScore, phase: levelInfo.phase };
}
