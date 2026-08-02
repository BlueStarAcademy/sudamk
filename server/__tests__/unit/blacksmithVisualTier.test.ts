import { describe, expect, it } from 'vitest';
import {
    getBlacksmithVisualImageSrc,
    getBlacksmithVisualNameKey,
    resolveBlacksmithVisualTier,
} from '../../../shared/utils/blacksmithVisualTier.js';

describe('blacksmithVisualTier', () => {
    it('resolves visual tiers by level thresholds', () => {
        expect(resolveBlacksmithVisualTier(1)).toBe(1);
        expect(resolveBlacksmithVisualTier(4)).toBe(1);
        expect(resolveBlacksmithVisualTier(5)).toBe(2);
        expect(resolveBlacksmithVisualTier(9)).toBe(2);
        expect(resolveBlacksmithVisualTier(10)).toBe(3);
        expect(resolveBlacksmithVisualTier(14)).toBe(3);
        expect(resolveBlacksmithVisualTier(15)).toBe(4);
        expect(resolveBlacksmithVisualTier(19)).toBe(4);
        expect(resolveBlacksmithVisualTier(20)).toBe(5);
    });

    it('maps tier image and name keys', () => {
        expect(getBlacksmithVisualImageSrc(3)).toBe('/images/equipments/moru.webp');
        expect(getBlacksmithVisualImageSrc(5)).toBe('/images/equipments/moru-lv5.webp');
        expect(getBlacksmithVisualImageSrc(20)).toBe('/images/equipments/moru-lv20.webp');
        expect(getBlacksmithVisualNameKey(1)).toBe('visualNames.tier1');
        expect(getBlacksmithVisualNameKey(12)).toBe('visualNames.tier3');
        expect(getBlacksmithVisualNameKey(20)).toBe('visualNames.tier5');
    });
});
