import { describe, it, expect } from 'vitest';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { GameMode, Player } from '../../../shared/types/index.js';
import { preservePairTurnIfExistingAhead } from '../../../utils/preservePairTurnOnMerge.js';

function makePairGame(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    return {
        id: 'pair-game',
        mode: GameMode.Mix,
        settings: {
            boardSize: 9,
            pairGame: {
                pairMode: 'pvp',
                turnOrder: [
                    { seatId: 'b1', participantId: 'u1', kind: 'user', player: Player.Black, teamId: 'a' },
                    { seatId: 'w1', participantId: 'u2', kind: 'user', player: Player.White, teamId: 'b' },
                    { seatId: 'b2', participantId: 'u3', kind: 'user', player: Player.Black, teamId: 'a' },
                    { seatId: 'w2', participantId: 'u4', kind: 'user', player: Player.White, teamId: 'b' },
                ],
                currentTurnIndex: 2,
            },
        },
        moveHistory: [{ player: Player.Black, x: 0, y: 0 }, { player: Player.White, x: 1, y: 1 }],
        currentPlayer: Player.Black,
        boardState: Array(9)
            .fill(0)
            .map(() => Array(9).fill(Player.None)),
        ...overrides,
    } as LiveGameSession;
}

describe('preservePairTurnIfExistingAhead', () => {
    it('preserves ahead client turn index when move counts match but server index is stale', () => {
        const existing = makePairGame();
        const merged = makePairGame({
            settings: {
                ...makePairGame().settings,
                pairGame: {
                    ...makePairGame().settings!.pairGame!,
                    currentTurnIndex: 0,
                },
            },
        });
        const result = preservePairTurnIfExistingAhead(existing, merged);
        expect(result.settings?.pairGame?.currentTurnIndex).toBe(2);
        expect(result.currentPlayer).toBe(Player.Black);
    });

    it('preserves client board when server moveHistory is shorter with matching prefix', () => {
        const existing = makePairGame({
            moveHistory: [
                { player: Player.Black, x: 0, y: 0 },
                { player: Player.White, x: 1, y: 1 },
                { player: Player.Black, x: 2, y: 2 },
            ],
        });
        const merged = makePairGame({
            moveHistory: [
                { player: Player.Black, x: 0, y: 0 },
                { player: Player.White, x: 1, y: 1 },
            ],
        });
        const result = preservePairTurnIfExistingAhead(existing, merged);
        expect(result.moveHistory?.length).toBe(3);
    });

    it('no-ops for non-pair games', () => {
        const existing = { id: '1v1', mode: GameMode.Standard, settings: { boardSize: 9 } } as LiveGameSession;
        const merged = { ...existing, currentPlayer: Player.White };
        expect(preservePairTurnIfExistingAhead(existing, merged)).toBe(merged);
    });
});
