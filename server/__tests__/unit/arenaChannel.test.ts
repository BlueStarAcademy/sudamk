import { describe, expect, it } from 'vitest';
import { GameMode, UserStatus } from '../../../shared/types/index.js';
import {
    arenaChannelForGameMode,
    arenaChannelForGameSession,
    arenaChannelForUserStatus,
    arenaChannelRoute,
} from '../../../shared/utils/arenaChannel.js';
import {
    arenaLobbyHash,
    arenaLobbyHashFromSession,
    arenaLobbyIntentFromPairRoom,
    pairRoomRequiresLeaveConfirmation,
    parseArenaLobbyHash,
} from '../../../shared/utils/arenaLobbyDestination.js';
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

    it('derives lobby intent from pair room pairMode', () => {
        expect(arenaLobbyIntentFromPairRoom({ pairMode: 'ai', roomKind: 'duo_match' })).toBe('ai');
        expect(arenaLobbyIntentFromPairRoom({ pairMode: 'pvp', roomKind: 'friendly_4p' })).toBe('pvp');
        expect(arenaLobbyIntentFromPairRoom({ roomKind: 'arena_ai' })).toBe('ai');
    });

    it('skips leave confirmation for AI lobby shell rooms only', () => {
        expect(pairRoomRequiresLeaveConfirmation({ roomKind: 'arena_ai' })).toBe(false);
        expect(pairRoomRequiresLeaveConfirmation({ roomKind: 'ai_duel', pairMode: 'ai' })).toBe(false);
        expect(
            pairRoomRequiresLeaveConfirmation({
                roomKind: 'duo_match',
                pairMode: 'ai',
                lobbyChannel: 'pair',
                pairAiDuoInviteShell: true,
            }),
        ).toBe(false);
        expect(pairRoomRequiresLeaveConfirmation({ roomKind: 'friendly_4p', pairMode: 'pvp' })).toBe(true);
        expect(pairRoomRequiresLeaveConfirmation({ roomKind: 'duo_match', pairMode: 'pvp' })).toBe(true);
    });

    it('builds stable arena routes with intent', () => {
        expect(arenaChannelRoute('strategic')).toBe('#/pvp/strategic');
        expect(arenaChannelRoute('playful', 'ai')).toBe('#/ai/playful');
        expect(arenaChannelRoute('pair')).toBe('#/pvp/pair');
        expect(arenaLobbyHash({ intent: 'ai', channel: 'strategic' })).toBe('#/ai/strategic');
        expect(parseArenaLobbyHash('#/pvp/playful')).toEqual({ intent: 'pvp', channel: 'playful' });
    });

    it('derives lobby hash from game session ai/pvp axis', () => {
        expect(
            arenaLobbyHashFromSession({
                isAiGame: true,
                mode: GameMode.Standard,
            }),
        ).toBe('#/ai/strategic');
        expect(
            arenaLobbyHashFromSession({
                isAiGame: false,
                mode: GameMode.Dice,
            }),
        ).toBe('#/pvp/playful');
    });
});
