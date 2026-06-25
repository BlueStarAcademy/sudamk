import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import {
    isPairChessSetupWaitingGuest,
    resolvePairChessSetupDraftKey,
    resolvePairChessSetupPlayerColor,
    resolvePairChessSideDraftKeys,
    shouldMaskChessPlacementOpponentHalf,
} from '../../../shared/utils/pairChessSetup.js';
import { PAIR_GO_REWARD_GAME_MODES } from '../../../shared/utils/pairGameTurn.js';
import { aiUserId } from '../../aiPlayer.js';

describe('PAIR_GO_REWARD_GAME_MODES', () => {
    it('includes pair chess and castle for board-size reward settlement', () => {
        expect(PAIR_GO_REWARD_GAME_MODES).toContain(GameMode.Chess);
        expect(PAIR_GO_REWARD_GAME_MODES).toContain(GameMode.Castle);
    });

    it('excludes uniform (pair play only, no reward band)', () => {
        expect(PAIR_GO_REWARD_GAME_MODES).not.toContain(GameMode.Uniform);
    });
});

function makePairChessSession(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    return {
        id: 'game-pair-chess',
        mode: GameMode.Chess,
        isAiGame: false,
        gameStatus: 'chess_piece_placement',
        player1: { id: 'owner-a', username: 'a', nickname: 'A' },
        player2: { id: 'owner-b', username: 'b', nickname: 'B' },
        blackPlayerId: 'owner-a',
        whitePlayerId: 'owner-b',
        settings: {
            boardSize: 13,
            komi: 6.5,
            pairGame: {
                roomId: 'room-1',
                pairMode: 'pvp',
                pairLobbyOwnerId: 'owner-a',
                teamA: {
                    name: 'A팀',
                    members: [
                        { id: 'owner-a', name: 'A', kind: 'user', slot: 'owner' },
                        { id: 'partner-a', name: 'A2', kind: 'user', slot: 'partner' },
                    ],
                },
                teamB: {
                    name: 'B팀',
                    members: [
                        { id: 'owner-b', name: 'B', kind: 'user', slot: 'owner' },
                        { id: 'partner-b', name: 'B2', kind: 'user', slot: 'partner' },
                    ],
                },
                turnOrder: [
                    {
                        seatId: 'black1',
                        player: Player.Black,
                        order: 1,
                        participantId: 'owner-a',
                        name: 'A',
                        kind: 'user',
                        teamId: 'teamA',
                        slot: 'owner',
                    },
                    {
                        seatId: 'white1',
                        player: Player.White,
                        order: 1,
                        participantId: 'owner-b',
                        name: 'B',
                        kind: 'user',
                        teamId: 'teamB',
                        slot: 'owner',
                    },
                    {
                        seatId: 'black2',
                        player: Player.Black,
                        order: 2,
                        participantId: 'partner-a',
                        name: 'A2',
                        kind: 'user',
                        teamId: 'teamA',
                        slot: 'partner',
                    },
                    {
                        seatId: 'white2',
                        player: Player.White,
                        order: 2,
                        participantId: 'partner-b',
                        name: 'B2',
                        kind: 'user',
                        teamId: 'teamB',
                        slot: 'partner',
                    },
                ],
            },
        },
        boardState: [],
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        currentPlayer: Player.None,
        ...overrides,
    } as LiveGameSession;
}

