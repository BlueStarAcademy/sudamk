import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession, User } from '../../../shared/types/index.js';
import { configurePairClassicGameStart } from '../../actions/socialActions.js';
import { ensureCastleStonePointsForSession } from '../../modes/castle.js';
import { aiUserId } from '../../aiPlayer.js';

function makePairCastleSession(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    return {
        id: 'game-pair-castle',
        mode: GameMode.Castle,
        isAiGame: true,
        gameStatus: 'pending',
        player1: { id: 'owner-a', username: 'a', nickname: 'A' } as User,
        player2: { id: aiUserId, username: 'ai', nickname: 'AI' } as User,
        blackPlayerId: null,
        whitePlayerId: null,
        settings: {
            boardSize: 13,
            komi: 6.5,
            castleCount: 2,
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
            },
        },
        boardState: Array.from({ length: 13 }, () => Array(13).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        currentPlayer: Player.None,
        ...overrides,
    } as LiveGameSession;
}

describe('pair castle setup', () => {
    it('ensureCastleStonePointsForSession generates deterministic castle points', () => {
        const session = makePairCastleSession();
        expect(session.castleStonePoints).toBeUndefined();

        ensureCastleStonePointsForSession(session);

        expect(session.castleStonePoints?.length).toBeGreaterThan(0);
        const again = makePairCastleSession();
        ensureCastleStonePointsForSession(again);
        expect(again.castleStonePoints).toEqual(session.castleStonePoints);
    });

    it('configurePairClassicGameStart seeds castle points for pair AI castle games', () => {
        const session = makePairCastleSession();
        configurePairClassicGameStart(session, session.player1, [session.player1]);

        expect(session.gameStatus).toBe('pair_order_reveal');
        expect(session.castleStonePoints?.length).toBeGreaterThan(0);
        expect(session.confirmedTerritoryOwnerByPoint).toEqual({});
    });
});
