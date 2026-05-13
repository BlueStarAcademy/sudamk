import { CoreStat, ItemGrade } from '../types/enums.js';
import type { PairPetDisposition, PairPetMeta, PairPetSpecialization, PairPetRpsAttribute } from '../types/entities.js';
import { CORE_STATS_DATA } from '../constants/items.js';
import { PAIR_PET_MAX_LEVEL, pairPetLevelUpStatBudget } from '../constants/pairPetGrade.js';
import {
    PAIR_PET_BIRTH_CORE_MAX,
    PAIR_PET_BIRTH_CORE_MIN,
    PAIR_PET_BIRTH_CORE_TOTAL,
} from './pairPetKataStatsFromMeta.js';

const CORE_ORDER: CoreStat[] = [
    CoreStat.Concentration,
    CoreStat.ThinkingSpeed,
    CoreStat.Judgment,
    CoreStat.Calculation,
    CoreStat.CombatPower,
    CoreStat.Stability,
];

/** 도감용 — `rollPairPetMetaForHatch` / `derivePairPetMetaFallback` 과 같은 성향 후보 */
export const PAIR_PET_HATCH_DISPOSITION_ENCYCLOPEDIA_LINES: readonly string[] = [
    ...CORE_ORDER.map((stat) => {
        const name = CORE_STATS_DATA[stat]?.name ?? stat;
        return `${name} +10%~20%`;
    }),
    '모든 능력치 +5%',
    '임의 한 능력치의 10~20%를 다른 한 능력치로 전환 (빠진 만큼의 2배를 대상에 합산)',
];

/** 도감용 — 부화 시 특화 종류·수치 범위 (`rollPairPetMetaForHatch` 와 동일) */
export const PAIR_PET_HATCH_SPECIALIZATION_ENCYCLOPEDIA_LINES: readonly string[] = [
    '수련 경험치 +10%~20%',
    '수련 골드 +10%~20%',
    '수련 시간 -10%~20%',
    '수련 영혼석 획득 +10%~20%',
    '수련 영혼석 획득 수량 +1',
    '전략 경기장 필요 행동력 -1',
    '페어 경기장 필요 행동력 -1',
    '놀이 경기장 필요 행동력 -1',
];

/** 도감용 — 부화 시 가위·바위·보 중 하나 */
export const PAIR_PET_HATCH_RPS_ENCYCLOPEDIA_LINES: readonly string[] = ['가위 / 바위 / 보 중 하나(부화 시 무작위)'];

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hashSeed(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i += 1) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export function isPairPetRpsAttribute(x: unknown): x is PairPetRpsAttribute {
    return x === 1 || x === 2 || x === 3;
}

/** 구 펫 행 등에 결정론적으로 부여 */
export function backfillPairPetRpsAttribute(itemId: string, createdAt: number): PairPetRpsAttribute {
    const rng = mulberry32(hashSeed(`pair-pet-rps|${itemId}|${createdAt}`));
    return (1 + Math.floor(rng() * 3)) as PairPetRpsAttribute;
}

export function resolvePairPetRpsAttributeFromMeta(meta: PairPetMeta, itemId: string, createdAt: number): PairPetRpsAttribute {
    if (isPairPetRpsAttribute(meta.rpsAttribute)) return meta.rpsAttribute;
    return backfillPairPetRpsAttribute(itemId, createdAt);
}

function rollInt(rng: () => number, min: number, max: number): number {
    return min + Math.floor(rng() * (max - min + 1));
}

function rollConvertDisposition(rng: () => number): PairPetDisposition {
    const pct = rollInt(rng, 10, 20);
    const fromStat = CORE_ORDER[Math.floor(rng() * CORE_ORDER.length)]!;
    let toStat: CoreStat;
    do {
        toStat = CORE_ORDER[Math.floor(rng() * CORE_ORDER.length)]!;
    } while (toStat === fromStat);
    return { kind: 'convert', fromStat, toStat, pct };
}

/** 펫 등급 강화 1회당 성향 %: 단일·전환 +2, 모든 능력치 +1 */
export function bumpPairPetDispositionPctOnGradeUpgrade(d: PairPetDisposition): PairPetDisposition {
    if (d.kind === 'all') {
        return { kind: 'all', pct: d.pct + 1 };
    }
    if (d.kind === 'single') {
        return { ...d, pct: d.pct + 2 };
    }
    return { ...d, pct: d.pct + 2 };
}

/** 0~5: 단일 코어 +10~20%, 6: 전체 +5%, 7: 전환 성향 */
function rollPairPetDispositionForHatch(rng: () => number): PairPetDisposition {
    const disBucket = Math.floor(rng() * 8);
    if (disBucket >= 7) {
        return rollConvertDisposition(rng);
    }
    if (disBucket >= 6) {
        return { kind: 'all', pct: 5 };
    }
    return {
        kind: 'single',
        stat: CORE_ORDER[disBucket]!,
        pct: rollInt(rng, 10, 20),
    };
}

