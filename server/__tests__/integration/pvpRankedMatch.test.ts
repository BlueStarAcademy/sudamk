/**
 * 랭킹전 PVP 매칭 통합 테스트 — 큐 → 제안 → 양측 수락 → 게임 생성
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { User, VolatileState } from '../../../shared/types/index.js';
import { GameMode } from '../../../shared/types/index.js';
import { createDefaultUser } from '../../initialData.js';

vi.mock('../../db.js', () => ({
    getUser: vi.fn(),
    updateUser: vi.fn(),
    saveGame: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../gameModes.js', () => ({
    initializeGame: vi.fn().mockResolvedValue({
        id: 'game-ranked-pvp-1',
        mode: GameMode.Standard,
        isRankedGame: true,
        player1: { id: 'user-1', nickname: 'P1' },
        player2: { id: 'user-2', nickname: 'P2' },
        blackPlayerId: 'user-1',
        whitePlayerId: 'user-2',
        gameStatus: 'playing',
        settings: { boardSize: 19, scoringTurnLimit: 120 },
    }),
}));
vi.mock('../../socket.js', () => ({
    broadcast: vi.fn(),
    broadcastUserUpdate: vi.fn(),
    broadcastToGameParticipants: vi.fn(),
    broadcastLiveGameToList: vi.fn(),
}));
vi.mock('../../arenaEntranceService.js', () => ({
    requireArenaEntranceOpen: vi.fn(async () => ({ ok: true })),
}));
vi.mock('../../summaryService.js', () => ({
    calculateEloChange: vi.fn(() => 16),
    endGame: vi.fn().mockResolvedValue(undefined),
}));

describe('PVP ranked match integration', () => {
    let volatileState: VolatileState;
    let u1: User;
    let u2: User;

    beforeEach(async () => {
        vi.clearAllMocks();
        u1 = createDefaultUser('user-1', 'user1', 'User1');
        u2 = createDefaultUser('user-2', 'user2', 'User2');
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
            return Promise.resolve(null);
        });
        vi.mocked(db.updateUser).mockResolvedValue(undefined);
    });

    it('START_RANKED_MATCHING + RESPOND_RANKED_MATCH (both accept) creates ranked game', async () => {
        const { handleSocialAction } = await import('../../actions/socialActions.js');

        const start1 = await handleSocialAction(
            volatileState,
            {
                type: 'START_RANKED_MATCHING',
                payload: { lobbyType: 'strategic', selectedModes: [GameMode.Standard] },
                userId: u1.id,
            } as any,
            u1,
        );
        expect(start1?.error).toBeUndefined();

        const start2 = await handleSocialAction(
            volatileState,
            {
                type: 'START_RANKED_MATCHING',
                payload: { lobbyType: 'strategic', selectedModes: [GameMode.Standard] },
                userId: u2.id,
            } as any,
            u2,
        );
        expect(start2?.error).toBeUndefined();
        expect(start2?.clientResponse?.rankedProposalId).toBeTruthy();

        const proposalId = start2.clientResponse!.rankedProposalId as string;

        const accept1 = await handleSocialAction(
            volatileState,
            {
                type: 'RESPOND_RANKED_MATCH',
                payload: { proposalId, accept: true },
                userId: u1.id,
            } as any,
            u1,
        );
        expect(accept1?.error).toBeUndefined();
        expect(accept1?.clientResponse?.gameId).toBeUndefined();

        const accept2 = await handleSocialAction(
            volatileState,
            {
                type: 'RESPOND_RANKED_MATCH',
                payload: { proposalId, accept: true },
                userId: u2.id,
            } as any,
            u2,
        );
        expect(accept2?.error).toBeUndefined();
        expect(accept2?.clientResponse?.gameId).toBe('game-ranked-pvp-1');
        expect(volatileState.rankedMatchProposals?.[proposalId!]).toBeUndefined();
    });
});
