import { InventoryItem, InventoryItemType } from '../types/index.js';

/** Vite 브라우저 번들에서는 Node `crypto`를 쓸 수 없음 — Web Crypto + 폴백 */
function randomUUID(): string {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}-${Math.random().toString(36).slice(2, 11)}`;
}
import { ItemGrade } from '../types/enums.js';
import {
    applyEnhancementStarsToEquipmentItem,
    getMailEquipmentDisplayStars,
    isMailAttachmentEquipment,
} from '../shared/utils/equipmentEnhancementStars.js';
import {
    mapNormalizeInventoryList,
    normalizeInventoryEquipmentItem,
} from '../shared/utils/inventoryLegacyNormalize.js';
import { isActionPointConsumable, isRefinementTicketMaterial } from '../constants/items.js';
import { getItemTemplateByName, normalizeBoxItemName } from './itemTemplateLookup.js';
import {
    isPairArenaExclusiveBagItem,
    isPairEggItem,
    isPairPetMaterial,
    isPairSoulStoneMaterialName,
    pairSoulTemplateIdFromTier,
    pairSoulTierFromMaterialName,
    PAIR_EGG_MATERIAL_NAME,
    PAIR_WELCOME_EGG_MATERIAL_NAME,
} from '../shared/constants/petLobby.js';
import {
    effectivePairPetGradeFromRow,
    PAIR_PET_MAX_LEVEL,
    pairPetXpGainBlockedByGrade,
} from '../shared/constants/pairPetGrade.js';
import { derivePairPetMetaFallback } from '../shared/utils/pairPetRoll.js';

export { getItemTemplateByName, normalizeBoxItemName };

/** 옵션 변경권 3종: 슬롯당 최대 겹침, 초과 시 다음 슬롯 */
export const REFINEMENT_TICKET_MAX_STACK = 100;

export type AddItemsToInventoryOptions = {
    /**
     * 재료 칸이 가득 차도 지급을 허용합니다.
     * 신비로운알 상점 구매 등 — 부화장용 알은 로비 펫 슬롯과 별도이나 가방 재료 슬롯과는 공유될 수 있어,
     * 구매만은 슬롯 초과 시에도 인벤에 합쳐지도록 할 때 사용합니다.
     */
    allowMaterialSlotOverflow?: boolean;
};

export const addItemsToInventory = (
    currentInventory: InventoryItem[],
    inventorySlots: { equipment: number; consumable: number; material: number },
    itemsToAdd: InventoryItem[],
    options?: AddItemsToInventoryOptions
): { success: boolean; finalItemsToAdd: InventoryItem[]; updatedInventory: InventoryItem[] } => {
    const tempInventory = JSON.parse(JSON.stringify(currentInventory));
    const finalItemsToAdd: InventoryItem[] = [];

    const getMaxStackSize = (name: string): number => {
        // 페어 AI 펫 인스턴스: 슬롯당 1마리(합치지 않음)
        if (name.startsWith('AI 펫·') || name.startsWith('AI 펫 #')) return 1;
        // 행동력 회복제: 한 묶음 최대 20개
        if (isActionPointConsumable(name)) return 20;
        // 옵션 변경권: 한 슬롯 최대 100개
        if (isRefinementTicketMaterial(name)) return REFINEMENT_TICKET_MAX_STACK;
        // 페어: 알·영혼석(동일 이름 누적). 펫 본체는 위에서 1로 처리됨
        if (
            name === PAIR_EGG_MATERIAL_NAME ||
            name === PAIR_WELCOME_EGG_MATERIAL_NAME ||
            name === '페어 미스터리 알' ||
            isPairSoulStoneMaterialName(name)
        )
            return 99;
        // 그 외 소모품/재료: 한 묶음 최대 100개
        return 100;
    };

    const itemsByType = {
        equipment: itemsToAdd.filter(item => item.type === 'equipment'),
        consumable: itemsToAdd.filter(item => item.type === 'consumable'),
        material: itemsToAdd.filter(item => item.type === 'material'),
    };

    // First, check space for non-stackable items (equipment)
    const currentEquipmentCount = tempInventory.filter((item: InventoryItem) => item.type === 'equipment').length;
    if (itemsByType.equipment.length > (inventorySlots.equipment - currentEquipmentCount)) {
        return { success: false, finalItemsToAdd: [], updatedInventory: currentInventory };
    }
    finalItemsToAdd.push(...itemsByType.equipment);

    // Then, check space and process stackable items (consumables and materials)
    // Stack by name+source so tower-purchased items don't merge with general (도전의 탑 전용 분리)
    const getStackKey = (item: InventoryItem) => `${item.name}|${(item as InventoryItem & { source?: string }).source ?? ''}`;
    const parseStackKey = (key: string): { name: string; source?: string } => {
        const idx = key.indexOf('|');
        if (idx === -1) return { name: key, source: undefined };
        const name = key.slice(0, idx);
        const sourcePart = key.slice(idx + 1);
        // `getStackKey`와 동일: 빈 문자열은 출처 없음, 그 외( tower·future-pet-system 등 )는 그대로 보존
        return { name, source: sourcePart === '' ? undefined : sourcePart };
    };

    for (const category of ['consumable', 'material'] as const) {
        const items = itemsByType[category];
        if (items.length === 0) continue;

        const currentCategoryItems = tempInventory.filter((item: InventoryItem) => item.type === category);
        const excludesFromMainBagMaterialSlots = (it: InventoryItem) =>
            category === 'material' && it.type === 'material' && isPairArenaExclusiveBagItem(it);
        let currentCategorySlotsUsed = currentCategoryItems.filter((it: InventoryItem) => !excludesFromMainBagMaterialSlots(it)).length;

        const stackableToAdd: Record<string, number> = {};
        for (const item of items) {
            const key = getStackKey(item);
            stackableToAdd[key] = (stackableToAdd[key] || 0) + (item.quantity || 1);
        }

        const resolveMaxStackSizeForKey = (key: string): number => {
            const donor = items.find((it) => getStackKey(it as InventoryItem) === key);
            if (
                donor &&
                donor.type === 'material' &&
                isPairPetMaterial(donor) &&
                !isPairEggItem(donor)
            ) {
                return 1;
            }
            const { name } = parseStackKey(key);
            return getMaxStackSize(name);
        };

        let neededNewSlotsForBagCap = 0;
        for (const key in stackableToAdd) {
            const { name, source } = parseStackKey(key);
            let quantityToPlace = stackableToAdd[key];
            const maxStackSize = resolveMaxStackSizeForKey(key);

            for (const existingItem of currentCategoryItems) {
                if (quantityToPlace <= 0) break;
                const exSource = (existingItem as InventoryItem & { source?: string }).source;
                if (existingItem.name === name && (exSource ?? '') === (source ?? '') && (existingItem.quantity || 0) < maxStackSize) {
                    const space = maxStackSize - (existingItem.quantity || 0);
                    const toAdd = Math.min(quantityToPlace, space);
                    existingItem.quantity = (existingItem.quantity || 0) + toAdd;
                    if (isPairSoulStoneMaterialName(name) && !existingItem.templateId) {
                        existingItem.templateId = pairSoulTemplateIdFromTier(pairSoulTierFromMaterialName(name));
                    }
                    quantityToPlace -= toAdd;
                }
            }
            if (quantityToPlace > 0) {
                const inc = Math.ceil(quantityToPlace / maxStackSize);
                const donor = items.find((it) => getStackKey(it as InventoryItem) === key);
                const skipCap =
                    category === 'material' &&
                    donor &&
                    donor.type === 'material' &&
                    isPairArenaExclusiveBagItem(donor);
                if (!skipCap) neededNewSlotsForBagCap += inc;
            }
        }

        const skipMaterialSlotCap = category === 'material' && Boolean(options?.allowMaterialSlotOverflow);
        if (!skipMaterialSlotCap && (currentCategorySlotsUsed + neededNewSlotsForBagCap) > inventorySlots[category]) {
            return { success: false, finalItemsToAdd: [], updatedInventory: currentInventory };
        }

        for (const key in stackableToAdd) {
            const { name, source } = parseStackKey(key);
            let quantityLeft = stackableToAdd[key];
            const maxStackSize = resolveMaxStackSizeForKey(key);

            for (const existingItem of currentCategoryItems) {
                if (quantityLeft <= 0) break;
                const exSource = (existingItem as InventoryItem & { source?: string }).source;
                if (existingItem.name === name && (exSource ?? '') === (source ?? '')) {
                    const originalQuantity = (currentInventory.find(i => i.id === existingItem.id)?.quantity || 0);
                    const addedQuantity = (existingItem.quantity || 0) - originalQuantity;
                    quantityLeft -= addedQuantity;
                }
            }

            if (quantityLeft > 0) {
                for (const finalItem of finalItemsToAdd) {
                    if (quantityLeft <= 0) break;
                    const fSource = (finalItem as InventoryItem & { source?: string }).source;
                    if (finalItem.name === name && (fSource ?? '') === (source ?? '') && (finalItem.quantity || 0) < maxStackSize) {
                        const space = maxStackSize - (finalItem.quantity || 0);
                        const toAdd = Math.min(quantityLeft, space);
                        finalItem.quantity = (finalItem.quantity || 0) + toAdd;
                        quantityLeft -= toAdd;
                    }
                }

                while (quantityLeft > 0) {
                    const toAdd = Math.min(quantityLeft, maxStackSize);
                    const template = getItemTemplateByName(name);
                    const newItemSource = source ? { source } : {};
                    if (template) {
                        const soulTid = isPairSoulStoneMaterialName(name)
                            ? pairSoulTemplateIdFromTier(pairSoulTierFromMaterialName(name))
                            : undefined;
                        finalItemsToAdd.push({
                            ...template,
                            ...(soulTid ? { templateId: soulTid } : {}),
                            ...newItemSource,
                            id: `item-${randomUUID()}`,
                            quantity: toAdd,
                            createdAt: Date.now(),
                            isEquipped: false,
                            stars: 0,
                            level: 1,
                        });
                    } else {
                        const donor = items.find((it) => getStackKey(it as InventoryItem) === key);
                        if (donor && donor.type === category) {
                            const row = JSON.parse(JSON.stringify(donor)) as InventoryItem;
                            row.id = `item-${randomUUID()}`;
                            row.quantity = toAdd;
                            row.createdAt = Date.now();
                            row.isEquipped = false;
                            if (source) {
                                (row as InventoryItem & { source?: string }).source = source;
                            }
                            finalItemsToAdd.push(row);
                        } else {
                            console.error(`[addItemsToInventory] Unable to find template for stackable item '${name}'.`);
                            finalItemsToAdd.push({
                                name,
                                description: '보상 아이템',
                                type: 'consumable',
                                slot: null,
                                image: '/images/icon/Reward.webp',
                                grade: 'normal',
                                id: `item-${randomUUID()}`,
                                quantity: toAdd,
                                createdAt: Date.now(),
                                isEquipped: false,
                                stars: 0,
                                level: 1,
                                ...newItemSource,
                            } as InventoryItem);
                        }
                    }
                    quantityLeft -= toAdd;
                }
            }
        }
    }

    // Create updated inventory
    // tempInventory already has stacking applied to existing items (quantities increased)
    // finalItemsToAdd contains only new items that couldn't be stacked
    // So we need to combine tempInventory (with updated quantities) and finalItemsToAdd
    // But we need to be careful: tempInventory contains ALL existing items, and finalItemsToAdd contains only new items
    
    // The updated inventory should be:
    // 1. All items from tempInventory (existing items with updated quantities from stacking)
    // 2. Plus all items from finalItemsToAdd (new items that need new slots)
    const updatedInventory: InventoryItem[] = [];
    
    // Add all items from tempInventory (these include the stacked items with updated quantities)
    updatedInventory.push(...tempInventory);
    
    // Add new items from finalItemsToAdd (these are items that couldn't be stacked and need new slots)
    updatedInventory.push(...finalItemsToAdd);

    return { success: true, finalItemsToAdd, updatedInventory };
};

/**
 * 동일 종류 옵션 변경권을 최대 REFINEMENT_TICKET_MAX_STACK개까지 한 슬롯에 합치고, 초과분은 다음 슬롯으로 분할.
 * 레거시(슬롯당 1개·consumable 저장 등) 정리 및 로드 시 일관된 스택 유지.
 */
export function consolidateRefinementTicketStacks(inventory: InventoryItem[]): InventoryItem[] {
    if (!Array.isArray(inventory) || inventory.length === 0) return inventory;

    const isTicketRow = (it: InventoryItem) =>
        (it.type === 'material' || it.type === 'consumable') && isRefinementTicketMaterial(it.name);

    const sourceKey = (it: InventoryItem & { source?: string }) => (it.source === 'tower' ? 'tower' : '');
    const stackKey = (it: InventoryItem) => `${it.name}|${sourceKey(it as InventoryItem & { source?: string })}`;

    const ticketRows = inventory.filter(isTicketRow);
    if (ticketRows.length === 0) return inventory;

    const keySeen = new Set<string>();
    let needsWork = false;
    for (const r of ticketRows) {
        const q = r.quantity ?? 1;
        if (q > REFINEMENT_TICKET_MAX_STACK || q < 1) {
            needsWork = true;
            break;
        }
        const k = stackKey(r);
        if (keySeen.has(k)) {
            needsWork = true;
            break;
        }
        keySeen.add(k);
        const tmpl = getItemTemplateByName(r.name);
        if (tmpl && r.type !== tmpl.type) {
            needsWork = true;
            break;
        }
    }
    if (!needsWork) return inventory;

    let insertAt = -1;
    const tickets: InventoryItem[] = [];
    const rest: InventoryItem[] = [];

    for (const item of inventory) {
        if (isTicketRow(item)) {
            if (insertAt < 0) insertAt = rest.length;
            tickets.push(item);
        } else {
            rest.push(item);
        }
    }

    if (tickets.length === 0) return inventory;

    const totals = new Map<string, number>();
    for (const t of tickets) {
        const k = stackKey(t);
        totals.set(k, (totals.get(k) ?? 0) + (t.quantity ?? 1));
    }

    const merged: InventoryItem[] = [];
    for (const [key, total] of totals) {
        const pipe = key.indexOf('|');
        const name = pipe >= 0 ? key.slice(0, pipe) : key;
        const src = pipe >= 0 ? key.slice(pipe + 1) : '';
        const sourceObj = src === 'tower' ? { source: 'tower' as const } : {};
        let left = total;
        const template = getItemTemplateByName(name);
        while (left > 0) {
            const chunk = Math.min(left, REFINEMENT_TICKET_MAX_STACK);
            if (template) {
                merged.push({
                    ...template,
                    ...sourceObj,
                    id: `item-${randomUUID()}`,
                    quantity: chunk,
                    createdAt: Date.now(),
                    isEquipped: false,
                    stars: 0,
                    level: 1,
                } as InventoryItem);
            } else {
                const sample = tickets.find((x) => x.name === name);
                merged.push({
                    name,
                    description: sample?.description ?? '보상 아이템',
                    type: 'material',
                    slot: null,
                    image: sample?.image ?? '/images/use/change1.webp',
                    grade: sample?.grade ?? ItemGrade.Normal,
                    ...sourceObj,
                    id: `item-${randomUUID()}`,
                    quantity: chunk,
                    createdAt: Date.now(),
                    isEquipped: false,
                    stars: 0,
                    level: 1,
                } as InventoryItem);
            }
            left -= chunk;
        }
    }

    return [...rest.slice(0, insertAt), ...merged, ...rest.slice(insertAt)];
}

const REFINEMENT_CHARM_ITEM_NAME = '제련의 부적' as const;
const REFINEMENT_CHARM_MAX_STACK = 100;

/**
 * `제련의 부적`: 레거시 consumable 행·다중 슬롯 분할 등을 한도 내에서 한 슬롯으로 합침 (가방 표시·사용 수량 일치).
 */
export function consolidateRefinementCharmStacks(inventory: InventoryItem[]): InventoryItem[] {
    if (!Array.isArray(inventory) || inventory.length === 0) return inventory;

    const isCharmRow = (it: InventoryItem) =>
        (it.type === 'material' || it.type === 'consumable') && it.name === REFINEMENT_CHARM_ITEM_NAME;

    const sourceKey = (it: InventoryItem & { source?: string }) => (it.source === 'tower' ? 'tower' : '');
    const stackKey = (it: InventoryItem) => `${it.name}|${sourceKey(it as InventoryItem & { source?: string })}`;

    const charmRows = inventory.filter(isCharmRow);
    if (charmRows.length === 0) return inventory;

    const rowsPerKey = new Map<string, number>();
    for (const r of charmRows) {
        const k = stackKey(r);
        rowsPerKey.set(k, (rowsPerKey.get(k) ?? 0) + 1);
    }

    let needsWork = false;
    for (const r of charmRows) {
        const q = r.quantity ?? 1;
        if (q > REFINEMENT_CHARM_MAX_STACK || q < 1) {
            needsWork = true;
            break;
        }
        const k = stackKey(r);
        if ((rowsPerKey.get(k) ?? 0) > 1) {
            needsWork = true;
            break;
        }
        const tmpl = getItemTemplateByName(r.name);
        if (tmpl && r.type !== tmpl.type) {
            needsWork = true;
            break;
        }
    }
    if (!needsWork) return inventory;

    let insertAt = -1;
    const charms: InventoryItem[] = [];
    const rest: InventoryItem[] = [];

    for (const item of inventory) {
        if (isCharmRow(item)) {
            if (insertAt < 0) insertAt = rest.length;
            charms.push(item);
        } else {
            rest.push(item);
        }
    }

    if (charms.length === 0) return inventory;

    const createdNum = (it: InventoryItem) => {
        const t = it.createdAt as unknown;
        if (typeof t === 'number' && Number.isFinite(t)) return t;
        return 0;
    };

    const totals = new Map<string, number>();
    for (const t of charms) {
        const k = stackKey(t);
        totals.set(k, (totals.get(k) ?? 0) + (t.quantity ?? 1));
    }

    const merged: InventoryItem[] = [];
    for (const [key, total] of totals) {
        const pipe = key.indexOf('|');
        const name = pipe >= 0 ? key.slice(0, pipe) : key;
        const src = pipe >= 0 ? key.slice(pipe + 1) : '';
        const sourceObj = src === 'tower' ? { source: 'tower' as const } : {};
        const sameKeyRows = charms.filter((c) => stackKey(c) === key);
        const rawMinCreated = sameKeyRows.length > 0 ? Math.min(...sameKeyRows.map((c) => createdNum(c))) : Date.now();
        const createdAtBase = Number.isFinite(rawMinCreated) ? rawMinCreated : Date.now();

        let left = total;
        const template = getItemTemplateByName(name);
        while (left > 0) {
            const chunk = Math.min(left, REFINEMENT_CHARM_MAX_STACK);
            if (template) {
                merged.push({
                    ...template,
                    ...sourceObj,
                    id: `item-${randomUUID()}`,
                    quantity: chunk,
                    createdAt: createdAtBase,
                    isEquipped: false,
                    stars: 0,
                    level: 1,
                } as InventoryItem);
            } else {
                const sample = charms.find((x) => x.name === name);
                merged.push({
                    name,
                    description: sample?.description ?? '보상 아이템',
                    type: 'material',
                    slot: null,
                    image: sample?.image ?? '/images/use/refine.webp',
                    grade: sample?.grade ?? ItemGrade.Legendary,
                    ...sourceObj,
                    id: `item-${randomUUID()}`,
                    quantity: chunk,
                    createdAt: createdAtBase,
                    isEquipped: false,
                    stars: 0,
                    level: 1,
                } as InventoryItem);
            }
            left -= chunk;
        }
    }

    return [...rest.slice(0, insertAt), ...merged, ...rest.slice(insertAt)];
}

/** 레거시: AI 펫이 quantity>1로 한 슬롯에 쌓인 경우 → 마리당 한 행으로 분리 */
export function splitStackedPairPetInstances(inventory: InventoryItem[]): InventoryItem[] {
    if (!Array.isArray(inventory) || inventory.length === 0) return inventory;
    let changed = false;
    const out: InventoryItem[] = [];
    for (const item of inventory) {
        if (!item || item.type !== 'material' || !isPairPetMaterial(item)) {
            out.push(item);
            continue;
        }
        const rawQ = Number(item.quantity ?? 1);
        const q = Number.isFinite(rawQ) && rawQ >= 1 ? Math.floor(rawQ) : 1;
        if (q <= 1) {
            if (item.quantity != null && item.quantity !== 1) changed = true;
            out.push(item.quantity === 1 ? item : { ...item, quantity: 1 });
            continue;
        }
        changed = true;
        for (let i = 0; i < q; i += 1) {
            const id = i === 0 ? item.id : `item-${randomUUID()}`;
            const createdAt = i === 0 ? item.createdAt ?? Date.now() : Date.now();
            const pairPetMeta = i === 0 ? item.pairPetMeta : derivePairPetMetaFallback(id, createdAt);
            out.push({
                ...item,
                id,
                quantity: 1,
                createdAt,
                pairPetMeta,
            });
        }
    }
    return changed ? out : inventory;
}

/** 등급 강화 구간(Lv10·20…)에 도달했는데 아직 다음 등급이 없으면 경험치 바를 0으로 맞춤 */
function normalizePairPetXpGates(items: InventoryItem[]): InventoryItem[] {
    let changed = false;
    const out = items.map((it) => {
        if (!isPairPetMaterial(it) || isPairEggItem(it)) return it;
        const meta = it.pairPetMeta;
        if (!meta) return it;
        const grade = effectivePairPetGradeFromRow(it);
        const level = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(meta.level) || 1));
        if (!pairPetXpGainBlockedByGrade(grade, level)) return it;
        const xp = meta.xp ?? 0;
        if (xp === 0) return it;
        changed = true;
        return { ...it, pairPetMeta: { ...meta, xp: 0 } };
    });
    return changed ? out : items;
}

/** 레거시: 이름만 있고 `templateId` 없는 페어 영혼석 → 로비·등급 강화 식별용 id 보정 */
function normalizePairSoulStoneTemplateIds(items: InventoryItem[]): InventoryItem[] {
    let changed = false;
    const out = items.map((it) => {
        if (it.type !== 'material' || !isPairSoulStoneMaterialName(it.name) || it.templateId) return it;
        changed = true;
        return {
            ...it,
            templateId: pairSoulTemplateIdFromTier(pairSoulTierFromMaterialName(it.name)),
        };
    });
    return changed ? out : items;
}

/**
 * 레거시/비정상 row(수량 0 이하)는 실제로 지급·사용할 수 없고
 * 슬롯 수 판정만 왜곡하므로 로드 정규화 시 제거한다.
 */
function pruneNonPositiveInventoryRows(items: InventoryItem[]): InventoryItem[] {
    let changed = false;
    const out = items.filter((it) => {
        if (!it || typeof it !== 'object') {
            changed = true;
            return false;
        }
        const qtyRaw = (it as InventoryItem & { quantity?: unknown }).quantity;
        const qty = qtyRaw == null ? 1 : Number(qtyRaw);
        if (!Number.isFinite(qty) || qty <= 0) {
            changed = true;
            return false;
        }
        return true;
    });
    return changed ? out : items;
}

/** DB/소켓 로드 후 인벤 정규화: 장비 수치 → 펫 스택 분리 → 변경권·제련의 부적 합산 */
export function normalizeInventoryAfterLoad(items: InventoryItem[]): InventoryItem[] {
    return normalizePairPetXpGates(
        consolidateRefinementCharmStacks(
            consolidateRefinementTicketStacks(
                splitStackedPairPetInstances(
                    mapNormalizeInventoryList(
                        pruneNonPositiveInventoryRows(normalizePairSoulStoneTemplateIds(items))
                    )
                )
            )
        )
    );
}

export const createItemInstancesFromReward = (itemRefs: (InventoryItem | { itemId: string; quantity: number })[]): InventoryItem[] => {
    const createdItems: InventoryItem[] = [];
    for (const itemRef of itemRefs) {
        if ('id' in itemRef) {
            const inv = itemRef as InventoryItem;
            if (isMailAttachmentEquipment(inv)) {
                const cloned = normalizeInventoryEquipmentItem(
                    JSON.parse(JSON.stringify(inv)) as InventoryItem
                );
                cloned.id = `item-${randomUUID()}`;
                delete cloned.mailPreEnhanced;
                if (!inv.mailPreEnhanced) {
                    const stars = getMailEquipmentDisplayStars(inv);
                    if (stars === 0) {
                        applyEnhancementStarsToEquipmentItem(cloned, 0);
                    }
                }
                if (cloned.type !== 'equipment') {
                    cloned.type = 'equipment';
                }
                createdItems.push(cloned);
            } else {
                createdItems.push(inv);
            }
            continue;
        }

        const { itemId, quantity } = itemRef;
        // 장비/재료 상자 등은 이름 정규화 후 템플릿 조회 (월드챔피언십 보상 등에서 이름 변형 시 이미지·사용 정상화)
        const lookupName = normalizeBoxItemName(itemId);
        const template = getItemTemplateByName(lookupName) || getItemTemplateByName(itemId);

        if (template) {
            const newItem: InventoryItem = {
                ...template,
                id: `item-${randomUUID()}`,
                createdAt: Date.now(),
                quantity: quantity,
                isEquipped: false, 
                level: 1,
                stars: 0,
                options: undefined,
            };
            createdItems.push(newItem);
        } else {
            console.error(`[Reward] Could not find consumable/material item template for: ${itemId}`);
            createdItems.push({
                name: lookupName || itemId,
                description: '보상 아이템',
                type: 'consumable',
                slot: null,
                image: '/images/icon/Reward.webp',
                grade: ItemGrade.Normal,
                id: `item-${randomUUID()}`,
                createdAt: Date.now(),
                quantity,
                isEquipped: false,
                stars: 0,
                level: 1,
                options: undefined,
            });
        }
    }
    return createdItems;
};