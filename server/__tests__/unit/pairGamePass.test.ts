import { describe, expect, it } from 'vitest';
import { Player } from '../../../types/index.js';
import {
    canPairHumanDeclarePass,
    getPairUserPassSeats,
    markPairSeatPassed,
} from '../../../shared/utils/pairGameTurn.js';

const pvpSettings: any = {
    pairGame: {
        pairMode: 'pvp' as const,
        passSeatIds: [],
        turnOrder: [
            { seatId: 'black1', player: Player.Black, participantId: 'u1', kind: 'user' as const },
            { seatId: 'white1', player: Player.White, participantId: 'u2', kind: 'user' as const },
            { seatId: 'black2', player: Player.Black, participantId: 'u3', kind: 'user' as const },
            { seatId: 'white2', player: Player.White, participantId: 'u4', kind: 'user' as const },
        ],
    },
};

const aiSettings: any = {
    pairGame: {
        pairMode: 'ai' as const,
        passSeatIds: [],
        turnOrder: [
            { seatId: 'black1', player: Player.Black, participantId: 'u1', kind: 'user' as const },
            { seatId: 'white1', player: Player.White, participantId: 'pair-opponent-ai', kind: 'ai' as const },
            { seatId: 'black2', player: Player.Black, participantId: 'pet-ai-u1', kind: 'pet' as const },
            { seatId: 'white2', player: Player.White, participantId: 'pair-opponent-pet', kind: 'pet' as const },
        ],
    },
};

describe('pair pass policy', () => {
    it('allows pass only for user seats in PVP pair', () => {
        expect(canPairHumanDeclarePass(pvpSettings, pvpSettings.pairGame.turnOrder[0])).toBe(true);
        expect(canPairHumanDeclarePass(aiSettings, aiSettings.pairGame.turnOrder[0])).toBe(false);
        expect(canPairHumanDeclarePass(aiSettings, aiSettings.pairGame.turnOrder[1])).toBe(false);
    });

    it('does not score when AI/pet pass in AI pair', () => {
        const settings = JSON.parse(JSON.stringify(aiSettings));
        const aiSeat = settings.pairGame.turnOrder[1];
        expect(markPairSeatPassed(settings, aiSeat)).toBe(false);
        expect(settings.pairGame.passSeatIds).toEqual([]);
    });

    it('scores only when all four users pass in PVP pair', () => {
        const settings = JSON.parse(JSON.stringify(pvpSettings));
        const seats = getPairUserPassSeats(settings);
        expect(seats).toHaveLength(4);
        expect(markPairSeatPassed(settings, seats[0]!)).toBe(false);
        expect(markPairSeatPassed(settings, seats[1]!)).toBe(false);
        expect(markPairSeatPassed(settings, seats[2]!)).toBe(false);
        expect(markPairSeatPassed(settings, seats[3]!)).toBe(true);
    });
});
