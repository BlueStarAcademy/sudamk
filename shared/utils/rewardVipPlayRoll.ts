export type VipBoxTier = 0 | 1 | 2 | 3;

export type VipPlayRewardRollOutcome =
    | { type: 'gold'; amount: number }
    | { type: 'equipment_box'; tier: VipBoxTier }
    | { type: 'material_box'; tier: VipBoxTier }
    | { type: 'legendary_equipment' };

const LEGENDARY_CHANCE = 0.001;

/** 재료 상자 I~IV: 60% / 25% / 10% / 5% */
function rollMaterialBoxTier(): VipBoxTier {
    const t = Math.random();
    if (t < 0.6) return 0;
    if (t < 0.85) return 1;
    if (t < 0.95) return 2;
    return 3;
}

/** 장비 상자 III~VI: 65% / 30% / 4.9% / 0.1% (`tier` 0=III … 3=VI) */
function rollEquipmentBoxTier(): VipBoxTier {
    const t = Math.random();
    if (t < 0.65) return 0;
    if (t < 0.95) return 1;
    if (t < 0.999) return 2;
    return 3;
}

function rollGoldAmount(): number {
    return Math.floor(Math.random() * 901) + 100;
}

/** 전략·놀이(및 동일 정책) 보상 VIP: 인벤토리 상자·전설 장비 없이 골드 보너스만. */
export function rollVipPlayRewardOutcomeGoldOnly(): VipPlayRewardRollOutcome {
    return { type: 'gold', amount: rollGoldAmount() };
}

/**
 * 보상 VIP 슬롯: 전설 장비 0.1%, 나머지는 골드(100~1000) / 장비상자 분기 / 재료상자 분기 균등.
 * 장비 상자: III 65% / IV 30% / V 4.9% / VI 0.1%.
 * 재료 상자: I 60% / II 25% / III 10% / IV 5%.
 * (전략·놀이 바둑 등은 호출부에서 {@link rollVipPlayRewardOutcomeGoldOnly}를 쓴다.)
 */
export function rollVipPlayRewardOutcome(): VipPlayRewardRollOutcome {
    if (Math.random() < LEGENDARY_CHANCE) {
        return { type: 'legendary_equipment' };
    }
    const nonLegendary = 1 - LEGENDARY_CHANCE;
    const third = nonLegendary / 3;
    const branch = Math.random() * nonLegendary;
    if (branch < third) {
        return { type: 'gold', amount: rollGoldAmount() };
    }
    if (branch < third * 2) {
        return { type: 'equipment_box', tier: rollEquipmentBoxTier() };
    }
    return { type: 'material_box', tier: rollMaterialBoxTier() };
}
