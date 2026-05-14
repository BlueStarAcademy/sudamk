import { describe, expect, it } from 'vitest';
import {
    championshipVersusTierBandIndexForTierName,
    CHAMPIONSHIP_VERSUS_TIER_BANDS,
} from '../../../shared/utils/championshipVersusTier.js';

describe('championshipVersusTier', () => {
    it('maps tier names to expected band indices', () => {
        expect(championshipVersusTierBandIndexForTierName('새싹')).toBe(0);
        expect(championshipVersusTierBandIndexForTierName('루키')).toBe(0);
        expect(championshipVersusTierBandIndexForTierName('브론즈')).toBe(0);
        expect(championshipVersusTierBandIndexForTierName('실버')).toBe(1);
        expect(championshipVersusTierBandIndexForTierName('골드')).toBe(1);
        expect(championshipVersusTierBandIndexForTierName('플래티넘')).toBe(2);
        expect(championshipVersusTierBandIndexForTierName('다이아')).toBe(2);
        expect(championshipVersusTierBandIndexForTierName('마스터')).toBe(3);
        expect(championshipVersusTierBandIndexForTierName('챌린저')).toBe(3);
    });

    it('has four disjoint bands covering known tiers', () => {
        expect(CHAMPIONSHIP_VERSUS_TIER_BANDS.length).toBe(4);
    });
});
