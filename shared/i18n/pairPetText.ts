import type { TFunction } from 'i18next';
import type { InventoryItem } from '../../types.js';
import {
    getPairPetDefinition,
    getPairPetDisplayName,
    PAIR_PET_CATALOG,
} from '../constants/petLobby.js';
import {
    getPairTrainingSlotDisplayName,
    PAIR_TRAINING_SLOT_COUNT,
} from '../constants/pairTraining.js';
import {
    getPairHatcheryUpgradeTierDef,
    PAIR_HATCHERY_UPGRADE_TIER_DEFS,
} from '../constants/pairHatchery.js';

export function translatePairPetName(
    item: Pick<InventoryItem, 'templateId' | 'name'>,
    t: TFunction,
): string {
    const tid = item.templateId;
    if (typeof tid === 'string' && tid.startsWith('pair-pet-')) {
        const fallback = getPairPetDefinition(tid)?.displayName ?? item.name;
        return t(`pair:pets.${tid}.name`, { defaultValue: fallback });
    }
    return item.name;
}

export function translatePairPetNameByTemplateId(templateId: string, t: TFunction): string {
    const def = getPairPetDefinition(templateId);
    const fallback = def?.displayName ?? templateId;
    if (templateId.startsWith('pair-pet-')) {
        return t(`pair:pets.${templateId}.name`, { defaultValue: fallback });
    }
    return fallback;
}

/** Legacy helper parity — prefer {@link translatePairPetName} in UI. */
export function translatePairPetDisplayName(
    item: Pick<InventoryItem, 'templateId' | 'name'>,
    t: TFunction,
): string {
    return translatePairPetName(item, t);
}

export function translatePairTrainingSlotName(slotIndex: number, t: TFunction): string {
    const fallback = getPairTrainingSlotDisplayName(slotIndex);
    if (!fallback) return '';
    return t(`pair:trainingSlots.${slotIndex}.name`, { defaultValue: fallback });
}

/** 수련 이름 레일 — `기술수련` → `기술`/`수련`, `Technique Training` → `Technique`/`Training` */
export function splitPairTrainingSlotNameLines(name: string): string[] {
    const trimmed = name.trim();
    if (!trimmed) return [];
    if (trimmed.endsWith('수련') && trimmed.length > 2) {
        return [trimmed.slice(0, -2), '수련'];
    }
    const trainingMatch = trimmed.match(/^(.+?)\s+Training$/i);
    if (trainingMatch?.[1]) {
        return [trainingMatch[1].trim(), 'Training'];
    }
    return [trimmed];
}

export function translatePairHatcheryUpgradeTierLabel(tierIndex: number, t: TFunction): string {
    const def = getPairHatcheryUpgradeTierDef(tierIndex);
    const fallback = def?.displayLabel ?? `강화 ${tierIndex}`;
    if (tierIndex >= 1 && tierIndex <= PAIR_HATCHERY_UPGRADE_TIER_DEFS.length) {
        return t(`pair:hatchery.upgradeTier${tierIndex}`, { defaultValue: fallback });
    }
    return fallback;
}

export function listPairPetCatalogTemplateIds(): string[] {
    return PAIR_PET_CATALOG.map((p) => p.templateId);
}

export function listPairPetCatalogKoNames(): string[] {
    return PAIR_PET_CATALOG.map((p) => p.displayName);
}

export function listPairTrainingSlotKoNames(): string[] {
    return Array.from({ length: PAIR_TRAINING_SLOT_COUNT }, (_, i) => getPairTrainingSlotDisplayName(i));
}

/** Non-UI fallback (server, logs) — unchanged Korean catalog names. */
export { getPairPetDisplayName };