/** 0~3: pct형 특화 10~20, 4~7: 고정 효과 특화 */
/** 부화 시: 각 코어 30~70, 여섯 합 300인 정수 분배(남는 120을 코어당 +40까지 무작위 누적). */
export function rollBirthCoreBasesMin30Sum300(rng: () => number): Record<CoreStat, number> {
    const extraPool = PAIR_PET_BIRTH_CORE_TOTAL - PAIR_PET_BIRTH_CORE_MIN * CORE_ORDER.length;
    const extraCapPerCore = PAIR_PET_BIRTH_CORE_MAX - PAIR_PET_BIRTH_CORE_MIN;
    const extras = new Array(CORE_ORDER.length).fill(0);
    for (let k = 0; k < extraPool; k += 1) {
        const candidates: number[] = [];
        for (let i = 0; i < CORE_ORDER.length; i += 1) {
            if (extras[i]! < extraCapPerCore) candidates.push(i);
        }
        const pick = candidates[Math.floor(rng() * candidates.length)]!;
        extras[pick]! += 1;
    }
    const out = {} as Record<CoreStat, number>;
    for (let i = 0; i < CORE_ORDER.length; i += 1) {
        out[CORE_ORDER[i]!] = PAIR_PET_BIRTH_CORE_MIN + extras[i]!;
    }
    return out;
}

export function backfillPairPetBirthCoreBases(itemId: string, createdAt: number): Record<CoreStat, number> {
    const rng = mulberry32(hashSeed(`pair-pet-birth-core|${itemId}|${createdAt}`));
    return rollBirthCoreBasesMin30Sum300(rng);
}

function isValidBirthCoreBases(b: PairPetMeta['birthCoreBases']): b is Record<CoreStat, number> {
    if (!b) return false;
    let sum = 0;
    for (const s of CORE_ORDER) {
        const v = b[s];
        if (typeof v !== 'number' || !Number.isFinite(v)) return false;
        const n = Math.round(v);
        if (n < PAIR_PET_BIRTH_CORE_MIN || n > PAIR_PET_BIRTH_CORE_MAX) return false;
        sum += n;
    }
    return sum === PAIR_PET_BIRTH_CORE_TOTAL;
}

function rollPairPetSpecializationForHatch(rng: () => number): PairPetSpecialization {
    const specKind = Math.floor(rng() * 8);
    if (specKind >= 4) {
        if (specKind === 4) return { kind: 'trainingSoulQuantityPlusOne' };
        if (specKind === 5) return { kind: 'strategicArenaApMinusOne' };
        if (specKind === 6) return { kind: 'pairArenaApMinusOne' };
        return { kind: 'playfulArenaApMinusOne' };
    }
    const sp = rollInt(rng, 10, 20);
    if (specKind === 0) return { kind: 'trainingXp', pct: sp };
    if (specKind === 1) return { kind: 'trainingGold', pct: sp };
    if (specKind === 2) return { kind: 'trainingTime', pct: sp };
    return { kind: 'soulDrop', pct: sp };
}

export function rollPairPetMetaForHatch(): PairPetMeta {
    const rng = () => Math.random();
    const disposition = rollPairPetDispositionForHatch(rng);
    const specialization = rollPairPetSpecializationForHatch(rng);
    return {
        level: 1,
        xp: 0,
        disposition,
        specialization,
        birthCoreBases: rollBirthCoreBasesMin30Sum300(rng),
        levelUpCoreBonuses: {},
        rpsAttribute: (1 + Math.floor(rng() * 3)) as PairPetRpsAttribute,
    };
}

function mergeCoreBonus(
    acc: Partial<Record<CoreStat, number>>,
    inc: Partial<Record<CoreStat, number>>
): Partial<Record<CoreStat, number>> {
    const out = { ...acc };
    for (const k of Object.keys(inc) as CoreStat[]) {
        const v = inc[k];
        if (typeof v !== 'number' || v === 0) continue;
        out[k] = (out[k] ?? 0) + v;
    }
    return out;
}

/** 이번 성장(레벨업)으로만 늘어난 6코어 보너스 — UI 표시용 */
export function diffPairPetLevelUpCoreBonuses(
    before: Partial<Record<CoreStat, number>> | undefined,
    after: Partial<Record<CoreStat, number>> | undefined,
): Partial<Record<CoreStat, number>> {
    const out: Partial<Record<CoreStat, number>> = {};
    for (const k of CORE_ORDER) {
        const d = (after?.[k] ?? 0) - (before?.[k] ?? 0);
        if (d !== 0) out[k] = d;
    }
    return out;
}

