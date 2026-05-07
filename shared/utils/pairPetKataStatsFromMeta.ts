import { CoreStat, ItemGrade } from '../types/enums.js';
import type { PairPetMeta } from '../types/entities.js';
import type { PairPetCoreStatsSix } from '../constants/pairArena.js';
import { pairPetStatMultiplierFromGrade } from '../constants/pairPetGrade.js';

const PET_BASE_STAT = 50;

/**
 * 페어 펫 KATA용 6코어 수치 — `server/actions/socialActions`의 `pairPetKataStatsFromEquippedPet`와 동일 규칙
 * (등급 배율 기본 + 레벨업 분배 + 성향 보너스; 유저 스탯 상한 미적용)
 */
export function computePairPetKataCoreStatsSixFromMeta(meta: PairPetMeta, petGrade: ItemGrade): PairPetCoreStatsSix {
    const rawBaseNoLvl = Math.round(PET_BASE_STAT * pairPetStatMultiplierFromGrade(petGrade));
    const d = meta.disposition;
    const convertSlice = d.kind === 'convert' ? Math.round((rawBaseNoLvl * d.pct) / 100) : 0;
    const valueFor = (stat: CoreStat): number => {
        const lvl = meta.levelUpCoreBonuses?.[stat] ?? 0;
        const base = rawBaseNoLvl + lvl;
        if (d.kind === 'all') {
            return base + Math.round((rawBaseNoLvl * d.pct) / 100);
        }
        if (d.kind === 'single') {
            return base + (d.stat === stat ? Math.round((rawBaseNoLvl * d.pct) / 100) : 0);
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
