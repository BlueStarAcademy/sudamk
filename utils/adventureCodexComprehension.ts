import type { AdventureProfile } from '../types/entities.js';
import { CoreStat, ItemGrade, SpecialStat } from '../types/enums.js';
import { ADVENTURE_STAGES } from '../constants/adventureConstants.js';
import type { AdventureCodexPercentBossBonus } from '../constants/adventureMonstersCodex.js';

/** `calculateUserEffects` 결과에 이 필드를 붙여 모험 전용 골드%를 전달 */
export type AdventureCodexCalculatedEffectsPatch = {
    coreStatBonuses: Record<CoreStat, { flat: number; percent: number }>;
    specialStatBonuses: Record<SpecialStat, { flat: number; percent: number }>;
    actionPointRegenInterval: number;
    adventureCodexGoldBonusPercent?: number;
};

/** 누적 승리 수(처치 수)로 도달하는 이해도 레벨 하한. Lv1=1승 … Lv10=300승 */
export const ADVENTURE_CODEX_WINS_FOR_LEVEL = [1, 10, 20, 30, 50, 100, 150, 200, 250, 300] as const;

export const ADVENTURE_CODEX_MAX_LEVEL = 10;

/** 챕터 보스: 이해도 레벨 1당 코어 %·모험 골드·드롭 % 등 +n% */
export const ADVENTURE_CODEX_BOSS_PERCENT_PER_LEVEL = 5;

/** 일반 몬스터: 배정된 모험 전용 % 1종 — 레벨당 +n% */
export const ADVENTURE_CODEX_NORMAL_PERCENT_PER_LEVEL = 2;

/** 일반 몬스터: 배정된 코어 스탯 1종 — 레벨당 플랫 +n */
export const ADVENTURE_CODEX_NORMAL_CORE_FLAT_PER_LEVEL = 1;

/** 일반 도감 % 합산 상한(%) — 여러 몬스터 이해도 중첩 완화 */
export const ADVENTURE_CODEX_NORMAL_DROP_CAP_PERCENT = {
    adventureGold: 18,
    itemDrop: 12,
    highGradeEquipment: 12,
    materialDrop: 12,
    highGradeMaterial: 12,
} as const;

/** 장비 슬롯과 동일 webp — 도감 몬스터 뒤 등급 배경 */
export const CODEX_COMPREHENSION_GRADE_BACKGROUNDS: Record<ItemGrade, string> = {
    [ItemGrade.Normal]: '/images/equipments/normalbgi.png',
    [ItemGrade.Uncommon]: '/images/equipments/uncommonbgi.png',
    [ItemGrade.Rare]: '/images/equipments/rarebgi.png',
    [ItemGrade.Epic]: '/images/equipments/epicbgi.png',
    [ItemGrade.Legendary]: '/images/equipments/legendarybgi.png',
    [ItemGrade.Mythic]: '/images/equipments/mythicbgi.png',
    [ItemGrade.Transcendent]: '/images/equipments/transcendentbgi.png',
};

/**
 * 이해도 레벨 → 표시 등급 (1=일반, 2+=고급, 5+=희귀, 7+=에픽, 9+=전설, 10=신화)
 */
export function getCodexComprehensionItemGrade(level: number): ItemGrade | null {
    const L = Math.max(0, Math.floor(level));
    if (L <= 0) return null;
    if (L >= 10) return ItemGrade.Mythic;
    if (L >= 9) return ItemGrade.Legendary;
    if (L >= 7) return ItemGrade.Epic;
    if (L >= 5) return ItemGrade.Rare;
    if (L >= 2) return ItemGrade.Uncommon;
    return ItemGrade.Normal;
}

export function codexComprehensionGradeLabelKo(grade: ItemGrade): string {
    switch (grade) {
        case ItemGrade.Normal:
            return '일반';
        case ItemGrade.Uncommon:
            return '고급';
        case ItemGrade.Rare:
            return '희귀';
        case ItemGrade.Epic:
            return '에픽';
        case ItemGrade.Legendary:
            return '전설';
        case ItemGrade.Mythic:
            return '신화';
        case ItemGrade.Transcendent:
            return '초월';
        default:
            return String(grade);
    }
}

