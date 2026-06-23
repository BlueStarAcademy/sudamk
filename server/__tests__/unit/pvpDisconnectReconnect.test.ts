import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LiveGameSession, VolatileState } from '../../../shared/types/index.js';
import { GameMode, Player, UserStatus } from '../../../shared/types/index.js';
import { createDefaultUser } from '../../initialData.js';
import { PVP_DISCONNECT_REJOIN_GRACE_MS } from '../../../shared/utils/pvpDisconnectPolicy.js';

vi.mock('../../db.js', () => ({
    saveGame: vi.fn().mockResolvedValue(undefined),
    getLiveGame: vi.fn(),
}));
vi.mock('../../socket.js', () => ({
    broadcastToGameParticipants: vi.fn(),
    broadcast: vi.fn(),
}));
vi.mock('../../summaryService.js', () => ({
    endGame: vi.fn().mockResolvedValue(undefined),
}));

import * as db from '../../db.js';
import { broadcast, broadcastToGameParticipants } from '../../socket.js';
import {
    applyPvpInGameDisconnect,
    clearPvpDisconnectOnPlayerReconnect,
    clearPvpDisconnectOnPlayerReconnectByStatus,
} from '../../actions/socialActions.js';

function makePvpGame(disconnectedUserId: string): LiveGameSession {
    const p1 = createDefaultUser('p1-id', 'p1', 'P1');
    const p2 = createDefaultUser('p2-id', 'p2', 'P2');
    return {
        id: 'game-1',
        mode: GameMode.Standard,
        settings: { boardSize: 9, komi: 0.5 },
        player1: p1,
        player2: p2,
        blackPlayerId: p1.id,
        whitePlayerId: p2.id,
        gameStatus: 'playing',
        boardState: Array(9).fill(0).map(() => Array(9).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.Black]: 0, [Player.White]: 0 },
        currentPlayer: Player.Black,
        disconnectionState: {
            disconnectedPlayerId: disconnectedUserId,
            timerStartedAt: Date.now() - 10_000,
        },
        disconnectionCounts: { [disconnectedUserId]: 1 },
    } as LiveGameSession;
}

describe('clearPvpDisconnectOnPlayerReconnect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('clears disconnectionState for the disconnected player within grace period', async () => {
        const game = makePvpGame('p2-id');
        const cleared = await clearPvpDisconnectOnPlayerReconnect(game, 'p2-id');
        expect(cleared).toBe(true);
        expect(game.disconnectionState).toBeNull();
        expect(db.saveGame).toHaveBeenCalledWith(game);
        expect(broadcastToGameParticipants).toHaveBeenCalled();
    });

    it('does not clear for the other player', async () => {
        const game = makePvpGame('p2-id');
        const cleared = await clearPvpDisconnectOnPlayerReconnect(game, 'p1-id');
        expect(cleared).toBe(false);
        expect(game.disconnectionState).not.toBeNull();
    });

    it('does not clear after grace period expired', async () => {
        const game = makePvpGame('p2-id');
        game.disconnectionState!.timerStartedAt = Date.now() - PVP_DISCONNECT_REJOIN_GRACE_MS - 1;
        const cleared = await clearPvpDisconnectOnPlayerReconnect(game, 'p2-id');
        expect(cleared).toBe(false);
        expect(game.disconnectionState).not.toBeNull();
    });
});

describe('clearPvpDisconnectOnPlayerReconnectByStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('loads in-game session and clears disconnect for reconnecting user', async () => {
        const game = makePvpGame('p2-id');
        vi.mocked(db.getLiveGame).mockResolvedValue(game);
        const volatileState = {
            userStatuses: {
                'p2-id': { status: UserStatus.InGame, gameId: 'game-1', mode: GameMode.Standard },
            },
        } as VolatileState;

        const cleared = await clearPvpDisconnectOnPlayerReconnectByStatus(volatileState, 'p2-id');
        expect(cleared).toBe(true);
        expect(game.disconnectionState).toBeNull();
    });
});

describe('applyPvpInGameDisconnect', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('sets disconnectionState when waiting-room entry overwrote in-game status', async () => {
        const game = makePvpGame('p2-id');
        game.disconnectionState = null;
        const volatileState = {
            userStatuses: {
                'p2-id': { status: UserStatus.Waiting, waitingLobby: 'strategic' },
            },
            gameCache: new Map([['game-1', { game, lastUpdated: Date.now() }]]),
        } as VolatileState;

        const handled = await applyPvpInGameDisconnect(volatileState, 'p2-id');
        expect(handled).toBe(true);
        expect(game.disconnectionState?.disconnectedPlayerId).toBe('p2-id');
        expect(volatileState.userStatuses['p2-id']?.status).toBe(UserStatus.InGame);
        expect(volatileState.userStatuses['p2-id']?.gameId).toBe('game-1');
        expect(broadcastToGameParticipants).toHaveBeenCalled();
        expect(broadcast).toHaveBeenCalled();
    });
});
