import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GameCategory, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { aiUserId } from '../../../shared/constants/auth.js';
import {
    isPveSessionAbandonOnLeave,
    resolvePveAbandonAiWinner,
    applyPveAbandonOnPlayerLeave,
    markPveAbandonForfeit,
    isPveAbandonForfeitGame,
    shouldSkipPveAbandonForActiveBrowserSession,
} from '../../utils/pveAbandonOnDisconnect.js';
import { UserStatus } from '../../../types/index.js';

vi.mock('../../db.js', () => ({
    getLiveGame: vi.fn(),
    deleteGame: vi.fn(),
}));

vi.mock('../../summaryService.js', () => ({
    endGame: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../socket.js', () => ({
    broadcast: vi.fn(),
    hasAuthenticatedWebSocket: vi.fn(() => false),
}));

vi.mock('../../gameCache.js', () => ({
    removeGameFromCache: vi.fn(),
}));

const session = (patch: Partial<LiveGameSession> = {}): LiveGameSession =>
    ({
        id: 'pve-abandon-test',
        mode: 'standard',
        gameCategory: GameCategory.SinglePlayer,
        isSinglePlayer: true,
        isAiGame: true,
        gameStatus: 'playing',
        blackPlayerId: 'human-1',
        whitePlayerId: aiUserId,
        player1: { id: 'human-1', nickname: 'Human' },
        player2: { id: aiUserId, nickname: 'AI' },
        settings: { boardSize: 9 },
        moveHistory: [],
        ...patch,
    }) as LiveGameSession;

describe('pveAbandonOnDisconnect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('isPveSessionAbandonOnLeave is true for matchAxis pve sessions', () => {
        expect(isPveSessionAbandonOnLeave(session())).toBe(true);
        expect(isPveSessionAbandonOnLeave(session({ gameCategory: GameCategory.Adventure, isSinglePlayer: false }))).toBe(
            true,
        );
        expect(
            isPveSessionAbandonOnLeave(
                session({
                    gameCategory: GameCategory.GuildWar,
                    isSinglePlayer: false,
                    isAiGame: false,
                    guildWarId: 'guild-war-1',
                    guildWarBoardId: 'center',
                }),
            ),
        ).toBe(true);
        expect(
            isPveSessionAbandonOnLeave(
                session({ gameCategory: GameCategory.Normal, isSinglePlayer: false, isAiGame: false }),
            ),
        ).toBe(false);
    });

    it('resolvePveAbandonAiWinner picks opposite color of human', () => {
        expect(resolvePveAbandonAiWinner(session(), 'human-1')).toBe(Player.White);
        expect(
            resolvePveAbandonAiWinner(
                session({ blackPlayerId: aiUserId, whitePlayerId: 'human-1' }),
                'human-1',
            ),
        ).toBe(Player.Black);
    });

    it('markPveAbandonForfeit flags game for no-reward settlement', () => {
        const game = session();
        expect(isPveAbandonForfeitGame(game)).toBe(false);
        markPveAbandonForfeit(game);
        expect(isPveAbandonForfeitGame(game)).toBe(true);
    });

    it('applyPveAbandonOnPlayerLeave ends game as defeat and deletes room', async () => {
        const { endGame } = await import('../../summaryService.js');
        const { deleteGame } = await import('../../db.js');
        const { broadcast } = await import('../../socket.js');
        const { removeGameFromCache } = await import('../../gameCache.js');

        const volatileState = {
            userStatuses: {
                'human-1': { status: UserStatus.InGame, gameId: 'pve-abandon-test' },
            },
            gameChats: { 'pve-abandon-test': [] },
        } as any;

        const game = session();
        const handled = await applyPveAbandonOnPlayerLeave(volatileState, 'human-1', game, 'logout');

        expect(handled).toBe(true);
        expect(isPveAbandonForfeitGame(game)).toBe(true);
        expect(endGame).toHaveBeenCalledWith(game, Player.White, 'resign');
        expect(deleteGame).toHaveBeenCalledWith('pve-abandon-test');
        expect(removeGameFromCache).toHaveBeenCalledWith('pve-abandon-test');
        expect(broadcast).toHaveBeenCalledWith({
            type: 'GAME_DELETED',
            payload: { gameId: 'pve-abandon-test', reason: 'pve_abandon' },
        });
        expect(volatileState.userStatuses['human-1'].status).toBe(UserStatus.Online);
        expect(volatileState.userStatuses['human-1'].gameId).toBeUndefined();
    });

    it('applyPveAbandonOnPlayerLeave skips ended games', async () => {
        const { endGame } = await import('../../summaryService.js');
        const volatileState = { userStatuses: {} } as any;
        const handled = await applyPveAbandonOnPlayerLeave(
            volatileState,
            'human-1',
            session({ gameStatus: 'ended' }),
            'logout',
        );
        expect(handled).toBe(false);
        expect(endGame).not.toHaveBeenCalled();
    });

    it('shouldSkipPveAbandonForActiveBrowserSession skips disconnect when HTTP session is active', async () => {
        const volatileState = { userConnections: { 'human-1': Date.now() } } as any;
        await expect(
            shouldSkipPveAbandonForActiveBrowserSession(volatileState, 'human-1', 'disconnect'),
        ).resolves.toBe(true);
        await expect(
            shouldSkipPveAbandonForActiveBrowserSession(volatileState, 'human-1', 'session_expired'),
        ).resolves.toBe(true);
        await expect(
            shouldSkipPveAbandonForActiveBrowserSession(volatileState, 'human-1', 'logout'),
        ).resolves.toBe(false);
    });

    it('applyPveAbandonOnPlayerLeave skips disconnect while browser session is active', async () => {
        const { endGame } = await import('../../summaryService.js');
        const volatileState = {
            userConnections: { 'human-1': Date.now() },
            userStatuses: {
                'human-1': { status: UserStatus.InGame, gameId: 'pve-abandon-test' },
            },
        } as any;

        const handled = await applyPveAbandonOnPlayerLeave(
            volatileState,
            'human-1',
            session(),
            'disconnect',
        );

        expect(handled).toBe(false);
        expect(endGame).not.toHaveBeenCalled();
        expect(volatileState.userStatuses['human-1'].gameId).toBe('pve-abandon-test');
    });

    it('applyPveAbandonOnPlayerLeave skips connection_timeout when websocket is still connected', async () => {
        const { endGame } = await import('../../summaryService.js');
        const { hasAuthenticatedWebSocket } = await import('../../socket.js');
        vi.mocked(hasAuthenticatedWebSocket).mockReturnValue(true);

        const volatileState = {
            userStatuses: {
                'human-1': { status: UserStatus.InGame, gameId: 'pve-abandon-test' },
            },
        } as any;

        const handled = await applyPveAbandonOnPlayerLeave(
            volatileState,
            'human-1',
            session(),
            'connection_timeout',
        );

        expect(handled).toBe(false);
        expect(endGame).not.toHaveBeenCalled();
        expect(volatileState.userConnections['human-1']).toBeTypeOf('number');
    });
});
