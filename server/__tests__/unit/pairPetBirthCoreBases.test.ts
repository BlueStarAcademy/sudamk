import { describe, expect, it } from 'vitest';
import { CoreStat } from '../../../shared/types/enums.js';
import {
    PAIR_PET_BIRTH_CORE_MAX,
    PAIR_PET_BIRTH_CORE_MIN,
    PAIR_PET_BIRTH_CORE_TOTAL,
} from '../../../shared/utils/pairPetKataStatsFromMeta.js';
import { rollBirthCoreBasesMin30Sum300 } from '../../../shared/utils/pairPetRoll.js';

describe('pair pet birth core bases', () => {
    it('distributes 30~70 each, sum 300 (rng→0 fills cores in order until cap then next)', () => {
        const b = rollBirthCoreBasesMin30Sum300(() => 0);
        const vals = Object.values(b);
        expect(vals.reduce((a, x) => a + x, 0)).toBe(PAIR_PET_BIRTH_CORE_TOTAL);
        expect(Math.min(...vals)).toBe(PAIR_PET_BIRTH_CORE_MIN);
        expect(Math.max(...vals)).toBe(PAIR_PET_BIRTH_CORE_MAX);
        expect(b[CoreStat.Concentration]).toBe(70);
        expect(b[CoreStat.ThinkingSpeed]).toBe(70);
        expect(b[CoreStat.Judgment]).toBe(70);
        expect(b[CoreStat.Calculation]).toBe(30);
        expect(b[CoreStat.CombatPower]).toBe(30);
        expect(b[CoreStat.Stability]).toBe(30);
    });
});
