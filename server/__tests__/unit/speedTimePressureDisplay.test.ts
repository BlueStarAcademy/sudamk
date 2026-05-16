import { describe, expect, it } from 'vitest';
import {
    getSpeedTimePressureBarProgress,
    getSpeedTimePressureBonusPointsFromConsumedSec,
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

    it('awards bonus points every 10 consumed seconds', () => {
        expect(getSpeedTimePressureBonusPointsFromConsumedSec(0)).toBe(0);
        expect(getSpeedTimePressureBonusPointsFromConsumedSec(9.9)).toBe(0);
        expect(getSpeedTimePressureBonusPointsFromConsumedSec(10)).toBe(1);
        expect(getSpeedTimePressureBonusPointsFromConsumedSec(19)).toBe(1);
        expect(getSpeedTimePressureBonusPointsFromConsumedSec(20)).toBe(2);
    });

    it('fills bar over 11 seconds per cycle', () => {
        expect(getSpeedTimePressureBarProgress(0)).toBe(0);
        expect(getSpeedTimePressureBarProgress(5.5)).toBeCloseTo(0.5, 5);
        expect(getSpeedTimePressureBarProgress(11)).toBe(0);
    });
});
