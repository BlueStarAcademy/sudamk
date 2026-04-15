
import { TournamentDefinition, TournamentType, QuestReward } from '../types/index.js';
import { LeagueTier } from '../types/enums.js';

export const TOURNAMENT_DEFINITIONS: Record<TournamentType, TournamentDefinition> = {
    neighborhood: { id: 'neighborhood', name: '동네바둑리그', description: '6인 풀리그 방식으로 진행됩니다. 가장 많은 승리를 거두세요!', format: 'round-robin', players: 6, image: '/images/championship/Champ1.png' },
    national: { id: 'national', name: '전국바둑대회', description: '예선을 거쳐 8강 토너먼트로 최강자를 가립니다.', format: 'tournament', players: 8, image: '/images/championship/Champ2.png' },
    world: { id: 'world', name: '월드챔피언십', description: '세계 각국의 강자들이 모인 16강 토너먼트입니다.', format: 'tournament', players: 16, image: '/images/championship/Champ3.png' },
};

export type TournamentRewardInfo = QuestReward;

// 동네바둑리그 리그별 경기 보상 (승리/패배)
export const NEIGHBORHOOD_MATCH_REWARDS: Record<LeagueTier, { win: number; loss: number }> = {
    [LeagueTier.Sprout]: { win: 100, loss: 50 },
    [LeagueTier.Rookie]: { win: 200, loss: 75 },
    [LeagueTier.Rising]: { win: 300, loss: 100 },
    [LeagueTier.Ace]: { win: 500, loss: 150 },
    [LeagueTier.Diamond]: { win: 1000, loss: 200 },
    [LeagueTier.Master]: { win: 1500, loss: 300 },
    [LeagueTier.Grandmaster]: { win: 2000, loss: 500 },
    [LeagueTier.Challenger]: { win: 3000, loss: 1000 },
};

// 전국바둑대회 리그별 경기 보상 (승리/패배) - 강화석
export const NATIONAL_MATCH_REWARDS: Record<LeagueTier, { win: { materialName: string; quantity: number }; loss: { materialName: string; quantity: number } }> = {
    [LeagueTier.Sprout]: { win: { materialName: '하급 강화석', quantity: 10 }, loss: { materialName: '하급 강화석', quantity: 4 } },
    [LeagueTier.Rookie]: { win: { materialName: '중급 강화석', quantity: 10 }, loss: { materialName: '중급 강화석', quantity: 4 } },
    [LeagueTier.Rising]: { win: { materialName: '중급 강화석', quantity: 20 }, loss: { materialName: '중급 강화석', quantity: 8 } },
    [LeagueTier.Ace]: { win: { materialName: '상급 강화석', quantity: 10 }, loss: { materialName: '상급 강화석', quantity: 4 } },
    [LeagueTier.Diamond]: { win: { materialName: '상급 강화석', quantity: 20 }, loss: { materialName: '상급 강화석', quantity: 8 } },
    [LeagueTier.Master]: { win: { materialName: '최상급 강화석', quantity: 5 }, loss: { materialName: '최상급 강화석', quantity: 2 } },
    [LeagueTier.Grandmaster]: { win: { materialName: '최상급 강화석', quantity: 10 }, loss: { materialName: '최상급 강화석', quantity: 4 } },
    [LeagueTier.Challenger]: { win: { materialName: '신비의 강화석', quantity: 10 }, loss: { materialName: '신비의 강화석', quantity: 4 } },
};

// 월드챔피언십 리그별 경기 보상 (승리/패배) - 장비상자
export const WORLD_MATCH_REWARDS: Record<LeagueTier, { win: { boxName: string; quantity: number }; loss: { boxName: string; quantity: number } }> = {
    [LeagueTier.Sprout]: { win: { boxName: '장비 상자 I', quantity: 2 }, loss: { boxName: '장비 상자 I', quantity: 1 } },
    [LeagueTier.Rookie]: { win: { boxName: '장비 상자 I', quantity: 4 }, loss: { boxName: '장비 상자 I', quantity: 2 } },
    [LeagueTier.Rising]: { win: { boxName: '장비 상자 II', quantity: 2 }, loss: { boxName: '장비 상자 II', quantity: 1 } },
    [LeagueTier.Ace]: { win: { boxName: '장비 상자 II', quantity: 4 }, loss: { boxName: '장비 상자 II', quantity: 2 } },
    [LeagueTier.Diamond]: { win: { boxName: '장비 상자 III', quantity: 2 }, loss: { boxName: '장비 상자 III', quantity: 1 } },
    [LeagueTier.Master]: { win: { boxName: '장비 상자 III', quantity: 4 }, loss: { boxName: '장비 상자 III', quantity: 2 } },
    [LeagueTier.Grandmaster]: { win: { boxName: '장비 상자 IV', quantity: 2 }, loss: { boxName: '장비 상자 IV', quantity: 1 } },
    [LeagueTier.Challenger]: { win: { boxName: '장비 상자 IV', quantity: 4 }, loss: { boxName: '장비 상자 IV', quantity: 2 } },
};

export const BASE_TOURNAMENT_REWARDS: Record<TournamentType, { rewardType: 'rank', rewards: Record<number, TournamentRewardInfo> }> = {
    neighborhood: { // 6인 풀리그, key = rank
        rewardType: 'rank',
        rewards: {
            1: { items: [{ itemId: '골드 꾸러미4', quantity: 1 }, { itemId: '다이아 꾸러미1', quantity: 1 }] }, // 우승
            2: { items: [{ itemId: '골드 꾸러미3', quantity: 1 }] }, // 준우승
            3: { items: [{ itemId: '골드 꾸러미2', quantity: 1 }] }, // 3위
            4: { items: [{ itemId: '골드 꾸러미1', quantity: 1 }] }, // 4-6위
        }
    },
    national: { // 8강 토너먼트, key = rank
        rewardType: 'rank',
        rewards: {
            1: { items: [{ itemId: '골드 꾸러미4', quantity: 1 }, { itemId: '다이아 꾸러미2', quantity: 1 }] }, // 우승
            2: { items: [{ itemId: '골드 꾸러미3', quantity: 1 }, { itemId: '다이아 꾸러미1', quantity: 1 }] }, // 준우승
            3: { items: [{ itemId: '골드 꾸러미2', quantity: 1 }, { itemId: '다이아 꾸러미1', quantity: 1 }] }, // 3위
            4: { items: [{ itemId: '골드 꾸러미1', quantity: 1 }, { itemId: '다이아 꾸러미1', quantity: 1 }] }, // 4위
            5: { items: [{ itemId: '골드 꾸러미1', quantity: 1 }] },   // 5-8위 (8강 탈락)
        }
    },
    // 월드: 순위 보상은 서버에서 getDungeonRankRewardWorld(단계, 순위)로 다이아만 지급. 아래는 레거시 키 유지용(빈 items).
    world: { // 16강 토너먼트, key = rank
        rewardType: 'rank',
        rewards: {
            1: { items: [] },
            2: { items: [] },
            3: { items: [] },
            4: { items: [] },
            5: { items: [] },
            9: { items: [] },
        }
    }
};

