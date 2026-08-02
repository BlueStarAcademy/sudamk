export type LootEntry = {
    itemId: string;
    weight: number;
    qtyMin: number;
    qtyMax: number;
};

export type LootRollResult = {
    itemId: string;
    quantity: number;
};

type AnchorWeights = Record<string, number>;
type AnchorQty = Record<string, { min: number; max: number }>;

const STONE_IDS = ['하급 강화석', '중급 강화석', '상급 강화석', '최상급 강화석', '신비의 강화석'] as const;
const BOX_IDS = ['장비 상자 I', '장비 상자 II', '장비 상자 III', '장비 상자 IV', '장비 상자 V', '장비 상자 VI'] as const;

const STONE_WEIGHTS: Record<'lv1' | 'lv5' | 'lv10', AnchorWeights> = {
    lv1: { '하급 강화석': 55, '중급 강화석': 28, '상급 강화석': 12, '최상급 강화석': 4, '신비의 강화석': 1 },
    lv5: { '하급 강화석': 42, '중급 강화석': 32, '상급 강화석': 16, '최상급 강화석': 8, '신비의 강화석': 2 },
    lv10: { '하급 강화석': 28, '중급 강화석': 34, '상급 강화석': 22, '최상급 강화석': 12, '신비의 강화석': 4 },
};

const STONE_QTY: Record<'lv1' | 'lv5' | 'lv10', AnchorQty> = {
    lv1: {
        '하급 강화석': { min: 3, max: 5 },
        '중급 강화석': { min: 2, max: 3 },
        '상급 강화석': { min: 1, max: 2 },
        '최상급 강화석': { min: 1, max: 1 },
        '신비의 강화석': { min: 1, max: 1 },
    },
    lv5: {
        '하급 강화석': { min: 4, max: 5 },
        '중급 강화석': { min: 2, max: 3 },
        '상급 강화석': { min: 1, max: 2 },
        '최상급 강화석': { min: 1, max: 1 },
        '신비의 강화석': { min: 1, max: 1 },
    },
    lv10: {
        '하급 강화석': { min: 5, max: 5 },
        '중급 강화석': { min: 3, max: 3 },
        '상급 강화석': { min: 2, max: 2 },
        '최상급 강화석': { min: 1, max: 1 },
        '신비의 강화석': { min: 1, max: 1 },
    },
};

/** VI는 Lv5부터 */
const BOX_WEIGHTS: Record<'lv1' | 'lv4' | 'lv5' | 'lv10', AnchorWeights> = {
    lv1: { '장비 상자 I': 52, '장비 상자 II': 28, '장비 상자 III': 14, '장비 상자 IV': 5, '장비 상자 V': 1, '장비 상자 VI': 0 },
    lv4: { '장비 상자 I': 40, '장비 상자 II': 30, '장비 상자 III': 18, '장비 상자 IV': 9, '장비 상자 V': 3, '장비 상자 VI': 0 },
    lv5: { '장비 상자 I': 36, '장비 상자 II': 30, '장비 상자 III': 18, '장비 상자 IV': 10, '장비 상자 V': 4, '장비 상자 VI': 2 },
    lv10: { '장비 상자 I': 22, '장비 상자 II': 28, '장비 상자 III': 24, '장비 상자 IV': 14, '장비 상자 V': 8, '장비 상자 VI': 4 },
};

const BOX_QTY: Record<'lv1' | 'lv5' | 'lv10', AnchorQty> = {
    lv1: {
        '장비 상자 I': { min: 3, max: 5 },
        '장비 상자 II': { min: 2, max: 3 },
        '장비 상자 III': { min: 1, max: 2 },
        '장비 상자 IV': { min: 1, max: 1 },
        '장비 상자 V': { min: 1, max: 1 },
        '장비 상자 VI': { min: 0, max: 0 },
    },
    lv5: {
        '장비 상자 I': { min: 4, max: 5 },
        '장비 상자 II': { min: 2, max: 3 },
        '장비 상자 III': { min: 1, max: 2 },
        '장비 상자 IV': { min: 1, max: 1 },
        '장비 상자 V': { min: 1, max: 1 },
        '장비 상자 VI': { min: 1, max: 1 },
    },
    lv10: {
        '장비 상자 I': { min: 5, max: 5 },
        '장비 상자 II': { min: 3, max: 3 },
        '장비 상자 III': { min: 2, max: 2 },
        '장비 상자 IV': { min: 1, max: 1 },
        '장비 상자 V': { min: 1, max: 1 },
        '장비 상자 VI': { min: 1, max: 1 },
    },
};

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function normalizeWeights(weights: AnchorWeights): AnchorWeights {
    const sum = Object.values(weights).reduce((s, w) => s + Math.max(0, w), 0);
    if (sum <= 0) return weights;
    const out: AnchorWeights = {};
    for (const [k, w] of Object.entries(weights)) {
        out[k] = (Math.max(0, w) / sum) * 100;
    }
    return out;
}

function interpolateWeights(a: AnchorWeights, b: AnchorWeights, t: number, ids: readonly string[]): AnchorWeights {
    const out: AnchorWeights = {};
    for (const id of ids) {
        out[id] = lerp(a[id] ?? 0, b[id] ?? 0, t);
    }
    return normalizeWeights(out);
}

function interpolateQty(a: AnchorQty, b: AnchorQty, t: number, ids: readonly string[]): AnchorQty {
    const out: AnchorQty = {};
    for (const id of ids) {
        const qa = a[id] ?? { min: 1, max: 1 };
        const qb = b[id] ?? { min: 1, max: 1 };
        out[id] = {
            min: Math.max(0, Math.round(lerp(qa.min, qb.min, t))),
            max: Math.max(0, Math.round(lerp(qa.max, qb.max, t))),
        };
        if (out[id].max < out[id].min) out[id].max = out[id].min;
    }
    return out;
}

