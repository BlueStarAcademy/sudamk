import type { PairPetMeta, User } from '../types/entities.js';
import { getEquippedPairPetInventoryRow } from './pairEquippedPet.js';
import { resolvePairPetMetaFromInventoryRow } from './pairPetRoll.js';

/** 탐험 동행: 장착 펫 kata 레벨 기반 약한 인간 측 flat score (0~3) */
export function adventureCompanionFlatScoreBonusFromPetMeta(meta: Pick<PairPetMeta, 'level'> | null | undefined): number {
    const lv = Math.max(1, Math.floor(Number(meta?.level ?? 1) || 1));
    if (lv >= 40) return 3;
    if (lv >= 25) return 2;
    if (lv >= 10) return 1;
    return 0;
}

export function resolveAdventureCompanionSnapshot(user: User): {
    templateId: string;
    inventoryItemId: string;
    flatScoreBonus: number;
} | null {
    const row = getEquippedPairPetInventoryRow(user);
    if (!row?.templateId) return null;
    const meta = resolvePairPetMetaFromInventoryRow(row);
    return {
        templateId: row.templateId,
        inventoryItemId: row.id,
        flatScoreBonus: adventureCompanionFlatScoreBonusFromPetMeta(meta),
    };
}
