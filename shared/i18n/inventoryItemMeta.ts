import type { TFunction } from 'i18next';
import type { InventoryItem } from '../../types.js';
import { ItemGrade } from '../../types/enums.js';
import { translateItemGrade } from './runtimeText.js';
import { translateInventoryItemDescription } from './inventoryItemText.js';
import {
    type InventoryMetaLine,
    getBagConsumableUsageMetaLine,
    getMaterialBagUsageMetaLines,
    resolveBagItemAcquireMetaLines,
    resolveItemObtainDescriptionMeta,
    resolveItemObtainUsageMetaLines,
    resolvePetTabEggOrSoulAcquireMetaLines,
    resolvePetTabEggOrSoulUsageMetaLines,
    resolvePurchaseModalUsageMetaLines,
} from '../utils/inventoryItemMetaLines.js';

function isMetaLine(value: InventoryMetaLine | string): value is InventoryMetaLine {
    return typeof value === 'object' && value !== null && 'key' in value && 'fallback' in value;
}

function resolveMetaLineParams(
    line: InventoryMetaLine,
    t: TFunction,
): Record<string, string | number> {
    const params: Record<string, string | number> = {};
    if (!line.params) return params;

    for (const [key, value] of Object.entries(line.params)) {
        if (key === 'grade' && typeof value === 'string') {
            params.gradeLabel = translateItemGrade(value as ItemGrade, String(value));
        } else if (key === 'fromGrade' && typeof value === 'string') {
            params.fromGrade = translateItemGrade(value as ItemGrade, value);
        } else if (key === 'toGrade' && typeof value === 'string') {
            params.toGrade = translateItemGrade(value as ItemGrade, value);
        } else if (typeof value === 'string' || typeof value === 'number') {
            params[key] = value;
        }
    }

    if (line.key.endsWith('usage.enhancementMaterial.single') && typeof line.params.stars === 'number') {
        params.rangeLabel = t('inventory:meta.enhanceRange.single', {
            stars: line.params.stars,
            defaultValue: `${line.params.stars}강화`,
        });
    }
    if (line.key.endsWith('usage.enhancementMaterial.range')) {
        const lo = line.params.minStars;
        const hi = line.params.maxStars;
        if (typeof lo === 'number' && typeof hi === 'number') {
            params.rangeLabel = t('inventory:meta.enhanceRange.range', {
                minStars: lo,
                maxStars: hi,
                defaultValue: `${lo}~${hi}강화`,
            });
        }
    }

    return params;
}

export function translateInventoryMetaLine(line: InventoryMetaLine, t: TFunction): string {
    return t(line.key, {
        ...resolveMetaLineParams(line, t),
        defaultValue: line.fallback,
    });
}

export function translateInventoryMetaLines(lines: InventoryMetaLine[], t: TFunction): string[] {
    return lines.map((line) => translateInventoryMetaLine(line, t));
}

export function resolveLocalizedItemDescriptionText(
    item: Pick<InventoryItem, 'name' | 'description' | 'type' | 'image'>,
    t: TFunction,
): string {
    const meta = resolveItemObtainDescriptionMeta(item as InventoryItem);
    if (isMetaLine(meta)) {
        return translateInventoryMetaLine(meta, t);
    }
    if (typeof meta === 'string' && meta.trim()) {
        return translateInventoryItemDescription(item.name, meta, t);
    }
    return translateInventoryItemDescription(item.name, item.description, t);
}

function isAcquireMetaLine(line: InventoryMetaLine): boolean {
    return line.key.includes('.acquire.') || line.key.includes('.meta.acquire.');
}

export function resolveLocalizedSoulStoneAcquireFallbackLines(item: InventoryItem, t: TFunction): string[] {
    return translateInventoryMetaLines(resolveBagItemAcquireMetaLines(item).filter(isAcquireMetaLine), t);
}

export function resolveLocalizedBagItemAcquireLines(item: InventoryItem, t: TFunction): string[] {
    return translateInventoryMetaLines(resolveBagItemAcquireMetaLines(item), t);
}

export function resolveLocalizedMaterialBagUsageLines(materialName: string, t: TFunction): string[] {
    return translateInventoryMetaLines(getMaterialBagUsageMetaLines(materialName), t);
}

export function resolveLocalizedBagConsumableUsageHint(name: string, t: TFunction): string | null {
    const meta = getBagConsumableUsageMetaLine(name);
    return meta ? translateInventoryMetaLine(meta, t) : null;
}

export function resolveLocalizedItemObtainUsageLines(item: InventoryItem, t: TFunction): string[] {
    return translateInventoryMetaLines(resolveItemObtainUsageMetaLines(item), t);
}

export function resolveLocalizedPurchaseModalUsageLines(
    params: { name: string; type: InventoryItem['type'] },
    t: TFunction,
): string[] {
    return translateInventoryMetaLines(resolvePurchaseModalUsageMetaLines(params), t);
}

export function resolveLocalizedPetTabEggOrSoulUsageLines(item: InventoryItem, t: TFunction): string[] {
    return translateInventoryMetaLines(resolvePetTabEggOrSoulUsageMetaLines(item), t);
}

export function resolveLocalizedPetTabEggOrSoulAcquireLines(item: InventoryItem, t: TFunction): string[] {
    return translateInventoryMetaLines(resolvePetTabEggOrSoulAcquireMetaLines(item), t);
}
