import { describe, expect, it } from 'vitest';
import {
    getPairPetXpRequirementForLevel,
    getXpRequirementForLevel,
} from '../../../shared/utils/strategyLevelXp.js';
import { getXpRequiredForCurrentLevel } from '../../../utils/playerLevelXp.js';

describe('getXpRequirementForLevel', () => {
    it('matches early linear bands and softened mid/late compounding', () => {
        expect(getXpRequirementForLevel(0)).toBe(0);
        expect(getXpRequirementForLevel(1)).toBe(300);
        expect(getXpRequirementForLevel(10)).toBe(1200);
        expect(getXpRequirementForLevel(15)).toBe(2550);
        expect(getXpRequirementForLevel(20)).toBe(3300);
        expect(getXpRequirementForLevel(30)).toBe(10251);
        expect(getXpRequirementForLevel(40)).toBe(31838);
        expect(getXpRequirementForLevel(50)).toBe(98886);
        expect(getXpRequirementForLevel(51)).toBe(113719);
        expect(getXpRequirementForLevel(100)).toBe(107158713);
        expect(getXpRequirementForLevel(101)).toBe(Number.POSITIVE_INFINITY);
    });

    it('is re-exported by playerLevelXp as getXpRequiredForCurrentLevel', () => {
        expect(getXpRequiredForCurrentLevel(30)).toBe(getXpRequirementForLevel(30));
        expect(getXpRequiredForCurrentLevel(50)).toBe(getXpRequirementForLevel(50));
    });
});

describe('getPairPetXpRequirementForLevel', () => {
    it('is half of the user curve (ceil, min 1)', () => {
        expect(getPairPetXpRequirementForLevel(1)).toBe(150);
        expect(getPairPetXpRequirementForLevel(20)).toBe(1650);
        expect(getPairPetXpRequirementForLevel(30)).toBe(5126);
        expect(getPairPetXpRequirementForLevel(50)).toBe(49443);
        expect(getPairPetXpRequirementForLevel(100)).toBe(53579357);
        expect(getPairPetXpRequirementForLevel(101)).toBe(Number.POSITIVE_INFINITY);
    });
});
