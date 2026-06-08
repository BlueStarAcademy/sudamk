import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../types/index.js';
import { aiUserId } from '../../aiPlayer.js';
import {
    getSpeedTimeBonusPointsDesired,
    getSpeedTurnPenaltySnapshot,
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

    it('counts live human turn elapsed for per-move penalty when tower speed is playing', () => {
        const nowMs = 2_000_000;
        const session = {
            gameCategory: GameCategory.Tower,
            mode: GameMode.Speed,
            gameStatus: 'playing',
            currentPlayer: Player.Black,
            blackPlayerId: 'human',
            whitePlayerId: aiUserId,
            blackTimeLeft: 300,
            whiteTimeLeft: 300,
            turnStartTime: nowMs - 15_000,
            turnDeadline: nowMs + 5_000,
            settings: { timeLimit: 5, __speedTurnPenaltyCommitted: { black: 0, white: 0 } },
            isAiGame: true,
        } as any;

        const snap = getSpeedTurnPenaltySnapshot(session, nowMs, aiUserId);
        expect(snap.blackPenaltyPoints).toBe(1);

        const bonus = getSpeedTimeBonusPointsDesired(session, nowMs, aiUserId);
        expect(bonus.whiteBonus).toBe(1);
        expect(bonus.blackBonus).toBe(0);
    });

    it('resets penalty count on next move (no cumulative carry-over)', () => {
        const nowMs = 3_000_000;
        const session = {
            gameCategory: GameCategory.Tower,
            mode: GameMode.Speed,
            gameStatus: 'playing',
            currentPlayer: Player.Black,
            blackPlayerId: 'human',
            whitePlayerId: aiUserId,
            blackTimeLeft: 280,
            whiteTimeLeft: 300,
            turnStartTime: nowMs - 5_000,
            turnDeadline: nowMs + 5_000,
            settings: { __speedTurnPenaltyCommitted: { black: 2, white: 0 } },
            isAiGame: true,
        } as any;

        const snap = getSpeedTurnPenaltySnapshot(session, nowMs, aiUserId);
        expect(snap.blackPenaltyPoints).toBe(2);
    });
});
