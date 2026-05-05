import type { User } from '../types/entities.js';
import type { PairPetCoreStatsSix } from '../constants/pairArena.js';
import { ItemGrade } from '../types/enums.js';
import { getEquippedPairPetInventoryRow } from './pairEquippedPet.js';
import { resolvePairPetMetaFromInventoryRow } from './pairPetRoll.js';
import { effectivePairPetGradeFromRow } from '../constants/pairPetGrade.js';
import { computePairPetKataCoreStatsSixFromMeta } from './pairPetKataStatsFromMeta.js';

/** 전략바둑 대표펫 힌트·KATA 레벨 산출용 — 장착 펫이 없으면 null */
export function pairPetKataStatsSixFromEquippedUser(user: User): PairPetCoreStatsSix | null {
    const row = getEquippedPairPetInventoryRow(user);
    if (!row) return null;
    const meta = resolvePairPetMetaFromInventoryRow(row);
    const grade = effectivePairPetGradeFromRow(row) ?? ItemGrade.Normal;
    return computePairPetKataCoreStatsSixFromMeta(meta, grade);
}
