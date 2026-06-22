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
            activeTournamentViewers: new Set<string>(),
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
            payload: { negotiationId: negId, settings: {} },
            userId: 'opponent',
        }, opponent);
        expect(r3.error).toBeUndefined();
        expect(r3.clientResponse?.gameId).toBe('game-neg-test-1');
        expect(volatileState.negotiations[negId]).toBeUndefined();
        expect(volatileState.userStatuses['challenger']?.status).toBe(UserStatus.InGame);
        expect(volatileState.userStatuses['opponent']?.status).toBe(UserStatus.InGame);
        // 행동력은 인게임 진입 시 차감 — 수락 직후에는 변하지 않음
        expect(challenger.actionPoints.current).toBe(10);
        expect(opponent.actionPoints.current).toBe(10);
    });

    it('second CHALLENGE_USER same pair returns superseded when challenger already has draft', async () => {
        const { handleNegotiationAction } = await import('../../actions/negotiationActions.js');

        const r1 = await handleNegotiationAction(
            volatileState,
            { type: 'CHALLENGE_USER', payload: { opponentId: 'opponent', mode: GameMode.Standard }, userId: 'challenger' },
            challenger
        );
        const negId = r1.clientResponse!.negotiationId!;

        const r2 = await handleNegotiationAction(
            volatileState,
            { type: 'CHALLENGE_USER', payload: { opponentId: 'challenger', mode: GameMode.Standard }, userId: 'opponent' },
            opponent
        );
        expect(r2.clientResponse?.challengeComposerSuperseded).toBe(true);
        expect(Object.keys(volatileState.negotiations)).toEqual([negId]);

        const r3 = await handleNegotiationAction(
            volatileState,
            { type: 'CHALLENGE_USER', payload: { opponentId: 'opponent', mode: GameMode.Standard }, userId: 'challenger' },
            challenger
        );
        expect(r3.clientResponse?.negotiationId).toBe(negId);
    });

    it('SEND_CHALLENGE on rematch draft preserves pairGame from REQUEST_REMATCH settings', async () => {
        const { handleNegotiationAction } = await import('../../actions/negotiationActions.js');

        const negId = 'neg-rematch-pair';
        const pairGameMeta = {
            lobbyChannel: 'pair' as const,
            roomId: 'pair-room-1',
            turnOrder: [{ seatId: 's1', participantId: 'challenger', player: 1, kind: 'human' as const, slot: 0 }],
        };
        volatileState.userStatuses = {
            challenger: { status: UserStatus.Negotiating, mode: GameMode.Standard },
            opponent: { status: UserStatus.Negotiating, mode: GameMode.Standard },
        };
        volatileState.negotiations[negId] = {
            id: negId,
            challenger,
            opponent,
            mode: GameMode.Standard,
            settings: {
                boardSize: 19,
                pairGame: pairGameMeta,
            } as any,
            proposerId: challenger.id,
            status: 'draft',
            turnCount: 0,
            deadline: Date.now() + 60_000,
            rematchOfGameId: 'game-original-1',
        };

        const r = await handleNegotiationAction(
            volatileState,
            {
                type: 'SEND_CHALLENGE',
                payload: { negotiationId: negId, settings: { boardSize: 13 } },
                userId: 'challenger',
            },
            challenger
        );
        expect(r.error).toBeUndefined();
        expect(volatileState.negotiations[negId].settings.boardSize).toBe(13);
        expect((volatileState.negotiations[negId].settings as any).pairGame).toEqual(pairGameMeta);
    });
});
