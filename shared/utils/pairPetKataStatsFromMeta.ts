import { CoreStat, ItemGrade } from '../types/enums.js';
import type { PairPetMeta } from '../types/entities.js';
import type { PairPetCoreStatsSix } from '../constants/pairArena.js';
import { pairPetStatMultiplierFromGrade } from '../constants/pairPetGrade.js';

/** `birthCoreBases` 없을 때 코어당 기본(구 스펙과 동일) */
export const PAIR_PET_LEGACY_BASE_PER_CORE = 50;
/**
 * 부화 시 6코어 무작위 분배: 각 스탯 하한·상한(등급 배율 적용 전 정수, 여섯 합 300).
 * `levelUpCoreBonuses`는 별도 필드로 합산되므로 이 상한은 태생 분배에만 적용된다.
 */
export const PAIR_PET_BIRTH_CORE_MIN = 30;
export const PAIR_PET_BIRTH_CORE_MAX = 70;
export const PAIR_PET_BIRTH_CORE_TOTAL = 300;

export function pairPetRawBaseCoreNoLevel(
    birthCoreBases: PairPetMeta['birthCoreBases'],
    petGrade: ItemGrade,
    stat: CoreStat,
): number {
    const mult = pairPetStatMultiplierFromGrade(petGrade);
    const b = birthCoreBases?.[stat];
    if (typeof b === 'number' && Number.isFinite(b)) {
        return Math.round(b * mult);
    }
    return Math.round(PAIR_PET_LEGACY_BASE_PER_CORE * mult);
}

/**
 * 페어 펫 KATA용 6코어 수치 — `server/actions/socialActions`의 `pairPetKataStatsFromEquippedPet`와 동일 규칙
 * (태생 `birthCoreBases` 또는 레거시 50·등급 배율 + 레벨업 분배 + 성향 보너스; 유저 스탯 상한 미적용)
 */
export function computePairPetKataCoreStatsSixFromMeta(meta: PairPetMeta, petGrade: ItemGrade): PairPetCoreStatsSix {
    const birth = meta.birthCoreBases;
    const d = meta.disposition;
    const rawFrom = (s: CoreStat) => pairPetRawBaseCoreNoLevel(birth, petGrade, s);
    const convertSlice =
        d.kind === 'convert' ? Math.round((rawFrom(d.fromStat) * d.pct) / 100) : 0;
    const valueFor = (stat: CoreStat): number => {
        const lvl = meta.levelUpCoreBonuses?.[stat] ?? 0;
        const base = rawFrom(stat) + lvl;
        if (d.kind === 'all') {
            return base + Math.round((rawFrom(stat) * d.pct) / 100);
        }
        if (d.kind === 'single') {
            return base + (d.stat === stat ? Math.round((rawFrom(d.stat) * d.pct) / 100) : 0);
        }
        if (d.kind === 'convert') {
            if (stat === d.fromStat) return base - convertSlice;
            if (stat === d.toStat) return base + 2 * convertSlice;
            return base;
        }
        return base;
    };
    return {
        concentration: valueFor(CoreStat.Concentration),
        thinkingSpeed: valueFor(CoreStat.ThinkingSpeed),
        judgment: valueFor(CoreStat.Judgment),
        calculation: valueFor(CoreStat.Calculation),
        combatPower: valueFor(CoreStat.CombatPower),
        stability: valueFor(CoreStat.Stability),
    };
}
