import { describe, expect, it } from 'vitest';
import { UserStatus } from '../../../shared/types/enums.js';
import {
    LOBBY_CHANNEL_CAPACITY,
    LOBBY_CHANNEL_COUNT,
    FRIEND_LIMIT,
} from '../../../shared/constants/lobbyChannel.js';
import {
    allocateLobbyChannel,
    canJoinLobbyChannel,
    countUsersInLobbyChannel,
    ensureLobbyChannel,
} from '../../../shared/utils/lobbyChannel.js';

describe('lobbyChannel utilities', () => {
    it('exposes friend limit of 50 and channel capacity 100', () => {
        expect(FRIEND_LIMIT).toBe(50);
        expect(LOBBY_CHANNEL_CAPACITY).toBe(100);
        expect(LOBBY_CHANNEL_COUNT).toBe(100);
    });

    it('allocates Ch.1 when empty', () => {
        expect(allocateLobbyChannel({})).toBe(1);
    });

    it('allocates next channel when Ch.1 is full', () => {
        const statuses: Record<string, { status: UserStatus; lobbyChannel: number }> = {};
        for (let i = 0; i < LOBBY_CHANNEL_CAPACITY; i += 1) {
            statuses[`u${i}`] = { status: UserStatus.Online, lobbyChannel: 1 };
        }
        expect(countUsersInLobbyChannel(statuses, 1)).toBe(100);
        expect(canJoinLobbyChannel(statuses, 1)).toBe(false);
        expect(allocateLobbyChannel(statuses)).toBe(2);
    });

    it('excludes a user id when checking capacity for channel move', () => {
        const statuses: Record<string, { status: UserStatus; lobbyChannel: number }> = {};
        for (let i = 0; i < LOBBY_CHANNEL_CAPACITY; i += 1) {
            statuses[`u${i}`] = { status: UserStatus.Online, lobbyChannel: 3 };
        }
        expect(canJoinLobbyChannel(statuses, 3)).toBe(false);
        expect(canJoinLobbyChannel(statuses, 3, 'u0')).toBe(true);
    });

    it('ensureLobbyChannel preserves existing channel', () => {
        const statuses = {
            a: { status: UserStatus.Online, lobbyChannel: 7 },
        };
        expect(ensureLobbyChannel(statuses, statuses.a, 'a')).toBe(7);
    });

    it('ensureLobbyChannel allocates when missing', () => {
        expect(ensureLobbyChannel({}, { status: UserStatus.Online }, 'new')).toBe(1);
    });

    it('returns null when every channel is full', () => {
        const statuses: Record<string, { status: UserStatus; lobbyChannel: number }> = {};
        let n = 0;
        for (let ch = 1; ch <= LOBBY_CHANNEL_COUNT; ch += 1) {
            for (let i = 0; i < LOBBY_CHANNEL_CAPACITY; i += 1) {
                statuses[`u${n++}`] = { status: UserStatus.Online, lobbyChannel: ch };
            }
        }
        expect(allocateLobbyChannel(statuses)).toBeNull();
    });
});
