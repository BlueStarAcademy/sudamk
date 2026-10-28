import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
    POST_GAME_OPEN_HOME_LOBBY_SESSION_KEY,
    POST_GAME_PAIR_ROOM_RESTORE_SESSION_KEY,
} from '../../../shared/constants/pairArena.js';
import {
    consumePostGameOpenHomeLobby,
    isPersistentPairWaitingRoomId,
    normalizePairArenaLobbyChannel,
    postGameHomeLobbyKindFromChannel,
    sessionShouldRetainEndedPvpLingerRoom,
    stashPostGamePairRoomLobbyReturn,
} from '../../../shared/utils/pairArenaSessionRestore.js';

function installMemorySessionStorage(): void {
    const store = new Map<string, string>();
    const mock = {
        getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
        setItem: (key: string, value: string) => {
            store.set(key, String(value));
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        clear: () => {
            store.clear();
        },
        key: (index: number) => [...store.keys()][index] ?? null,
        get length() {
            return store.size;
        },
    };
    Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: mock,
    });
}

describe('pairArenaSessionRestore', () => {
    beforeEach(() => {
        installMemorySessionStorage();
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    it('keeps waiting-room ids and rejects ranked/ephemeral shells', () => {
        expect(isPersistentPairWaitingRoomId('pair-room-abc')).toBe(true);
        expect(isPersistentPairWaitingRoomId('pair-ai-ephemeral-1')).toBe(false);
        expect(isPersistentPairWaitingRoomId('pair-duo-ranked-a-b')).toBe(false);
        expect(isPersistentPairWaitingRoomId('pair-ranked-a-b')).toBe(false);
    });

    it('maps friendly/playful channels for home embed reopen', () => {
        expect(normalizePairArenaLobbyChannel('friendly')).toBe('friendly');
        expect(postGameHomeLobbyKindFromChannel('friendly')).toBe('friendly');
        expect(postGameHomeLobbyKindFromChannel('playful')).toBe('playful');
        expect(postGameHomeLobbyKindFromChannel('pair')).toBe('friendly');
    });

    it('stashes room restore and home lobby reopen for a friendly waiting room game', () => {
        stashPostGamePairRoomLobbyReturn({
            settings: { pairGame: { roomId: 'pair-room-friendly-1', lobbyChannel: 'friendly', pairMode: 'pvp' } },
        });
        expect(sessionStorage.getItem(POST_GAME_PAIR_ROOM_RESTORE_SESSION_KEY)).toBe('pair-room-friendly-1');
        expect(consumePostGameOpenHomeLobby()).toBe('friendly');
        expect(sessionStorage.getItem(POST_GAME_OPEN_HOME_LOBBY_SESSION_KEY)).toBeNull();
    });

    it('stashes restore from pairWaitingRoomReturn for duo classic 1:1 (no pairGame)', () => {
        stashPostGamePairRoomLobbyReturn({
            settings: {
                pairWaitingRoomReturn: { roomId: 'pair-room-friendly-duo', lobbyChannel: 'friendly' },
            },
        });
        expect(sessionStorage.getItem(POST_GAME_PAIR_ROOM_RESTORE_SESSION_KEY)).toBe('pair-room-friendly-duo');
        expect(consumePostGameOpenHomeLobby()).toBe('friendly');
    });

    it('does not stash reopen keys for ranked synthetic room ids', () => {
        stashPostGamePairRoomLobbyReturn({
            settings: { pairGame: { roomId: 'pair-duo-ranked-a-b', lobbyChannel: 'friendly', pairMode: 'pvp' } },
        });
        expect(sessionStorage.getItem(POST_GAME_PAIR_ROOM_RESTORE_SESSION_KEY)).toBeNull();
        expect(consumePostGameOpenHomeLobby()).toBeNull();
    });

    it('does not linger ended duo friendly games that return to a waiting room', () => {
        expect(
            sessionShouldRetainEndedPvpLingerRoom({
                gameStatus: 'ended',
                isSinglePlayer: false,
                isAiGame: false,
                settings: {
                    pairWaitingRoomReturn: { roomId: 'pair-room-friendly-duo', lobbyChannel: 'friendly' },
                },
            }),
        ).toBe(false);
        expect(
            sessionShouldRetainEndedPvpLingerRoom({
                gameStatus: 'ended',
                isSinglePlayer: false,
                isAiGame: false,
                settings: {},
            }),
        ).toBe(true);
    });
});
