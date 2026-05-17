import { ItemGrade } from '../types/enums.js';
import type { InventoryItem, PairPetMeta, PairPetTrainingPrecomputedRewards } from '../types/entities.js';
import type { PairTrainingClaimClientSummary } from '../types/pairTrainingClaim.js';
import { getPairPetDefinition } from '../constants/petLobby.js';
import {
    PAIR_PET_MAX_LEVEL,
    effectivePairPetGradeFromRow,
    pairPetXpGainBlockedByGrade,
} from '../constants/pairPetGrade.js';
import { getPairPetXpRequirementForLevel } from './strategyLevelXp.js';
import { resolvePairPetMetaFromInventoryRow } from './pairPetRoll.js';

/** 수련 보상 XP만 반영한 레벨·바 진행(레벨업 코어 롤 없음 — 서버 `applyPairPetXp`와 바 수치는 동일) */
export function simulatePairPetXpBarAfterGain(
    metaBefore: PairPetMeta,
    rawGain: number,
    grade: ItemGrade,
): {
    oldLevel: number;
    finalLevel: number;
    initialXp: number;
    finalXp: number;
    initialXpForBar: number;
    safeMax: number;
} {
    const oldLevel = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(metaBefore.level) || 1));
    const initialXp = Math.max(0, Math.floor(metaBefore.xp ?? 0));
    let level = oldLevel;
    let xp = initialXp;
    let gain = Math.max(0, Math.floor(rawGain));

    while (gain > 0 && level < PAIR_PET_MAX_LEVEL) {
        if (pairPetXpGainBlockedByGrade(grade, level)) {
            xp = 0;
            break;
        }
        const need = getPairPetXpRequirementForLevel(level);
        if (!Number.isFinite(need) || need <= 0) break;
        const room = need - xp;
        if (room <= 0) {
            level += 1;
            xp = 0;
            continue;
        }
        const take = Math.min(room, gain);
        xp += take;
        gain -= take;
        if (xp >= need) {
            level += 1;
            xp = 0;
        }
    }

    if (pairPetXpGainBlockedByGrade(grade, level)) xp = 0;
    const finalLevel = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, level));
    const finalXp = finalLevel >= PAIR_PET_MAX_LEVEL ? 0 : Math.max(0, xp);
    const maxXpForInitialLevel = getPairPetXpRequirementForLevel(oldLevel);
    const leveledUp = finalLevel > oldLevel;
    const maxXpForBar = leveledUp ? getPairPetXpRequirementForLevel(finalLevel) : maxXpForInitialLevel;
    const initialXpForBar = leveledUp ? 0 : initialXp;
    const safeMax =
        Number.isFinite(maxXpForBar) && maxXpForBar > 0
            ? maxXpForBar
            : leveledUp
              ? 1
              : Number.isFinite(maxXpForInitialLevel) && maxXpForInitialLevel > 0
                ? maxXpForInitialLevel
                : 100;

    return {
        oldLevel,
        finalLevel,
        initialXp,
        finalXp,
        initialXpForBar,
        safeMax,
    };
}

/** 수련 시작 시 확정된 `precomputedRewards`로 클라이언트 결과 모달 요약을 즉시 만든다. */
export function buildPairTrainingClaimSummaryFromPrecomputed(
    petRow: InventoryItem,
    pre: PairPetTrainingPrecomputedRewards,
): PairTrainingClaimClientSummary {
    const { goldRoll, goldGain, goldFromSpec, xpRoll, xpGain, xpFromSpec, soulDrop } = pre;
    const metaBefore = resolvePairPetMetaFromInventoryRow(petRow);
    const grade = effectivePairPetGradeFromRow(petRow);
    const bar = simulatePairPetXpBarAfterGain(metaBefore, xpGain, grade);
    const petDisplayName = petRow.templateId
        ? (getPairPetDefinition(petRow.templateId)?.displayName ?? petRow.name)
        : petRow.name;

    return {
        goldGain,
        goldBase: goldRoll,
        goldFromSpecialization: goldFromSpec,
        xpGain,
        xpBase: xpRoll,
        xpFromSpecialization: xpFromSpec,
        soulDrop,
        petImage: petRow.image ?? null,
        petDisplayName: petDisplayName ?? null,
        pairPetXp: { change: xpGain },
        pairPetLevel: {
            initial: bar.oldLevel,
            final: bar.finalLevel,
            progress: {
                initial: bar.initialXpForBar,
                final: bar.finalXp,
                max: bar.safeMax,
            },
        },
    };
}
