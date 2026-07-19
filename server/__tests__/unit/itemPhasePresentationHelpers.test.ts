import { describe, expect, it } from 'vitest';
import { Player } from '../../../shared/types/enums.js';
import {
    isItemPhaseAiBlockingPresentationActive,
    isTimedAnimationClockActive,
    stripStaleFlightOrScanAnimationIfPlaying,
} from '../../../shared/utils/itemPhaseAnimationTypes.js';

describe('itemPhasePresentationHelpers', () => {
    it('treats in-flight missile animation as AI-blocking', () => {
        const now = 10_000;
        const session = {
            animation: {
                type: 'missile' as const,
                from: { x: 0, y: 0 },
                to: { x: 0, y: 2 },
                player: Player.Black,
                startTime: now - 200,
                duration: 2000,
            },
        };
        expect(isItemPhaseAiBlockingPresentationActive(session as any, now)).toBe(true);
    });

    it('does not block AI for expired missile leftover on playing', () => {
        const now = 10_000;
        const session = {
            animation: {
                type: 'missile' as const,
                from: { x: 0, y: 0 },
                to: { x: 0, y: 2 },
                player: Player.Black,
                startTime: now - 5000,
                duration: 400,
            },
        };
        expect(isTimedAnimationClockActive(session.animation, now)).toBe(false);
        expect(isItemPhaseAiBlockingPresentationActive(session as any, now)).toBe(false);
    });

    it('strips stale flight animation when status is playing', () => {
        const session = {
            gameStatus: 'playing' as const,
            animation: {
                type: 'scan' as const,
                playerId: 'p1',
                startTime: 1,
                duration: 400,
            },
        };
        expect(stripStaleFlightOrScanAnimationIfPlaying(session as any).animation).toBeNull();
    });

    it('does not strip animation while still in missile_animating', () => {
        const session = {
            gameStatus: 'missile_animating' as const,
            animation: {
                type: 'missile' as const,
                from: { x: 1, y: 1 },
                to: { x: 1, y: 3 },
                player: Player.Black,
                startTime: 1,
                duration: 400,
            },
        };
        expect(stripStaleFlightOrScanAnimationIfPlaying(session as any).animation).toEqual(session.animation);
    });
});