describe('pairChessSetup', () => {
    it('team owners get team draft keys; partners wait', () => {
        const session = makePairChessSession();
        expect(resolvePairChessSetupDraftKey(session, 'owner-a')).toBe('owner-a');
        expect(resolvePairChessSetupDraftKey(session, 'owner-b')).toBe('owner-b');
        expect(resolvePairChessSetupDraftKey(session, 'partner-a')).toBeNull();
        expect(resolvePairChessSetupDraftKey(session, 'partner-b')).toBeNull();
        expect(isPairChessSetupWaitingGuest(session, 'partner-a')).toBe(true);
        expect(resolvePairChessSetupPlayerColor(session, 'owner-a')).toBe(Player.Black);
        expect(resolvePairChessSetupPlayerColor(session, 'owner-b')).toBe(Player.White);
    });

    it('pair AI coop: only lobby owner places human team pieces', () => {
        const session = makePairChessSession({
            isAiGame: true,
            player2: { id: aiUserId, username: 'ai', nickname: 'AI' },
            settings: {
                boardSize: 13,
                komi: 6.5,
                pairGame: {
                    roomId: 'room-ai',
                    pairMode: 'ai',
                    pairLobbyOwnerId: 'owner-a',
                    teamA: {
                        name: '우리',
                        members: [
                            { id: 'owner-a', name: 'A', kind: 'user', slot: 'owner' },
                            { id: 'partner-a', name: 'A2', kind: 'user', slot: 'partner' },
                        ],
                    },
                    teamB: {
                        name: 'AI',
                        members: [
                            { id: 'pair-opponent-ai', name: 'AI', kind: 'ai', slot: 'opponentAi' },
                            { id: 'pair-opponent-pet', name: 'Pet', kind: 'pet', slot: 'opponentPet' },
                        ],
                    },
                    turnOrder: [
                        {
                            seatId: 'black1',
                            player: Player.Black,
                            order: 1,
                            participantId: 'owner-a',
                            name: 'A',
                            kind: 'user',
                            teamId: 'teamA',
                            slot: 'owner',
                        },
                        {
                            seatId: 'white1',
                            player: Player.White,
                            order: 1,
                            participantId: 'pair-opponent-ai',
                            name: 'AI',
                            kind: 'ai',
                            teamId: 'teamB',
                            slot: 'opponentAi',
                        },
                        {
                            seatId: 'black2',
                            player: Player.Black,
                            order: 2,
                            participantId: 'partner-a',
                            name: 'A2',
                            kind: 'user',
                            teamId: 'teamA',
                            slot: 'partner',
                        },
                        {
                            seatId: 'white2',
                            player: Player.White,
                            order: 2,
                            participantId: 'pair-opponent-pet',
                            name: 'Pet',
                            kind: 'pet',
                            teamId: 'teamB',
                            slot: 'opponentPet',
                        },
                    ],
                },
            },
        });
        expect(resolvePairChessSetupDraftKey(session, 'owner-a')).toBe('owner-a');
        expect(resolvePairChessSetupDraftKey(session, 'partner-a')).toBeNull();
        expect(isPairChessSetupWaitingGuest(session, 'partner-a')).toBe(true);
        expect(shouldMaskChessPlacementOpponentHalf(session)).toBe(false);
    });

    it('pair PVP: mask opponent half while both team owners place', () => {
        const session = makePairChessSession();
        expect(shouldMaskChessPlacementOpponentHalf(session)).toBe(true);
    });

    it('1v1 AI chess: no opponent-half mask (AI auto-places)', () => {
        const session = makePairChessSession({
            isAiGame: true,
            player2: { id: aiUserId, username: 'ai', nickname: 'AI' },
            settings: {
                boardSize: 13,
                komi: 6.5,
            },
        });
        expect(shouldMaskChessPlacementOpponentHalf(session)).toBe(false);
    });

    it('black1 pet + black2 user: human team draft key is user id, not pet seat id', () => {
        const session = makePairChessSession({
            blackPlayerId: 'pet-ai-owner-a',
            whitePlayerId: 'owner-b',
            settings: {
                boardSize: 13,
                komi: 6.5,
                pairGame: {
                    roomId: 'room-pet-black1',
                    pairMode: 'pvp',
                    pairLobbyOwnerId: 'owner-a',
                    teamA: {
                        name: 'A팀',
                        members: [
                            { id: 'owner-a', name: 'A', kind: 'user', slot: 'owner' },
                            { id: 'pet-ai-owner-a', name: '펫', kind: 'pet', slot: 'ownerPet' },
                        ],
                    },
                    teamB: {
                        name: 'B팀',
                        members: [
                            { id: 'owner-b', name: 'B', kind: 'user', slot: 'owner' },
                            { id: 'partner-b', name: 'B2', kind: 'user', slot: 'partner' },
                        ],
                    },
                    turnOrder: [
                        {
                            seatId: 'black1',
                            player: Player.Black,
                            order: 1,
                            participantId: 'pet-ai-owner-a',
                            name: '펫',
                            kind: 'pet',
                            teamId: 'teamA',
                            slot: 'ownerPet',
                        },
                        {
                            seatId: 'white1',
                            player: Player.White,
                            order: 1,
                            participantId: 'owner-b',
                            name: 'B',
                            kind: 'user',
                            teamId: 'teamB',
                            slot: 'owner',
                        },
                        {
                            seatId: 'black2',
                            player: Player.Black,
                            order: 2,
                            participantId: 'owner-a',
                            name: 'A',
                            kind: 'user',
                            teamId: 'teamA',
                            slot: 'owner',
                        },
                        {
                            seatId: 'white2',
                            player: Player.White,
                            order: 2,
                            participantId: 'partner-b',
                            name: 'B2',
                            kind: 'user',
                            teamId: 'teamB',
                            slot: 'partner',
                        },
                    ],
                },
            },
        });
        const sides = resolvePairChessSideDraftKeys(session);
        expect(sides?.blackKey).toBe('owner-a');
        expect(sides?.whiteKey).toBe('owner-b');
        expect(resolvePairChessSetupDraftKey(session, 'owner-a')).toBe('owner-a');
        expect(resolvePairChessSetupPlayerColor(session, 'owner-a')).toBe(Player.Black);
    });
});
