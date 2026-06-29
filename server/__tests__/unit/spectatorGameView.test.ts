import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../types/index.js';
import type { LiveGameSession } from '../../../types/index.js';
import { buildSpectatorGameView } from '../../utils/spectatorGameView.js';

const baseGame = (overrides: Partial<LiveGameSession> = {}): LiveGameSession =>
    ({
        id: 'spectator-game',
        mode: GameMode.Hidden,
        gameStatus: 'playing',
        settings: { boardSize: 9, komi: 6.5, timeLimit: 300, byoyomiTime: 30, byoyomiCount: 3 },
        boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        moveHistory: [],
        hiddenMoves: {},
        revealedHiddenMoves: {},
        newlyRevealed: [],
        ...overrides,
    }) as LiveGameSession;

describe('buildSpectatorGameView', () => {
    it('hides unrevealed hidden stones and strips player-specific reveal data', () => {
        const boardState = Array.from({ length: 9 }, () => Array(9).fill(Player.None));
        boardState[2][3] = Player.Black;
        const game = baseGame({
            boardState,
            moveHistory: [{ x: 3, y: 2, player: Player.Black }],
            hiddenMoves: { 0: true },
            revealedHiddenMoves: { playerA: { 0: true } } as any,
            newlyRevealed: [{ x: 3, y: 2, player: Player.Black }] as any,
            scannedAiInitialHiddenByUser: { playerA: [{ x: 1, y: 1 }] } as any,
            animation: {
                type: 'hidden_reveal',
                stones: [{ point: { x: 3, y: 2 }, player: Player.Black }],
                startTime: 1000,
                duration: 1200,
            } as any,
            revealAnimationEndTime: 2200,
        });

        const view = buildSpectatorGameView(game);

        expect(view.boardState[2][3]).toBe(Player.None);
        expect(view.hiddenMoves).toEqual({});
        expect(view.revealedHiddenMoves).toEqual({});
        expect(view.newlyRevealed).toEqual([]);
        expect((view as any).scannedAiInitialHiddenByUser).toBeUndefined();
        expect(view.animation).toBeNull();
        expect(view.revealAnimationEndTime).toBeUndefined();
        expect(game.boardState[2][3]).toBe(Player.Black);
    });

    it('keeps hidden stones visible after permanent or global reveal', () => {
        const boardState = Array.from({ length: 9 }, () => Array(9).fill(Player.None));
        boardState[2][3] = Player.Black;
        const game = baseGame({
            boardState,
            moveHistory: [{ x: 3, y: 2, player: Player.Black }],
            hiddenMoves: { 0: true },
            permanentlyRevealedStones: [{ x: 3, y: 2 }],
        });

        expect(buildSpectatorGameView(game).boardState[2][3]).toBe(Player.Black);
        expect(buildSpectatorGameView({ ...game, gameStatus: 'scoring' } as LiveGameSession).boardState[2][3]).toBe(Player.Black);
    });
});
