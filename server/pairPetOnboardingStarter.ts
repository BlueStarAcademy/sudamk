import { randomUUID } from 'crypto';
import type { InventoryItem } from '../types/index.js';
import { MATERIAL_ITEMS } from '../constants/index.js';
import {
    PAIR_EGG_MATERIAL_NAME,
    PAIR_EGG_TEMPLATE_ID,
    PAIR_WELCOME_EGG_MATERIAL_NAME,
    PAIR_WELCOME_EGG_TEMPLATE_ID,
} from '../shared/constants/petLobby.js';

function buildMaterialEggItem(templateId: string, materialName: string, quantity: number): InventoryItem {
    const base = MATERIAL_ITEMS[materialName as keyof typeof MATERIAL_ITEMS];
    if (!base) throw new Error(`Missing MATERIAL_ITEMS entry: ${materialName}`);
    return {
        id: `pair-onboard-egg-${randomUUID()}`,
        name: base.name,
        description: base.description,
        type: 'material',
        slot: null,
        level: 1,
        stars: 0,
        isEquipped: false,
        createdAt: Date.now(),
        image: base.image,
        grade: base.grade,
        quantity,
        templateId,
    };
}

/**
 * 신규 계정 펫 스타터:
 * - 환영 특알 1개 (대표펫용)
 * - 일반 알 1개 (2펫·기술수련용)
 */
export function createPairPetOnboardingStarterItems(): InventoryItem[] {
    return [
        buildMaterialEggItem(PAIR_WELCOME_EGG_TEMPLATE_ID, PAIR_WELCOME_EGG_MATERIAL_NAME, 1),
        buildMaterialEggItem(PAIR_EGG_TEMPLATE_ID, PAIR_EGG_MATERIAL_NAME, 1),
    ];
}
