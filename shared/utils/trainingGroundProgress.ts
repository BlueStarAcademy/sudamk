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
import type { TrainingGroundTrack } from '../constants/trainingGround.js';
import {
    TRAINING_GROUND_KATA_LEVELS,
    normalizeTrainingGroundKataLevel,
    trainingGroundStageIndex,
    trainingGroundUnlockTotalAbility,
} from '../constants/trainingGround.js';

export function trainingGroundUserMidgameAbility(
    stats: Partial<Record<CoreStat, number>>,
): number {
    return championshipKataAbilityScore('midgame', stats);
}

export function trainingGroundUserTotalAbility(
    stats: Partial<Record<CoreStat, number>>,
): number {
    return (
        championshipKataAbilityScore('opening', stats) +
        championshipKataAbilityScore('midgame', stats) +
        championshipKataAbilityScore('endgame', stats)
    );
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

export function trainingGroundPetTotalAbility(user: User): number | null {
    const six = pairPetKataStatsSixFromEquippedUser(user);
    if (!six) return null;
    return (
        pairPetKataAbilityScore('opening', six) +
        pairPetKataAbilityScore('midgame', six) +
        pairPetKataAbilityScore('endgame', six)
    );
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
    currentTotalAbility: number | null | undefined,
    stageKata: number,
    track: TrainingGroundTrack,
): boolean {
    if (currentTotalAbility == null || !Number.isFinite(currentTotalAbility)) return false;
    return currentTotalAbility >= trainingGroundUnlockTotalAbility(stageKata, track);
}

export function isTrainingGroundStageCleared(
    clearedLevels: readonly number[] | undefined,
    stageKata: number,
): boolean {
    const kata = normalizeTrainingGroundKataLevel(stageKata);
    if (!Array.isArray(clearedLevels)) return false;
    return clearedLevels.some((level) => normalizeTrainingGroundKataLevel(level) === kata);
}

/** 1단계는 항상 순차 해금. 이후 단계는 직전 단계 클리어 필요. */
export function isTrainingGroundStageUnlockedBySequentialClear(
    clearedLevels: readonly number[] | undefined,
    stageKata: number,
): boolean {
    const stageIndex = trainingGroundStageIndex(stageKata);
    if (stageIndex <= 0) return true;
    const previousKata = TRAINING_GROUND_KATA_LEVELS[stageIndex - 1];
    if (previousKata == null) return true;
    return isTrainingGroundStageCleared(clearedLevels, previousKata);
}

export function canPlayTrainingGroundStage(
    currentTotalAbility: number | null | undefined,
    stageKata: number,
    track: TrainingGroundTrack,
    clearedLevels: readonly number[],
): boolean {
    return (
        isTrainingGroundStageUnlocked(currentTotalAbility, stageKata, track) &&
        isTrainingGroundStageUnlockedBySequentialClear(clearedLevels, stageKata)
    );
}

export function trainingGroundUnlockAbility(
    stageKata: number,
    track: TrainingGroundTrack,
): number {
    return trainingGroundUnlockTotalAbility(stageKata, track);
}
