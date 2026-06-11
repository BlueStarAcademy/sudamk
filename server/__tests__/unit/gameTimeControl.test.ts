import { describe, it, expect } from 'vitest';
import { GameMode } from '../../../types/enums.js';
import {
    isSpeedMode,
    hasSpeedPerMovePressure,
    isSpeedPerMoveTimeControl,
    isFischerStyleTimeControl,
    getFischerIncrementSeconds,
    getSpeedPerMoveSeconds,
} from '../../../shared/utils/gameTimeControl.js';

describe('gameTimeControl', () => {
    it('detects speed mode and overlay', () => {
        const session = { mode: GameMode.Speed, settings: { timeIncrement: 0 } };
        expect(isSpeedMode(session)).toBe(true);
        expect(hasSpeedPerMovePressure(session)).toBe(true);
        expect(isSpeedPerMoveTimeControl(session)).toBe(true);
    });

    it('detects mix with speed overlay', () => {
        const session = {
            mode: GameMode.Mix,
            settings: { mixedModes: [GameMode.Standard, GameMode.Speed], timeIncrement: 5 },
        };
        expect(hasSpeedPerMovePressure(session)).toBe(true);
    });

    it('human PVP fischer when timeIncrement > 0', () => {
        const session = { mode: GameMode.Standard, settings: { timeIncrement: 10 } };
        expect(isFischerStyleTimeControl(session)).toBe(true);
        expect(getFischerIncrementSeconds(session)).toBe(10);
    });

    it('speed + fischer coexist (main fischer + 10s overlay)', () => {
        const session = { mode: GameMode.Speed, settings: { timeIncrement: 5 } };
        expect(isFischerStyleTimeControl(session)).toBe(true);
        expect(hasSpeedPerMovePressure(session)).toBe(true);
        expect(getFischerIncrementSeconds(session)).toBe(5);
    });

    it('speed byoyomi main is not fischer', () => {
        const session = {
            mode: GameMode.Speed,
            settings: { timeIncrement: 0, byoyomiTime: 30, byoyomiCount: 3 },
        };
        expect(isFischerStyleTimeControl(session)).toBe(false);
        expect(hasSpeedPerMovePressure(session)).toBe(true);
    });

    it('getSpeedPerMoveSeconds is constant 10 regardless of byoyomiTime', () => {
        const session = {
            mode: GameMode.Speed,
            settings: { byoyomiTime: 30, timeIncrement: 0 },
        };
        expect(getSpeedPerMoveSeconds(session)).toBe(10);
    });

    it('guildwar fischer still works', () => {
        const session = {
            mode: GameMode.Standard,
            gameCategory: 'guildwar',
            settings: { timeIncrement: 3 },
        };
        expect(isFischerStyleTimeControl(session)).toBe(true);
    });
});