export const TOURNAMENT_SCORE_REWARDS: Record<TournamentType, Record<number, number>> = {
    neighborhood: { 1: 32, 2: 16, 3: 8, 4: 5, 5: 3, 6: 1 },
    national:     { 1: 46, 2: 29, 3: 15, 4: 7, 5: 2 },
    world:        { 1: 58, 2: 44, 3: 21, 4: 11, 5: 5, 9: 3 },
};

// === 던전 시스템 상수 ===

// 단계별 봇 능력치 범위 (각 능력치 개별 값)
export const DUNGEON_STAGE_BOT_STATS: Record<number, { minStat: number; maxStat: number }> = {
    1: { minStat: 120, maxStat: 120 },
    2: { minStat: 160, maxStat: 160 },
    3: { minStat: 220, maxStat: 220 },
    4: { minStat: 300, maxStat: 300 },
    5: { minStat: 400, maxStat: 400 },
    6: { minStat: 520, maxStat: 520 },
    7: { minStat: 660, maxStat: 660 },
    8: { minStat: 820, maxStat: 820 },
    9: { minStat: 1000, maxStat: 1000 },
    10: { minStat: 1200, maxStat: 1200 },
};

// 던전 타입별 능력치 배율
export const DUNGEON_TYPE_MULTIPLIER: Record<TournamentType, number> = {
    neighborhood: 0.8,  // 가장 쉬움
    national: 1.0,      // 기준
    world: 1.2,         // 가장 어려움
};

// 순위별 보상 배율
export const DUNGEON_RANK_REWARD_MULTIPLIER: Record<number, number> = {
    1: 2.0,   // 1위: 기본 보상 × 2.0
    2: 1.5,   // 2위: 기본 보상 × 1.5
    3: 1.3,   // 3위: 기본 보상 × 1.3
    4: 1.1,   // 4~10위: 기본 보상 × 1.1
    5: 1.1,
    6: 1.1,
    7: 1.1,
    8: 1.1,
    9: 1.1,
    10: 1.1,
};

// 기본 보상 배율 (11위 이하)
export const DUNGEON_DEFAULT_REWARD_MULTIPLIER = 1.0;

/** 3·6·9·10단계 순위·경기 보상 추가 배수 (10단계 최고). 전국·월드 순위 보상 등에 사용 */
export function getDungeonStageRewardMilestoneMultiplier(stage: number): number {
    const s = Math.min(10, Math.max(1, Math.floor(stage)));
    switch (s) {
        case 3:
            return 1.38;
        case 6:
            return 1.62;
        case 9:
            return 1.95;
        case 10:
            return 2.35;
        default:
            return 1;
    }
}

/**
 * 동네바둑리그 전용: 단계가 올라갈수록 골드 배수가 항상 증가 (경기당·순위 공통).
 * 기존 마일스톤만 쓰면 6단계(배수↑) 직후 7단계(배수 1)에서 보상이 역전되는 문제가 있어 별도 곡선을 둠.
 */
export function getNeighborhoodDungeonGoldStageMultiplier(stage: number): number {
    const s = Math.min(10, Math.max(1, Math.floor(stage)));
    const table: Record<number, number> = {
        1: 1.0,
        2: 1.06,
        3: 1.3, // 관문: 2→3 체감 상승
        4: 1.42,
        5: 1.52,
        6: 1.66,
        7: 1.8,
        8: 1.94,
        9: 2.12,
        10: 2.38,
    };
    return table[s] ?? 1;
}

/** 단계 봇 6능력치 구간의 기대값(중간값). UI 추천 단계용 */
export function getDungeonBotExpectedAverageCoreStat(stage: number): number {
    const s = Math.min(10, Math.max(1, Math.floor(stage)));
    const row = DUNGEON_STAGE_BOT_STATS[s];
    if (!row) return 110;
    return (row.minStat + row.maxStat) / 2;
}

/**
 * 내 6능력 평균이 봇 기대 평균보다 큰 단계들 중 최댓값.
 * 타입 배율(DUNGEON_TYPE_MULTIPLIER)은 봇 생성 경로에 따라 다를 수 있어 여기서는 단계 테이블만 사용.
 */
export function getHighestDungeonStageWhereUserAvgExceedsBot(userAverageCoreStat: number): number | null {
    if (!Number.isFinite(userAverageCoreStat) || userAverageCoreStat <= 0) return null;
    let best: number | null = null;
    for (let st = 1; st <= 10; st++) {
        if (userAverageCoreStat > getDungeonBotExpectedAverageCoreStat(st)) best = st;
    }
    return best;
}

// --- 던전 경기당 범위 보상 (한 판 끝날 때마다 지급) ---

/** 1~10 단계 선형 보간: t=(stage-1)/9 */
function lerp(stage: number, a1: number, b1: number, a10: number, b10: number): { min: number; max: number } {
    const t = (stage - 1) / 9;
    return { min: Math.round(a1 + (a10 - a1) * t), max: Math.round(b1 + (b10 - b1) * t) };
}

/** 경기당 골드 min/max를 100골드 단위로 정렬 (표시·지급 범위) */
function roundDungeonGoldBounds(min: number, max: number): { min: number; max: number } {
    const step = 100;
    const rMin = Math.max(step, Math.floor(min / step) * step);
    const rMax = Math.max(rMin + step, Math.ceil(max / step) * step);
    return { min: rMin, max: rMax };
}

