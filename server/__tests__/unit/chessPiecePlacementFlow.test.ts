import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import {
    enterChessPiecePlacement,
    getChessDraftKey,
    resolveChessPlacementAndTransition,
} from '../../../server/modes/chessPlacementFlow.js';
import { aiUserId } from '../../../server/aiPlayer.js';

function makeUser(id: string) {
    return { id, username: id, nickname: id } as LiveGameSession['player1'];
}

function makeChessSession(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    const human = makeUser('human-1');
    const ai = makeUser(aiUserId);
    return {
        id: 'game-1',
        mode: GameMode.Chess,
        isAiGame: true,
        gameStatus: 'chess_piece_placement',
        player1: human,
        player2: ai,
        blackPlayerId: human.id,
        whitePlayerId: ai.id,
        settings: { boardSize: 13, chessPieceTotalScore: 15, komi: 6.5 },
        boardState: [],
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        currentPlayer: Player.None,
        ...overrides,
    } as LiveGameSession;
}

describe('chessPlacementFlow', () => {
    it('PVE: human confirm starts playing immediately', () => {
        const game = makeChessSession();
        const now = Date.now();
        enterChessPiecePlacement(game, now);
        expect(game.gameStatus).toBe('chess_piece_placement');
        expect(game.chessPiecePlacementReady?.[aiUserId]).toBe(true);

        game.chessPiecePlacementReady!['human-1'] = true;
        const started = resolveChessPlacementAndTransition(game, now);
        expect(started).toBe(true);
        expect(game.gameStatus).toBe('playing');
        expect(game.chessPieces?.some((p) => p.type === 'king')).toBe(true);
        expect(game.chessPieces?.some((p) => p.owner === Player.White && p.type !== 'king')).toBe(true);
    });

    it('PVE: AI fills setup pieces within budget when draft is empty', () => {
        const game = makeChessSession({ settings: { boardSize: 13, chessPieceTotalScore: 20, komi: 6.5 } });
        const now = Date.now();
        enterChessPiecePlacement(game, now);
        game.chessPiecePlacementDraft![aiUserId] = [];
        game.chessPiecePlacementReady!['human-1'] = true;

        const started = resolveChessPlacementAndTransition(game, now);
        expect(started).toBe(true);
        const aiPieces = game.chessPieces?.filter((p) => p.owner === Player.White && p.type !== 'king') ?? [];
        expect(aiPieces.length).toBeGreaterThan(0);
        const aiScore = aiPieces.reduce((sum, p) => {
            if (p.type === 'pawn') return sum + 1;
            if (p.type === 'knight' || p.type === 'bishop') return sum + 3;
            if (p.type === 'rook') return sum + 5;
            if (p.type === 'queen') return sum + 9;
            return sum;
        }, 0);
        expect(aiScore).toBeGreaterThanOrEqual(14);
    });

    it('PVE: AI auto-fills draft on placement entry', () => {
        const game = makeChessSession({ settings: { boardSize: 13, chessPieceTotalScore: 15, komi: 6.5 } });
        enterChessPiecePlacement(game, Date.now());
        const aiDraft = game.chessPiecePlacementDraft?.[aiUserId] ?? [];
        expect(aiDraft.length).toBeGreaterThan(0);
        expect(game.chessPieces?.some((p) => p.owner === Player.White && p.type !== 'king')).toBe(true);
    });

    it('PVP: both confirm starts before deadline', () => {
        const p1 = makeUser('p1');
        const p2 = makeUser('p2');
        const game = makeChessSession({
            isAiGame: false,
            player1: p1,
            player2: p2,
            blackPlayerId: p1.id,
            whitePlayerId: p2.id,
        });
        const now = Date.now();
        enterChessPiecePlacement(game, now);

        game.chessPiecePlacementReady![p1.id] = true;
        expect(resolveChessPlacementAndTransition(game, now)).toBe(false);

        game.chessPiecePlacementReady![p2.id] = true;
        expect(resolveChessPlacementAndTransition(game, now)).toBe(true);
        expect(game.gameStatus).toBe('playing');
    });

    it('PVP: deadline auto-fills remaining budget for not-ready side', () => {
        const p1 = makeUser('p1');
        const p2 = makeUser('p2');
        const game = makeChessSession({
            isAiGame: false,
            player1: p1,
            player2: p2,
            blackPlayerId: p1.id,
            whitePlayerId: p2.id,
        });
        const now = 1_000_000;
        enterChessPiecePlacement(game, now);
        game.chessPiecePlacementReady![p1.id] = true;
        game.chessPiecePlacementDraft![p1.id] = [{ type: 'pawn', x: 3, y: 2 }];
        game.chessPiecePlacementDeadline = now - 1;

        const started = resolveChessPlacementAndTransition(game, now);
        expect(started).toBe(true);
        expect(game.gameStatus).toBe('playing');
        expect(game.chessPieces?.some((p) => p.owner === Player.White && p.type !== 'king')).toBe(true);
    });

    it('pair PVP: only team owners use black/white draft keys; partners rejected', () => {
        const ownerA = makeUser('owner-a');
        const ownerB = makeUser('owner-b');
        const partnerA = makeUser('partner-a');
        const game = makeChessSession({
            isAiGame: false,
            player1: ownerA,
            player2: ownerB,
            blackPlayerId: ownerA.id,
            whitePlayerId: ownerB.id,
            settings: {
                boardSize: 13,
                chessPieceTotalScore: 15,
                komi: 6.5,
                pairGame: {
                    roomId: 'room',
                    pairMode: 'pvp',
                    teamA: {
                        name: 'A',
                        members: [
                            { id: ownerA.id, name: 'A', kind: 'user', slot: 'owner' },
                            { id: partnerA.id, name: 'A2', kind: 'user', slot: 'partner' },
                        ],
                    },
                    teamB: {
                        name: 'B',
                        members: [{ id: ownerB.id, name: 'B', kind: 'user', slot: 'owner' }],
                    },
                    turnOrder: [
                        {
                            seatId: 'black1',
                            player: Player.Black,
                            order: 1,
                            participantId: ownerA.id,
                            name: 'A',
                            kind: 'user',
                            teamId: 'teamA',
                            slot: 'owner',
                        },
                        {
                            seatId: 'white1',
                            player: Player.White,
                            order: 1,
                            participantId: ownerB.id,
                            name: 'B',
                            kind: 'user',
                            teamId: 'teamB',
                            slot: 'owner',
                        },
                    ],
                },
            },
        });
        enterChessPiecePlacement(game, Date.now());
        expect(getChessDraftKey(game, ownerA.id)).toBe(ownerA.id);
        expect(getChessDraftKey(game, ownerB.id)).toBe(ownerB.id);
        expect(getChessDraftKey(game, partnerA.id)).toBeNull();

        game.chessPiecePlacementReady![ownerA.id] = true;
        game.chessPiecePlacementReady![ownerB.id] = true;
        expect(resolveChessPlacementAndTransition(game, Date.now())).toBe(true);
        expect(game.gameStatus).toBe('playing');
    });
});
