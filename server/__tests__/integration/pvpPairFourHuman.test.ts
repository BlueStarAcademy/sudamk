/**
 * 페어 4인 PVP — 유저 좌석 착수 순환 통합 테스트
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LiveGameSession, User, VolatileState } from '../../../shared/types/index.js';
import { GameMode, Player, GameCategory } from '../../../shared/types/index.js';
import { createDefaultUser } from '../../initialData.js';
import { configurePairClassicGameStart } from '../../actions/socialActions.js';
import { getCurrentPairTurnSeat } from '../../../shared/utils/pairGameTurn.js';

vi.mock('../../db.js', () => ({
    saveGame: vi.fn().mockResolvedValue(undefined),
    getLiveGame: vi.fn(),
    getUser: vi.fn().mockResolvedValue(null),
    updateUser: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../summaryService.js', () => ({
    endGame: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../socket.js', () => ({
    broadcastToGameParticipants: vi.fn(),
}));
vi.mock('../../kataServerService.js', () => ({
    isKataServerAvailable: vi.fn(() => false),
    generateKataServerMoveCandidateDetails: vi.fn(async () => null),
}));

function emptyBoard(size: number): number[][] {
    return Array(size).fill(0).map(() => Array(size).fill(Player.None));
}

function makePairFourHumanSession(): {
    game: LiveGameSession;
    ownerA: User;
    partnerA: User;
    ownerB: User;
    partnerB: User;
} {
    const ownerA = createDefaultUser('owner-a', 'owner-a', 'OwnerA');
    const partnerA = createDefaultUser('partner-a', 'partner-a', 'PartnerA');
    const ownerB = createDefaultUser('owner-b', 'owner-b', 'OwnerB');
    const partnerB = createDefaultUser('partner-b', 'partner-b', 'PartnerB');
    const now = Date.now();
    const boardSize = 9;
    const game: LiveGameSession = {
        id: 'game-pair-4human-1',
        mode: GameMode.Standard,
        isAiGame: false,
        isRankedGame: false,
        player1: ownerA,
        player2: ownerB,
        blackPlayerId: ownerA.id,
        whitePlayerId: ownerB.id,
        gameStatus: 'pending',
        currentPlayer: Player.None,
        boardState: emptyBoard(boardSize) as LiveGameSession['boardState'],
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        winner: null,
        winReason: null,
        createdAt: now,
        lastMove: null,
        passCount: 0,
        round: 0,
        turnInRound: 0,
        koInfo: null,
        blackTimeLeft: 300,
        whiteTimeLeft: 300,
        blackByoyomiPeriodsLeft: 3,
        whiteByoyomiPeriodsLeft: 3,
        turnDeadline: now + 300 * 1000,
        turnStartTime: now,
        disconnectionCounts: {},
        currentActionButtons: {},
        scores: {},
        gameCategory: GameCategory.Normal,
        settings: {
            boardSize: 9,
            komi: 6.5,
            timeLimit: 5,
            byoyomiCount: 3,
            byoyomiTime: 30,
            pairGame: {
                roomId: 'room-pair-4p',
                pairMode: 'pvp',
                pairLobbyOwnerId: ownerA.id,
                teamA: {
                    name: 'A팀',
                    members: [
                        { id: ownerA.id, name: 'OwnerA', kind: 'user', slot: 'owner' },
                        { id: partnerA.id, name: 'PartnerA', kind: 'user', slot: 'partner' },
                    ],
                },
                teamB: {
                    name: 'B팀',
                    members: [
                        { id: ownerB.id, name: 'OwnerB', kind: 'user', slot: 'owner' },
                        { id: partnerB.id, name: 'PartnerB', kind: 'user', slot: 'partner' },
                    ],
                },
            },
        },
    } as LiveGameSession;

    configurePairClassicGameStart(game, ownerA, [ownerA, partnerA, ownerB, partnerB]);
    return { game, ownerA, partnerA, ownerB, partnerB };
}

describe('PVP pair four-human turn rotation', () => {
    let volatileState: VolatileState;

    beforeEach(() => {
        vi.clearAllMocks();
        volatileState = {
            userConnections: {},
            userStatuses: {},
            negotiations: {},
            waitingRoomChats: { global: [], strategic: [], playful: [] },
            gameChats: {},
            userLastChatMessage: {},
            activeTournamentViewers: new Set<string>(),
        };
    });

    it('PLACE_STONE rotates through all four human seats after pair order reveal', async () => {
        const { game, ownerA, partnerA, ownerB, partnerB } = makePairFourHumanSession();
        expect(game.gameStatus).toBe('pair_order_reveal');
        expect(game.settings.pairGame?.turnOrder).toHaveLength(4);

        const { handleStrategicGameAction } = await import('../../modes/standard.js');
        const humans = [ownerA, partnerA, ownerB, partnerB];

        for (const user of humans) {
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'CONFIRM_COLOR_START',
                payload: {},
                userId: user.id,
            } as any, user);
            expect(res?.error).toBeUndefined();
        }
        expect(game.gameStatus).toBe('playing');

        const turnOrder = game.settings.pairGame!.turnOrder!;
        const usersBySeat = new Map(
            turnOrder.map((seat) => {
                const user = humans.find((u) => u.id === seat.participantId);
                if (!user) throw new Error(`missing user for seat ${seat.seatId}`);
                return [seat.participantId, user] as const;
            }),
        );

        for (let i = 0; i < 4; i++) {
            const seat = getCurrentPairTurnSeat(game.settings);
            expect(seat).toBeTruthy();
            const user = usersBySeat.get(seat!.participantId)!;
            const x = i;
            const y = i;
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'PLACE_STONE',
                payload: { x, y },
                userId: user.id,
            } as any, user);
            expect(res?.error).toBeUndefined();
            expect(game.moveHistory).toHaveLength(i + 1);
            expect(game.boardState[x][y]).toBe(seat!.player);
        }

        const nextSeat = getCurrentPairTurnSeat(game.settings);
        expect(nextSeat?.participantId).toBe(turnOrder[0]!.participantId);
        expect(game.moveHistory).toHaveLength(4);
    });

    it('four human PASS_TURN in sequence advances passSeatIds without early scoring', async () => {
        const { game, ownerA, partnerA, ownerB, partnerB } = makePairFourHumanSession();
        const { handleStrategicGameAction } = await import('../../modes/standard.js');
        const humans = [ownerA, partnerA, ownerB, partnerB];

        for (const user of humans) {
            await handleStrategicGameAction(volatileState, game, {
                type: 'CONFIRM_COLOR_START',
                payload: {},
                userId: user.id,
            } as any, user);
        }

        const turnOrder = game.settings.pairGame!.turnOrder!;
        const usersBySeat = new Map(
            turnOrder.map((seat) => [seat.participantId, humans.find((u) => u.id === seat.participantId)!]),
        );

        for (let i = 0; i < 4; i++) {
            const seat = getCurrentPairTurnSeat(game.settings);
            const user = usersBySeat.get(seat!.participantId)!;
            const res = await handleStrategicGameAction(volatileState, game, {
                type: 'PASS_TURN',
                payload: {},
                userId: user.id,
            } as any, user);
            expect(res?.error).toBeUndefined();
            if (i < 3) {
                expect(game.gameStatus).toBe('playing');
            }
        }
        expect(game.settings.pairGame?.passSeatIds).toHaveLength(4);
    });
});
