import { EQUIPMENT_POOL, CONSUMABLE_ITEMS, MATERIAL_ITEMS, LEGACY_TRANSCENDENT_EQUIPMENT_NAME_TO_NEW } from './items.js';
import { SHOP_ITEM_DISPLAY } from './shopItemDisplay.js';

export type InventoryItemCatalogEntry = {
    slug: string;
    name: string;
    description?: string;
};

const KO_NAME_TO_ENTRY = new Map<string, InventoryItemCatalogEntry>();

function slugFromImage(image: string | undefined, fallbackName: string): string {
    if (image) {
        const equip = image.match(/equipments\/([^/.]+)/i);
        if (equip?.[1]) return `eq_${equip[1].toLowerCase()}`;
        const box = image.match(/Box\/([^/.]+)/i);
        if (box?.[1]) return `box_${box[1].toLowerCase()}`;
        const mat = image.match(/materials\/([^/.]+)/i);
        if (mat?.[1]) return `mat_${mat[1].toLowerCase()}`;
        const use = image.match(/use\/([^/.]+)/i);
        if (use?.[1]) return `use_${use[1].toLowerCase()}`;
        const btn = image.match(/button\/([^/.]+)/i);
        if (btn?.[1]) return `btn_${btn[1].toLowerCase()}`;
        const pet = image.match(/pets\/([^/.]+)/i);
        if (pet?.[1]) return `pet_${pet[1].toLowerCase()}`;
    }
    let h = 2166136261 >>> 0;
    for (let i = 0; i < fallbackName.length; i++) {
        h ^= fallbackName.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return `n_${h.toString(36)}`;
}

function registerEntry(name: string, entry: InventoryItemCatalogEntry): void {
    const trimmed = name?.trim();
    if (!trimmed) return;
    KO_NAME_TO_ENTRY.set(trimmed, entry);
}

function registerItem(name: string, description: string | undefined, image: string | undefined, slugOverride?: string): void {
    const slug = slugOverride ?? slugFromImage(image, name);
    const entry: InventoryItemCatalogEntry = { slug, name, description };
    registerEntry(name, entry);
}

for (const item of EQUIPMENT_POOL) {
    registerItem(item.name, item.description, item.image);
}

for (const item of CONSUMABLE_ITEMS) {
    registerItem(item.name, item.description, item.image);
}

for (const item of Object.values(MATERIAL_ITEMS)) {
    registerItem(item.name, item.description, item.image);
}

for (const [legacyName, newName] of Object.entries(LEGACY_TRANSCENDENT_EQUIPMENT_NAME_TO_NEW)) {
    const entry = KO_NAME_TO_ENTRY.get(newName);
    if (entry) registerEntry(legacyName, entry);
}

for (const [shopId, display] of Object.entries(SHOP_ITEM_DISPLAY)) {
    registerItem(display.name, display.description, undefined, `shop_${shopId}`);
    registerEntry('신화 옵션 변경권', {
        slug: 'shop_mythic_option_change_ticket',
        name: '스페셜 옵션 변경권',
        description: SHOP_ITEM_DISPLAY.mythic_option_change_ticket.description,
    });
}

/** 레거시·표기 차이(장비상자1 등) — canonical key는 itemTemplateLookup과 동일 규칙으로 클라이언트에서 보강 */
export function resolveInventoryItemCatalogEntry(koName: string | undefined | null): InventoryItemCatalogEntry | null {
    if (!koName) return null;
    const trimmed = koName.trim();
    return KO_NAME_TO_ENTRY.get(trimmed) ?? null;
}

export function resolveInventoryItemSlug(koName: string | undefined | null): string | null {
    return resolveInventoryItemCatalogEntry(koName)?.slug ?? null;
}

export function listInventoryItemCatalogEntries(): InventoryItemCatalogEntry[] {
    const seen = new Set<string>();
    const out: InventoryItemCatalogEntry[] = [];
    for (const entry of KO_NAME_TO_ENTRY.values()) {
        if (seen.has(entry.slug)) continue;
        seen.add(entry.slug);
        out.push(entry);
    }
    return out.sort((a, b) => a.slug.localeCompare(b.slug));
}