/** 일반 몬스터 전용 모험 % 보너스 종류(고유 슬롯 1마리 1종, 슬롯 초과분은 모험 골드 %가 여러 마리에 배정될 수 있음) */
export type AdventureCodexNormalPercentKind =
    | 'adventureGold'
    | 'itemDrop'
    | 'materialDrop'
    | 'highGradeEquipment'
    | 'highGradeMaterial';

export type AdventureMonsterComprehensionDesign = {
    /** 챕터 보스 — 일반 이해도 플랫·일반% 없음(보스 %는 `codexPercentBossBonus` 경로) */
    isBoss: boolean;
    /** 이해도 레벨 1당: 배정된 코어 1종에만 플랫, 나머지 0 */
    coreStatBonusPerLevel: Record<CoreStat, number>;
    /** 일반만: 모험 전용 % 1종 · 레벨당 `ADVENTURE_CODEX_NORMAL_PERCENT_PER_LEVEL` */
    normalPercentBonus: null | { kind: AdventureCodexNormalPercentKind; percentPerLevel: number };
};

const CORE_ORDER: CoreStat[] = [
    CoreStat.Concentration,
    CoreStat.ThinkingSpeed,
    CoreStat.Judgment,
    CoreStat.Calculation,
    CoreStat.CombatPower,
    CoreStat.Stability,
];

/** 챕터 내 효과 슬롯(코어 플랫 6 + 모험% 5). 보스가 쓰는 슬롯은 일반에게 배정하지 않음 */
const NORMAL_BUFF_SLOT_ORDER: string[] = [
    ...CORE_ORDER.map((s) => `flat:${s}`),
    'gold',
    'item',
    'hgEq',
    'mat',
    'hgMat',
];

const PERCENT_SLOT_TO_KIND: Record<string, AdventureCodexNormalPercentKind> = {
    gold: 'adventureGold',
    item: 'itemDrop',
    hgEq: 'highGradeEquipment',
    mat: 'materialDrop',
    hgMat: 'highGradeMaterial',
};

function emptyCoreRecord(): Record<CoreStat, number> {
    const o = {} as Record<CoreStat, number>;
    for (const k of Object.values(CoreStat)) {
        o[k] = 0;
    }
    return o;
}

function bossReservedSlotKeys(b: AdventureCodexPercentBossBonus): string[] {
    switch (b.target) {
        case 'core':
            return [`flat:${b.stat}`];
        case 'adventureGold':
            return ['gold'];
        case 'itemDrop':
            return ['item'];
        case 'materialDrop':
            return ['mat'];
        case 'highGradeEquipment':
            return ['hgEq'];
        case 'highGradeMaterial':
            return ['hgMat'];
        default:
            return [];
    }
}

function designFromSlotKey(slotKey: string): AdventureMonsterComprehensionDesign {
    const coreStatBonusPerLevel = emptyCoreRecord();
    if (slotKey.startsWith('flat:')) {
        const stat = slotKey.slice('flat:'.length) as CoreStat;
        if (Object.values(CoreStat).includes(stat)) {
            coreStatBonusPerLevel[stat] = ADVENTURE_CODEX_NORMAL_CORE_FLAT_PER_LEVEL;
        }
        return {
            isBoss: false,
            coreStatBonusPerLevel,
            normalPercentBonus: null,
        };
    }
    const kind = PERCENT_SLOT_TO_KIND[slotKey];
    if (!kind) {
        return { isBoss: false, coreStatBonusPerLevel, normalPercentBonus: null };
    }
    return {
        isBoss: false,
        coreStatBonusPerLevel,
        normalPercentBonus: { kind, percentPerLevel: ADVENTURE_CODEX_NORMAL_PERCENT_PER_LEVEL },
    };
}

/** 고유 효과 슬롯이 부족한 일반 몬스터 — 모험 골드 %만 부여 */
function designOverflowNormalAdventureGold(): AdventureMonsterComprehensionDesign {
    return {
        isBoss: false,
        coreStatBonusPerLevel: emptyCoreRecord(),
        normalPercentBonus: {
            kind: 'adventureGold',
            percentPerLevel: ADVENTURE_CODEX_NORMAL_PERCENT_PER_LEVEL,
        },
    };
}

