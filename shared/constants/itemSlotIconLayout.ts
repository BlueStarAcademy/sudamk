import type { CSSProperties } from 'react';
import { ItemGrade } from '../types/enums.js';

/** Soft scrim between grade frame and icon so textured frames don't crush silhouettes. */
export const GRADE_SLOT_SCRIM_CLASS =
    'pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-black/5 via-transparent to-black/8';

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

/** Unified inventory/shop slot icon size over grade frame (no extra padding). */
export const ITEM_SLOT_ICON_SIZE_PCT = 94;

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
        // Keep edges crisp: light contrast bump, short hard-ish shadow (blur softens icons)
        filter: 'contrast(1.12) saturate(1.04) drop-shadow(0 1px 1px rgba(0,0,0,0.55))',
    };
}
