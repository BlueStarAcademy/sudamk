import { describe, expect, it } from 'vitest';
import { applyPveItemActionClientSync } from '../../pveItemSync.js';
import { Player } from '../../../types/index.js';
import { buildPveItemActionClientSync } from '../../../utils/pveItemClientSync.js';

const emptyBoard = (size: number) =>
    Array.from({ length: size }, () => Array.from({ length: size }, () => Player.None));

describe('PVE item client sync', () => {
    it('builds human hidden sync from coordinate marker instead of stale hiddenMoves index', () => {
        const board = emptyBoard(5);
        board[0][0] = Player.Black;
        board[1][1] = Player.White;
        board[2][2] = Player.Black;
        const session: any = {
            id: 'pve-human-hidden-marker-authority',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            boardState: board,
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.White },
                { x: 2, y: 2, player: Player.Black },
            ],
            currentPlayer: Player.White,
            gameStatus: 'playing',
            mode: 'mix',
            settings: { mixedModes: ['hidden'] },
            hiddenMoves: { '0': true },
            humanHiddenStonePoints: [{ x: 2, y: 2, player: Player.Black }],
        };

        const sync = buildPveItemActionClientSync(session);

        expect(sync?.hiddenMoves).toEqual({ '2': true });
        expect(sync?.humanHiddenStonePoints).toEqual([{ x: 2, y: 2, player: Player.Black }]);
    });

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

    it('does not let stale base opening sync skip the AI first move', () => {
        const board = emptyBoard(5);
        board[1][1] = Player.Black;
        board[3][3] = Player.White;
        const game: any = {
            id: 'pve-base-opening-stability',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            blackPlayerId: 'ai-player-01',
            whitePlayerId: 'human-1',
            boardState: board,
            moveHistory: [],
            currentPlayer: Player.Black,
            gameStatus: 'playing',
            mode: 'base',
            settings: { baseStones: 1, mixedModes: [] },
            baseStones: [
                { x: 1, y: 1, player: Player.Black },
                { x: 3, y: 3, player: Player.White },
            ],
        };

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState: emptyBoard(5),
                moveHistory: [],
                currentPlayer: Player.White,
                gameStatus: 'playing',
                totalTurns: 0,
            },
        });

        expect(game.currentPlayer).toBe(Player.Black);
        expect(game.moveHistory).toEqual([]);
        expect(game.baseStones).toEqual([
            { x: 1, y: 1, player: Player.Black },
            { x: 3, y: 3, player: Player.White },
        ]);
        expect(game.boardState[1][1]).toBe(Player.Black);
        expect(game.boardState[3][3]).toBe(Player.White);
    });

    it('preserveServerHiddenPlacementMeta ignores client hiddenMoves / aiInitialHiddenStone relabeling', () => {
        const board = emptyBoard(5);
        board[1][1] = Player.Black;
        board[2][2] = Player.White;
        const game: any = {
            id: 'pve-hidden-handshake',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            boardState: board,
            moveHistory: [
                { x: 1, y: 1, player: Player.Black },
                { x: 2, y: 2, player: Player.White },
            ],
            currentPlayer: Player.Black,
            gameStatus: 'playing',
            mode: 'hidden',
            settings: { mixedModes: [] },
            hiddenMoves: { '1': true },
            aiInitialHiddenStone: { x: 2, y: 2 },
        };

        applyPveItemActionClientSync(
            game,
            {
                clientSync: {
                    boardState: board.map((row) => [...row]),
                    moveHistory: [
                        { x: 1, y: 1, player: Player.Black },
                        { x: 2, y: 2, player: Player.White },
                    ],
                    hiddenMoves: { '0': true },
                    aiInitialHiddenStone: { x: 1, y: 1 },
                    currentPlayer: Player.Black,
                    gameStatus: 'playing',
                },
            },
            { preserveServerHiddenPlacementMeta: true },
        );

        expect(game.hiddenMoves).toEqual({ '1': true });
        expect(game.aiInitialHiddenStone).toEqual({ x: 2, y: 2 });
    });

    it('ignores client aiInitialHiddenStone when the coordinate belongs to the human', () => {
        const board = emptyBoard(5);
        board[1][1] = Player.Black;
        board[2][2] = Player.White;
        const game: any = {
            id: 'pve-human-hidden-not-ai-initial',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            blackPlayerId: 'ai-player-01',
            whitePlayerId: 'human-1',
            boardState: board,
            moveHistory: [
                { x: 1, y: 1, player: Player.Black },
                { x: 2, y: 2, player: Player.White },
            ],
            currentPlayer: Player.Black,
            gameStatus: 'playing',
            mode: 'mix',
            settings: { mixedModes: ['base', 'hidden'] },
            hiddenMoves: { '1': true },
        };

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState: board.map((row) => [...row]),
                moveHistory: game.moveHistory.map((move: any) => ({ ...move })),
                hiddenMoves: { '1': true },
                aiInitialHiddenStone: { x: 2, y: 2 },
                currentPlayer: Player.Black,
                gameStatus: 'playing',
            },
        });

        expect(game.aiInitialHiddenStone).toBeUndefined();
    });

    it('does not let same-length client sync relabel a normal stone as hidden', () => {
        const board = emptyBoard(5);
        board[1][1] = Player.Black;
        board[2][2] = Player.White;
        const game: any = {
            id: 'pve-hidden-relabel-guard',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            boardState: board.map((row) => [...row]),
            moveHistory: [
                { x: 1, y: 1, player: Player.Black },
                { x: 2, y: 2, player: Player.White },
            ],
            currentPlayer: Player.Black,
            gameStatus: 'playing',
            mode: 'mix',
            settings: { mixedModes: ['base', 'hidden', 'speed'] },
            hiddenMoves: { '1': true },
        };

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState: board.map((row) => [...row]),
                moveHistory: game.moveHistory.map((move: any) => ({ ...move })),
                hiddenMoves: { '0': true, '1': true },
                currentPlayer: Player.Black,
                gameStatus: 'playing',
            },
        });

        expect(game.hiddenMoves).toEqual({ '1': true });
    });

    it('does not accept first-move hidden labeling from client-advanced snapshot', () => {
        const board = emptyBoard(5);
        board[0][0] = Player.Black;
        const game: any = {
            id: 'pve-first-move-hidden-relabel-guard',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            boardState: emptyBoard(5),
            moveHistory: [],
            currentPlayer: Player.White,
            gameStatus: 'playing',
            mode: 'mix',
            settings: { mixedModes: ['base', 'hidden', 'speed'] },
            hiddenMoves: {},
        };

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState: board,
                moveHistory: [{ x: 0, y: 0, player: Player.Black }],
                hiddenMoves: { '0': true },
                currentPlayer: Player.White,
                gameStatus: 'playing',
            },
        });

        expect(game.moveHistory).toEqual([{ x: 0, y: 0, player: Player.Black }]);
        expect(game.hiddenMoves).toEqual({});
    });

    it('accepts hidden label only for appended moves during hidden placement sync', () => {
        const board = emptyBoard(5);
        board[0][0] = Player.Black;
        const game: any = {
            id: 'pve-hidden-placement-append-allow',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            boardState: emptyBoard(5),
            moveHistory: [],
            currentPlayer: Player.Black,
            gameStatus: 'hidden_placing',
            mode: 'mix',
            settings: { mixedModes: ['base', 'hidden', 'speed'] },
            hiddenMoves: {},
        };

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState: board,
                moveHistory: [{ x: 0, y: 0, player: Player.Black }],
                hiddenMoves: { '0': true },
                currentPlayer: Player.White,
                gameStatus: 'hidden_placing',
            },
        });

        expect(game.moveHistory).toEqual([{ x: 0, y: 0, player: Player.Black }]);
        expect(game.hiddenMoves).toEqual({ '0': true });
    });

    it('tower-like catch-up: rejects stale hiddenMoves[0] when server already had moves', () => {
        const board = emptyBoard(5);
        board[0][0] = Player.Black;
        board[1][1] = Player.White;
        board[2][2] = Player.Black;
        board[3][3] = Player.White;
        board[4][4] = Player.Black;
        const game: any = {
            id: 'pve-tower-stale-hidden-zero',
            gameCategory: 'tower',
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            boardState: board.map((row) => [...row]),
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.White },
            ],
            currentPlayer: Player.Black,
            gameStatus: 'hidden_placing',
            mode: 'mix',
            settings: { mixedModes: ['hidden'] },
            hiddenMoves: {},
        };

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState: board.map((row) => [...row]),
                moveHistory: [
                    { x: 0, y: 0, player: Player.Black },
                    { x: 1, y: 1, player: Player.White },
                    { x: 2, y: 2, player: Player.Black },
                    { x: 3, y: 3, player: Player.White },
                    { x: 4, y: 4, player: Player.Black },
                ],
                hiddenMoves: { '0': true, '4': true },
                currentPlayer: Player.White,
                gameStatus: 'hidden_placing',
            },
        });

        expect(game.hiddenMoves).toEqual({ '4': true });
    });

    it('does not accept hidden relabel when only client reports hidden_placing', () => {
        const board = emptyBoard(5);
        board[0][0] = Player.Black;
        const game: any = {
            id: 'pve-hidden-placement-client-only-state',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            boardState: emptyBoard(5),
            moveHistory: [],
            currentPlayer: Player.Black,
            gameStatus: 'playing',
            mode: 'mix',
            settings: { mixedModes: ['base', 'hidden', 'speed'] },
            hiddenMoves: {},
        };

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState: board,
                moveHistory: [{ x: 0, y: 0, player: Player.Black }],
                hiddenMoves: { '0': true },
                currentPlayer: Player.White,
                gameStatus: 'hidden_placing',
            },
        });

        expect(game.moveHistory).toEqual([{ x: 0, y: 0, player: Player.Black }]);
        expect(game.hiddenMoves).toEqual({});
    });

    it('does not let client sync drop server permanently revealed hidden stones', () => {
        const board = emptyBoard(5);
        board[1][1] = Player.Black;
        board[3][3] = Player.White;
        const game: any = {
            id: 'pve-revealed-stones-monotonic',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            boardState: board.map((row) => [...row]),
            moveHistory: [
                { x: 1, y: 1, player: Player.Black },
                { x: 3, y: 3, player: Player.White },
            ],
            currentPlayer: Player.Black,
            gameStatus: 'playing',
            mode: 'mix',
            settings: { mixedModes: ['hidden'] },
            hiddenMoves: { '1': true },
            permanentlyRevealedStones: [{ x: 1, y: 1 }],
        };

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState: board.map((row) => [...row]),
                moveHistory: game.moveHistory.map((m: any) => ({ ...m })),
                currentPlayer: Player.Black,
                gameStatus: 'playing',
                permanentlyRevealedStones: [{ x: 3, y: 3 }],
            },
        });

        expect(game.permanentlyRevealedStones).toEqual([
            { x: 1, y: 1 },
            { x: 3, y: 3 },
        ]);
    });

    it('allows hidden_placing to playing when client sync advances move history after hidden commit', () => {
        const board = emptyBoard(5);
        board[0][0] = Player.Black;
        const game: any = {
            id: 'pve-hidden-commit-playing',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            boardState: emptyBoard(5),
            moveHistory: [],
            currentPlayer: Player.Black,
            gameStatus: 'hidden_placing',
            mode: 'hidden',
            settings: { mixedModes: [] },
            hiddenMoves: {},
            itemUseDeadline: Date.now() + 30000,
            itemPhaseActingPlayer: Player.Black,
        };

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState: board,
                moveHistory: [{ x: 0, y: 0, player: Player.Black }],
                hiddenMoves: { '0': true },
                currentPlayer: Player.White,
                gameStatus: 'playing',
            },
        });

        expect(game.gameStatus).toBe('playing');
        expect(game.currentPlayer).toBe(Player.White);
        expect(game.itemUseDeadline).toBeUndefined();
        expect(game.itemPhaseActingPlayer).toBeUndefined();
    });

    it('carries PVE overlay metadata from the client before a server AI hidden move', () => {
        const board = emptyBoard(5);
        board[1][1] = Player.Black;
        board[3][3] = Player.White;
        const game: any = {
            id: 'pve-overlay-sync',
            isSinglePlayer: true,
            gameCategory: 'singleplayer',
            blackPlayerId: 'human-1',
            whitePlayerId: 'ai-player-01',
            boardState: emptyBoard(5),
            moveHistory: [],
            currentPlayer: Player.White,
            gameStatus: 'playing',
            mode: 'mix',
            settings: { mixedModes: ['base', 'hidden'] },
            captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
            baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
            hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        };

        applyPveItemActionClientSync(game, {
            clientSync: {
                boardState: board,
                moveHistory: [],
                currentPlayer: Player.White,
                gameStatus: 'playing',
                baseStones: [
                    { x: 1, y: 1, player: Player.Black },
                    { x: 3, y: 3, player: Player.White },
                ],
                blackPatternStones: [{ x: 1, y: 1 }],
                whitePatternStones: [{ x: 3, y: 3 }],
                baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 2, [Player.White]: 0 },
                hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 1 },
                captures: { [Player.None]: 0, [Player.Black]: 10, [Player.White]: 5 },
            },
        });

        expect(game.baseStones).toEqual([
            { x: 1, y: 1, player: Player.Black },
            { x: 3, y: 3, player: Player.White },
        ]);
        expect(game.blackPatternStones).toEqual([{ x: 1, y: 1 }]);
        expect(game.whitePatternStones).toEqual([{ x: 3, y: 3 }]);
        expect(game.baseStoneCaptures[Player.Black]).toBe(2);
        expect(game.hiddenStoneCaptures[Player.White]).toBe(1);
        expect(game.captures[Player.Black]).toBe(10);
    });
});
