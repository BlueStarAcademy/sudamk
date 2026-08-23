import { CoreStat } from '../types/enums.js';
import type { User } from '../types/entities.js';
import type { ChampionshipAbilityKataLadderRow } from '../constants/championshipRealMatch.js';
import {
    CHAMPIONSHIP_ABILITY_KATA_LADDER,
    championshipKataAbilityScore,
    championshipKataLevelFromAbilityScore,
} from '../constants/championshipRealMatch.js';
import type { PairPetAbilityKataLadderRow } from '../constants/pairArena.js';
import {
    DEFAULT_PAIR_PET_ABILITY_KATA_LADDER,
    pairPetKataAbilityScore,
    pairPetKataLevelFromAbilityScoreWithLadder,
} from '../constants/pairArena.js';
import { pairPetKataStatsSixFromEquippedUser } from './pairPetKataStatsFromEquippedUser.js';
import { minAbilityScoreForKataLevel, normalizeTrainingGroundKataLevel } from '../constants/trainingGround.js';

export function trainingGroundUserMidgameAbility(
    stats: Partial<Record<CoreStat, number>>,
): number {
    return championshipKataAbilityScore('midgame', stats);
}

export function trainingGroundUserKataLevel(
    stats: Partial<Record<CoreStat, number>>,
    ladder: readonly ChampionshipAbilityKataLadderRow[] = CHAMPIONSHIP_ABILITY_KATA_LADDER,
): number {
    return normalizeTrainingGroundKataLevel(championshipKataLevelFromAbilityScore(trainingGroundUserMidgameAbility(stats), ladder));
}

export function trainingGroundPetMidgameAbility(user: User): number | null {
    const six = pairPetKataStatsSixFromEquippedUser(user);
    if (!six) return null;
    return pairPetKataAbilityScore('midgame', six);
}

export function trainingGroundPetKataLevel(
    user: User,
    ladder: readonly PairPetAbilityKataLadderRow[] = DEFAULT_PAIR_PET_ABILITY_KATA_LADDER,
): number | null {
    const ability = trainingGroundPetMidgameAbility(user);
    if (ability == null) return null;
    return normalizeTrainingGroundKataLevel(pairPetKataLevelFromAbilityScoreWithLadder(ability, ladder));
}

export function isTrainingGroundStageUnlocked(
    currentKata: number | null | undefined,
    stageKata: number,
): boolean {
    if (currentKata == null || !Number.isFinite(currentKata)) return false;
    return normalizeTrainingGroundKataLevel(currentKata) >= normalizeTrainingGroundKataLevel(stageKata);
}

export function trainingGroundUnlockAbility(
    stageKata: number,
    ladder: readonly { minAbilityScore: number; kataLevel?: number; kataLevelOffset?: number }[],
): number {
    return minAbilityScoreForKataLevel(stageKata, ladder);
}
