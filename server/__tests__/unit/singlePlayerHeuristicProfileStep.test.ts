import { describe, expect, it } from 'vitest';
import { resolveSinglePlayerHeuristicProfileStep } from '../../../shared/utils/strategicAiDifficulty.js';

describe('resolveSinglePlayerHeuristicProfileStep', () => {
    it('uses academy profile 5 for 유단자 kataServerLevel 1 (not lobby step 1)', () => {
        expect(
            resolveSinglePlayerHeuristicProfileStep({
                goAiBotLevel: 5,
                aiDifficulty: 5,
                kataServerLevel: 1,
            }),
        ).toBe(5);
    });

    it('maps academy kata levels -31..-27 to profile 1..5 when goAiBotLevel is absent', () => {
        expect(resolveSinglePlayerHeuristicProfileStep({ kataServerLevel: -31 })).toBe(1);
        expect(resolveSinglePlayerHeuristicProfileStep({ kataServerLevel: -27 })).toBe(5);
    });
});
