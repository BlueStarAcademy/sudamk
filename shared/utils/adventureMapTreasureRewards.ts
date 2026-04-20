import { getKSTDate } from './timeUtils.js';

export const ADVENTURE_MAP_KEY_CHAPTER_CONFIG: Record<
    number,
    {
        /** 하루에 획득 가능한 열쇠 수 */
        dailyEarnCap: number;
        /** 동시에 보유할 수 있는 최대 열쇠 */
        maxHeld: number;
        /** 열쇠 1개까지 필요한 열쇠 경험치(일반 몬스터 +1, 챕터 보스 +2) */
        keyXpRequired: number;
    }
> = {
    1: { dailyEarnCap: 5, maxHeld: 5, keyXpRequired: 5 },
    2: { dailyEarnCap: 3, maxHeld: 3, keyXpRequired: 5 },
    3: { dailyEarnCap: 3, maxHeld: 3, keyXpRequired: 6 },
    4: { dailyEarnCap: 3, maxHeld: 3, keyXpRequired: 7 },
    5: { dailyEarnCap: 3, maxHeld: 3, keyXpRequired: 7 },
};

export type WeightedBoxTier = { roman: string; weight: number };

export type AdventureTreasureChapterRewardDef = {
    goldMin: number;
    goldMax: number;
    actionPoints: number;
    equipmentTiers: WeightedBoxTier[];
    materialTiers: WeightedBoxTier[];
};

/** 장비/재료 상자 로마 숫자 → `장비 상자 I` 형식(인벤 템플릿 이름) */
export function adventureTreasureEquipmentBoxName(roman: string): string {
    return `장비 상자 ${roman}`;
}

export function adventureTreasureMaterialBoxName(roman: string): string {
    return `재료 상자 ${roman}`;
}

const CHAPTER_REWARDS: Record<number, AdventureTreasureChapterRewardDef> = {
    1: {
        goldMin: 100,
        goldMax: 1000,
        actionPoints: 10,
        equipmentTiers: [
            { roman: 'I', weight: 60 },
            { roman: 'II', weight: 35 },
            { roman: 'III', weight: 5 },
        ],
        materialTiers: [
            { roman: 'I', weight: 60 },
            { roman: 'II', weight: 35 },
            { roman: 'III', weight: 5 },
        ],
    },
    2: {
        goldMin: 500,
        goldMax: 2000,
        actionPoints: 15,
        equipmentTiers: [
            { roman: 'I', weight: 45 },
            { roman: 'II', weight: 45 },
            { roman: 'III', weight: 10 },
        ],
        materialTiers: [
            { roman: 'I', weight: 45 },
            { roman: 'II', weight: 45 },
            { roman: 'III', weight: 10 },
        ],
    },
    3: {
        goldMin: 1000,
        goldMax: 3000,
        actionPoints: 20,
        equipmentTiers: [
            { roman: 'I', weight: 34 },
            { roman: 'II', weight: 50 },
            { roman: 'III', weight: 15 },
            { roman: 'IV', weight: 1 },
        ],
        materialTiers: [
            { roman: 'I', weight: 34 },
            { roman: 'II', weight: 50 },
            { roman: 'III', weight: 15 },
            { roman: 'IV', weight: 1 },
        ],
    },
    4: {
        goldMin: 1500,
        goldMax: 4000,
        actionPoints: 25,
        equipmentTiers: [
            { roman: 'II', weight: 65 },
            { roman: 'III', weight: 30 },
            { roman: 'IV', weight: 5 },
        ],
        materialTiers: [
            { roman: 'II', weight: 65 },
            { roman: 'III', weight: 30 },
            { roman: 'IV', weight: 5 },
        ],
    },
    5: {
        goldMin: 2000,
        goldMax: 5000,
        actionPoints: 30,
        equipmentTiers: [
            { roman: 'II', weight: 49 },
            { roman: 'III', weight: 35 },
            { roman: 'IV', weight: 15 },
            { roman: 'V', weight: 1 },
        ],
        materialTiers: [
            { roman: 'II', weight: 49 },
            { roman: 'III', weight: 35 },
            { roman: 'IV', weight: 15 },
            { roman: 'V', weight: 1 },
        ],
    },
};

