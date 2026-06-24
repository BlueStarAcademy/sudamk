import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { GameMode, Player } from '../../../shared/types/index.js';
import { createDefaultUser } from '../../initialData.js';

/**
 * Mutual disconnect eligibility: all human participants offline should trigger cleanup
 * even when disconnectionState is set (one player disconnected first).
 */
function shouldSkipMutualDisconnectCheck(game: LiveGameSession): boolean {
    return (
        !!game.isAiGame ||
        game.gameStatus === 'ended' ||
        game.gameStatus === 'no_contest' ||
        game.gameStatus === 'scoring'
    );
}

function getHumanParticipantIds(game: LiveGameSession): string[] {
    const pairGame = game.settings?.pairGame;
    if (pairGame?.turnOrder?.length) {
        return pairGame.turnOrder.filter((s) => s.kind === 'user').map((s) => s.participantId);
    }
    return [game.player1?.id, game.player2?.id].filter((id): id is string => Boolean(id));
}

function isMutualHumanDisconnect(game: LiveGameSession, onlineUserIds: string[]): boolean {
    if (shouldSkipMutualDisconnectCheck(game)) return false;
    const humanIds = getHumanParticipantIds(game);
    return humanIds.length > 0 && humanIds.every((id) => !onlineUserIds.includes(id));
}

function makePvpGame(): LiveGameSession {
    const p1 = createDefaultUser('p1-id', 'p1', 'P1');
    const p2 = createDefaultUser('p2-id', 'p2', 'P2');
    return {
        id: 'game-mutual',
        mode: GameMode.Standard,
        settings: { boardSize: 9, komi: 0.5 },
        player1: p1,
        player2: p2,
        blackPlayerId: p1.id,
        whitePlayerId: p2.id,
        gameStatus: 'playing',
        boardState: Array(9)
            .fill(0)
            .map(() => Array(9).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.Black]: 0, [Player.White]: 0 },
        currentPlayer: Player.Black,
        disconnectionState: {
            disconnectedPlayerId: p2.id,
            timerStartedAt: Date.now() - 5000,
        },
    } as LiveGameSession;
}

describe('pvp mutual disconnect eligibility', () => {
    it('does not skip mutual disconnect when disconnectionState is set', () => {
        const game = makePvpGame();
        expect(shouldSkipMutualDisconnectCheck(game)).toBe(false);
    });

    it('detects mutual disconnect when both humans offline despite disconnectionState', () => {
        const game = makePvpGame();
        expect(isMutualHumanDisconnect(game, [])).toBe(true);
    });

    it('does not mutual-disconnect when one human still online', () => {
        const game = makePvpGame();
        expect(isMutualHumanDisconnect(game, [game.player1!.id])).toBe(false);
    });

    it('pair PVP: all four human seats must be offline', () => {
        const game = makePvpGame();
        game.settings = {
            ...game.settings,
            pairGame: {
                pairMode: 'pvp',
                turnOrder: [
                    { seatId: 'b1', participantId: 'u1', kind: 'user', player: Player.Black, teamId: 'team-a' },
                    { seatId: 'w1', participantId: 'u2', kind: 'user', player: Player.White, teamId: 'team-b' },
                    { seatId: 'b2', participantId: 'u3', kind: 'user', player: Player.Black, teamId: 'team-a' },
                    { seatId: 'w2', participantId: 'u4', kind: 'user', player: Player.White, teamId: 'team-b' },
                ],
            },
        } as any;
        expect(isMutualHumanDisconnect(game, ['u1', 'u2'])).toBe(false);
        expect(isMutualHumanDisconnect(game, [])).toBe(true);
    });
});
