/** 장비 프리셋 기본 표시명 (슬롯 1~5) */
export const DEFAULT_EQUIPMENT_PRESET_SLOT_COUNT = 5;

export function defaultEquipmentPresetName(index1Based: number): string {
    return `장비세트 ${Math.max(1, Math.floor(index1Based))}`;
}

export function createEmptyEquipmentPresets(
    firstSlotEquipment: Record<string, string> = {},
): Array<{ name: string; equipment: Record<string, string> }> {
    return Array.from({ length: DEFAULT_EQUIPMENT_PRESET_SLOT_COUNT }, (_, i) => ({
        name: defaultEquipmentPresetName(i + 1),
        equipment: i === 0 ? { ...firstSlotEquipment } : {},
    }));
}

/**
 * 기본 이름만 새 표기로 바꾼다. 유저가 바꾼 커스텀 이름은 유지.
 * @returns 새 이름 또는 null(변경 없음)
 */
export function migrateLegacyDefaultEquipmentPresetName(name: string | null | undefined): string | null {
    const raw = String(name ?? '').trim();
    const m = raw.match(/^(?:프리셋|Preset)\s*([1-5])$/i);
    if (!m) return null;
    return defaultEquipmentPresetName(Number(m[1]));
}

export function migrateEquipmentPresetDefaultNames<T extends { name?: string }>(
    presets: T[] | null | undefined,
): { presets: T[]; changed: boolean } {
    if (!Array.isArray(presets) || presets.length === 0) {
        return { presets: (presets ?? []) as T[], changed: false };
    }
    let changed = false;
    const next = presets.map((p) => {
        const renamed = migrateLegacyDefaultEquipmentPresetName(p?.name);
        if (!renamed || renamed === p.name) return p;
        changed = true;
        return { ...p, name: renamed };
    });
    return { presets: next, changed };
}