export function getAdventureTreasureChapterRewardDef(stageIndex: number): AdventureTreasureChapterRewardDef {
    const ch = Math.max(1, Math.min(5, Math.floor(stageIndex)));
    return CHAPTER_REWARDS[ch]!;
}

export type TreasureRollCategory = 'gold' | 'equipment' | 'material' | 'actionPoints';

export type AdventureTreasureRollResult =
    | { category: 'gold'; gold: number }
    | { category: 'equipment'; boxRoman: string }
    | { category: 'material'; boxRoman: string }
    | { category: 'actionPoints'; actionPoints: number };

/** 보물상자 3연 선택 세션(서버 `adventureProfile`에 임시 저장) */
export type AdventureMapTreasurePickSession = {
    stageId: string;
    windowStartMs: number;
    nonce: string;
    rolls: [AdventureTreasureRollResult, AdventureTreasureRollResult, AdventureTreasureRollResult];
    /** 보상 VIP 시 2 */
    pickSlots: 1 | 2;
    expiresAtMs: number;
};

const PREVIEW_GOLD = '/images/icon/Gold.png';
const PREVIEW_LIGHTNING = '/images/icon/lightning.png';
const PREVIEW_EQ: Record<string, string> = {
    I: '/images/Box/EquipmentBox1.png',
    II: '/images/Box/EquipmentBox2.png',
    III: '/images/Box/EquipmentBox3.png',
    IV: '/images/Box/EquipmentBox4.png',
    V: '/images/Box/EquipmentBox5.png',
    VI: '/images/Box/EquipmentBox6.png',
};
const PREVIEW_MAT: Record<string, string> = {
    I: '/images/Box/ResourceBox1.png',
    II: '/images/Box/ResourceBox2.png',
    III: '/images/Box/ResourceBox3.png',
    IV: '/images/Box/ResourceBox4.png',
    V: '/images/Box/ResourceBox5.png',
    VI: '/images/Box/ResourceBox6.png',
};

/** 보물 룰렛/결과 UI용 미리보기 */
export function getAdventureTreasureRollPreview(roll: AdventureTreasureRollResult): {
    imageSrc: string;
    label: string;
    subLabel: string;
} {
    if (roll.category === 'gold') {
        return {
            imageSrc: PREVIEW_GOLD,
            label: '골드',
            subLabel: `${roll.gold.toLocaleString()} G`,
        };
    }
    if (roll.category === 'equipment') {
        const img = PREVIEW_EQ[roll.boxRoman] ?? PREVIEW_EQ.I!;
        return { imageSrc: img, label: '장비 상자', subLabel: roll.boxRoman };
    }
    if (roll.category === 'material') {
        const img = PREVIEW_MAT[roll.boxRoman] ?? PREVIEW_MAT.I!;
        return { imageSrc: img, label: '재료 상자', subLabel: roll.boxRoman };
    }
    return {
        imageSrc: PREVIEW_LIGHTNING,
        label: '행동력',
        subLabel: `${roll.actionPoints} 회복`,
    };
}

function pickWeightedRoman(rows: WeightedBoxTier[], rng: () => number): string {
    const total = rows.reduce((s, r) => s + r.weight, 0);
    let t = rng() * total;
    for (const row of rows) {
        t -= row.weight;
        if (t <= 0) return row.roman;
    }
    return rows[rows.length - 1]!.roman;
}

/** 골드/장비상자/재료상자/행동력 각 25% */
export function rollAdventureTreasureChestReward(stageIndex: number, rng: () => number): AdventureTreasureRollResult {
    const def = getAdventureTreasureChapterRewardDef(stageIndex);
    const branch = rng();
    if (branch < 0.25) {
        const span = def.goldMax - def.goldMin + 1;
        const gold = def.goldMin + Math.floor(rng() * span);
        return { category: 'gold', gold };
    }
    if (branch < 0.5) {
        return { category: 'equipment', boxRoman: pickWeightedRoman(def.equipmentTiers, rng) };
    }
    if (branch < 0.75) {
        return { category: 'material', boxRoman: pickWeightedRoman(def.materialTiers, rng) };
    }
    return { category: 'actionPoints', actionPoints: def.actionPoints };
}