// 동네바둑리그: 1↔10 보간 × 단조 증가 단계 배수 → 100골드 단위
/** 단계별 경기당 골드 기본 보상 범위 (표시·실지급 동일, 단계마다 보수 단조 증가) */
export function getDungeonBasicRewardRangeGold(stage: number): { win: { min: number; max: number }; loss: { min: number; max: number } } {
    const winRange = lerp(stage, 220, 380, 4500, 10500);
    const lossRange = lerp(stage, 110, 190, 2250, 5200);
    const m = getNeighborhoodDungeonGoldStageMultiplier(stage);
    const scale = (rng: { min: number; max: number }) => {
        const min = Math.max(1, Math.round(rng.min * m));
        const max = Math.max(min, Math.round(rng.max * m));
        return roundDungeonGoldBounds(min, max);
    };
    return { win: scale(winRange), loss: scale(lossRange) };
}

export function getDungeonMatchGoldReward(stage: number, isWin: boolean): number {
    const { win: winRange, loss: lossRange } = getDungeonBasicRewardRangeGold(stage);
    const r = isWin ? winRange : lossRange;
    return r.min + Math.floor(Math.random() * (r.max - r.min + 1));
}

// 전국바둑대회: 가중치 합 100으로 한 종류만 지급 (9·10단계 신비의 강화석 약 1%/10%)
export type DungeonMaterialRoll = { chance: number; materialName: string; min: number; max: number };
export type DungeonMaterialWeightedEntry = { materialName: string; min: number; max: number; weight: number };

export const DUNGEON_STAGE_MATERIAL_WEIGHTED: Record<number, { win: DungeonMaterialWeightedEntry[]; loss: DungeonMaterialWeightedEntry[] }> = {
    1: {
        win: [{ materialName: '하급 강화석', min: 12, max: 24, weight: 100 }],
        loss: [{ materialName: '하급 강화석', min: 6, max: 12, weight: 100 }],
    },
    2: {
        win: [{ materialName: '하급 강화석', min: 14, max: 26, weight: 100 }],
        loss: [{ materialName: '하급 강화석', min: 7, max: 14, weight: 100 }],
    },
    3: {
        win: [
            { materialName: '중급 강화석', min: 10, max: 18, weight: 72 },
            { materialName: '하급 강화석', min: 12, max: 20, weight: 28 },
        ],
        loss: [
            { materialName: '중급 강화석', min: 5, max: 10, weight: 72 },
            { materialName: '하급 강화석', min: 6, max: 12, weight: 28 },
        ],
    },
    4: {
        win: [{ materialName: '중급 강화석', min: 12, max: 22, weight: 100 }],
        loss: [{ materialName: '중급 강화석', min: 6, max: 12, weight: 100 }],
    },
    5: {
        win: [{ materialName: '중급 강화석', min: 14, max: 26, weight: 100 }],
        loss: [{ materialName: '중급 강화석', min: 7, max: 14, weight: 100 }],
    },
    6: {
        win: [
            { materialName: '상급 강화석', min: 8, max: 16, weight: 78 },
            { materialName: '중급 강화석', min: 10, max: 18, weight: 22 },
        ],
        loss: [
            { materialName: '상급 강화석', min: 4, max: 9, weight: 78 },
            { materialName: '중급 강화석', min: 6, max: 12, weight: 22 },
        ],
    },
    7: {
        win: [{ materialName: '상급 강화석', min: 10, max: 22, weight: 100 }],
        loss: [{ materialName: '상급 강화석', min: 5, max: 12, weight: 100 }],
    },
    8: {
        win: [{ materialName: '최상급 강화석', min: 7, max: 16, weight: 100 }],
        loss: [{ materialName: '최상급 강화석', min: 4, max: 9, weight: 100 }],
    },
    9: {
        win: [
            { materialName: '신비의 강화석', min: 1, max: 1, weight: 1 },
            { materialName: '최상급 강화석', min: 6, max: 12, weight: 54 },
            { materialName: '상급 강화석', min: 10, max: 20, weight: 45 },
        ],
        loss: [
            { materialName: '신비의 강화석', min: 1, max: 1, weight: 1 },
            { materialName: '최상급 강화석', min: 4, max: 8, weight: 44 },
            { materialName: '상급 강화석', min: 7, max: 16, weight: 35 },
            { materialName: '중급 강화석', min: 8, max: 16, weight: 20 },
        ],
    },
    10: {
        win: [
            { materialName: '신비의 강화석', min: 1, max: 2, weight: 10 },
            { materialName: '최상급 강화석', min: 7, max: 14, weight: 45 },
            { materialName: '상급 강화석', min: 12, max: 22, weight: 45 },
        ],
        loss: [
            { materialName: '신비의 강화석', min: 1, max: 1, weight: 5 },
            { materialName: '최상급 강화석', min: 5, max: 11, weight: 40 },
            { materialName: '상급 강화석', min: 8, max: 18, weight: 35 },
            { materialName: '중급 강화석', min: 10, max: 18, weight: 20 },
        ],
    },
};

function weightedMaterialPick(entries: DungeonMaterialWeightedEntry[]): Record<string, number> {
    const sum = entries.reduce((a, e) => a + e.weight, 0);
    if (sum <= 0) return {};
    let r = Math.random() * sum;
    for (const e of entries) {
        r -= e.weight;
        if (r < 0) {
            const qty = e.min + Math.floor(Math.random() * (e.max - e.min + 1));
            return qty > 0 ? { [e.materialName]: qty } : {};
        }
    }
    const last = entries[entries.length - 1];
    const qty = last.min + Math.floor(Math.random() * (last.max - last.min + 1));
    return qty > 0 ? { [last.materialName]: qty } : {};
}

export function getDungeonMatchMaterialReward(stage: number, isWin: boolean): Record<string, number> {
    const s = Math.min(10, Math.max(1, Math.floor(stage)));
    const config = DUNGEON_STAGE_MATERIAL_WEIGHTED[s] ?? DUNGEON_STAGE_MATERIAL_WEIGHTED[1];
    const entries = isWin ? config.win : config.loss;
    return weightedMaterialPick(entries);
}

/** UI·토너먼트 패널용 (가중치를 chance%로 표기) */
export const DUNGEON_STAGE_MATERIAL_ROLLS: Record<number, { win: DungeonMaterialRoll[]; loss?: DungeonMaterialRoll[] }> = Object.fromEntries(
    ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const).map((st) => {
        const w = DUNGEON_STAGE_MATERIAL_WEIGHTED[st];
        return [
            st,
            {
                win: w.win.map((e) => ({ chance: e.weight, materialName: e.materialName, min: e.min, max: e.max })),
                loss: w.loss.map((e) => ({ chance: e.weight, materialName: e.materialName, min: e.min, max: e.max })),
            },
        ];
    })
) as Record<number, { win: DungeonMaterialRoll[]; loss?: DungeonMaterialRoll[] }>;

