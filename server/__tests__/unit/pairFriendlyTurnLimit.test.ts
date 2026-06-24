import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession, User } from '../../../shared/types/index.js';
import { configurePairClassicGameStart } from '../../actions/socialActions.js';

function makePairFriendlyPvpSession(): LiveGameSession {
    const owner = { id: 'owner-a', username: 'a', nickname: 'A' } as User;
    return {
        id: 'game-pair-friendly',
        mode: GameMode.Standard,
        isAiGame: false,
        isRankedGame: false,
        gameStatus: 'pending',
        player1: owner,
        player2: { id: 'owner-b', username: 'b', nickname: 'B' } as User,
        settings: {
            boardSize: 19,
            komi: 6.5,
            scoringTurnLimit: 120,
            pairGame: {
                roomId: 'room-pvp',
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
            },
        },
        boardState: Array.from({ length: 19 }, () => Array(19).fill(Player.None)),
        moveHistory: [],
        currentPlayer: Player.None,
    } as LiveGameSession;
}

describe('configurePairClassicGameStart friendly PVP turn limit', () => {
    it('strips scoringTurnLimit for human-human friendly pair (same as 1v1 friendly)', () => {
        const session = makePairFriendlyPvpSession();
        configurePairClassicGameStart(session, session.player1, [session.player1]);
        expect(session.settings.scoringTurnLimit).toBe(0);
        expect((session.settings as { autoScoringTurns?: number }).autoScoringTurns).toBeUndefined();
    });
});
