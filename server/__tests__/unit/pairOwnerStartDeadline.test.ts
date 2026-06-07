import { describe, expect, it } from 'vitest';
import type { PairRoomState } from '../../../shared/types/api.js';
import { PAIR_OWNER_START_DEADLINE_MS } from '../../../shared/constants/pairOwnerStart.js';
import {
    pairLobbyAllNonOwnerHumansReady,
    pairOwnerStartDeadlineExpired,
    pickFirstJoinedPairRoomGuestSuccessor,
    recordPairGuestJoinOrder,
    syncPairOwnerStartDeadline,
} from '../../../shared/utils/pairOwnerStartDeadline.js';
import { GameMode } from '../../../shared/types/index.js';

function baseDuoRoom(): PairRoomState {
    return {
        id: 'room-1',
        code: '1',
        mode: 'pvp',
        pairMode: 'pvp',
        roomKind: 'duo_match',
        visibility: 'public',
        passwordProtected: false,
        phase: 'waiting',
        title: '테스트방',
        ownerId: 'owner-1',
        ownerName: '방장',
        partnerId: 'guest-2',
        partnerName: '손님2',
        partnerReady: true,
        selectedGameMode: GameMode.Standard,
        settings: {},
        teamA: { id: 'teamA', name: 'A', members: [] },
        teamB: { id: 'teamB', name: 'B', members: [] },
        ownerReady: false,
        createdAt: Date.now(),
        lobbyChannel: 'strategic',
        pairGuestJoinOrder: ['guest-1', 'guest-2'],
    };
}

describe('pair owner start deadline', () => {
    it('sets deadline when all guests are ready', () => {
        const room = baseDuoRoom();
        room.extraPairMembers = [{ id: 'guest-1', name: '손님1', ready: true }];
        const now = 1_000_000;
        syncPairOwnerStartDeadline(room, now);
        expect(room.pairOwnerStartDeadlineAt).toBe(now + PAIR_OWNER_START_DEADLINE_MS);
    });

    it('clears deadline when a guest is not ready', () => {
        const room = baseDuoRoom();
        room.partnerReady = false;
        room.pairOwnerStartDeadlineAt = Date.now() + PAIR_OWNER_START_DEADLINE_MS;
        syncPairOwnerStartDeadline(room, Date.now());
        expect(room.pairOwnerStartDeadlineAt).toBeUndefined();
    });

    it('picks the earliest joined guest as successor', () => {
        const room = baseDuoRoom();
        room.extraPairMembers = [{ id: 'guest-1', name: '손님1', ready: true }];
        expect(pickFirstJoinedPairRoomGuestSuccessor(room, 'owner-1')).toBe('guest-1');
    });

    it('detects expired deadline only while guests remain ready', () => {
        const room = baseDuoRoom();
        const now = 5_000_000;
        room.pairOwnerStartDeadlineAt = now - 1;
        expect(pairOwnerStartDeadlineExpired(room, now)).toBe(true);
        room.partnerReady = false;
        expect(pairOwnerStartDeadlineExpired(room, now)).toBe(false);
    });

    it('tracks guest join order without duplicating', () => {
        const room = baseDuoRoom();
        delete room.pairGuestJoinOrder;
        recordPairGuestJoinOrder(room, 'guest-a');
        recordPairGuestJoinOrder(room, 'guest-b');
        recordPairGuestJoinOrder(room, 'guest-a');
        expect(room.pairGuestJoinOrder).toEqual(['guest-a', 'guest-b']);
        expect(pairLobbyAllNonOwnerHumansReady(room)).toBe(true);
    });
});
