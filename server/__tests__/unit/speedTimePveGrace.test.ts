import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../types/index.js';
import { aiUserId } from '../../aiPlayer.js';
import {
    getSpeedTimeBonusPointsDesired,
    getSpeedTimePressureConsumptionSnapshot,
} from '../../../shared/utils/speedTimePressureSessionSync.js';

describe('speed time pressure consumption (10s scoring / 11s bar)', () => {
    it('counts live human consumption without PVE grace on server snapshot', () => {
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
            turnDeadline: nowMs + 299_000,
            settings: { __speedBonusConsumedSec: { black: 0, white: 0 } },
            isAiGame: true,
        } as any;

        const snap = getSpeedTimePressureConsumptionSnapshot(session, nowMs, aiUserId);
        expect(snap.blackConsumed).toBe(1);
    });

    it('grants first AI bonus at 10s human consumption', () => {
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
            turnDeadline: nowMs + 290_000,
            settings: { __speedBonusConsumedSec: { black: 0, white: 0 } },
            isAiGame: true,
        } as any;

        const bonus = getSpeedTimeBonusPointsDesired(session, nowMs, aiUserId);
        expect(bonus.whiteBonus).toBe(1);
        expect(bonus.blackBonus).toBe(0);
    });

    it('PVP speed uses full live consumption without grace', () => {
        const nowMs = 1_000_000;
        const session = {
            gameCategory: GameCategory.Normal,
            mode: GameMode.Speed,
            gameStatus: 'playing',
            currentPlayer: Player.Black,
            blackPlayerId: 'p1',
            whitePlayerId: 'p2',
            blackTimeLeft: 300,
            whiteTimeLeft: 300,
            turnDeadline: nowMs + 299_000,
            settings: { __speedBonusConsumedSec: { black: 0, white: 0 } },
            isAiGame: false,
        } as any;

        const snap = getSpeedTimePressureConsumptionSnapshot(session, nowMs, aiUserId);
        expect(snap.blackConsumed).toBe(1);
    });
});