const bossOnlyDesign: AdventureMonsterComprehensionDesign = {
    isBoss: true,
    coreStatBonusPerLevel: emptyCoreRecord(),
    normalPercentBonus: null,
};

/** `adventureMonstersCodex` 보스·슬롯 배정 변경 시 증가시켜 메모 무효화 */
export const ADVENTURE_CODEX_COMPREHENSION_DESIGN_VERSION = 3;

let designsMemo: ReadonlyMap<string, AdventureMonsterComprehensionDesign> | null = null;
let codexIdsMemo: ReadonlySet<string> | null = null;
let designsVersionMemo = 0;

function buildDesignsForAllStages(): Map<string, AdventureMonsterComprehensionDesign> {
    const m = new Map<string, AdventureMonsterComprehensionDesign>();
    for (const st of ADVENTURE_STAGES) {
        const used = new Set<string>();
        for (const mon of st.monsters) {
            if ('codexPercentBossBonus' in mon && mon.codexPercentBossBonus) {
                for (const k of bossReservedSlotKeys(mon.codexPercentBossBonus)) {
                    used.add(k);
                }
            }
        }
        const available = NORMAL_BUFF_SLOT_ORDER.filter((k) => !used.has(k));
        let slotIndex = 0;
        for (const mon of st.monsters) {
            if ('codexPercentBossBonus' in mon && mon.codexPercentBossBonus) {
                m.set(mon.codexId, bossOnlyDesign);
                continue;
            }
            const slotKey = available[slotIndex];
            slotIndex += 1;
            if (slotKey === undefined) {
                m.set(mon.codexId, designOverflowNormalAdventureGold());
                continue;
            }
            m.set(mon.codexId, designFromSlotKey(slotKey));
        }
    }
    return m;
}

export function getAdventureCodexIdSet(): ReadonlySet<string> {
    if (!codexIdsMemo) {
        const s = new Set<string>();
        for (const st of ADVENTURE_STAGES) {
            for (const mon of st.monsters) {
                s.add(mon.codexId);
            }
        }
        codexIdsMemo = s;
    }
    return codexIdsMemo;
}

export function getAdventureMonsterComprehensionDesigns(): ReadonlyMap<string, AdventureMonsterComprehensionDesign> {
    if (!designsMemo || designsVersionMemo !== ADVENTURE_CODEX_COMPREHENSION_DESIGN_VERSION) {
        designsMemo = buildDesignsForAllStages();
        designsVersionMemo = ADVENTURE_CODEX_COMPREHENSION_DESIGN_VERSION;
    }
    return designsMemo;
}

export function getAdventureMonsterComprehensionDesign(codexId: string): AdventureMonsterComprehensionDesign | undefined {
    return getAdventureMonsterComprehensionDesigns().get(codexId);
}

/** 0 = 미활성(0승), 1~10 = 이해도 레벨 */
export function getAdventureCodexComprehensionLevel(defeatCount: number): number {
    const w = Math.max(0, Math.floor(defeatCount));
    if (w < ADVENTURE_CODEX_WINS_FOR_LEVEL[0]) return 0;
    let level = 1;
    for (let i = 1; i < ADVENTURE_CODEX_WINS_FOR_LEVEL.length; i++) {
        if (w >= ADVENTURE_CODEX_WINS_FOR_LEVEL[i]!) level = i + 1;
        else break;
    }
    return Math.min(level, ADVENTURE_CODEX_MAX_LEVEL);
}

export function getNextAdventureCodexWinsThreshold(currentLevel: number): number | null {
    if (currentLevel >= ADVENTURE_CODEX_MAX_LEVEL) return null;
    return ADVENTURE_CODEX_WINS_FOR_LEVEL[currentLevel] ?? null;
}

