import { describe, expect, it } from 'vitest';
import { computePairPetKataCoreStatsSixFromMeta } from '../../../shared/utils/pairPetKataStatsFromMeta.js';
import { CoreStat, ItemGrade } from '../../../shared/types/enums.js';
import type { PairPetMeta } from '../../../shared/types/entities.js';

describe('pair pet convert disposition', () => {
    it('subtracts pct of grade base from fromStat and adds twice that to toStat', () => {
        const meta: PairPetMeta = {
            level: 1,
            xp: 0,
            disposition: {
                kind: 'convert',
                fromStat: CoreStat.Calculation,
                toStat: CoreStat.ThinkingSpeed,
                pct: 11,
            },
            specialization: { kind: 'trainingXp', pct: 10 },
            levelUpCoreBonuses: { [CoreStat.Calculation]: 3 },
        };
        const six = computePairPetKataCoreStatsSixFromMeta(meta, ItemGrade.Normal);
        const raw = 50;
        const slice = Math.round((raw * 11) / 100);
        expect(slice).toBe(6);
        expect(six.calculation).toBe(raw + 3 - slice);
        expect(six.thinkingSpeed).toBe(raw + 2 * slice);
        expect(six.concentration).toBe(raw);
        expect(six.judgment).toBe(raw);
        expect(six.combatPower).toBe(raw);
        expect(six.stability).toBe(raw);
    });
});
