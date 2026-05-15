import { describe, expect, it } from 'vitest';
import { isScoreBasedScoringPresentation } from '../../../hooks/useScoringOverlayPresentation.js';

describe('isScoreBasedScoringPresentation', () => {
    it('is true while scoring or hidden final reveal', () => {
        expect(isScoreBasedScoringPresentation('scoring', undefined, 'playing')).toBe(true);
        expect(isScoreBasedScoringPresentation('hidden_final_reveal', undefined, 'playing')).toBe(true);
    });

    it('is true on score win even when status is already ended', () => {
        expect(isScoreBasedScoringPresentation('ended', 'score', 'playing')).toBe(true);
    });

    it('is true on ended after scoring even without score winReason', () => {
        expect(isScoreBasedScoringPresentation('ended', 'resign', 'scoring')).toBe(true);
    });

    it('is false for capture/resign endings that never entered scoring', () => {
        expect(isScoreBasedScoringPresentation('ended', 'capture_limit', 'playing')).toBe(false);
        expect(isScoreBasedScoringPresentation('ended', 'resign', 'playing')).toBe(false);
    });
});