// 월드챔피언십: 구간별 3등급 풀 보간, 승리 확률 합 100% — 패배는 하위 등급 가중
export type EquipmentGradeKey = 'normal' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

function allocateHundredFromWeights(w: readonly [number, number, number]): [number, number, number] {
    const sum = w[0] + w[1] + w[2];
    if (sum <= 0) return [34, 33, 33];
    const exact = [w[0] / sum * 100, w[1] / sum * 100, w[2] / sum * 100];
    const floor = exact.map((x) => Math.floor(x));
    let rem = 100 - floor[0] - floor[1] - floor[2];
    const order = [0, 1, 2].sort((i, j) => (exact[j] - floor[j]) - (exact[i] - floor[i]));
    const out = [...floor] as [number, number, number];
    for (let k = 0; k < rem; k++) out[order[k % 3]]++;
    return out;
}

function lerpEquipmentTriple(
    stage: number,
    segLo: number,
    segHi: number,
    start: readonly [number, number, number],
    end: readonly [number, number, number],
): [number, number, number] {
    const t = segHi <= segLo ? 0 : (stage - segLo) / (segHi - segLo);
    return allocateHundredFromWeights([
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
        start[2] + (end[2] - start[2]) * t,
    ]);
}

/** 승리 시 장비 등급 분포 (낮은 등급 → 높은 등급 순) */
export function getDungeonEquipmentWinChances(stage: number): { grade: EquipmentGradeKey; chance: number }[] {
    const s = Math.min(10, Math.max(1, Math.floor(stage)));
    if (s <= 3) {
        const [a, b, c] = lerpEquipmentTriple(s, 1, 3, [70, 20, 10], [20, 35, 45]);
        return [
            { grade: 'normal', chance: a },
            { grade: 'uncommon', chance: b },
            { grade: 'rare', chance: c },
        ];
    }
    if (s <= 6) {
        const [a, b, c] = lerpEquipmentTriple(s, 4, 6, [70, 20, 10], [20, 35, 45]);
        return [
            { grade: 'uncommon', chance: a },
            { grade: 'rare', chance: b },
            { grade: 'epic', chance: c },
        ];
    }
    if (s <= 8) {
        const [a, b, c] = lerpEquipmentTriple(s, 7, 8, [70, 20, 10], [20, 35, 45]);
        return [
            { grade: 'rare', chance: a },
            { grade: 'epic', chance: b },
            { grade: 'legendary', chance: c },
        ];
    }
    if (s === 9) {
        return [
            { grade: 'epic', chance: 80 },
            { grade: 'legendary', chance: 19 },
            { grade: 'mythic', chance: 1 },
        ];
    }
    return [
        { grade: 'epic', chance: 60 },
        { grade: 'legendary', chance: 30 },
        { grade: 'mythic', chance: 10 },
    ];
}

/** 승리 분포에서 하위 등급으로 확률 이동 (합 100%) */
export function getDungeonEquipmentLossChancesFromWin(win: { grade: EquipmentGradeKey; chance: number }[]): { grade: EquipmentGradeKey; chance: number }[] {
    const biases: [number, number, number] = [1.55, 1.05, 0.4];
    const w = win.map((e, i) => e.chance * biases[i]);
    const [a, b, c] = allocateHundredFromWeights([w[0], w[1], w[2]]);
    return win.map((e, i) => ({ grade: e.grade, chance: [a, b, c][i] }));
}

export const DUNGEON_STAGE_EQUIPMENT_DROP: Record<number, { win: { grade: EquipmentGradeKey; chance: number }[]; loss: { grade: EquipmentGradeKey; chance: number }[] }> = (() => {
    const out: Record<number, { win: { grade: EquipmentGradeKey; chance: number }[]; loss: { grade: EquipmentGradeKey; chance: number }[] }> = {};
    for (let s = 1; s <= 10; s++) {
        const win = getDungeonEquipmentWinChances(s);
        out[s] = { win, loss: getDungeonEquipmentLossChancesFromWin(win) };
    }
    return out;
})();

export function getDungeonMatchEquipmentGrade(stage: number, isWin: boolean): EquipmentGradeKey {
    const config = DUNGEON_STAGE_EQUIPMENT_DROP[stage] || DUNGEON_STAGE_EQUIPMENT_DROP[1];
    const list = isWin ? config.win : config.loss;
    let r = Math.random() * 100;
    for (const e of list) {
        r -= e.chance;
        if (r < 0) return e.grade;
    }
    return list[list.length - 1].grade;
}

// 레거시 호환: 단일 고정값 (동네 승리 골드 중간값 × 동네 단조 배수, 50골드 단위)
export const DUNGEON_STAGE_BASE_REWARDS_GOLD: Record<number, number> = Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => {
        const w = lerp(s, 220, 380, 4500, 10500);
        const mid = ((w.min + w.max) / 2) * getNeighborhoodDungeonGoldStageMultiplier(s);
        const rounded = Math.round(mid / 50) * 50;
        return [s, Math.max(50, rounded)];
    })
) as Record<number, number>;

// 전국바둑대회 단계별 기본 재료 (scheduledTasks 등 — 경기당 가중 롤과 대략 정합)
export const DUNGEON_STAGE_BASE_REWARDS_MATERIAL: Record<number, { materialName: string; quantity: number }> = {
    1: { materialName: '하급 강화석', quantity: 18 },
    2: { materialName: '하급 강화석', quantity: 20 },
    3: { materialName: '중급 강화석', quantity: 14 },
    4: { materialName: '중급 강화석', quantity: 17 },
    5: { materialName: '중급 강화석', quantity: 20 },
    6: { materialName: '상급 강화석', quantity: 12 },
    7: { materialName: '상급 강화석', quantity: 16 },
    8: { materialName: '최상급 강화석', quantity: 11 },
    9: { materialName: '최상급 강화석', quantity: 10 },
    10: { materialName: '최상급 강화석', quantity: 11 },
};

