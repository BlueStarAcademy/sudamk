import { describe, expect, it } from 'vitest';
import { applyPveItemActionClientSync } from '../../pveItemSync.js';
import { Player } from '../../../types/index.js';

const emptyBoard = (size: number) =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => Player.None));

describe('PVE item client sync', () => {
    it('does not let a same-length client snapshot relocate or erase a confirmed AI stone', () => {
        const board = emptyBoard(5);
        board[2][2] = Player.White;
        const game: any = {
            id: 'pve-ai-stability',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            boardState: board,
            moveHistory: [{ x: 2, y: 2, player: Player.White }],
            currentPlayer: Player.Black,
            gameStatus: 'playing',
            mode: 'missile',
            settings: { mixedModes: [] },
        };

        const staleBoard = emptyBoard(5);
        staleBoard[4][4] = Player.White;

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState: staleBoard,
                moveHistory: [{ x: 4, y: 4, player: Player.White }],
                currentPlayer: Player.Black,
                gameStatus: 'playing',
            },
        });

        expect(game.moveHistory[0]).toEqual({ x: 2, y: 2, player: Player.White });
        expect(game.boardState[2][2]).toBe(Player.White);
        expect(game.boardState[4][4]).toBe(Player.None);
    });

    it('does not remap captured AI moves during missile board/history reconciliation', () => {
        const board = emptyBoard(5);
        board[4][4] = Player.White;
        const game: any = {
            id: 'pve-ai-capture-stability',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            boardState: emptyBoard(5),
            moveHistory: [
                { x: 2, y: 2, player: Player.White },
                { x: 0, y: 0, player: Player.Black },
                { x: 4, y: 4, player: Player.White },
            ],
            currentPlayer: Player.Black,
            gameStatus: 'playing',
            mode: 'missile',
            settings: { mixedModes: [] },
        };

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState: board,
                moveHistory: [
                    { x: 2, y: 2, player: Player.White },
                    { x: 0, y: 1, player: Player.Black },
                    { x: 4, y: 4, player: Player.White },
                ],
                currentPlayer: Player.Black,
                gameStatus: 'playing',
            },
        });

        expect(game.moveHistory[0]).toEqual({ x: 2, y: 2, player: Player.White });
        expect(game.moveHistory[1]).toEqual({ x: 0, y: 1, player: Player.Black });
        expect(game.moveHistory[2]).toEqual({ x: 4, y: 4, player: Player.White });
    });

    it('does not let stale client sync hand an AI turn back to the user', () => {
        const board = emptyBoard(5);
        board[0][0] = Player.Black;
        const game: any = {
            id: 'pve-ai-turn-stability',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            boardState: board,
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
            currentPlayer: Player.White,
            gameStatus: 'playing',
            mode: 'capture',
            settings: { mixedModes: [] },
        };

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState: board,
                moveHistory: [{ x: 0, y: 0, player: Player.Black }],
                currentPlayer: Player.Black,
                gameStatus: 'playing',
            },
        });

        expect(game.currentPlayer).toBe(Player.White);
    });
});