/** 도감 카드·결과 모달 공통: 누적 승리 수·이해도 레벨로 구간 진행률(0~1) */
export function getAdventureCodexComprehensionBarProgress(
    wins: number,
    level: number,
): { prog: number; nextAt: number | null; prevThreshold: number } {
    const w = Math.max(0, Math.floor(wins));
    const nextAt = getNextAdventureCodexWinsThreshold(level);
    const prevThreshold = level >= 1 ? ADVENTURE_CODEX_WINS_FOR_LEVEL[level - 1]! ?? 0 : 0;
    if (level >= ADVENTURE_CODEX_MAX_LEVEL) {
        return { prog: 1, nextAt: null, prevThreshold };
    }
    if (nextAt != null && nextAt > prevThreshold) {
        /** 카드 표기(예: 1/10승, 20/30승)와 동일 기준으로 진행률을 맞춘다. */
        return {
            prog: Math.min(1, w / nextAt),
            nextAt,
            prevThreshold,
        };
    }
    return { prog: 0, nextAt, prevThreshold };
}

export type AdventureCodexBossPercentTotals = {
    corePercent: Record<CoreStat, number>;
    adventureGoldPercent: number;
    itemDropPercent: number;
    materialDropPercent: number;
    highGradeEquipmentPercent: number;
    highGradeMaterialPercent: number;
};

function getCodexMonsterRow(codexId: string): (typeof ADVENTURE_STAGES)[number]['monsters'][number] | undefined {
    for (const st of ADVENTURE_STAGES) {
        const mon = st.monsters.find((m) => m.codexId === codexId);
        if (mon) return mon;
    }
    return undefined;
}

/** 챕터 보스 도감 이해도로부터 % 보너스 합산 (모험 드롭·코어%·모험 골드) */
export function accumulateAdventureCodexBossPercentBonuses(profile: AdventureProfile | null | undefined): AdventureCodexBossPercentTotals {
    const counts = profile?.codexDefeatCounts ?? {};
    const corePercent = {} as Record<CoreStat, number>;
    for (const k of Object.values(CoreStat)) {
        corePercent[k] = 0;
    }
    const out: AdventureCodexBossPercentTotals = {
        corePercent,
        adventureGoldPercent: 0,
        itemDropPercent: 0,
        materialDropPercent: 0,
        highGradeEquipmentPercent: 0,
        highGradeMaterialPercent: 0,
    };

    for (const [codexId, rawWins] of Object.entries(counts)) {
        const row = getCodexMonsterRow(codexId);
        if (!row || !('codexPercentBossBonus' in row) || !row.codexPercentBossBonus) continue;
        const wins = Math.max(0, Math.floor(Number(rawWins) || 0));
        const level = getAdventureCodexComprehensionLevel(wins);
        if (level <= 0) continue;
        const pct = Math.min(level, ADVENTURE_CODEX_MAX_LEVEL) * ADVENTURE_CODEX_BOSS_PERCENT_PER_LEVEL;
        const b = row.codexPercentBossBonus;
        switch (b.target) {
            case 'core':
                out.corePercent[b.stat] = (out.corePercent[b.stat] ?? 0) + pct;
                break;
            case 'adventureGold':
                out.adventureGoldPercent += pct;
                break;
            case 'itemDrop':
                out.itemDropPercent += pct;
                break;
            case 'materialDrop':
                out.materialDropPercent += pct;
                break;
            case 'highGradeEquipment':
                out.highGradeEquipmentPercent += pct;
                break;
            case 'highGradeMaterial':
                out.highGradeMaterialPercent += pct;
                break;
        }
    }
    return out;
}

export function adventureCodexPercentBossBonusLabelKo(b: AdventureCodexPercentBossBonus): string {
    switch (b.target) {
        case 'core':
            return String(b.stat);
        case 'adventureGold':
            return '모험 승리 골드';
        case 'itemDrop':
            return '모험 장비상자 획득';
        case 'materialDrop':
            return '모험 재료상자 획득';
        case 'highGradeEquipment':
            return '모험 고급 장비상자';
        case 'highGradeMaterial':
            return '모험 고급 재료상자';
        default:
            return '';
    }
}

export type AdventureCodexComprehensionTotals = {
    coreFlat: Record<CoreStat, number>;
    adventureGoldBonusPercent: number;
    adventureEquipmentDropBonusPercent: number;
    adventureHighGradeEquipmentBonusPercent: number;
    adventureMaterialDropBonusPercent: number;
    adventureHighGradeMaterialBonusPercent: number;
};

