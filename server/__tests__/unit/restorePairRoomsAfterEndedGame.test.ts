import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../types/index.js';
import type { LiveGameSession } from '../../../types/index.js';
import { restorePairRoomsAfterEndedGame } from '../../actions/socialActions.js';

describe('restorePairRoomsAfterEndedGame', () => {
    it('resets strategic duo_match shell without pairGame settings when players match', () => {
        const volatileState: any = {
            userStatuses: {
                'owner-1': { status: 'in-game', gameId: 'g1' },
                'guest-1': { status: 'in-game', gameId: 'g1' },
            },
            pairRooms: {
                'room-strategic-duo': {
                    id: 'room-strategic-duo',
                    code: '1',
                    mode: 'pvp',
                    pairMode: 'pvp',
                    roomKind: 'duo_match',
                    lobbyChannel: 'strategic',
                    visibility: 'public',
                    passwordProtected: false,
                    phase: 'in_game',
                    title: '친선',
                    ownerId: 'owner-1',
                    ownerName: '방장',
                    ownerReady: true,
                    partnerId: 'guest-1',
                    partnerName: '손님',
                    partnerReady: true,
                    matchStartedAt: Date.now(),
                    selectedGameMode: GameMode.Standard,
                    settings: {},
                    teamA: {
                        id: 'teamA',
                        name: 'A',
                        members: [
                            { id: 'owner-1', name: '방장', kind: 'user', ready: true },
                            { id: 'guest-1', name: '손님', kind: 'user', ready: true },
                        ],
                    },
                    teamB: { id: 'teamB', name: 'B', members: [] },
                    createdAt: Date.now(),
                },
            },
        };

        const game = {
            id: 'g1',
            gameStatus: 'ended',
            mode: GameMode.Standard,
            player1: { id: 'owner-1', nickname: '방장' },
            player2: { id: 'guest-1', nickname: '손님' },
            settings: {},
        } as LiveGameSession;

        expect(restorePairRoomsAfterEndedGame(volatileState, game)).toBe(true);
        const room = volatileState.pairRooms['room-strategic-duo'];
        expect(room.phase).toBe('waiting');
        expect(room.partnerReady).toBe(false);
        expect(room.ownerReady).toBe(false);
        expect(room.teamA.members.find((m: { id: string }) => m.id === 'guest-1')?.ready).toBe(false);
        expect(volatileState.userStatuses['guest-1'].status).toBe('waiting');
    });
});
