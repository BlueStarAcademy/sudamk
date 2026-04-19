export type VipBoxTier = 0 | 1 | 2 | 3;

export type VipPlayRewardRollOutcome =
    | { type: 'gold'; amount: number }
    | { type: 'equipment_box'; tier: VipBoxTier }
    | { type: 'material_box'; tier: VipBoxTier }
    | { type: 'legendary_equipment' };

const LEGENDARY_CHANCE = 0.001;

function rollBoxTier(): VipBoxTier {
    const t = Math.random();
    if (t < 0.6) return 0;
    if (t < 0.85) return 1;
    if (t < 0.95) return 2;
    return 3;
}

function rollGoldAmount(): number {
    return Math.floor(Math.random() * 901) + 100;
}

/**
 * 보상 VIP 슬롯: 전설 장비 0.1%, 나머지는 골드(100~1000) / 장비상자 분기 / 재료상자 분기 균등.
 * 장비·재료 상자는 각각 I~IV가 60% / 25% / 10% / 5%.
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
        return { type: 'equipment_box', tier: rollBoxTier() };
    }
    return { type: 'material_box', tier: rollBoxTier() };
}
