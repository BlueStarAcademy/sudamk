import { describe, expect, it } from 'vitest';
import {
    isScoreBasedScoringPresentation,
    shouldCompleteScoringOverlay,
} from '../../../hooks/useScoringOverlayPresentation.js';
import {
    SCORING_OVERLAY_MAX_WAIT_MS,
    SCORING_PROGRESS_DURATION_MS,
} from '../../../shared/constants/scoringOverlayTiming.js';

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

describe('shouldCompleteScoringOverlay', () => {
    it('completes immediately when result content is ready even before progress duration', () => {
        expect(
            shouldCompleteScoringOverlay({
                elapsedMs: 500,
                resultContentReady: true,
            }),
        ).toBe(true);
        expect(
            shouldCompleteScoringOverlay({
                elapsedMs: SCORING_PROGRESS_DURATION_MS - 1,
                resultContentReady: true,
            }),
        ).toBe(true);
    });

    it('does not complete from progress duration alone when results are not ready', () => {
        expect(
            shouldCompleteScoringOverlay({
                elapsedMs: SCORING_PROGRESS_DURATION_MS,
                resultContentReady: false,
            }),
        ).toBe(false);
        expect(
            shouldCompleteScoringOverlay({
                elapsedMs: SCORING_OVERLAY_MAX_WAIT_MS - 1,
                resultContentReady: false,
            }),
        ).toBe(false);
    });

    it('completes when max wait is exceeded even without results', () => {
        expect(
            shouldCompleteScoringOverlay({
                elapsedMs: SCORING_OVERLAY_MAX_WAIT_MS,
                resultContentReady: false,
            }),
        ).toBe(true);
        expect(
            shouldCompleteScoringOverlay({
                elapsedMs: SCORING_OVERLAY_MAX_WAIT_MS + 100,
                resultContentReady: false,
            }),
        ).toBe(true);
    });
});