export function accumulateAdventureCodexComprehension(profile: AdventureProfile | null | undefined): AdventureCodexComprehensionTotals {
    const counts = profile?.codexDefeatCounts ?? {};
    const designs = getAdventureMonsterComprehensionDesigns();
    const coreFlat = emptyCoreRecord();
    const raw = {
        adventureGold: 0,
        itemDrop: 0,
        highGradeEquipment: 0,
        materialDrop: 0,
        highGradeMaterial: 0,
    };

    for (const [codexId, rawWins] of Object.entries(counts)) {
        const row = getCodexMonsterRow(codexId);
        if (row && 'codexPercentBossBonus' in row && row.codexPercentBossBonus) continue;

        const wins = Math.max(0, Math.floor(Number(rawWins) || 0));
        const level = getAdventureCodexComprehensionLevel(wins);
        if (level <= 0) continue;
        const d = designs.get(codexId);
        if (!d || d.isBoss) continue;

        for (const stat of CORE_ORDER) {
            coreFlat[stat] += (d.coreStatBonusPerLevel[stat] ?? 0) * level;
        }
        const nb = d.normalPercentBonus;
        if (nb) {
            const add = nb.percentPerLevel * level;
            switch (nb.kind) {
                case 'adventureGold':
                    raw.adventureGold += add;
                    break;
                case 'itemDrop':
                    raw.itemDrop += add;
                    break;
                case 'highGradeEquipment':
                    raw.highGradeEquipment += add;
                    break;
                case 'materialDrop':
                    raw.materialDrop += add;
                    break;
                case 'highGradeMaterial':
                    raw.highGradeMaterial += add;
                    break;
            }
        }
    }

    return {
        coreFlat,
        adventureGoldBonusPercent: Math.min(raw.adventureGold, ADVENTURE_CODEX_NORMAL_DROP_CAP_PERCENT.adventureGold),
        adventureEquipmentDropBonusPercent: Math.min(raw.itemDrop, ADVENTURE_CODEX_NORMAL_DROP_CAP_PERCENT.itemDrop),
        adventureHighGradeEquipmentBonusPercent: Math.min(
            raw.highGradeEquipment,
            ADVENTURE_CODEX_NORMAL_DROP_CAP_PERCENT.highGradeEquipment,
        ),
        adventureMaterialDropBonusPercent: Math.min(raw.materialDrop, ADVENTURE_CODEX_NORMAL_DROP_CAP_PERCENT.materialDrop),
        adventureHighGradeMaterialBonusPercent: Math.min(
            raw.highGradeMaterial,
            ADVENTURE_CODEX_NORMAL_DROP_CAP_PERCENT.highGradeMaterial,
        ),
    };
}

/**
 * 일반 도감 이해도: 코어 플랫 + 모험 골드%(상한)만 패치에 반영.
 * 나머지 모험 드롭 %는 반환값으로 `calculateUserEffects`에서 `adventureUnderstanding*`에 합산.
 */
export function applyAdventureCodexComprehensionToCalculatedEffects(
    user: { adventureProfile?: AdventureProfile },
    calculatedEffects: AdventureCodexCalculatedEffectsPatch,
): AdventureCodexComprehensionTotals {
    const totals = accumulateAdventureCodexComprehension(user.adventureProfile);
    for (const key of Object.values(CoreStat)) {
        calculatedEffects.coreStatBonuses[key].flat += Math.floor(totals.coreFlat[key] ?? 0);
    }
    calculatedEffects.adventureCodexGoldBonusPercent =
        (calculatedEffects.adventureCodexGoldBonusPercent ?? 0) + totals.adventureGoldBonusPercent;
    return totals;
}

export function adventureCodexNormalPercentLabelKo(kind: AdventureCodexNormalPercentKind): string {
    switch (kind) {
        case 'adventureGold':
            return '모험 승리 골드';
        case 'itemDrop':
            return '모험 장비상자 획득';
        case 'materialDrop':
            return '모험 재료상자 획득';
        case 'highGradeEquipment':
            return '모험 고급 장비상자';
        case 'highGradeMaterial':
            return '모험 고급 재료상자';
        default:
            return String(kind);
    }
}
