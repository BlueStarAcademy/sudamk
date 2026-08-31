import { describe, expect, it } from 'vitest';
import {
    PRE_GAME_PVP_COUNTDOWN_MS,
    PRE_GAME_PVP_COUNTDOWN_SECONDS,
    assignPreGamePvpCountdownDeadline,
    preGameCountdownDurationSeconds,
    preGamePvpDeadlineAt,
    resolvePreGameCountdownTotalSeconds,
} from '../../../shared/constants/preGameCountdown.js';

describe('preGameCountdown', () => {
    it('uses 60 second PVP pre-game window', () => {
        expect(PRE_GAME_PVP_COUNTDOWN_SECONDS).toBe(60);
        expect(PRE_GAME_PVP_COUNTDOWN_MS).toBe(60_000);
        const now = 1_700_000_000_000;
        expect(preGamePvpDeadlineAt(now)).toBe(now + 60_000);
    });

    it('stamps start time when assigning deadline', () => {
        const session: { preGameCountdownStartAt?: number } = {};
        const now = 1_700_000_000_000;
        const deadline = assignPreGamePvpCountdownDeadline(session, now, true);
        expect(deadline).toBe(now + 60_000);
        expect(session.preGameCountdownStartAt).toBe(now);
    });

    it('derives total seconds from stamped start and deadline fields', () => {
        const start = 1_700_000_000_000;
        const session = {
            preGameCountdownStartAt: start,
            revealEndTime: start + 60_000,
        };
        expect(preGameCountdownDurationSeconds(session)).toBe(60);
    });

    it('falls back to configured seconds when session slice is incomplete', () => {
        expect(preGameCountdownDurationSeconds({})).toBe(60);
        expect(resolvePreGameCountdownTotalSeconds(undefined, 60)).toBe(60);
    });
});
