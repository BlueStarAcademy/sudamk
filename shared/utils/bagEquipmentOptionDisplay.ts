import type { ItemOption } from '../types/entities.js';
import {
    coerceSpecialStatType,
    computeSpecialSubRollBoundsAfterMilestones,
    formatSpecialSubLineForPanel,
    milestoneTierCountFromStars,
} from './specialStatMilestones.js';

export function stripOptionDisplayRange(display: string): string {
    return display.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
}

export function resolveBagOptionEnhancementCount(opt: ItemOption, itemStars: number): number {
    if (opt.enhancements != null && Number.isFinite(Number(opt.enhancements))) {
        return Math.max(0, Math.floor(Number(opt.enhancements)));
    }
    const stat = coerceSpecialStatType(opt.type);
    if (stat) return milestoneTierCountFromStars(itemStars);
    return 0;
}

export function formatBagOptionRangeTrailing(opt: ItemOption, itemStars: number): string | null {
    if (!opt.range || opt.range.length !== 2) return null;
    let lo = Math.round(Number(opt.range[0]));
    let hi = Math.round(Number(opt.range[1]));
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    const stat = coerceSpecialStatType(opt.type);
    const enh = resolveBagOptionEnhancementCount(opt, itemStars);
    if (stat) {
        [lo, hi] = computeSpecialSubRollBoundsAfterMilestones([lo, hi], stat, enh);
    }
    const pct = opt.isPercentage ? '%' : '';
    const rangePart = `[${lo}~${hi}${pct}]`;
    return enh > 0 ? `${rangePart} (${enh}강화)` : rangePart;
}

export function bagOptionLabelText(opt: ItemOption, itemStars: number): string {
    const stat = coerceSpecialStatType(opt.type);
    if (stat) {
        return stripOptionDisplayRange(formatSpecialSubLineForPanel(opt, itemStars));
    }
    return stripOptionDisplayRange(opt.display);
}
