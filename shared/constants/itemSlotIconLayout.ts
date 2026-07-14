import type { CSSProperties } from 'react';
import { ItemGrade } from '../types/enums.js';

/** Soft scrim between grade frame and icon — kept very light so dark stones stay solid. */
export const GRADE_SLOT_SCRIM_CLASS =
    'pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/0 via-transparent to-black/4';

/**
 * Inset rim painted above *bgi + icon (background cover otherwise hides CSS border).
 * Transcendent keeps its animated cyan overlay.
 */
export const GRADE_SLOT_BORDER_OVERLAY_CLASS: Record<ItemGrade, string> = {
    [ItemGrade.Normal]: 'grade-inventory-slot-overlay grade-inventory-slot-overlay--normal',
    [ItemGrade.Uncommon]: 'grade-inventory-slot-overlay grade-inventory-slot-overlay--uncommon',
    [ItemGrade.Rare]: 'grade-inventory-slot-overlay grade-inventory-slot-overlay--rare',
    [ItemGrade.Epic]: 'grade-inventory-slot-overlay grade-inventory-slot-overlay--epic',
    [ItemGrade.Legendary]: 'grade-inventory-slot-overlay grade-inventory-slot-overlay--legendary',
    [ItemGrade.Mythic]: 'grade-inventory-slot-overlay grade-inventory-slot-overlay--mythic',
    [ItemGrade.Transcendent]: 'transcendent-inventory-slot-overlay',
};

/** Position classes for the grade rim overlay element. */
export const GRADE_SLOT_BORDER_OVERLAY_POSITION_CLASS =
    'pointer-events-none absolute inset-0 z-[3] rounded-[inherit]';

export function gradeSlotBorderOverlayClass(grade: ItemGrade): string {
    return GRADE_SLOT_BORDER_OVERLAY_CLASS[grade] ?? GRADE_SLOT_BORDER_OVERLAY_CLASS[ItemGrade.Normal];
}

/** Unified inventory/shop slot icon size over grade frame. */
export const ITEM_SLOT_ICON_SIZE_PCT = 94;

/** Legendary: below default so ornate frames don't clip, but not undersized. */
const ITEM_SLOT_ICON_SIZE_PCT_BY_GRADE: Partial<Record<ItemGrade, number>> = {
    [ItemGrade.Legendary]: 90,
};

export function itemSlotIconSizePct(grade?: ItemGrade | null): number {
    if (grade && ITEM_SLOT_ICON_SIZE_PCT_BY_GRADE[grade] != null) {
        return ITEM_SLOT_ICON_SIZE_PCT_BY_GRADE[grade]!;
    }
    return ITEM_SLOT_ICON_SIZE_PCT;
}

export function itemSlotIconStyle(sizePct: number = ITEM_SLOT_ICON_SIZE_PCT): CSSProperties {
    return {
        width: `${sizePct}%`,
        height: `${sizePct}%`,
        maxWidth: `${sizePct}%`,
        maxHeight: `${sizePct}%`,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        objectFit: 'contain',
        boxSizing: 'border-box',
        // Milder filters — heavy contrast/saturate exaggerate fringe against grade frames
        filter: 'contrast(1.04) saturate(1.02) drop-shadow(0 1px 1px rgba(0,0,0,0.4))',
    };
}

/** Convenience for equipment/inventory slots that know the item grade. */
export function itemSlotIconStyleForGrade(grade?: ItemGrade | null): CSSProperties {
    return itemSlotIconStyle(itemSlotIconSizePct(grade));
}