/** `diffPairPetLevelUpCoreBonuses` 결과를 표시 순서대로 엔트리화 */
export function pairPetLevelUpCoreBonusDeltaEntries(
    delta: Partial<Record<CoreStat, number>>,
): { stat: CoreStat; add: number }[] {
    return CORE_ORDER.map((stat) => {
        const add = delta[stat];
        return typeof add === 'number' && add !== 0 ? { stat, add } : null;
    }).filter((x): x is { stat: CoreStat; add: number } => x != null);
}

/** 한 레벨 상승분: 등급별 총합만큼 6코어에 무작위로 +1씩 배분 (같은 스탯에 여러 번 가능) */
export function rollSingleLevelUpCoreBonuses(grade: ItemGrade, rng: () => number): Partial<Record<CoreStat, number>> {
    const n = pairPetLevelUpStatBudget(grade);
    const out: Partial<Record<CoreStat, number>> = {};
    for (let i = 0; i < n; i += 1) {
        const pick = CORE_ORDER[Math.floor(rng() * CORE_ORDER.length)]!;
        out[pick] = (out[pick] ?? 0) + 1;
    }
    return out;
}

/** 구 데이터: Lv>1 인데 보너스 없을 때 결정론적으로 누적 생성 */
export function backfillPairPetLevelUpCoreBonuses(
    itemId: string,
    createdAt: number,
    targetLevel: number,
    grade: ItemGrade
): Partial<Record<CoreStat, number>> {
    const lv = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(targetLevel) || 1));
    if (lv <= 1) return {};
    const rng = mulberry32(hashSeed(`pet-lvl-bonus|${itemId}|${createdAt}`));
    let acc: Partial<Record<CoreStat, number>> = {};
    for (let step = 1; step < lv; step += 1) {
        acc = mergeCoreBonus(acc, rollSingleLevelUpCoreBonuses(grade, rng));
    }
    return acc;
}

/** 인벤 행 기준 메타(레벨업 보너스 없는 구 펫은 결정론 백필) */
export function resolvePairPetMetaFromInventoryRow(row: {
    id: string;
    createdAt?: number;
    grade?: ItemGrade;
    pairPetMeta?: PairPetMeta | null;
}): PairPetMeta {
    const raw = row.pairPetMeta ?? derivePairPetMetaFallback(row.id, row.createdAt ?? Date.now());
    const grade = row.grade ?? ItemGrade.Normal;
    const lvl = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(raw.level) || 1));
    const existing = raw.levelUpCoreBonuses ?? {};
    const sumB = Object.values(existing).reduce((a, v) => a + (typeof v === 'number' ? v : 0), 0);
    const merged: PairPetMeta = {
        ...raw,
        level: lvl,
        xp: lvl >= PAIR_PET_MAX_LEVEL ? 0 : raw.xp ?? 0,
        levelUpCoreBonuses: { ...existing },
    };
    if (!isValidBirthCoreBases(merged.birthCoreBases)) {
        merged.birthCoreBases = backfillPairPetBirthCoreBases(row.id, row.createdAt ?? Date.now());
    }
    if (lvl > 1 && sumB === 0) {
        merged.levelUpCoreBonuses = backfillPairPetLevelUpCoreBonuses(row.id, row.createdAt ?? Date.now(), lvl, grade);
    }
    if (!isPairPetRpsAttribute(merged.rpsAttribute)) {
        merged.rpsAttribute = backfillPairPetRpsAttribute(row.id, row.createdAt ?? Date.now());
    }
    return merged;
}

/** 부화장 등: 성향·특성은 일반 부화와 동일 분포, 시작 레벨만 지정 */
export function rollPairPetMetaForHatchAtLevel(level: number): PairPetMeta {
    const base = rollPairPetMetaForHatch();
    const lv = Math.min(PAIR_PET_MAX_LEVEL, Math.max(1, Math.floor(level)));
    const rng = () => Math.random();
    let bonuses: Partial<Record<CoreStat, number>> = {};
    for (let step = 1; step < lv; step += 1) {
        bonuses = mergeCoreBonus(bonuses, rollSingleLevelUpCoreBonuses(ItemGrade.Normal, rng));
    }
    return { ...base, level: lv, xp: 0, levelUpCoreBonuses: bonuses };
}

/** 서버 부화와 동일 규칙의 결정론적 메타(구 인벤·스택 호환) */
export function derivePairPetMetaFallback(itemId: string, createdAt: number): PairPetMeta {
    const rng = mulberry32(hashSeed(`${itemId}|${createdAt}`));
    const disposition = rollPairPetDispositionForHatch(rng);
    const specialization = rollPairPetSpecializationForHatch(rng);
    return {
        level: 1,
        xp: 0,
        disposition,
        specialization,
        birthCoreBases: rollBirthCoreBasesMin30Sum300(rng),
        levelUpCoreBonuses: {},
        rpsAttribute: (1 + Math.floor(rng() * 3)) as PairPetRpsAttribute,
    };
}
