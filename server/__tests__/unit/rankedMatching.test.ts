import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VolatileState } from '../../../shared/types/index.js';
import { GameMode } from '../../../shared/types/index.js';
import { createDefaultUser } from '../../initialData.js';

// Mock db and gameModes so tryMatchPlayers can run without real DB
vi.mock('../../db.js', () => ({
    getUser: vi.fn(),
    updateUser: vi.fn(),
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
    broadcastUserUpdate: vi.fn(),
    broadcastToGameParticipants: vi.fn(),
    broadcastLiveGameToList: vi.fn(),
}));

const u1 = createDefaultUser('user-1', 'user1', 'User1');
const u2 = createDefaultUser('user-2', 'user2', 'User2');
const u3 = createDefaultUser('user-3', 'user3', 'User3');
u1.stats = {
    [GameMode.Standard]: { wins: 0, losses: 0, rankingScore: 1200 },
    [GameMode.Capture]: { wins: 0, losses: 0, rankingScore: 1500 },
};
u2.stats = {
    [GameMode.Standard]: { wins: 0, losses: 0, rankingScore: 1250 },
    [GameMode.Capture]: { wins: 0, losses: 0, rankingScore: 1510 },
};
u3.stats = {
    [GameMode.Standard]: { wins: 0, losses: 0, rankingScore: 1701 },
};

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
            activeTournamentViewers: new Set<string>(),
            rankedMatchingQueue: { strategic: {} },
            rankedMatchProposals: {},
        };
        const db = await import('../../db.js');
        vi.mocked(db.getUser).mockImplementation((id: string) => {
            if (id === 'user-1') return Promise.resolve(u1);
            if (id === 'user-2') return Promise.resolve(u2);
            if (id === 'user-3') return Promise.resolve(u3);
            return Promise.resolve(null);
        });
        vi.mocked(db.updateUser).mockResolvedValue(undefined);
    });

    it('tryMatchPlayers removes two users from queue and opens a ranked match proposal', async () => {
        volatileState.rankedMatchingQueue!.strategic!['user-1'] = {
            userId: 'user-1',
            lobbyType: 'strategic',
            selectedModes: [GameMode.Standard],
            startTime: Date.now(),
            rating: 1200,
            modeRatings: { [GameMode.Standard]: 1200 },
        };
        volatileState.rankedMatchingQueue!.strategic!['user-2'] = {
            userId: 'user-2',
            lobbyType: 'strategic',
            selectedModes: [GameMode.Standard],
            startTime: Date.now(),
            rating: 1250,
            modeRatings: { [GameMode.Standard]: 1250 },
        };

        const { tryMatchPlayers } = await import('../../actions/socialActions.js');
        await tryMatchPlayers(volatileState, 'strategic');

        expect(volatileState.rankedMatchingQueue!.strategic!['user-1']).toBeUndefined();
        expect(volatileState.rankedMatchingQueue!.strategic!['user-2']).toBeUndefined();
        expect(Object.keys(volatileState.rankedMatchProposals ?? {})).toHaveLength(1);
        const proposal = Object.values(volatileState.rankedMatchProposals ?? {})[0];
        expect(proposal?.user1Id).toBe('user-1');
        expect(proposal?.user2Id).toBe('user-2');
        expect(proposal?.selectedMode).toBe(GameMode.Standard);
        expect(proposal?.acceptUser1).toBe(false);
        expect(proposal?.acceptUser2).toBe(false);
        expect(volatileState.userStatuses['user-1']?.status).toBeUndefined();
        expect(volatileState.userStatuses['user-2']?.status).toBeUndefined();

        const socket = await import('../../socket.js');
        expect(vi.mocked(socket.broadcast).mock.calls.some(([msg]) => msg.type === 'RANKED_MATCH_PROPOSAL')).toBe(true);
    });

    it('tryMatchPlayers does not match players over the 400 point rating limit', async () => {
        volatileState.rankedMatchingQueue!.strategic!['user-1'] = {
            userId: 'user-1',
            lobbyType: 'strategic',
            selectedModes: [GameMode.Standard],
            startTime: Date.now(),
            rating: 1200,
            modeRatings: { [GameMode.Standard]: 1200 },
        };
        volatileState.rankedMatchingQueue!.strategic!['user-3'] = {
            userId: 'user-3',
            lobbyType: 'strategic',
            selectedModes: [GameMode.Standard],
            startTime: Date.now(),
            rating: 1701,
            modeRatings: { [GameMode.Standard]: 1701 },
        };

        const { tryMatchPlayers } = await import('../../actions/socialActions.js');
        await tryMatchPlayers(volatileState, 'strategic');

        expect(Object.keys(volatileState.rankedMatchingQueue!.strategic!)).toHaveLength(2);
        expect(Object.keys(volatileState.rankedMatchProposals ?? {})).toHaveLength(0);
        expect(volatileState.userStatuses['user-1']?.status).toBeUndefined();
        expect(volatileState.userStatuses['user-3']?.status).toBeUndefined();
    });

    it('tryMatchPlayers picks the common mode with the closest actual mode rating', async () => {
        volatileState.rankedMatchingQueue!.strategic!['user-1'] = {
            userId: 'user-1',
            lobbyType: 'strategic',
            selectedModes: [GameMode.Standard, GameMode.Capture],
            startTime: Date.now(),
            rating: 1200,
            modeRatings: { [GameMode.Standard]: 1200, [GameMode.Capture]: 1500 },
        };
        volatileState.rankedMatchingQueue!.strategic!['user-2'] = {
            userId: 'user-2',
            lobbyType: 'strategic',
            selectedModes: [GameMode.Standard, GameMode.Capture],
            startTime: Date.now(),
            rating: 1250,
            modeRatings: { [GameMode.Standard]: 1250, [GameMode.Capture]: 1510 },
        };

        const { tryMatchPlayers } = await import('../../actions/socialActions.js');
        await tryMatchPlayers(volatileState, 'strategic');

        const proposal = Object.values(volatileState.rankedMatchProposals ?? {})[0];
        expect(proposal?.selectedMode).toBe(GameMode.Capture);
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
        expect(Object.keys(volatileState.rankedMatchProposals ?? {})).toHaveLength(0);
        expect(volatileState.userStatuses['user-1']?.status).toBeUndefined();
    });

    it('expireStaleRankedMatchProposals re-queues accepted user with preserved startTime and matchPriority', async () => {
        const originalStart = Date.now() - 120_000;
        volatileState.rankedMatchingQueue!.strategic!['user-1'] = {
            userId: 'user-1',
            lobbyType: 'strategic',
            selectedModes: [GameMode.Standard],
            startTime: originalStart,
            rating: 1200,
            modeRatings: { [GameMode.Standard]: 1200 },
        };
        volatileState.rankedMatchingQueue!.strategic!['user-2'] = {
            userId: 'user-2',
            lobbyType: 'strategic',
            selectedModes: [GameMode.Standard],
            startTime: Date.now() - 30_000,
            rating: 1250,
            modeRatings: { [GameMode.Standard]: 1250 },
        };

        const { tryMatchPlayers, expireStaleRankedMatchProposals } = await import('../../actions/socialActions.js');
        await tryMatchPlayers(volatileState, 'strategic');

        const proposalId = Object.keys(volatileState.rankedMatchProposals ?? {})[0];
        expect(proposalId).toBeTruthy();
        volatileState.rankedMatchProposals![proposalId].acceptUser1 = true;

        expireStaleRankedMatchProposals(volatileState, Date.now() + 60_000);

        expect(volatileState.rankedMatchProposals?.[proposalId]).toBeUndefined();
        expect(volatileState.rankedMatchingQueue!.strategic!['user-1']).toBeDefined();
        expect(volatileState.rankedMatchingQueue!.strategic!['user-1']!.startTime).toBe(originalStart);
        expect(volatileState.rankedMatchingQueue!.strategic!['user-1']!.matchPriority).toBe(1);
        expect(volatileState.rankedMatchingQueue!.strategic!['user-2']).toBeUndefined();
    });

    it('calculateEloChange applies the standard ranked min and max bounds', async () => {
        const { calculateEloChange } = await import('../../summaryService.js');

        expect(calculateEloChange(1200, 1200, 'win')).toBe(16);
        expect(calculateEloChange(1200, 1600, 'win')).toBe(29);
        expect(calculateEloChange(1600, 1200, 'win')).toBe(6);
        expect(calculateEloChange(1200, 1600, 'loss')).toBe(-6);
        expect(calculateEloChange(1600, 1200, 'loss')).toBe(-29);
    });
});
