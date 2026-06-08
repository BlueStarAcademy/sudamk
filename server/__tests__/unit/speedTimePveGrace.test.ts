import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../types/index.js';
import { aiUserId } from '../../aiPlayer.js';
import {
    getSpeedTimeBonusPointsDesired,
    getSpeedCurrentTurnElapsedSec,
} from '../../../shared/utils/speedTimePressureSessionSync.js';

describe('speed time pressure per-move turn elapsed', () => {
    it('counts live human turn elapsed from turnStartTime', () => {
        const nowMs = 1_000_000;
        const session = {
            gameCategory: GameCategory.Adventure,
            mode: GameMode.Speed,
            gameStatus: 'playing',
            currentPlayer: Player.Black,
            blackPlayerId: 'human',
            whitePlayerId: aiUserId,
            blackTimeLeft: 300,
            whiteTimeLeft: 300,
            turnStartTime: nowMs - 1_000,
            turnDeadline: nowMs + 9_000,
            settings: { __speedTurnPenaltyCommitted: { black: 0, white: 0 } },
            isAiGame: true,
        } as any;

        const elapsed = getSpeedCurrentTurnElapsedSec(session, nowMs, aiUserId);
        expect(elapsed.blackElapsed).toBe(1);
    });

    it('does not grant AI bonus before 10s on current move', () => {
        const nowMs = 1_000_000;
        const session = {
            gameCategory: GameCategory.Adventure,
            mode: GameMode.Speed,
            gameStatus: 'playing',
            currentPlayer: Player.Black,
            blackPlayerId: 'human',
            whitePlayerId: aiUserId,
            blackTimeLeft: 300,
            whiteTimeLeft: 300,
            turnStartTime: nowMs - 9_000,
            turnDeadline: nowMs + 1_000,
            settings: { __speedTurnPenaltyCommitted: { black: 0, white: 0 } },
            isAiGame: true,
        } as any;

        const bonus = getSpeedTimeBonusPointsDesired(session, nowMs, aiUserId);
        expect(bonus.whiteBonus).toBe(0);
        expect(bonus.blackBonus).toBe(0);
    });

    it('grants first AI bonus after 10s on current move', () => {
        const nowMs = 1_000_000;
        const session = {
            gameCategory: GameCategory.Adventure,
            mode: GameMode.Speed,
            gameStatus: 'playing',
            currentPlayer: Player.Black,
            blackPlayerId: 'human',
            whitePlayerId: aiUserId,
            blackTimeLeft: 300,
            whiteTimeLeft: 300,
            turnStartTime: nowMs - 11_000,
            turnDeadline: nowMs + 0,
            settings: { __speedTurnPenaltyCommitted: { black: 0, white: 0 } },
            isAiGame: true,
        } as any;

        const bonus = getSpeedTimeBonusPointsDesired(session, nowMs, aiUserId);
        expect(bonus.whiteBonus).toBe(1);
        expect(bonus.blackBonus).toBe(0);
    });
});
