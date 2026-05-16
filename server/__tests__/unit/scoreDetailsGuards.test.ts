import { describe, expect, it } from 'vitest';
import { hasRenderableScoreDetails } from '../../../shared/utils/scoreDetailsGuards.js';

describe('hasRenderableScoreDetails', () => {
    it('returns false when totals are null', () => {
        expect(
            hasRenderableScoreDetails({
                scoreDetails: {
                    black: { total: 10, territory: 5 } as any,
                    white: { total: null, territory: 4 } as any,
                },
            } as any),
        ).toBe(false);
    });

    it('returns true when both totals are finite numbers', () => {
        expect(
            hasRenderableScoreDetails({
                scoreDetails: {
                    black: { total: 10.5, territory: 5 },
                    white: { total: 8.5, territory: 4, komi: 6.5 },
                },
            } as any),
        ).toBe(true);
    });
});
