import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../types/index.js';
import { aiUserId } from '../../aiPlayer.js';
import {
    getSpeedTimeBonusPointsDesired,
    getSpeedTimePressureConsumptionSnapshot,
    isSessionSpeedTimePressureMode,
} from '../../../shared/utils/speedTimePressureSessionSync.js';

describe('tower speed time pressure clock', () => {
    it('detects tower speed and mix+speed as time pressure modes', () => {
        expect(
            isSessionSpeedTimePressureMode({
                mode: GameMode.Speed,
                settings: {},
            } as any),
        ).toBe(true);
        expect(
            isSessionSpeedTimePressureMode({
                mode: GameMode.Mix,
                settings: { mixedModes: [GameMode.Speed, GameMode.Hidden] },
            } as any),
        ).toBe(true);
        expect(
            isSessionSpeedTimePressureMode({
                mode: GameMode.Standard,
                settings: {},
            } as any),
        ).toBe(false);
    });

    it('counts live human consumption when tower speed has turnDeadline', () => {
        const nowMs = 2_000_000;
        const initialSec = 300;
        const session = {
            gameCategory: GameCategory.Tower,
            mode: GameMode.Speed,
            gameStatus: 'playing',
            currentPlayer: Player.Black,
            blackPlayerId: 'human',
            whitePlayerId: aiUserId,
            blackTimeLeft: initialSec,
            whiteTimeLeft: initialSec,
            turnDeadline: nowMs + (initialSec - 10) * 1000,
            turnStartTime: nowMs - 10_000,
            settings: { timeLimit: 5, __speedBonusConsumedSec: { black: 0, white: 0 } },
            isAiGame: true,
        } as any;

        const snap = getSpeedTimePressureConsumptionSnapshot(session, nowMs, aiUserId);
        expect(snap.blackConsumed).toBe(10);

        const bonus = getSpeedTimeBonusPointsDesired(session, nowMs, aiUserId);
        expect(bonus.whiteBonus).toBe(1);
        expect(bonus.blackBonus).toBe(0);
    });
});
