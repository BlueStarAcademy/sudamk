import { describe, expect, it } from 'vitest';
import { Player } from '../../../types/index.js';
import {
    getLiveGameHumanParticipantIds,
    isLiveGameHumanParticipant,
    resolveLiveGamePlayerEnumForUser,
    resolveOpponentPlayerEnumForUser,
} from '../../utils/liveGameParticipants.js';

const pairGame = {
    roomId: 'room-1',
    pairMode: 'pvp' as const,
    teamA: {
        name: 'A',
        members: [
            { id: 'black-main', name: 'Black 1', kind: 'user' as const, slot: 'black1' },
            { id: 'black-partner', name: 'Black 2', kind: 'user' as const, slot: 'black2' },
        ],
    },
    teamB: {
        name: 'B',
        members: [
            { id: 'white-main', name: 'White 1', kind: 'user' as const, slot: 'white1' },
            { id: 'white-partner', name: 'White 2', kind: 'user' as const, slot: 'white2' },
        ],
    },
    turnOrder: [
        { seatId: 'black1', player: Player.Black, participantId: 'black-main', kind: 'user' as const },
        { seatId: 'white1', player: Player.White, participantId: 'white-main', kind: 'user' as const },
        { seatId: 'black2', player: Player.Black, participantId: 'black-partner', kind: 'user' as const },
        { seatId: 'white2', player: Player.White, participantId: 'white-partner', kind: 'user' as const },
    ],
};

describe('liveGameParticipants', () => {
    it('includes pair turnOrder humans beyond player1/player2', () => {
        const game = {
            player1: { id: 'black-main' },
            player2: { id: 'white-main' },
            settings: { pairGame },
        } as any;

        expect([...getLiveGameHumanParticipantIds(game)].sort()).toEqual([
            'black-main',
            'black-partner',
            'white-main',
            'white-partner',
        ]);
        expect(isLiveGameHumanParticipant(game, 'black-partner')).toBe(true);
        expect(isLiveGameHumanParticipant(game, 'spectator')).toBe(false);
    });

    it('resolves pair user color and opponent color from turnOrder seats', () => {
        const game = {
            blackPlayerId: 'black-main',
            whitePlayerId: 'white-main',
            settings: { pairGame },
        } as any;

        expect(resolveLiveGamePlayerEnumForUser(game, 'black-partner')).toBe(Player.Black);
        expect(resolveOpponentPlayerEnumForUser(game, 'black-partner')).toBe(Player.White);
        expect(resolveLiveGamePlayerEnumForUser(game, 'white-partner')).toBe(Player.White);
        expect(resolveOpponentPlayerEnumForUser(game, 'white-partner')).toBe(Player.Black);
        expect(resolveLiveGamePlayerEnumForUser(game, 'spectator')).toBeNull();
    });
});
