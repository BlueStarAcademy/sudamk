import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VolatileState } from '../../../shared/types/index.js';
import { GameMode, UserStatus } from '../../../shared/types/index.js';
import { createDefaultUser } from '../../initialData.js';

vi.mock('../../db.js', () => ({
    getUser: vi.fn(),
    updateUser: vi.fn(),
    saveGame: vi.fn(),
}));
vi.mock('../../gameModes.js', () => ({
    initializeGame: vi.fn().mockResolvedValue({
        id: 'game-neg-test-1',
        mode: GameMode.Standard,
        player1: { id: 'challenger', nickname: 'Challenger' },
        player2: { id: 'opponent', nickname: 'Opponent' },
        blackPlayerId: 'challenger',
        whitePlayerId: 'opponent',
        gameStatus: 'playing',
    }),
}));
vi.mock('../../socket.js', () => ({
    broadcast: vi.fn(),
    broadcastUserUpdate: vi.fn(),
    broadcastToGameParticipants: vi.fn(),
    broadcastLiveGameToList: vi.fn(),
}));

describe('negotiation flow', () => {
    let volatileState: VolatileState;
    let challenger: ReturnType<typeof createDefaultUser>;
    let opponent: ReturnType<typeof createDefaultUser>;

    beforeEach(async () => {
        vi.clearAllMocks();
        challenger = createDefaultUser('challenger', 'challenger', 'Challenger');
        opponent = createDefaultUser('opponent', 'opponent', 'Opponent');
        challenger.actionPoints = { current: 10, max: 30 };
        opponent.actionPoints = { current: 10, max: 30 };
        volatileState = {
            userConnections: {},
            userStatuses: {
                challenger: { status: UserStatus.Waiting },
                opponent: { status: UserStatus.Waiting },
            },
            negotiations: {},
            waitingRoomChats: { global: [], strategic: [], playful: [] },
            gameChats: {},
            userLastChatMessage: {},
        };
        const db = await import('../../db.js');
        vi.mocked(db.getUser).mockImplementation((id: string) => {
            if (id === 'challenger') return Promise.resolve(challenger);
            if (id === 'opponent') return Promise.resolve(opponent);
            return Promise.resolve(null);
        });
        vi.mocked(db.updateUser).mockResolvedValue(undefined);
    });

    it('CHALLENGE_USER creates draft negotiation and SEND_CHALLENGE sets pending, ACCEPT_NEGOTIATION creates game', async () => {
        const { handleNegotiationAction } = await import('../../actions/negotiationActions.js');

        const r1 = await handleNegotiationAction(volatileState, {
            type: 'CHALLENGE_USER',
            payload: { opponentId: 'opponent', mode: GameMode.Standard },
            userId: 'challenger',
        }, challenger);
        expect(r1.error).toBeUndefined();
        expect(r1.clientResponse?.negotiationId).toBeDefined();
        const negId = r1.clientResponse!.negotiationId;
        expect(Object.keys(volatileState.negotiations)).toContain(negId);
        expect(volatileState.negotiations[negId].status).toBe('draft');

        const r2 = await handleNegotiationAction(volatileState, {
            type: 'SEND_CHALLENGE',
            payload: { negotiationId: negId, settings: {} },
            userId: 'challenger',
        }, challenger);
        expect(r2.error).toBeUndefined();
        expect(volatileState.negotiations[negId].status).toBe('pending');

        const r3 = await handleNegotiationAction(volatileState, {
            type: 'ACCEPT_NEGOTIATION',
            payload: { negotiationId: negId },
            userId: 'opponent',
        }, opponent);
        expect(r3.error).toBeUndefined();
        expect(r3.clientResponse?.gameId).toBe('game-neg-test-1');
        expect(volatileState.negotiations[negId]).toBeUndefined();
        expect(volatileState.userStatuses['challenger']?.status).toBe(UserStatus.InGame);
        expect(volatileState.userStatuses['opponent']?.status).toBe(UserStatus.InGame);
    });
});
