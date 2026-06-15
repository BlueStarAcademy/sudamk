import { describe, expect, it } from 'vitest';
import { Player } from '../../../types/index.js';
import {
    resolveChessPvePlayingSession,
    resolvePveScoringBoardAndMoveHistory,
    resolveStrategicPvePlayingBoardAndMoveHistory,
    replayStrategicBoardFromMoveHistory,
    deriveBoardFromMoveHistoryAndBaseStones,
} from '../../../utils/deferredWsBoardSnapshot.js';
import type { LiveGameSession } from '../../../types/index.js';
import { GameMode } from '../../../types/index.js';
import { generateChessGoInitialPieces } from '../../../shared/utils/chessGoRules.js';

const boardWithWhiteAtCenter = (): number[][] => [
    [Player.None, Player.None, Player.None],
    [Player.None, Player.White, Player.None],
    [Player.None, Player.None, Player.None],
];

const boardWithoutWhite = (): number[][] => [
    [Player.None, Player.None, Player.None],
    [Player.None, Player.None, Player.None],
    [Player.None, Player.None, Player.None],
];

describe('resolvePveScoringBoardAndMoveHistory', () => {
    it('prefers client when moveHistory is longer (human white last move before server sync)', () => {
        const server = {
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
            boardState: boardWithoutWhite(),
        } as LiveGameSession;
        const client = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.White },
            ],
            boardState: boardWithWhiteAtCenter(),
        } as LiveGameSession;

        const resolved = resolvePveScoringBoardAndMoveHistory(server, client);
        expect(resolved.moveHistory).toHaveLength(2);
        expect(resolved.boardState?.[1]?.[1]).toBe(Player.White);
    });

    it('prefers server when server moveHistory is longer', () => {
        const server = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.White },
            ],
            boardState: boardWithWhiteAtCenter(),
        } as LiveGameSession;
        const client = {
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
            boardState: boardWithoutWhite(),
        } as LiveGameSession;

        const resolved = resolvePveScoringBoardAndMoveHistory(server, client);
        expect(resolved.moveHistory).toHaveLength(2);
        expect(resolved.boardState?.[1]?.[1]).toBe(Player.White);
    });
});

describe('resolveStrategicPvePlayingBoardAndMoveHistory', () => {
    it('prefers server board when server moveHistory is ahead (AI move with full board)', () => {
        const server = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.White },
            ],
            boardState: boardWithWhiteAtCenter(),
        } as LiveGameSession;
        const client = {
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
            boardState: boardWithoutWhite(),
        } as LiveGameSession;

        const resolved = resolveStrategicPvePlayingBoardAndMoveHistory(server, client);
        expect(resolved.moveHistory).toHaveLength(2);
        expect(resolved.boardState?.[1]?.[1]).toBe(Player.White);
    });

    it('keeps client board when client moveHistory is ahead and server sent slim packet', () => {
        const server = {
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
            boardState: undefined,
        } as LiveGameSession;
        const client = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.White },
            ],
            boardState: boardWithWhiteAtCenter(),
        } as LiveGameSession;

        const resolved = resolveStrategicPvePlayingBoardAndMoveHistory(server, client);
        expect(resolved.moveHistory).toHaveLength(2);
        expect(resolved.boardState?.[1]?.[1]).toBe(Player.White);
    });

    it('derives board when server moveHistory is ahead and server sent slim packet without board', () => {
        const server = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.White },
            ],
            boardState: undefined,
            settings: { boardSize: 3 },
        } as LiveGameSession;
        const client = {
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
            boardState: boardWithoutWhite(),
            settings: { boardSize: 3 },
        } as LiveGameSession;

        const resolved = resolveStrategicPvePlayingBoardAndMoveHistory(server, client);
        expect(resolved.moveHistory).toHaveLength(2);
        expect(resolved.boardState?.[1]?.[1]).toBe(Player.White);
    });

    it('replay removes captured stones when server sent slim packet after capture', () => {
        // Black (1,0) — White (0,0) — Black (0,1) captures white
        const server = {
            moveHistory: [
                { x: 1, y: 0, player: Player.Black },
                { x: 0, y: 0, player: Player.White },
                { x: 0, y: 1, player: Player.Black },
            ],
            boardState: undefined,
            settings: { boardSize: 3 },
        } as LiveGameSession;
        const client = {
            moveHistory: [
                { x: 1, y: 0, player: Player.Black },
                { x: 0, y: 0, player: Player.White },
            ],
            boardState: [
                [Player.White, Player.Black, Player.None],
                [Player.None, Player.None, Player.None],
                [Player.None, Player.None, Player.None],
            ],
            settings: { boardSize: 3 },
        } as LiveGameSession;

        const naive = deriveBoardFromMoveHistoryAndBaseStones(server, client);
        expect(naive?.[0]?.[0]).toBe(Player.White);

        const resolved = resolveStrategicPvePlayingBoardAndMoveHistory(server, client);
        expect(resolved.moveHistory).toHaveLength(3);
        expect(resolved.boardState?.[0]?.[0]).toBe(Player.None);
        expect(resolved.boardState?.[0]?.[1]).toBe(Player.Black);
        expect(resolved.boardState?.[1]?.[0]).toBe(Player.Black);

        const replayed = replayStrategicBoardFromMoveHistory(server, client);
        expect(replayed?.[0]?.[0]).toBe(Player.None);
    });
});