export const DUNGEON_STAGE_BASE_REWARDS_EQUIPMENT: Record<number, { boxes: { boxName: string; quantity: number }[]; changeTickets: number }> = {
    1: { boxes: [{ boxName: '장비 상자 I', quantity: 1 }], changeTickets: 0 },
    2: { boxes: [{ boxName: '장비 상자 I', quantity: 1 }], changeTickets: 0 },
    3: { boxes: [{ boxName: '장비 상자 II', quantity: 1 }], changeTickets: 0 },
    4: { boxes: [{ boxName: '장비 상자 II', quantity: 1 }], changeTickets: 1 },
    5: { boxes: [{ boxName: '장비 상자 III', quantity: 2 }], changeTickets: 1 },
    6: { boxes: [{ boxName: '장비 상자 III', quantity: 2 }], changeTickets: 1 },
    7: { boxes: [{ boxName: '장비 상자 IV', quantity: 2 }], changeTickets: 2 },
    8: { boxes: [{ boxName: '장비 상자 IV', quantity: 2 }], changeTickets: 2 },
    9: { boxes: [{ boxName: '장비 상자 IV', quantity: 3 }], changeTickets: 2 },
    10: { boxes: [{ boxName: '장비 상자 IV', quantity: 3 }], changeTickets: 3 },
};

// 일일 랭킹 점수: 단계별 기본 점수 (레거시, DUNGEON_STAGE_1_SCORE_BY_TYPE + 배율 사용 권장)
export const DUNGEON_STAGE_BASE_SCORE: Record<number, number> = {
    1: 10,
    2: 15,
    3: 20,
    4: 30,
    5: 50,
    6: 65,
    7: 80,
    8: 90,
    9: 95,
    10: 100,
};

// 일일 랭킹 점수: 순위별 보너스 배율 (레거시)
export const DUNGEON_RANK_SCORE_BONUS: Record<number, number> = {
    1: 0.5,   // 1위: +50%
    2: 0.3,   // 2위: +30%
    3: 0.2,   // 3위: +20%
    4: 0.1,   // 4~10위: +10%
    5: 0.1,
    6: 0.1,
    7: 0.1,
    8: 0.1,
    9: 0.1,
    10: 0.1,
};

// 기본 보너스 (11위 이하)
export const DUNGEON_DEFAULT_SCORE_BONUS = 0.0;

// --- 던전 타입·단계별 챔피언십 점수 (일일 획득 가능 점수) ---
// 1단계 기준 순위별 점수: 동네(6인), 전국(8인), 월드(15인)
export const DUNGEON_STAGE_1_SCORE_BY_TYPE: Record<TournamentType, Record<number, number>> = {
    neighborhood: { 1: 15, 2: 10, 3: 6, 4: 3, 5: 2, 6: 1 },
    national:     { 1: 21, 2: 14, 3: 7, 4: 3, 5: 3, 6: 3, 7: 3, 8: 2 },
    world:        { 1: 24, 2: 16, 3: 10, 4: 7, 5: 5, 6: 5, 7: 5, 8: 5, 9: 3, 10: 3, 11: 3, 12: 3, 13: 3, 14: 3, 15: 3, 16: 3 },
};

// 2~10단계 배율 (1단계 점수 × 이 배율 = 해당 단계 점수, 소수점 반올림)
export const DUNGEON_STAGE_SCORE_MULTIPLIER: Record<number, number> = {
    1: 1.0,
    2: 1.2,
    3: 1.4,
    4: 1.6,
    5: 1.8,
    6: 2.0,
    7: 2.2,
    8: 2.4,
    9: 2.6,
    10: 2.8,
};

/** 던전 타입·단계·순위에 따른 챔피언십 점수 (일일 획득 가능 점수 및 실제 지급 점수) */
export function getDungeonStageScore(type: TournamentType, stage: number, rank: number): number {
    const base = DUNGEON_STAGE_1_SCORE_BY_TYPE[type]?.[rank] ?? 0;
    const mult = DUNGEON_STAGE_SCORE_MULTIPLIER[stage] ?? 1;
    return Math.round(base * mult);
}

// 던전 순위 보상: 직접 지급 (골드/재료/다이아). 1단계 1위 = 200골드, 10단계 1위 = 5000골드 등 비율로 2~9단계 보정
export type DungeonRankRewardResult = { gold?: number; materials?: Record<string, number>; diamonds?: number; items?: Array<{ itemId: string; quantity: number }> };

/** 골드 보상을 50골드 단위로 반올림 (최소 50, 0은 0 유지) */
function roundGoldToFifty(raw: number): number {
    if (raw <= 0) return 0;
    const rounded = Math.round(raw / 50) * 50;
    return Math.max(50, rounded);
}

function rankGoldNeighborhood(stage: number, rank: number): number {
    const s1: Record<number, number> = { 1: 450, 2: 280, 3: 190, 4: 120, 5: 70, 6: 50 };
    const s10: Record<number, number> = { 1: 12000, 2: 7200, 3: 4800, 4: 3000, 5: 1800, 6: 1200 };
    const t = (stage - 1) / 9;
    const a = s1[rank] ?? 10, b = s10[rank] ?? 300;
    const raw = Math.round((a + (b - a) * t) * getNeighborhoodDungeonGoldStageMultiplier(stage));
    return roundGoldToFifty(raw);
}

export function getDungeonRankRewardNeighborhood(stage: number, rank: number): DungeonRankRewardResult {
    if (rank < 1 || rank > 6) return {};
    return { gold: rankGoldNeighborhood(stage, rank) };
}

// 전국바둑대회 순위 보상: 1~2단계 하급, 3단계~ 중급, 5단계~ 상급, 7단계~ 최상급, 10단계 1위 신비의 강화석(마일스톤 상향)
const NATIONAL_RANK_QTY: Record<string, Record<number, number>> = {
    '하급 강화석': { 1: 30, 2: 22, 3: 16, 4: 12, 5: 9, 6: 6, 7: 4, 8: 2 },
    '중급 강화석': { 1: 20, 2: 15, 3: 12, 4: 9, 5: 7, 6: 5, 7: 3, 8: 2 },
    '상급 강화석': { 1: 15, 2: 12, 3: 9, 4: 7, 5: 5, 6: 4, 7: 3, 8: 2 },
    '최상급 강화석': { 1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 },
};
function rankMaterialNational(stage: number, rank: number): Record<string, number> {
    if (rank < 1 || rank > 8) return {};
    if (stage >= 10 && rank === 1) return { '신비의 강화석': 4 };
    let materialName: string;
    if (stage <= 2) materialName = '하급 강화석';
    else if (stage <= 4) materialName = '중급 강화석';
    else if (stage <= 6) materialName = '상급 강화석';
    else materialName = '최상급 강화석';
    const qty = NATIONAL_RANK_QTY[materialName]?.[rank] ?? 1;
    const m = getDungeonStageRewardMilestoneMultiplier(stage);
    return { [materialName]: Math.max(1, Math.round(qty * m)) };
}

