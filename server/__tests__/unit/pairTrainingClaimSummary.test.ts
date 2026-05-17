import { describe, expect, it } from 'vitest';
import { ItemGrade } from '../../../types/enums.js';
import type { InventoryItem, PairPetMeta } from '../../../shared/types/entities.js';
import { buildPairTrainingClaimSummaryFromPrecomputed } from '../../../shared/utils/pairTrainingClaimSummary.js';

const meta: PairPetMeta = {
    level: 5,
    xp: 40,
    disposition: { kind: 'all', pct: 5 },
    specialization: { kind: 'trainingGold', pct: 10 },
    levelUpCoreBonuses: {},
    rpsAttribute: 1,
};

const petRow: InventoryItem = {
    id: 'pet-1',
    name: 'Test Pet',
    templateId: 'pair-pet-1',
    image: '/x.png',
    grade: ItemGrade.Normal,
    pairPetMeta: meta,
} as InventoryItem;

describe('buildPairTrainingClaimSummaryFromPrecomputed', () => {
    it('maps precomputed rolls to claim summary', () => {
        const pre = {
            goldRoll: 100,
            goldGain: 110,
            goldFromSpec: 10,
            xpRoll: 50,
            xpGain: 55,
            xpFromSpec: 5,
            soulDrop: { materialName: '영혼석1', quantity: 2 },
        };
        const s = buildPairTrainingClaimSummaryFromPrecomputed(petRow, pre);
        expect(s.goldGain).toBe(110);
        expect(s.goldBase).toBe(100);
        expect(s.xpGain).toBe(55);
        expect(s.soulDrop).toEqual(pre.soulDrop);
        expect(s.pairPetXp?.change).toBe(55);
        expect(s.pairPetLevel?.initial).toBe(5);
        expect(s.pairPetLevel?.final).toBeGreaterThanOrEqual(5);
    });
});