export function getEnhanceStoneLootTable(facilityLevel: number): LootEntry[] {
    const L = Math.min(10, Math.max(1, facilityLevel));
    let weights: AnchorWeights;
    let qty: AnchorQty;
    if (L <= 5) {
        const t = (L - 1) / 4;
        weights = interpolateWeights(STONE_WEIGHTS.lv1, STONE_WEIGHTS.lv5, t, STONE_IDS);
        qty = interpolateQty(STONE_QTY.lv1, STONE_QTY.lv5, t, STONE_IDS);
    } else {
        const t = (L - 5) / 5;
        weights = interpolateWeights(STONE_WEIGHTS.lv5, STONE_WEIGHTS.lv10, t, STONE_IDS);
        qty = interpolateQty(STONE_QTY.lv5, STONE_QTY.lv10, t, STONE_IDS);
    }
    return STONE_IDS.map((itemId) => ({
        itemId,
        weight: weights[itemId] ?? 0,
        qtyMin: qty[itemId]?.min ?? 1,
        qtyMax: qty[itemId]?.max ?? 1,
    })).filter((e) => e.weight > 0 && e.qtyMax > 0);
}

export function getEquipmentBoxLootTable(facilityLevel: number): LootEntry[] {
    const L = Math.min(10, Math.max(1, facilityLevel));
    let weights: AnchorWeights;
    let qty: AnchorQty;

    if (L <= 4) {
        const t = (L - 1) / 3;
        weights = interpolateWeights(BOX_WEIGHTS.lv1, BOX_WEIGHTS.lv4, t, BOX_IDS);
        qty = interpolateQty(BOX_QTY.lv1, BOX_QTY.lv5, t * 0.5, BOX_IDS);
        // VI 강제 0
        weights['장비 상자 VI'] = 0;
        qty['장비 상자 VI'] = { min: 0, max: 0 };
        weights = normalizeWeights(weights);
    } else if (L === 5) {
        weights = normalizeWeights({ ...BOX_WEIGHTS.lv5 });
        qty = { ...BOX_QTY.lv5 };
    } else {
        const t = (L - 5) / 5;
        weights = interpolateWeights(BOX_WEIGHTS.lv5, BOX_WEIGHTS.lv10, t, BOX_IDS);
        qty = interpolateQty(BOX_QTY.lv5, BOX_QTY.lv10, t, BOX_IDS);
    }

    return BOX_IDS.map((itemId) => ({
        itemId,
        weight: weights[itemId] ?? 0,
        qtyMin: qty[itemId]?.min ?? 1,
        qtyMax: qty[itemId]?.max ?? 1,
    })).filter((e) => e.weight > 0 && e.qtyMax > 0);
}

export function rollWeightedLoot(table: LootEntry[], rng: () => number = Math.random): LootRollResult {
    const total = table.reduce((s, e) => s + e.weight, 0);
    if (total <= 0 || table.length === 0) {
        throw new Error('Empty loot table');
    }
    let r = rng() * total;
    for (const entry of table) {
        r -= entry.weight;
        if (r <= 0) {
            const span = Math.max(0, entry.qtyMax - entry.qtyMin);
            const quantity = entry.qtyMin + (span > 0 ? Math.floor(rng() * (span + 1)) : 0);
            return { itemId: entry.itemId, quantity: Math.max(1, quantity) };
        }
    }
    const last = table[table.length - 1]!;
    return { itemId: last.itemId, quantity: Math.max(1, last.qtyMin) };
}

export function rollProductionLoot(
    rewardType: 'enhance_stone' | 'equipment_box',
    facilityLevel: number,
    cycles: number,
    rng: () => number = Math.random,
): LootRollResult[] {
    const table =
        rewardType === 'enhance_stone' ? getEnhanceStoneLootTable(facilityLevel) : getEquipmentBoxLootTable(facilityLevel);
    const results: LootRollResult[] = [];
    const n = Math.max(0, Math.floor(cycles));
    for (let i = 0; i < n; i++) {
        results.push(rollWeightedLoot(table, rng));
    }
    return results;
}

/** 동일 itemId 수량 합산 */
export function mergeLootResults(rolls: LootRollResult[]): LootRollResult[] {
    const map = new Map<string, number>();
    for (const r of rolls) {
        map.set(r.itemId, (map.get(r.itemId) ?? 0) + r.quantity);
    }
    return [...map.entries()].map(([itemId, quantity]) => ({ itemId, quantity }));
}

/** UI용: 상위 등급 비중 합 (강화석: 상급+, 상자: IV+) */
export function highTierLootChancePercent(rewardType: 'enhance_stone' | 'equipment_box', facilityLevel: number): number {
    const table =
        rewardType === 'enhance_stone' ? getEnhanceStoneLootTable(facilityLevel) : getEquipmentBoxLootTable(facilityLevel);
    const highIds =
        rewardType === 'enhance_stone'
            ? new Set(['상급 강화석', '최상급 강화석', '신비의 강화석'])
            : new Set(['장비 상자 IV', '장비 상자 V', '장비 상자 VI']);
    const total = table.reduce((s, e) => s + e.weight, 0);
    if (total <= 0) return 0;
    const high = table.filter((e) => highIds.has(e.itemId)).reduce((s, e) => s + e.weight, 0);
    return Math.round((high / total) * 1000) / 10;
}