export function getDungeonRankRewardNational(stage: number, rank: number): DungeonRankRewardResult {
    if (rank < 1 || rank > 8) return {};
    return { materials: rankMaterialNational(stage, rank) };
}

// 월드: 다이아 직접. 1→10단계 선형 보간만 사용(단계가 올라갈수록 구간이 항상 증가).
// 마일스톤 배수는 적용하지 않음 — 적용 시 6→7단계 등에서 기대 보상이 일시적으로 줄어드는 현상이 있었음.
// 10단계 상한: 1위 max 20, 2위 max 15, 3위 max 10, 4위 max 7 (5~8위는 그에 맞춰 완만히 상향).
const WORLD_DIAMOND_S1: Record<number, { min: number; max: number }> = {
    1: { min: 2, max: 3 },
    2: { min: 1, max: 2 },
    3: { min: 1, max: 1 },
    4: { min: 1, max: 1 },
    5: { min: 1, max: 1 },
    6: { min: 1, max: 1 },
    7: { min: 1, max: 1 },
    8: { min: 1, max: 1 },
};
const WORLD_DIAMOND_S10: Record<number, { min: number; max: number }> = {
    1: { min: 18, max: 20 },
    2: { min: 12, max: 15 },
    3: { min: 8, max: 10 },
    4: { min: 5, max: 7 },
    5: { min: 3, max: 4 },
    6: { min: 2, max: 3 },
    7: { min: 1, max: 2 },
    8: { min: 1, max: 1 },
};

function worldDiamondInterpolatedRange(stage: number, rank: number): { min: number; max: number } | null {
    if (rank >= 9) return null;
    const r = WORLD_DIAMOND_S1[rank] || { min: 0, max: 0 };
    const r10 = WORLD_DIAMOND_S10[rank] || { min: 0, max: 0 };
    const t = (stage - 1) / 9;
    let min = Math.round(r.min + (r10.min - r.min) * t);
    let max = Math.round(r.max + (r10.max - r.max) * t);
    if (max < 1) return null;
    min = Math.max(1, min);
    max = Math.max(min, max);
    return { min, max };
}

/** 월드 다이아 min~max (표시·실지급 RNG 공통). 마일스톤 미적용. */
function worldDiamondRangeWithMilestone(stage: number, rank: number): { min: number; max: number } | null {
    return worldDiamondInterpolatedRange(stage, rank);
}

function rankDiamondsWorld(stage: number, rank: number): number {
    const rng = worldDiamondRangeWithMilestone(stage, rank);
    if (!rng) return 0;
    return rng.min + Math.floor(Math.random() * (rng.max - rng.min + 1));
}

export function getDungeonRankRewardWorld(stage: number, rank: number): DungeonRankRewardResult {
    if (rank >= 9) return {};
    const d = rankDiamondsWorld(stage, rank);
    return d > 0 ? { diamonds: d } : {};
}

// 전국 순위 보상 표시용 (실제 지급과 동일한 단계별 강화석 종류·수량)
function rankMaterialNationalDisplay(stage: number, rank: number): Record<string, number> {
    return rankMaterialNational(stage, rank);
}

// 월드 다이아 표시용 (구간 중간값)
function rankDiamondsWorldMidpoint(stage: number, rank: number): number {
    const rng = worldDiamondRangeWithMilestone(stage, rank);
    if (!rng) return 0;
    return Math.round((rng.min + rng.max) / 2);
}

/** 실제 지급 로직과 동일한 순위 보상을 UI 표시용 아이템 형태로 반환 (동네=골드, 전국=강화석, 월드=다이아) */
export function getDungeonRankRewardForDisplay(type: TournamentType, stage: number, rank: number): QuestReward | null {
    if (type === 'neighborhood') {
        if (rank < 1 || rank > 6) return null;
        const gold = rankGoldNeighborhood(stage, rank);
        return { items: [{ itemId: '골드', quantity: gold }] };
    }
    if (type === 'national') {
        if (rank < 1 || rank > 8) return null;
        const mat = rankMaterialNationalDisplay(stage, rank);
        const entries = Object.entries(mat);
        if (!entries.length) return null;
        return { items: entries.map(([name, qty]) => ({ itemId: name, quantity: qty })) };
    }
    if (type === 'world') {
        if (rank >= 9) return { items: [] }; // 9~16위 표시용
        const d = rankDiamondsWorldMidpoint(stage, rank);
        if (d <= 0) return null;
        return { items: [{ itemId: '다이아', quantity: d }] };
    }
    return null;
}

/** 표시할 순위 키 목록 (동네 1~6, 전국 1~8, 월드 1·2·3·4~8·9) */
export function getDungeonRankKeysForDisplay(type: TournamentType): number[] {
    if (type === 'neighborhood') return [1, 2, 3, 4, 5, 6];
    if (type === 'national') return [1, 2, 3, 4, 5, 6, 7, 8];
    return [1, 2, 3, 4, 9]; // 4 = 4~8위 묶음, 9 = 9~16위
}

/** 순위 보상 범위 표시용 (min~max 또는 단일값). UI에서 "3~5 다이아" 형태로 표시할 때 사용 */
export type DungeonRankRewardRangeItem = { itemId: string; min: number; max: number };
export function getDungeonRankRewardRangeForDisplay(type: TournamentType, stage: number, rank: number): { items: DungeonRankRewardRangeItem[] } | null {
    if (type === 'neighborhood') {
        if (rank < 1 || rank > 6) return null;
        const gold = rankGoldNeighborhood(stage, rank);
        return { items: [{ itemId: '골드', min: gold, max: gold }] };
    }
    if (type === 'national') {
        if (rank < 1 || rank > 8) return null;
        const mat = rankMaterialNational(stage, rank);
        const entries = Object.entries(mat);
        if (!entries.length) return null;
        return { items: entries.map(([name, qty]) => ({ itemId: name, min: qty, max: qty })) };
    }
    if (type === 'world') {
        if (rank >= 9) return rank === 9 ? { items: [] } : null;
        const ranksToAggregate = rank === 4 ? [4, 5, 6, 7, 8] : [rank];
        let minV = Infinity, maxV = -Infinity;
        for (const rk of ranksToAggregate) {
            const rng = worldDiamondRangeWithMilestone(stage, rk);
            if (!rng) continue;
            if (rng.min < minV) minV = rng.min;
            if (rng.max > maxV) maxV = rng.max;
        }
        if (maxV <= 0 || minV === Infinity) return null;
        return { items: [{ itemId: '다이아', min: minV, max: maxV }] };
    }
    return null;
}

