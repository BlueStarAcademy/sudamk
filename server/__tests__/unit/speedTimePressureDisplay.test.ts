import { describe, expect, it } from 'vitest';
import {
    getSpeedTimePressureBarProgress,
    getSpeedTurnPenaltyPointsFromElapsedSec,
    getSpeedTimePressureUiCountdownSeconds,
} from '../../../shared/utils/speedTimePressureDisplay.js';

describe('speedTimePressureDisplay', () => {
    it('maps 11s bar cycle to 10→1 countdown (never 11)', () => {
        expect(getSpeedTimePressureUiCountdownSeconds(0)).toBe(10);
        expect(getSpeedTimePressureUiCountdownSeconds(5)).toBeGreaterThan(1);
        expect(getSpeedTimePressureUiCountdownSeconds(5)).toBeLessThanOrEqual(10);
        expect(getSpeedTimePressureUiCountdownSeconds(10)).toBe(1);
        expect(getSpeedTimePressureUiCountdownSeconds(10.9)).toBe(1);
        expect(getSpeedTimePressureUiCountdownSeconds(11)).toBe(10);
        expect(getSpeedTimePressureUiCountdownSeconds(22)).toBe(10);
        const allAtSecondTicks = Array.from({ length: 12 }, (_, i) =>
            getSpeedTimePressureUiCountdownSeconds(i),
        );
        expect(allAtSecondTicks.every((s) => s >= 1 && s <= 10)).toBe(true);
        expect(allAtSecondTicks.includes(11)).toBe(false);
    });

    it('awards penalty points only after 10 seconds on the current move', () => {
        expect(getSpeedTurnPenaltyPointsFromElapsedSec(0)).toBe(0);
        expect(getSpeedTurnPenaltyPointsFromElapsedSec(9.9)).toBe(0);
        expect(getSpeedTurnPenaltyPointsFromElapsedSec(10)).toBe(0);
        expect(getSpeedTurnPenaltyPointsFromElapsedSec(11)).toBe(1);
        expect(getSpeedTurnPenaltyPointsFromElapsedSec(19)).toBe(1);
        expect(getSpeedTurnPenaltyPointsFromElapsedSec(20)).toBe(2);
        expect(getSpeedTurnPenaltyPointsFromElapsedSec(25)).toBe(2);
    });

    it('fills bar over 11 seconds per cycle', () => {
        expect(getSpeedTimePressureBarProgress(0)).toBe(0);
        expect(getSpeedTimePressureBarProgress(5.5)).toBeCloseTo(0.5, 5);
        expect(getSpeedTimePressureBarProgress(11)).toBe(0);
    });
});
