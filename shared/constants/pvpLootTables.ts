export type PvpLootEntry = {
    name: string;
    chance: number;
    type: 'equipment' | 'material';
};

/** 전략·놀이 바둑 종료 보상은 골드·경험치·랭킹(및 별도 정책 재화)만 두고 장비/재료 상자 드롭은 사용하지 않는다. */
export const STRATEGIC_LOOT_TABLE: PvpLootEntry[] = [];

export const PLAYFUL_LOOT_TABLES_BY_ROUNDS: Record<1 | 2 | 3, PvpLootEntry[]> = {
    1: [],
    2: [],
    3: [],
};
