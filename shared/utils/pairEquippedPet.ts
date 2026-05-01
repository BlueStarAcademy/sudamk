import type { InventoryItem, User } from '../types/entities.js';
import { isPairEggItem, isPairPetMaterial } from '../constants/petLobby.js';

/**
 * 대표 펫은 `equippedPairPetTemplateId`만 저장하면 동종 펫이 여러 마리일 때 `inventory.find`가
 * 항상 첫 행을 잡아 등급이 어긋날 수 있음 → `equippedPairPetInventoryItemId`로 정확한 인벤 행을 지정.
 */
export function getEquippedPairPetInventoryRow(
    user: Pick<User, 'inventory' | 'equippedPairPetTemplateId' | 'equippedPairPetInventoryItemId'>
): InventoryItem | null {
    const tid = user.equippedPairPetTemplateId ?? null;
    if (!tid) return null;
    const inv = user.inventory ?? [];
    const markerId = user.equippedPairPetInventoryItemId ?? null;
    if (markerId) {
        const byId = inv.find((it) => it.id === markerId);
        if (
            byId &&
            isPairPetMaterial(byId) &&
            !isPairEggItem(byId) &&
            byId.templateId === tid &&
            (byId.quantity ?? 1) >= 1
        ) {
            return byId;
        }
    }
    return (
        inv.find(
            (it) =>
                isPairPetMaterial(it) &&
                !isPairEggItem(it) &&
                it.templateId === tid &&
                (it.quantity ?? 1) >= 1
        ) ?? null
    );
}

/** 로드·판매·변환 등 인벤 변동 후: 저장된 행이 무효면 같은 종류 다른 행으로 맞추거나 장착 해제 */
export function reconcileEquippedPairPetInventoryItem(user: User): void {
    const tid = user.equippedPairPetTemplateId ?? null;
    if (!tid) {
        user.equippedPairPetInventoryItemId = null;
        return;
    }
    const inv = user.inventory ?? [];
    const curId = user.equippedPairPetInventoryItemId ?? null;
    if (curId) {
        const row = inv.find((it) => it.id === curId);
        if (
            row &&
            isPairPetMaterial(row) &&
            !isPairEggItem(row) &&
            row.templateId === tid &&
            (row.quantity ?? 1) >= 1
        ) {
            return;
        }
    }
    const fb = inv.find(
        (it) =>
            isPairPetMaterial(it) &&
            !isPairEggItem(it) &&
            it.templateId === tid &&
            (it.quantity ?? 1) >= 1
    );
    user.equippedPairPetInventoryItemId = fb?.id ?? null;
    if (!fb) user.equippedPairPetTemplateId = null;
}