// 레거시 DUNGEON_RANK_REWARDS (아이템 형태): 실제 지급은 getDungeonRankReward* 사용, UI는 getDungeonRankRewardForDisplay 사용 권장
export const DUNGEON_RANK_REWARDS: Record<TournamentType, Record<number, Record<number, QuestReward>>> = {
    neighborhood: {
        10: { 1: { items: [{ itemId: '골드', quantity: 5000 }] }, 2: { items: [{ itemId: '골드', quantity: 3000 }] }, 3: { items: [{ itemId: '골드', quantity: 2000 }] }, 4: { items: [{ itemId: '골드', quantity: 1250 }] }, 5: { items: [{ itemId: '골드', quantity: 750 }] }, 6: { items: [{ itemId: '골드', quantity: 500 }] } },
        9: { 1: { items: [{ itemId: '골드', quantity: 4333 }] }, 2: { items: [{ itemId: '골드', quantity: 2600 }] }, 3: { items: [{ itemId: '골드', quantity: 1733 }] }, 4: { items: [{ itemId: '골드', quantity: 1083 }] }, 5: { items: [{ itemId: '골드', quantity: 650 }] }, 6: { items: [{ itemId: '골드', quantity: 433 }] } },
        8: { 1: { items: [{ itemId: '골드', quantity: 3667 }] }, 2: { items: [{ itemId: '골드', quantity: 2200 }] }, 3: { items: [{ itemId: '골드', quantity: 1467 }] }, 4: { items: [{ itemId: '골드', quantity: 917 }] }, 5: { items: [{ itemId: '골드', quantity: 550 }] }, 6: { items: [{ itemId: '골드', quantity: 367 }] } },
        7: { 1: { items: [{ itemId: '골드', quantity: 3000 }] }, 2: { items: [{ itemId: '골드', quantity: 1800 }] }, 3: { items: [{ itemId: '골드', quantity: 1200 }] }, 4: { items: [{ itemId: '골드', quantity: 750 }] }, 5: { items: [{ itemId: '골드', quantity: 450 }] }, 6: { items: [{ itemId: '골드', quantity: 300 }] } },
        6: { 1: { items: [{ itemId: '골드', quantity: 2333 }] }, 2: { items: [{ itemId: '골드', quantity: 1400 }] }, 3: { items: [{ itemId: '골드', quantity: 933 }] }, 4: { items: [{ itemId: '골드', quantity: 583 }] }, 5: { items: [{ itemId: '골드', quantity: 350 }] }, 6: { items: [{ itemId: '골드', quantity: 233 }] } },
        5: { 1: { items: [{ itemId: '골드', quantity: 1667 }] }, 2: { items: [{ itemId: '골드', quantity: 1000 }] }, 3: { items: [{ itemId: '골드', quantity: 667 }] }, 4: { items: [{ itemId: '골드', quantity: 417 }] }, 5: { items: [{ itemId: '골드', quantity: 250 }] }, 6: { items: [{ itemId: '골드', quantity: 167 }] } },
        4: { 1: { items: [{ itemId: '골드', quantity: 1200 }] }, 2: { items: [{ itemId: '골드', quantity: 720 }] }, 3: { items: [{ itemId: '골드', quantity: 480 }] }, 4: { items: [{ itemId: '골드', quantity: 300 }] }, 5: { items: [{ itemId: '골드', quantity: 180 }] }, 6: { items: [{ itemId: '골드', quantity: 120 }] } },
        3: { 1: { items: [{ itemId: '골드', quantity: 733 }] }, 2: { items: [{ itemId: '골드', quantity: 440 }] }, 3: { items: [{ itemId: '골드', quantity: 293 }] }, 4: { items: [{ itemId: '골드', quantity: 183 }] }, 5: { items: [{ itemId: '골드', quantity: 110 }] }, 6: { items: [{ itemId: '골드', quantity: 73 }] } },
        2: { 1: { items: [{ itemId: '골드', quantity: 467 }] }, 2: { items: [{ itemId: '골드', quantity: 280 }] }, 3: { items: [{ itemId: '골드', quantity: 187 }] }, 4: { items: [{ itemId: '골드', quantity: 117 }] }, 5: { items: [{ itemId: '골드', quantity: 70 }] }, 6: { items: [{ itemId: '골드', quantity: 47 }] } },
        1: { 1: { items: [{ itemId: '골드', quantity: 200 }] }, 2: { items: [{ itemId: '골드', quantity: 120 }] }, 3: { items: [{ itemId: '골드', quantity: 80 }] }, 4: { items: [{ itemId: '골드', quantity: 50 }] }, 5: { items: [{ itemId: '골드', quantity: 30 }] }, 6: { items: [{ itemId: '골드', quantity: 20 }] } },
    },
    national: {
        // 10단계 기준: 1위 = 재료 상자6 × 2개
        10: {
            1: { items: [{ itemId: '재료 상자6', quantity: 2 }] },
            2: { items: [{ itemId: '재료 상자6', quantity: 1 }] },
            3: { items: [{ itemId: '재료 상자5', quantity: 1 }] },
            4: { items: [{ itemId: '재료 상자4', quantity: 1 }] },
            5: { items: [{ itemId: '재료 상자3', quantity: 1 }] },
            6: { items: [{ itemId: '재료 상자2', quantity: 1 }] },
            7: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            8: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
        },
        // 9단계: 1위 = 재료 상자5 × 2개
        9: {
            1: { items: [{ itemId: '재료 상자5', quantity: 2 }] },
            2: { items: [{ itemId: '재료 상자5', quantity: 1 }] },
            3: { items: [{ itemId: '재료 상자4', quantity: 1 }] },
            4: { items: [{ itemId: '재료 상자3', quantity: 1 }] },
            5: { items: [{ itemId: '재료 상자2', quantity: 1 }] },
            6: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            7: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            8: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
        },
        // 8단계: 1위 = 재료 상자4 × 2개
        8: {
            1: { items: [{ itemId: '재료 상자4', quantity: 2 }] },
            2: { items: [{ itemId: '재료 상자4', quantity: 1 }] },
            3: { items: [{ itemId: '재료 상자3', quantity: 1 }] },
            4: { items: [{ itemId: '재료 상자2', quantity: 1 }] },
            5: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            6: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            7: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            8: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
        },
        // 7단계: 1위 = 재료 상자3 × 2개
        7: {
            1: { items: [{ itemId: '재료 상자3', quantity: 2 }] },
            2: { items: [{ itemId: '재료 상자3', quantity: 1 }] },
            3: { items: [{ itemId: '재료 상자2', quantity: 1 }] },
            4: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            5: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            6: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            7: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            8: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
        },
        // 6단계: 1위 = 재료 상자2 × 2개
        6: {
            1: { items: [{ itemId: '재료 상자2', quantity: 2 }] },
            2: { items: [{ itemId: '재료 상자2', quantity: 1 }] },
            3: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            4: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            5: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            6: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            7: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            8: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
        },
        // 5단계: 1위 = 재료 상자2 × 1개
        5: {
            1: { items: [{ itemId: '재료 상자2', quantity: 1 }] },
            2: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            3: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            4: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            5: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            6: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            7: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            8: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
        },
        // 4단계: 1위 = 재료 상자1 × 2개
        4: {
            1: { items: [{ itemId: '재료 상자1', quantity: 2 }] },
            2: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            3: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            4: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            5: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            6: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            7: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            8: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
        },
        // 3단계: 1위 = 재료 상자1 × 2개
        3: {
            1: { items: [{ itemId: '재료 상자1', quantity: 2 }] },
            2: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            3: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            4: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            5: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            6: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            7: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            8: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
        },
        // 2단계: 1위 = 재료 상자1 × 2개
        2: {
            1: { items: [{ itemId: '재료 상자1', quantity: 2 }] },
            2: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            3: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            4: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            5: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            6: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            7: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            8: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
        },
        // 1단계 기준: 1위 = 재료 상자1 × 2개
        1: {
            1: { items: [{ itemId: '재료 상자1', quantity: 2 }] },
            2: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            3: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            4: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            5: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            6: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            7: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
            8: { items: [{ itemId: '재료 상자1', quantity: 1 }] },
        },
    },
    world: {
        // 10단계 기준: 1위 = 다이아 꾸러미4 × 3개
        10: {
            1: { items: [{ itemId: '다이아 꾸러미4', quantity: 3 }] },
            2: { items: [{ itemId: '다이아 꾸러미4', quantity: 2 }] },
            3: { items: [{ itemId: '다이아 꾸러미3', quantity: 2 }] },
            4: { items: [{ itemId: '다이아 꾸러미3', quantity: 1 }] },
            5: { items: [{ itemId: '다이아 꾸러미2', quantity: 1 }] },
            6: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            7: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            8: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            9: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            10: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            11: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            12: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            13: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            14: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            15: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            16: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
        },
        // 9단계: 1위 = 다이아 꾸러미4 × 2개
        9: {
            1: { items: [{ itemId: '다이아 꾸러미4', quantity: 2 }] },
            2: { items: [{ itemId: '다이아 꾸러미3', quantity: 2 }] },
            3: { items: [{ itemId: '다이아 꾸러미3', quantity: 1 }] },
            4: { items: [{ itemId: '다이아 꾸러미2', quantity: 1 }] },
            5: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            6: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            7: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            8: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            9: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            10: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            11: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            12: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            13: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            14: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            15: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            16: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
        },
        // 8단계: 1위 = 다이아 꾸러미3 × 2개
        8: {
            1: { items: [{ itemId: '다이아 꾸러미3', quantity: 2 }] },
            2: { items: [{ itemId: '다이아 꾸러미3', quantity: 1 }] },
            3: { items: [{ itemId: '다이아 꾸러미2', quantity: 1 }] },
            4: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            5: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            6: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            7: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            8: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            9: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            10: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            11: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            12: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            13: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            14: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            15: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            16: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
        },
        // 7단계: 1위 = 다이아 꾸러미3 × 1개
        7: {
            1: { items: [{ itemId: '다이아 꾸러미3', quantity: 1 }] },
            2: { items: [{ itemId: '다이아 꾸러미2', quantity: 1 }] },
            3: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            4: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            5: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            6: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            7: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            8: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            9: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            10: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            11: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            12: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            13: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            14: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            15: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            16: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
        },
        // 6단계: 1위 = 다이아 꾸러미2 × 1개
        6: {
            1: { items: [{ itemId: '다이아 꾸러미2', quantity: 1 }] },
            2: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            3: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            4: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            5: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            6: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            7: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            8: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            9: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            10: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            11: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            12: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            13: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            14: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            15: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            16: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
        },
        // 5단계: 1위 = 다이아 꾸러미2 × 1개
        5: {
            1: { items: [{ itemId: '다이아 꾸러미2', quantity: 1 }] },
            2: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            3: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            4: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            5: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            6: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            7: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            8: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            9: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            10: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            11: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            12: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            13: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            14: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            15: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            16: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
        },
        // 4단계: 1위 = 다이아 꾸러미1 × 2개
        4: {
            1: { items: [{ itemId: '다이아 꾸러미1', quantity: 2 }] },
            2: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            3: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            4: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            5: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            6: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            7: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            8: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            9: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            10: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            11: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            12: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            13: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            14: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            15: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            16: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
        },
        // 3단계: 1위 = 다이아 꾸러미1 × 1개
        3: {
            1: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            2: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            3: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            4: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            5: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            6: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            7: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            8: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            9: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            10: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            11: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            12: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            13: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            14: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            15: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            16: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
        },
        // 2단계: 1위 = 다이아 꾸러미1 × 1개
        2: {
            1: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            2: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            3: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            4: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            5: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            6: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            7: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            8: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            9: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            10: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            11: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            12: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            13: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            14: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            15: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            16: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
        },
        // 1단계 기준: 1위 = 다이아 꾸러미1 × 1개
        1: {
            1: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            2: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            3: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            4: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            5: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            6: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            7: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            8: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            9: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            10: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            11: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            12: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            13: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            14: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            15: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
            16: { items: [{ itemId: '다이아 꾸러미1', quantity: 1 }] },
        },
    },
};