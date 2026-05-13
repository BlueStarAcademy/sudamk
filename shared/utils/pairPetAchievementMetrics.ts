import type { InventoryItem, User } from '../types/entities.js';
import { isPairEggItem, isPairPetMaterial } from '../constants/petLobby.js';
import { effectivePairPetGradeFromRow, PAIR_PET_MAX_LEVEL, pairPetGradeIndex } from '../constants/pairPetGrade.js';
import { resolvePairPetMetaFromInventoryRow } from './pairPetRoll.js';

/** 로비 인벤의 펫(알 제외) 중 최고 레벨 — 업적 진행 표시용 */
export function getMaxPairPetLevelAcrossInventory(user: Pick<User, 'inventory'>): number {
    let max = 0;
    for (const it of user.inventory ?? []) {
        if (!isPairPetMaterial(it) || isPairEggItem(it) || (it.quantity ?? 0) < 1) continue;
        const meta = resolvePairPetMetaFromInventoryRow(it as InventoryItem);
        const lv = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(meta.level) || 1));
        max = Math.max(max, lv);
    }
    return max;
}

/** 보유 펫 중 최고 등급 인덱스 (`pairPetGradeIndex`) — 업적 진행 표시용 */
export function getMaxPairPetGradeIndexAcrossInventory(user: Pick<User, 'inventory'>): number {
    let maxIdx = 0;
    for (const it of user.inventory ?? []) {
        if (!isPairPetMaterial(it) || isPairEggItem(it) || (it.quantity ?? 0) < 1) continue;
        const g = effectivePairPetGradeFromRow(it as InventoryItem);
        maxIdx = Math.max(maxIdx, pairPetGradeIndex(g));
    }
    return maxIdx;
}
