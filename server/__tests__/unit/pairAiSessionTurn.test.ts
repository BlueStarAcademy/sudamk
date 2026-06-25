import { describe, expect, it, beforeEach } from 'vitest';
import { Player } from '../../../types/index.js';
import {
    clearAiSession,
    finishAiProcessing,
    shouldProcessAiTurn,
} from '../../aiSessionManager.js';
import { buildPairAiSchedulingKey, buildPairAiSchedulingKeyForChessGo, resolvePairUserPlayerEnum } from '../../../shared/utils/pairGameTurn.js';

const pairSettings: any = {
    pairGame: {
        roomId: 'pair-ai-room',
        pairMode: 'ai' as const,
        currentTurnIndex: 0,
        teamA: {
            name: 'A',
            members: [
                { id: 'u1', name: 'U1', kind: 'user' as const, slot: 'A1' },
                { id: 'pet-ai-u1', name: 'Pet', kind: 'pet' as const, slot: 'A2' },
            ],
        },
        teamB: {
            name: 'B',
            members: [
                { id: 'pair-opponent-ai', name: 'AI', kind: 'ai' as const, slot: 'B1' },
                { id: 'pair-opponent-pet', name: 'Pet2', kind: 'pet' as const, slot: 'B2' },
            ],
        },
        turnOrder: [
            {
                seatId: 'black1' as const,
                player: Player.Black,
                order: 1 as const,
                participantId: 'u1',
                name: 'U1',
                kind: 'user' as const,
                teamId: 'teamA' as const,
                slot: 'A1',
            },
            {
                seatId: 'white1' as const,
                player: Player.White,
                order: 1 as const,
                participantId: 'pair-opponent-ai',
                name: 'AI',
                kind: 'ai' as const,
                teamId: 'teamB' as const,
                slot: 'B1',
            },
            {
                seatId: 'black2' as const,
                player: Player.Black,
                order: 2 as const,
                participantId: 'pet-ai-u1',
                name: 'Pet',
                kind: 'pet' as const,
                teamId: 'teamA' as const,
                slot: 'A2',
            },
            {
                seatId: 'white2' as const,
                player: Player.White,
                order: 2 as const,
                participantId: 'pair-opponent-pet',
                name: 'Pet2',
                kind: 'pet' as const,
                teamId: 'teamB' as const,
                slot: 'B2',
            },
        ],
    },
};

describe('pair AI session turn scheduling', () => {
    const gameId = 'pair-ai-session-test';

    beforeEach(() => {
        clearAiSession(gameId);
    });

    it('allows the next pair AI seat at the same moveHistory length', () => {
        const keyWhite1ToMove = buildPairAiSchedulingKey(pairSettings, 1)!;
        const keyWhite1Done = buildPairAiSchedulingKey(pairSettings, 2, 1)!;
        const keyBlack2ToMove = buildPairAiSchedulingKey({ pairGame: { ...pairSettings.pairGame, currentTurnIndex: 2 } }, 2)!;
        const keyBlack2Done = buildPairAiSchedulingKey({ pairGame: { ...pairSettings.pairGame, currentTurnIndex: 3 } }, 3, 2)!;
        const keyWhite2ToMove = buildPairAiSchedulingKey({ pairGame: { ...pairSettings.pairGame, currentTurnIndex: 3 } }, 3)!;

        expect(shouldProcessAiTurn(gameId, 1, keyWhite1ToMove)).toBe(true);
        finishAiProcessing(gameId, 2, keyWhite1Done);

        expect(shouldProcessAiTurn(gameId, 2, keyWhite1Done)).toBe(false);
        expect(shouldProcessAiTurn(gameId, 2, keyBlack2ToMove)).toBe(true);
        finishAiProcessing(gameId, 3, keyBlack2Done);

        expect(shouldProcessAiTurn(gameId, 3, keyWhite2ToMove)).toBe(true);
        finishAiProcessing(gameId, 4, buildPairAiSchedulingKey({ pairGame: { ...pairSettings.pairGame, currentTurnIndex: 0 } }, 4, 3)!);

        expect(shouldProcessAiTurn(gameId, 4, buildPairAiSchedulingKey({ pairGame: { ...pairSettings.pairGame, currentTurnIndex: 0 } }, 4, 3)!)).toBe(false);
    });

    it('allows retry on same scheduling key after cancel (capture reveal path)', () => {
        const key = buildPairAiSchedulingKey(pairSettings, 2)!;
        expect(shouldProcessAiTurn(gameId, 2, key)).toBe(true);
        finishAiProcessing(gameId, 2, key);
        expect(shouldProcessAiTurn(gameId, 2, key)).toBe(false);
        clearAiSession(gameId);
        expect(shouldProcessAiTurn(gameId, 2, key)).toBe(true);
    });

    it('chess go: piece phase and stone phase share moveCount but use distinct keys', () => {
        const pieceKey = buildPairAiSchedulingKeyForChessGo(pairSettings, 3, { phase: 'piece' })!;
        const stoneKey = buildPairAiSchedulingKeyForChessGo(pairSettings, 3, { phase: 'stone' })!;
        expect(pieceKey).not.toBe(stoneKey);
        expect(shouldProcessAiTurn(gameId, 3, pieceKey)).toBe(true);
        finishAiProcessing(gameId, 3, pieceKey);
        expect(shouldProcessAiTurn(gameId, 3, pieceKey)).toBe(false);
        expect(shouldProcessAiTurn(gameId, 3, stoneKey)).toBe(true);
    });
});

describe('resolvePairUserPlayerEnum', () => {
    it('resolves black2 user seat when blackPlayerId is black1 only', () => {
        const settings = {
            pairGame: {
                ...pairSettings.pairGame,
                currentTurnIndex: 2,
                turnOrder: [
                    {
                        seatId: 'black1' as const,
                        player: Player.Black,
                        order: 1 as const,
                        participantId: 'pet-ai-u1',
                        name: 'Pet',
                        kind: 'pet' as const,
                        teamId: 'teamA' as const,
                        slot: 'A2',
                    },
                    {
                        seatId: 'white1' as const,
                        player: Player.White,
                        order: 1 as const,
                        participantId: 'pair-opponent-ai',
                        name: 'AI',
                        kind: 'ai' as const,
                        teamId: 'teamB' as const,
                        slot: 'B1',
                    },
                    {
                        seatId: 'black2' as const,
                        player: Player.Black,
                        order: 2 as const,
                        participantId: 'u1',
                        name: 'U1',
                        kind: 'user' as const,
                        teamId: 'teamA' as const,
                        slot: 'A1',
                    },
                    {
                        seatId: 'white2' as const,
                        player: Player.White,
                        order: 2 as const,
                        participantId: 'pair-opponent-pet',
                        name: 'Pet2',
                        kind: 'pet' as const,
                        teamId: 'teamB' as const,
                        slot: 'B2',
                    },
                ],
            },
        };

        expect(resolvePairUserPlayerEnum(settings as any, 'u1')).toBe(Player.Black);
    });
});
