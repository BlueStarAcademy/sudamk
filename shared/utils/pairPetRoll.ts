import { CoreStat, ItemGrade } from '../types/enums.js';
import type { PairPetDisposition, PairPetMeta, PairPetSpecialization } from '../types/entities.js';
import { CORE_STATS_DATA } from '../constants/items.js';
import { PAIR_PET_MAX_LEVEL, pairPetLevelUpStatBudget } from '../constants/pairPetGrade.js';

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
];

/** 도감용 — 부화 시 특화 종류·수치 범위 (`rollPairPetMetaForHatch` 와 동일) */
export const PAIR_PET_HATCH_SPECIALIZATION_ENCYCLOPEDIA_LINES: readonly string[] = [
    '수련 경험치 +10%~20%',
    '수련 골드 +10%~20%',
    '수련 시간 -10%~20%',
    '영혼석 획득 확률 +10%~20%',
];

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

function rollInt(rng: () => number, min: number, max: number): number {
    return min + Math.floor(rng() * (max - min + 1));
}

export function rollPairPetMetaForHatch(): PairPetMeta {
    const rng = () => Math.random();
    const disBucket = Math.floor(rng() * 7);
    let disposition: PairPetDisposition;
    if (disBucket >= 6) {
        disposition = { kind: 'all', pct: 5 };
    } else {
        disposition = {
            kind: 'single',
            stat: CORE_ORDER[disBucket]!,
            pct: rollInt(rng, 10, 20),
        };
    }
    const specKind = Math.floor(rng() * 4);
    const sp = rollInt(rng, 10, 20);
    const specialization: PairPetSpecialization =
        specKind === 0
            ? { kind: 'trainingXp', pct: sp }
            : specKind === 1
              ? { kind: 'trainingGold', pct: sp }
              : specKind === 2
                ? { kind: 'trainingTime', pct: sp }
                : { kind: 'soulDrop', pct: sp };
    return {
        level: 1,
        xp: 0,
        disposition,
        specialization,
        levelUpCoreBonuses: {},
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
    if (lvl > 1 && sumB === 0) {
        merged.levelUpCoreBonuses = backfillPairPetLevelUpCoreBonuses(row.id, row.createdAt ?? Date.now(), lvl, grade);
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
    const disBucket = Math.floor(rng() * 7);
    let disposition: PairPetDisposition;
    if (disBucket >= 6) {
        disposition = { kind: 'all', pct: 5 };
    } else {
        disposition = {
            kind: 'single',
            stat: CORE_ORDER[disBucket]!,
            pct: rollInt(rng, 10, 20),
        };
    }
    const specKind = Math.floor(rng() * 4);
    const sp = rollInt(rng, 10, 20);
    const specialization: PairPetSpecialization =
        specKind === 0
            ? { kind: 'trainingXp', pct: sp }
            : specKind === 1
              ? { kind: 'trainingGold', pct: sp }
              : specKind === 2
                ? { kind: 'trainingTime', pct: sp }
                : { kind: 'soulDrop', pct: sp };
    return {
        level: 1,
        xp: 0,
        disposition,
        specialization,
        levelUpCoreBonuses: {},
    };
}
