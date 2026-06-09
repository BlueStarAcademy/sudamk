import type { QuickUtilityPanelKind } from '../types/quickUtilityPanel.js';
import type { MobileViewportEntry, MobileViewportEntryType } from '../types/mobileViewportStack.js';

export function getQuickUtilityKindFromStack(stack: MobileViewportEntry[]): QuickUtilityPanelKind | null {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
        const entry = stack[i];
        if (entry.type === 'quickUtility') return entry.kind;
    }
    return null;
}

export function getMobileViewportStackTop(stack: MobileViewportEntry[]): MobileViewportEntry | null {
    return stack.length > 0 ? stack[stack.length - 1] : null;
}

export function isMobileViewportEntryTypeActive(
    stack: MobileViewportEntry[],
    type: MobileViewportEntryType,
): boolean {
    return stack.some((entry) => entry.type === type);
}

export function mobileViewportStacksEqual(a: MobileViewportEntry[], b: MobileViewportEntry[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((entry, index) => entry.type === b[index]?.type);
}
