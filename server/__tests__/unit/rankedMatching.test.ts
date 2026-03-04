import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VolatileState } from '../../../shared/types/index.js';
import { GameMode } from '../../../shared/types/index.js';
import { createDefaultUser } from '../../initialData.js';

// Mock db and gameModes so tryMatchPlayers can run without real DB
vi.mock('../../db.js', () => ({
    getUser: vi.fn(),
    saveGame: vi.fn(),
}));
vi.mock('../../gameModes.js', () => ({
    initializeGame: vi.fn().mockResolvedValue({
        id: 'game-ranked-test-1',
        mode: GameMode.Standard,
        player1: { id: 'user-1', nickname: 'P1' },
        player2: { id: 'user-2', nickname: 'P2' },
        blackPlayerId: 'user-1',
        whitePlayerId: 'user-2',
        gameStatus: 'playing',
    }),
}));
vi.mock('../../socket.js', () => ({
    broadcast: vi.fn(),
    broadcastToGameParticipants: vi.fn(),
    broadcastLiveGameToList: vi.fn(),
}));

const u1 = createDefaultUser('user-1', 'user1', 'User1');
const u2 = createDefaultUser('user-2', 'user2', 'User2');
u1.stats = { [GameMode.Standard]: { wins: 0, losses: 0, rankingScore: 1200 } };
u2.stats = { [GameMode.Standard]: { wins: 0, losses: 0, rankingScore: 1250 } };

describe('ranked matching', () => {
    let volatileState: VolatileState;

    beforeEach(async () => {
        vi.clearAllMocks();
        volatileState = {
            userConnections: {},
            userStatuses: {},
            negotiations: {},
            waitingRoomChats: { global: [], strategic: [], playful: [] },
            gameChats: {},
            userLastChatMessage: {},
            rankedMatchingQueue: { strategic: {}, playful: {} },
        };
        const db = await import('../../db.js');
        vi.mocked(db.getUser).mockImplementation((id: string) => {
            if (id === 'user-1') return Promise.resolve(u1);
            if (id === 'user-2') return Promise.resolve(u2);
            return Promise.resolve(null);
        });
    });

    it('tryMatchPlayers removes two users from queue and sets in-game status when common mode and rating within 500', async () => {
        volatileState.rankedMatchingQueue!.strategic!['user-1'] = {
            userId: 'user-1',
            lobbyType: 'strategic',
            selectedModes: [GameMode.Standard],
            startTime: Date.now(),
            rating: 1200,
        };
        volatileState.rankedMatchingQueue!.strategic!['user-2'] = {
            userId: 'user-2',
            lobbyType: 'strategic',
            selectedModes: [GameMode.Standard],
            startTime: Date.now(),
            rating: 1250,
        };

        const { tryMatchPlayers } = await import('../../actions/socialActions.js');
        await tryMatchPlayers(volatileState, 'strategic');

        expect(volatileState.rankedMatchingQueue!.strategic!['user-1']).toBeUndefined();
        expect(volatileState.rankedMatchingQueue!.strategic!['user-2']).toBeUndefined();
        expect(volatileState.userStatuses['user-1']?.status).toBe('in-game');
        expect(volatileState.userStatuses['user-1']?.gameId).toBe('game-ranked-test-1');
        expect(volatileState.userStatuses['user-2']?.status).toBe('in-game');
        expect(volatileState.userStatuses['user-2']?.gameId).toBe('game-ranked-test-1');
    });

    it('tryMatchPlayers does nothing when only one user in queue', async () => {
        volatileState.rankedMatchingQueue!.strategic!['user-1'] = {
            userId: 'user-1',
            lobbyType: 'strategic',
            selectedModes: [GameMode.Standard],
            startTime: Date.now(),
            rating: 1200,
        };

        const { tryMatchPlayers } = await import('../../actions/socialActions.js');
        await tryMatchPlayers(volatileState, 'strategic');

        expect(Object.keys(volatileState.rankedMatchingQueue!.strategic!)).toHaveLength(1);
        expect(volatileState.userStatuses['user-1']?.status).toBeUndefined();
    });
});
