import { describe, expect, it } from 'vitest';
import { GameMode, UserStatus } from '../../../shared/types/index.js';
import {
    arenaChannelForGameMode,
    arenaChannelForGameSession,
    arenaChannelForUserStatus,
    arenaChannelRoute,
} from '../../../shared/utils/arenaChannel.js';
import {
    aiRoomKindsForChannel,
    arenaLobbyHash,
    arenaLobbyHashFromSession,
    arenaLobbyIntentFromPairRoom,
    canonicalizeHomeAlignedLobbyDestination,
    isPairAiDuoInviteOnlyRoom,
    isPairRoomVisibleInLobbyIntent,
    isRoomKindAllowedForLobby,
    pairRoomAllowsFriendlyOpponentAiSeats,
    pairRoomRequiresLeaveConfirmation,
    parseArenaLobbyHash,
    pvpRoomKindsForChannel,
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
        expect(userArenaChannelBadge({ status: UserStatus.Waiting, arenaChannel: 'playful' })?.label).toBe('놀이터');
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

    it('keeps playful AI/user rooms visible on the same playground list', () => {
        expect(
            isPairRoomVisibleInLobbyIntent(
                { roomKind: 'arena_ai', pairMode: 'ai', lobbyChannel: 'playful', ownerId: 'u1' },
                { intent: 'pvp', channel: 'playful' },
                'u2',
            ),
        ).toBe(true);
        expect(
            isPairRoomVisibleInLobbyIntent(
                { roomKind: 'duo_match', pairMode: 'pvp', lobbyChannel: 'playful', ownerId: 'u1' },
                { intent: 'ai', channel: 'playful' },
                'u2',
            ),
        ).toBe(true);
    });

    it('shows the owner their AI-mode room on a PVP list when roomKind is allowed', () => {
        expect(
            isPairRoomVisibleInLobbyIntent(
                { roomKind: 'duo_match', pairMode: 'ai', lobbyChannel: 'strategic', ownerId: 'owner' },
                { intent: 'pvp', channel: 'strategic' },
                'owner',
            ),
        ).toBe(true);
        expect(
            isPairRoomVisibleInLobbyIntent(
                { roomKind: 'duo_match', pairMode: 'ai', lobbyChannel: 'strategic', ownerId: 'owner' },
                { intent: 'pvp', channel: 'strategic' },
                'other',
            ),
        ).toBe(false);
    });

    it('builds stable arena routes with intent', () => {
        expect(arenaChannelRoute('strategic')).toBe('#/pvp/strategic');
        expect(arenaChannelRoute('playful', 'ai')).toBe('#/pvp/friendly');
        expect(arenaChannelRoute('pair')).toBe('#/pvp/friendly');
        expect(arenaLobbyHash({ intent: 'ai', channel: 'strategic' })).toBe('#/pvp/friendly');
        expect(arenaLobbyHash({ intent: 'ai', channel: 'pair' })).toBe('#/pvp/friendly');
        expect(parseArenaLobbyHash('#/pvp/playful')).toEqual({ intent: 'pvp', channel: 'playful' });
    });

    it('derives post-game return hash as home for home-aligned arenas', () => {
        expect(
            arenaLobbyHashFromSession({
                isAiGame: true,
                mode: GameMode.Standard,
            }),
        ).toBe('#/home');
        expect(
            arenaLobbyHashFromSession({
                isAiGame: false,
                mode: GameMode.Standard,
            }),
        ).toBe('#/home');
        expect(
            arenaLobbyHashFromSession({
                isAiGame: false,
                mode: GameMode.Dice,
            }),
        ).toBe('#/home');
        expect(
            arenaLobbyHashFromSession({
                isAiGame: true,
                mode: GameMode.Standard,
                settings: { pairGame: { lobbyChannel: 'pair', pairMode: 'ai' } },
            }),
        ).toBe('#/home');
        expect(
            arenaLobbyHashFromSession({
                isAiGame: false,
                mode: GameMode.Standard,
                settings: { pairGame: { lobbyChannel: 'friendly', pairMode: 'pvp' } },
            }),
        ).toBe('#/home');
    });

    it('canonicalizes orphan lobbies to home-aligned destinations', () => {
        expect(canonicalizeHomeAlignedLobbyDestination({ intent: 'ai', channel: 'pair' })).toEqual({
            intent: 'pvp',
            channel: 'friendly',
        });
        expect(canonicalizeHomeAlignedLobbyDestination({ intent: 'ai', channel: 'playful' })).toEqual({
            intent: 'pvp',
            channel: 'friendly',
        });
        expect(canonicalizeHomeAlignedLobbyDestination({ intent: 'ai', channel: 'friendly' })).toEqual({
            intent: 'pvp',
            channel: 'friendly',
        });
        expect(canonicalizeHomeAlignedLobbyDestination({ intent: 'pvp', channel: 'pair' })).toEqual({
            intent: 'pvp',
            channel: 'friendly',
        });
        expect(canonicalizeHomeAlignedLobbyDestination({ intent: 'pvp', channel: 'friendly' })).toEqual({
            intent: 'pvp',
            channel: 'friendly',
        });
        expect(aiRoomKindsForChannel('strategic')).toEqual(['arena_ai', 'duo_match']);
        expect(
            isPairAiDuoInviteOnlyRoom({
                roomKind: 'duo_match',
                pairMode: 'ai',
                lobbyChannel: 'strategic',
            }),
        ).toBe(true);
        expect(pvpRoomKindsForChannel('friendly')).toEqual([
            'duo_match',
            'friendly_2p',
            'team_pair',
            'friendly_4p',
        ]);
        expect(isRoomKindAllowedForLobby('duo_match', { intent: 'pvp', channel: 'friendly' })).toBe(true);
        expect(isRoomKindAllowedForLobby('friendly_4p', { intent: 'pvp', channel: 'friendly' })).toBe(true);
        expect(isRoomKindAllowedForLobby('team_pair', { intent: 'pvp', channel: 'friendly' })).toBe(true);
        /** AI intent는 친선전으로 canonicalize → 1:1 친선(duo_match) 허용 */
        expect(canonicalizeHomeAlignedLobbyDestination({ intent: 'ai', channel: 'strategic' })).toEqual({
            intent: 'pvp',
            channel: 'friendly',
        });
        expect(
            isRoomKindAllowedForLobby(
                'duo_match',
                canonicalizeHomeAlignedLobbyDestination({ intent: 'ai', channel: 'strategic' }),
            ),
        ).toBe(true);
        expect(isRoomKindAllowedForLobby('arena_ai', { intent: 'pvp', channel: 'friendly' })).toBe(false);
        /** pair로 잘못 접히면 친선전(duo_match)이 거절되던 회귀 */
        expect(isRoomKindAllowedForLobby('duo_match', { intent: 'pvp', channel: 'pair' })).toBe(false);
        expect(pairRoomAllowsFriendlyOpponentAiSeats({ roomKind: 'friendly_4p', lobbyChannel: 'friendly' })).toBe(
            false,
        );
        expect(pairRoomAllowsFriendlyOpponentAiSeats({ roomKind: 'duo_match', lobbyChannel: 'friendly' })).toBe(
            false,
        );
        expect(pairRoomAllowsFriendlyOpponentAiSeats({ roomKind: 'team_pair', lobbyChannel: 'friendly' })).toBe(
            false,
        );
    });
});
