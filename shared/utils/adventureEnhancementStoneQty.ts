/** 일반 몬스터 재료 슬롯 획득 시 강화석 1회 지급 개수(랜덤 구간) */
export const ADVENTURE_ENHANCEMENT_STONE_QTY_NORMAL: Record<string, { min: number; max: number }> = {
    '하급 강화석': { min: 1, max: 10 },
    '중급 강화석': { min: 1, max: 6 },
    '상급 강화석': { min: 1, max: 4 },
    '최상급 강화석': { min: 1, max: 2 },
    '신비의 강화석': { min: 1, max: 1 },
};

export function rollAdventureEnhancementStoneQuantity(stoneName: string, isBoss19Board: boolean): number {
    const r = ADVENTURE_ENHANCEMENT_STONE_QTY_NORMAL[stoneName];
    if (!r) return 1;
    const span = r.max - r.min + 1;
    let q = r.min + Math.floor(Math.random() * span);
    if (isBoss19Board) {
        q = Math.max(1, Math.round(q * 1.45));
        const cap = Math.max(r.max, Math.ceil(r.max * 1.85));
        q = Math.min(cap, q);
    }
    return q;
}
