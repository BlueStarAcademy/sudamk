import { describe, expect, it } from 'vitest';
import { GameMode, UserStatus } from '../../../shared/types/index.js';
import {
    arenaChannelForGameMode,
    arenaChannelForGameSession,
    arenaChannelForUserStatus,
    arenaChannelRoute,
} from '../../../shared/utils/arenaChannel.js';
import { userArenaChannelBadge } from '../../../shared/utils/unifiedArenaLobbyUserList.js';

describe('arena channel utilities', () => {
    it('maps game modes to strategic and playful channels', () => {
        expect(arenaChannelForGameMode(GameMode.Standard)).toBe('strategic');
        expect(arenaChannelForGameMode(GameMode.Base)).toBe('strategic');
        expect(arenaChannelForGameMode(GameMode.Dice)).toBe('playful');
        expect(arenaChannelForGameMode(GameMode.Curling)).toBe('playful');
    });

    it('prefers pairGame lobbyChannel over mode for in-game sessions', () => {
        expect(
            arenaChannelForGameSession({
                mode: GameMode.Standard,
                settings: { pairGame: { lobbyChannel: 'pair' } },
            } as any),
        ).toBe('pair');
        expect(
            arenaChannelForGameSession({
                mode: GameMode.Standard,
                settings: { pairGame: { lobbyChannel: 'playful' } },
            } as any),
        ).toBe('playful');
    });

    it('resolves user status badges from explicit channel and legacy fields', () => {
        expect(arenaChannelForUserStatus({ status: UserStatus.Waiting, arenaChannel: 'pair' })).toBe('pair');
        expect(arenaChannelForUserStatus({ status: UserStatus.Waiting, waitingLobby: 'strategic' })).toBe('strategic');
        expect(arenaChannelForUserStatus({ status: UserStatus.Waiting, mode: GameMode.Omok })).toBe('playful');
        expect(userArenaChannelBadge({ status: UserStatus.Waiting, arenaChannel: 'playful' })?.label).toBe('놀이');
    });

    it('builds stable arena routes', () => {
        expect(arenaChannelRoute('strategic')).toBe('#/waiting/strategic');
        expect(arenaChannelRoute('playful')).toBe('#/waiting/playful');
        expect(arenaChannelRoute('pair')).toBe('#/pair');
    });
});