describe('resolveChessPvePlayingSession', () => {
    const chessPieces = generateChessGoInitialPieces(13);

    it('keeps client moveHistory when client is ahead (user optimistic move after AI)', () => {
        const server = {
            mode: GameMode.Chess,
            gameStatus: 'playing',
            settings: { boardSize: 13, komi: 6.5 },
            chessPieces,
            moveHistory: [
                { x: 6, y: 6, player: Player.Black },
                { x: 7, y: 7, player: Player.White },
            ],
            currentPlayer: Player.Black,
        } as LiveGameSession;
        const client = {
            ...server,
            moveHistory: [
                { x: 6, y: 6, player: Player.Black },
                { x: 7, y: 7, player: Player.White },
                { x: 5, y: 5, player: Player.Black },
            ],
            currentPlayer: Player.White,
        } as LiveGameSession;

        const resolved = resolveChessPvePlayingSession(server, client);
        expect(resolved.moveHistory).toHaveLength(3);
        expect(resolved.boardState![5]![5]).toBe(Player.Black);
        expect(resolved.boardState![7]![7]).toBe(Player.White);
    });

    it('prefers server when server moveHistory is ahead (AI move arrived)', () => {
        const client = {
            mode: GameMode.Chess,
            gameStatus: 'playing',
            settings: { boardSize: 13, komi: 6.5 },
            chessPieces,
            moveHistory: [{ x: 6, y: 6, player: Player.Black }],
            currentPlayer: Player.White,
        } as LiveGameSession;
        const server = {
            ...client,
            moveHistory: [
                { x: 6, y: 6, player: Player.Black },
                { x: 7, y: 7, player: Player.White },
            ],
            currentPlayer: Player.Black,
        } as LiveGameSession;

        const resolved = resolveChessPvePlayingSession(server, client);
        expect(resolved.moveHistory).toHaveLength(2);
        expect(resolved.boardState![7]![7]).toBe(Player.White);
    });

    it('keeps client when same-length stale server has diverged AI stone position', () => {
        const client = {
            mode: GameMode.Chess,
            gameStatus: 'playing',
            settings: { boardSize: 13, komi: 6.5 },
            chessPieces,
            moveHistory: [
                { x: 6, y: 6, player: Player.Black },
                { x: 7, y: 7, player: Player.White },
            ],
            currentPlayer: Player.Black,
        } as LiveGameSession;
        const server = {
            ...client,
            moveHistory: [
                { x: 6, y: 6, player: Player.Black },
                { x: 8, y: 8, player: Player.White },
            ],
        } as LiveGameSession;

        const resolved = resolveChessPvePlayingSession(server, client);
        expect(resolved.moveHistory![1]).toEqual({ x: 7, y: 7, player: Player.White });
        expect(resolved.boardState![7]![7]).toBe(Player.White);
        expect(resolved.boardState![8]![8]).toBe(Player.None);
    });

    it('does not regress client ended to server playing (checkmate stale sync)', () => {
        const client = {
            mode: GameMode.Chess,
            gameStatus: 'ended',
            winner: Player.Black,
            winReason: 'chess_checkmate',
            settings: { boardSize: 13, komi: 6.5 },
            chessPieces,
            moveHistory: [{ x: 6, y: 6, player: Player.Black }],
            currentPlayer: Player.None,
        } as LiveGameSession;
        const server = {
            ...client,
            gameStatus: 'playing',
            winner: undefined,
            winReason: undefined,
            currentPlayer: Player.White,
        } as LiveGameSession;

        const resolved = resolveChessPvePlayingSession(server, client);
        expect(resolved.gameStatus).toBe('ended');
        expect(resolved.winner).toBe(Player.Black);
        expect(resolved.winReason).toBe('chess_checkmate');
    });
});
