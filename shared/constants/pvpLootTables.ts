export type PvpLootEntry = {
    name: string;
    chance: number;
    type: 'equipment' | 'material';
};

export const STRATEGIC_LOOT_TABLE: PvpLootEntry[] = [
    { name: '재료 상자 IV', chance: 0.1, type: 'material' },
    { name: '장비 상자 IV', chance: 0.1, type: 'equipment' },
    { name: '재료 상자 III', chance: 1, type: 'material' },
    { name: '장비 상자 III', chance: 1, type: 'equipment' },
    { name: '재료 상자 II', chance: 3, type: 'material' },
    { name: '장비 상자 II', chance: 3, type: 'equipment' },
    { name: '재료 상자 I', chance: 15, type: 'material' },
    { name: '장비 상자 I', chance: 15, type: 'equipment' },
];

export const PLAYFUL_LOOT_TABLES_BY_ROUNDS: Record<1 | 2 | 3, PvpLootEntry[]> = {
    3: [
        { name: '재료 상자 IV', chance: 0.05, type: 'material' },
        { name: '장비 상자 IV', chance: 0.05, type: 'equipment' },
        { name: '재료 상자 III', chance: 0.1, type: 'material' },
        { name: '장비 상자 III', chance: 0.1, type: 'equipment' },
        { name: '재료 상자 II', chance: 1, type: 'material' },
        { name: '장비 상자 II', chance: 1, type: 'equipment' },
        { name: '재료 상자 I', chance: 10, type: 'material' },
        { name: '장비 상자 I', chance: 10, type: 'equipment' },
    ],
    2: [
        { name: '재료 상자 IV', chance: 0.03, type: 'material' },
        { name: '장비 상자 IV', chance: 0.03, type: 'equipment' },
        { name: '재료 상자 III', chance: 0.05, type: 'material' },
        { name: '장비 상자 III', chance: 0.05, type: 'equipment' },
        { name: '재료 상자 II', chance: 0.5, type: 'material' },
        { name: '장비 상자 II', chance: 0.5, type: 'equipment' },
        { name: '재료 상자 I', chance: 5, type: 'material' },
        { name: '장비 상자 I', chance: 5, type: 'equipment' },
    ],
    1: [
        { name: '재료 상자 IV', chance: 0.01, type: 'material' },
        { name: '장비 상자 IV', chance: 0.01, type: 'equipment' },
        { name: '재료 상자 III', chance: 0.03, type: 'material' },
        { name: '장비 상자 III', chance: 0.03, type: 'equipment' },
        { name: '재료 상자 II', chance: 0.1, type: 'material' },
        { name: '장비 상자 II', chance: 0.1, type: 'equipment' },
        { name: '재료 상자 I', chance: 2, type: 'material' },
        { name: '장비 상자 I', chance: 2, type: 'equipment' },
    ],
};
