import { describe, expect, it } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { aiUserId } from '../../aiPlayer.js';
import { tryStartRevealOnlyOpponentHiddenAttack } from '../../modes/startOpponentHiddenReveal.js';

describe('tryStartRevealOnlyOpponentHiddenAttack', () => {
    it('adventure AI: reveals all opponent hiddens without placing and keeps discoverer turn flag', () => {
        const board = Array.from({ length: 9 }, () => Array(9).fill(Player.None));
        board[3][3] = Player.White;
        board[4][4] = Player.White;
        const game = {
            id: 'adv-1',
            mode: GameMode.Hidden,
            gameCategory: GameCategory.Adventure,
            isAiGame: true,
            gameStatus: 'playing',
            blackPlayerId: 'user-1',
            whitePlayerId: aiUserId,
            currentPlayer: Player.Black,
            boardState: board,
            moveHistory: [
                { x: 3, y: 3, player: Player.White },
                { x: 4, y: 4, player: Player.White },
            ],
            hiddenMoves: { 0: true, 1: true },
            aiHiddenStonePoints: [
                { x: 3, y: 3, player: Player.White },
                { x: 4, y: 4, player: Player.White },
            ],
            permanentlyRevealedStones: [],
            settings: { boardSize: 9, hiddenStoneCount: 2 },
        } as LiveGameSession;

        const ok = tryStartRevealOnlyOpponentHiddenAttack(game, Player.Black, 3, 3, Date.now());
        expect(ok).toBe(true);
        expect(game.gameStatus).toBe('hidden_reveal_animating');
        expect(game.animation?.type).toBe('hidden_reveal');
        expect((game.animation as any).stones.length).toBeGreaterThanOrEqual(2);
        expect(game.permanentlyRevealedStones).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ x: 3, y: 3 }),
                expect.objectContaining({ x: 4, y: 4 }),
            ]),
        );
        expect(game.pendingCapture).toBeNull();
        expect((game as any).isAiTurnCancelledAfterReveal).toBe(true);
        expect(game.currentPlayer).toBe(Player.Black);
    });

    it('adventure AI: detects via aiHiddenStonePoints alone', () => {
        const board = Array.from({ length: 9 }, () => Array(9).fill(Player.None));
        board[1][1] = Player.White;
        const game = {
            id: 'adv-2',
            mode: GameMode.Hidden,
            gameCategory: GameCategory.Adventure,
            isAiGame: true,
            gameStatus: 'playing',
            blackPlayerId: 'user-1',
            whitePlayerId: aiUserId,
            currentPlayer: Player.Black,
            boardState: board,
            moveHistory: [{ x: 1, y: 1, player: Player.White }],
            hiddenMoves: {},
            aiHiddenStonePoints: [{ x: 1, y: 1, player: Player.White }],
            permanentlyRevealedStones: [],
            settings: { boardSize: 9, hiddenStoneCount: 1 },
        } as LiveGameSession;

        expect(tryStartRevealOnlyOpponentHiddenAttack(game, Player.Black, 1, 1, Date.now())).toBe(true);
        expect(game.gameStatus).toBe('hidden_reveal_animating');
    });
});