/** KST 당일 문자열 YYYY-MM-DD */
export function formatKstYmd(nowMs: number): string {
    const k = getKSTDate(nowMs);
    const y = k.getUTCFullYear();
    const m = String(k.getUTCMonth() + 1).padStart(2, '0');
    const d = String(k.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export type TreasurePreviewSlot = { image: string; label: string };

export type AdventureTreasureRewardPreviewBlocks = {
    gold: TreasurePreviewSlot;
    equipment: TreasurePreviewSlot[];
    material: TreasurePreviewSlot[];
    ap: TreasurePreviewSlot;
};

const GOLD_SRC = '/images/icon/Gold.png';
const EQ_IMG: Record<string, string> = {
    I: '/images/Box/EquipmentBox1.png',
    II: '/images/Box/EquipmentBox2.png',
    III: '/images/Box/EquipmentBox3.png',
    IV: '/images/Box/EquipmentBox4.png',
    V: '/images/Box/EquipmentBox5.png',
    VI: '/images/Box/EquipmentBox6.png',
};
const MAT_IMG: Record<string, string> = {
    I: '/images/Box/ResourceBox1.png',
    II: '/images/Box/ResourceBox2.png',
    III: '/images/Box/ResourceBox3.png',
    IV: '/images/Box/ResourceBox4.png',
    V: '/images/Box/ResourceBox5.png',
    VI: '/images/Box/ResourceBox6.png',
};

/** 유저 UI용 — 확률·가중치 없이 풀 크기·이미지만 */
export type AdventureTreasureUserRewardSections = {
    goldMin: number;
    goldMax: number;
    equipmentImages: string[];
    equipmentPoolSize: number;
    materialImages: string[];
    materialPoolSize: number;
    actionPoints: number;
};

export function getAdventureTreasureUserRewardSections(stageIndex: number): AdventureTreasureUserRewardSections {
    const def = getAdventureTreasureChapterRewardDef(stageIndex);
    return {
        goldMin: def.goldMin,
        goldMax: def.goldMax,
        equipmentImages: def.equipmentTiers.map((row) => EQ_IMG[row.roman] ?? EQ_IMG.I!),
        equipmentPoolSize: def.equipmentTiers.length,
        materialImages: def.materialTiers.map((row) => MAT_IMG[row.roman] ?? MAT_IMG.I!),
        materialPoolSize: def.materialTiers.length,
        actionPoints: def.actionPoints,
    };
}

/** 보물상자 정보 패널용 — 골드 / 장비 / 재료 / 행동력 블록 */
export function getAdventureTreasureRewardPreviewBlocks(stageIndex: number): AdventureTreasureRewardPreviewBlocks {
    const def = getAdventureTreasureChapterRewardDef(stageIndex);
    return {
        gold: { image: GOLD_SRC, label: `${def.goldMin}~${def.goldMax}` },
        equipment: def.equipmentTiers.map((row) => ({
            image: EQ_IMG[row.roman] ?? EQ_IMG.I!,
            label: `${row.weight}%`,
        })),
        material: def.materialTiers.map((row) => ({
            image: MAT_IMG[row.roman] ?? MAT_IMG.I!,
            label: `${row.weight}%`,
        })),
        ap: { image: '/images/icon/lightning.png', label: `${def.actionPoints} 회복` },
    };
}

/** 관리자 확률 패널용 텍스트 줄 */
export function formatAdventureTreasureChestAdminLines(stageIndex: number): string[] {
    const def = getAdventureTreasureChapterRewardDef(stageIndex);
    const eq = def.equipmentTiers.map((t) => `${t.roman} ${t.weight}%`).join(' / ');
    const mat = def.materialTiers.map((t) => `${t.roman} ${t.weight}%`).join(' / ');
    return [
        `대분류(각 25%): 골드 / 장비상자 / 재료상자 / 행동력`,
        `골드 범위: ${def.goldMin.toLocaleString()}~${def.goldMax.toLocaleString()}`,
        `장비상자(25% 안에서): ${eq}`,
        `재료상자(25% 안에서): ${mat}`,
        `행동력 회복: ${def.actionPoints} (최대치까지, 최대치 자체는 증가하지 않음)`,
    ];
}
