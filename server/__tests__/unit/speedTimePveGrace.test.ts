import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../types/index.js';
import { aiUserId } from '../../aiPlayer.js';
import { getSpeedTimePressureConsumptionSnapshot } from '../../utils/speedTimePressureLiveCaptures.js';

describe('PVE speed time pressure grace (1s per human live turn)', () => {
    it('subtracts 1s from live human consumption snapshot in adventure speed', () => {
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

        const snap = getSpeedTimePressureConsumptionSnapshot(session, nowMs);
        expect(snap.blackConsumed).toBe(0);
    });

    it('still counts full live used after 1s wall (grace exhausted)', () => {
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
            turnDeadline: nowMs + 298_000,
            settings: { __speedBonusConsumedSec: { black: 0, white: 0 } },
            isAiGame: true,
        } as any;

        const snap = getSpeedTimePressureConsumptionSnapshot(session, nowMs);
        expect(snap.blackConsumed).toBe(1);
    });

    it('does not apply grace to PVP human speed', () => {
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

        const snap = getSpeedTimePressureConsumptionSnapshot(session, nowMs);
        expect(snap.blackConsumed).toBe(1);
    });
});
