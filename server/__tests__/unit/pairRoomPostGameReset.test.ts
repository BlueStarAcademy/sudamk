import { describe, expect, it } from 'vitest';
import type { PairRoomState } from '../../../shared/types/api.js';
import { GameMode } from '../../../shared/types/index.js';
import { resetPairRoomAfterGame, restorePairRoomMemberLobbyStatuses } from '../../utils/pairRoomPostGameReset.js';

function duoMatchRoomAfterGame(): PairRoomState {
    return {
        id: 'room-1',
        code: '1',
        mode: 'pvp',
        pairMode: 'pvp',
        roomKind: 'duo_match',
        visibility: 'public',
        passwordProtected: false,
        phase: 'in_game',
        title: '친선방',
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
                { id: 'owner-1', name: '방장', kind: 'user', slot: 'owner', ready: true },
                { id: 'guest-1', name: '손님', kind: 'user', slot: 'partner', ready: true },
            ],
        },
        teamB: { id: 'teamB', name: 'B', members: [] },
        createdAt: Date.now(),
        lobbyChannel: 'strategic',
    };
}

describe('resetPairRoomAfterGame', () => {
    it('clears owner and guest readiness after a friendly duo match', () => {
        const room = duoMatchRoomAfterGame();
        resetPairRoomAfterGame(room);
        expect(room.phase).toBe('waiting');
        expect(room.matchStartedAt).toBeUndefined();
        expect(room.ownerReady).toBe(false);
        expect(room.partnerReady).toBe(false);
        expect(room.teamA.members.find((m) => m.id === 'guest-1')?.ready).toBe(false);
    });

    it('does not auto-ready human partner in friendly_4p after game', () => {
        const room = duoMatchRoomAfterGame();
        room.roomKind = 'friendly_4p';
        room.partnerId = 'guest-1';
        resetPairRoomAfterGame(room);
        expect(room.partnerReady).toBe(false);
    });

    it('keeps pet partner auto-ready in ai pair rooms', () => {
        const room = duoMatchRoomAfterGame();
        room.pairMode = 'ai';
        room.partnerId = 'pet-ai-owner-1';
        resetPairRoomAfterGame(room);
        expect(room.partnerReady).toBe(true);
    });
});

describe('restorePairRoomMemberLobbyStatuses', () => {
    it('clears stale in-game for room members when phase returns to waiting', () => {
        const room = duoMatchRoomAfterGame();
        resetPairRoomAfterGame(room);
        const volatileState = {
            userStatuses: {
                'owner-1': { status: 'in-game' as const, gameId: 'g1', mode: GameMode.Standard },
                'guest-1': { status: 'in-game' as const, gameId: 'g1', mode: GameMode.Standard },
            },
        } as any;
        expect(restorePairRoomMemberLobbyStatuses(volatileState, room)).toBe(true);
        expect(volatileState.userStatuses['owner-1'].status).toBe('waiting');
        expect(volatileState.userStatuses['owner-1'].gameId).toBeUndefined();
        expect(volatileState.userStatuses['owner-1'].waitingLobby).toBe('strategic');
        expect(volatileState.userStatuses['guest-1'].status).toBe('waiting');
    });
});
