import { describe, expect, it } from 'vitest';
import { PAIR_TRAINING_SLOT_COUNT, normalizePairPetTrainingSlots } from '../../../shared/constants/pairTraining.js';
import { rollPairPetTrainingRewards } from '../../utils/pairPetTrainingRewardRoll.js';
import type { PairPetMeta } from '../../../shared/types/entities.js';

const baseMeta: PairPetMeta = {
    level: 10,
    xp: 0,
    disposition: { kind: 'all', pct: 5 },
    specialization: { kind: 'trainingXp', pct: 0 },
    levelUpCoreBonuses: {},
    rpsAttribute: 1,
};

describe('rollPairPetTrainingRewards', () => {
    it('is deterministic when rnd is fixed', () => {
        const seq = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
        let i = 0;
        const rnd = () => {
            const v = seq[i % seq.length]!;
            i += 1;
            return v;
        };
        const a = rollPairPetTrainingRewards(0, baseMeta, rnd);
        i = 0;
        const b = rollPairPetTrainingRewards(0, baseMeta, rnd);
        expect(a).toEqual(b);
        expect(a?.goldGain).toBeGreaterThanOrEqual(0);
        expect(a?.xpGain).toBeGreaterThanOrEqual(0);
    });
});

describe('normalizePairPetTrainingSlots + precomputedRewards', () => {
    it('round-trips precomputedRewards', () => {
        const now = Date.now();
        const pre = {
            goldRoll: 10,
            goldGain: 12,
            goldFromSpec: 2,
            xpRoll: 5,
            xpGain: 6,
            xpFromSpec: 1,
            soulDrop: null as const,
        };
        const raw = [
            { slotIndex: 0, itemId: 'pet-1', startedAt: now, precomputedRewards: pre },
            ...Array(PAIR_TRAINING_SLOT_COUNT - 1).fill(null),
        ];
        const norm = normalizePairPetTrainingSlots(raw);
        expect(norm[0]?.precomputedRewards).toEqual(pre);
    });
});
