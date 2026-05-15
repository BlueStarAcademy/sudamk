import { getPairTrainingSlotDef } from '../../shared/constants/pairTraining.js';
import type { PairPetMeta, PairPetTrainingPrecomputedRewards } from '../../shared/types/entities.js';
import { trainingSoulBonusQuantityFromMeta } from '../../shared/utils/pairPetArenaApDiscount.js';

function rollInclusive(min: number, max: number, rnd: () => number): number {
    return min + Math.floor(rnd() * (max - min + 1));
}

function trainingGoldMultiplier(meta: PairPetMeta): number {
    return meta.specialization.kind === 'trainingGold' ? 1 + meta.specialization.pct / 100 : 1;
}

function trainingXpMultiplier(meta: PairPetMeta): number {
    return meta.specialization.kind === 'trainingXp' ? 1 + meta.specialization.pct / 100 : 1;
}

/** 영혼석 추가 지급 1차 판정 — `soulDrop` 특화는 슬롯 기본 확률에 N%p 가산 */
function trainingSoulChance(meta: PairPetMeta, baseChance: number): number {
    const extra = meta.specialization.kind === 'soulDrop' ? meta.specialization.pct / 100 : 0;
    return Math.min(0.999, Math.max(0, baseChance + extra));
}

function rollSoulDropForSlot(
    slotIndex: number,
    meta: PairPetMeta,
    rnd: () => number,
): { materialName: string; quantity: number } | null {
    const def = getPairTrainingSlotDef(slotIndex);
    if (!def) return null;
    const p = trainingSoulChance(meta, def.soulDropChance);
    if (rnd() >= p) return null;
    const table = def.soulTable;
    const totalW = table.reduce((s, r) => s + r.weight, 0);
    if (totalW <= 0) return null;
    let t = rnd() * totalW;
    for (const row of table) {
        t -= row.weight;
        if (t <= 0) return { materialName: row.materialName, quantity: row.quantity };
    }
    const last = table[table.length - 1]!;
    return { materialName: last.materialName, quantity: last.quantity };
}

/**
 * 수련 1회분 보상 롤(시작 시 저장하거나, 구세션은 수령 시에만 호출).
 */
export function rollPairPetTrainingRewards(
    slotIndex: number,
    metaForBonuses: PairPetMeta,
    rnd: () => number = () => Math.random(),
): PairPetTrainingPrecomputedRewards | null {
    const def = getPairTrainingSlotDef(slotIndex);
    if (!def) return null;

    const goldRoll = rollInclusive(def.goldMin, def.goldMax, rnd);
    const goldMult = trainingGoldMultiplier(metaForBonuses);
    const goldGain = Math.max(0, Math.floor(goldRoll * goldMult));
    const goldFromSpec = Math.max(0, goldGain - goldRoll);

    const xpRoll = rollInclusive(def.xpMin, def.xpMax, rnd);
    const xpMult = trainingXpMultiplier(metaForBonuses);
    const xpGain = Math.max(0, Math.floor(xpRoll * xpMult));
    const xpFromSpec = Math.max(0, xpGain - xpRoll);

    const soulBase = rollSoulDropForSlot(slotIndex, metaForBonuses, rnd);
    const soulQtyBonus = trainingSoulBonusQuantityFromMeta(metaForBonuses);
    const soulDrop = soulBase
        ? {
              materialName: soulBase.materialName,
              quantity: soulBase.quantity + soulQtyBonus,
          }
        : null;

    return {
        goldRoll,
        goldGain,
        goldFromSpec,
        xpRoll,
        xpGain,
        xpFromSpec,
        soulDrop,
    };
}
