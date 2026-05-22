import type { InventoryItem } from '../types/entities.js';
import { isPairPetMaterial } from '../constants/petLobby.js';

export type PairHatcheryClaimClientResponse = {
    updatedUser?: { inventory?: InventoryItem[] };
    obtainedPet?: InventoryItem;
};

/** 부화 수령·즉시 완료 응답에서 새 펫 행 추출 */
export function readObtainedPetFromHatcheryActionResult(
    res: unknown,
    beforePetIds?: ReadonlySet<string>,
): InventoryItem | null {
    const r = res as PairHatcheryClaimClientResponse & {
        clientResponse?: PairHatcheryClaimClientResponse;
        error?: string;
    };
    if (r.error) return null;
    /** `/api/action` 성공 시 `{ success, ...clientResponse }` 평탄화 */
    const obtained = r.obtainedPet ?? r.clientResponse?.obtainedPet;
    if (obtained?.id) return obtained;
    const after = r.updatedUser?.inventory ?? r.clientResponse?.updatedUser?.inventory;
    if (!beforePetIds || !Array.isArray(after)) return null;
    for (const row of after) {
        if (isPairPetMaterial(row) && !beforePetIds.has(row.id)) return row;
    }
    return null;
}

export function collectPairPetInventoryIds(inventory: InventoryItem[] | undefined | null): Set<string> {
    const ids = new Set<string>();
    if (!Array.isArray(inventory)) return ids;
    for (const row of inventory) {
        if (isPairPetMaterial(row) && row.id) ids.add(row.id);
    }
    return ids;
}
