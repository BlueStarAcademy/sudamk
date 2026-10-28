import { describe, expect, it } from 'vitest';
import { Player } from '../../../types/index.js';
import {
    pickRicherWsBoardSnapshot,
    resolveChessPvePlayingSession,
    resolvePveScoringBoardAndMoveHistory,
    resolveStrategicPvePlayingBoardAndMoveHistory,
    replayStrategicBoardFromMoveHistory,
    deriveBoardFromMoveHistoryAndBaseStones,
    shouldResolveStrategicPlayingBoardForMatchAxis,
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

    it('replays onto server board when client MH is longer but board omitted (slim packet)', () => {
        const server = {
            settings: { boardSize: 3 },
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
            boardState: [
                [Player.Black, Player.None, Player.None],
                [Player.None, Player.None, Player.None],
                [Player.None, Player.None, Player.None],
            ],
        } as LiveGameSession;
        const client = {
            settings: { boardSize: 3 },
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.White },
            ],
        } as LiveGameSession;
        delete (client as any).boardState;

        const resolved = resolvePveScoringBoardAndMoveHistory(server, client);
        expect(resolved.moveHistory).toHaveLength(2);
        expect(resolved.boardState?.[1]?.[1]).toBe(Player.White);
        expect(resolved.boardState?.[0]?.[0]).toBe(Player.Black);
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

    it('keeps client when scoring server snapshot diverges from displayed PVE sequence', () => {
        const client = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.White },
                { x: 2, y: 1, player: Player.Black },
            ],
            boardState: [
                [Player.Black, Player.None, Player.None],
                [Player.None, Player.White, Player.Black],
                [Player.None, Player.None, Player.None],
            ],
        } as LiveGameSession;
        const server = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 2, y: 2, player: Player.White },
                { x: 2, y: 1, player: Player.Black },
                { x: 1, y: 2, player: Player.White },
            ],
            boardState: [
                [Player.Black, Player.None, Player.None],
                [Player.None, Player.None, Player.Black],
                [Player.None, Player.White, Player.White],
            ],
        } as LiveGameSession;

        const resolved = resolvePveScoringBoardAndMoveHistory(server, client);
        expect(resolved.moveHistory).toEqual(client.moveHistory);
        expect(resolved.boardState?.[1]?.[1]).toBe(Player.White);
        expect(resolved.boardState?.[2]?.[1]).toBe(Player.None);
    });
});

describe('pickRicherWsBoardSnapshot', () => {
    it('does not pick a longer deferred snapshot when it diverges from the displayed prefix', () => {
        const client = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.White },
                { x: 2, y: 1, player: Player.Black },
            ],
        } as LiveGameSession;
        const pendingDeferred = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 2, y: 2, player: Player.White },
                { x: 2, y: 1, player: Player.Black },
                { x: 1, y: 2, player: Player.White },
            ],
        } as LiveGameSession;

        expect(pickRicherWsBoardSnapshot(client, pendingDeferred)).toBe(client);
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

    it('prefers longer server board even when optimistic client history diverges at last move', () => {
        const client = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 0, player: Player.White },
            ],
            boardState: [
                [Player.Black, Player.White, Player.None],
                [Player.None, Player.None, Player.None],
                [Player.None, Player.None, Player.None],
            ],
            settings: { boardSize: 3 },
        } as LiveGameSession;
        const server = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 2, y: 0, player: Player.White },
                { x: 1, y: 1, player: Player.Black },
            ],
            boardState: [
                [Player.Black, Player.None, Player.White],
                [Player.None, Player.Black, Player.None],
                [Player.None, Player.None, Player.None],
            ],
            settings: { boardSize: 3 },
        } as LiveGameSession;

        const resolved = resolveStrategicPvePlayingBoardAndMoveHistory(server, client);
        expect(resolved.moveHistory).toHaveLength(3);
        expect(resolved.boardState?.[0]?.[2]).toBe(Player.White);
        expect(resolved.boardState?.[1]?.[1]).toBe(Player.Black);
    });

    it('keeps client when same-length stale server has diverged AI stone position', () => {
        const client = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.White },
            ],
            boardState: boardWithWhiteAtCenter(),
            settings: { boardSize: 3 },
        } as LiveGameSession;
        const server = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 2, y: 2, player: Player.White },
            ],
            boardState: [
                [Player.None, Player.None, Player.None],
                [Player.None, Player.None, Player.None],
                [Player.None, Player.None, Player.White],
            ],
            settings: { boardSize: 3 },
        } as LiveGameSession;

        const resolved = resolveStrategicPvePlayingBoardAndMoveHistory(server, client);
        expect(resolved.moveHistory).toHaveLength(2);
        expect(resolved.moveHistory?.[1]).toEqual({ x: 1, y: 1, player: Player.White });
        expect(resolved.boardState?.[1]?.[1]).toBe(Player.White);
        expect(resolved.boardState?.[2]?.[2]).toBe(Player.None);
    });

    it('keeps client when a later slim packet diverges from the already displayed AI move', () => {
        const client = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.White },
                { x: 2, y: 1, player: Player.Black },
            ],
            boardState: [
                [Player.Black, Player.None, Player.None],
                [Player.None, Player.White, Player.Black],
                [Player.None, Player.None, Player.None],
            ],
            settings: { boardSize: 3 },
        } as LiveGameSession;
        const staleServer = {
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 2, y: 2, player: Player.White },
                { x: 2, y: 1, player: Player.Black },
                { x: 1, y: 2, player: Player.White },
            ],
            boardState: undefined,
            settings: { boardSize: 3 },
        } as LiveGameSession;

        const resolved = resolveStrategicPvePlayingBoardAndMoveHistory(staleServer, client);
        expect(resolved.moveHistory).toEqual(client.moveHistory);
        expect(resolved.boardState?.[1]?.[1]).toBe(Player.White);
        expect(resolved.boardState?.[2]?.[2]).toBe(Player.None);
        expect(resolved.boardState?.[2]?.[1]).toBe(Player.None);
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

describe('hidden reveal finalization (board changes without a new move)', () => {
    const empty5 = () =>
        Array.from({ length: 5 }, () => Array(5).fill(Player.None)) as number[][];
    // Black hidden at (1,1) captures White at (2,1); surrounding black at (2,0),(2,2),(3,1)
    const history = [
        { x: 2, y: 1, player: Player.White },
        { x: 2, y: 0, player: Player.Black },
        { x: 2, y: 2, player: Player.Black },
        { x: 3, y: 1, player: Player.Black },
        { x: 1, y: 1, player: Player.Black },
    ];
    const preRevealBoard = () => {
        const b = empty5();
        b[1][2] = Player.White;
        b[0][2] = Player.Black;
        b[2][2] = Player.Black;
        b[1][3] = Player.Black;
        return b;
    };

    it('replays board when leaving hidden_reveal_animating so capturing hidden stone appears and captured stone is gone', () => {
        // Merged "server" snapshot after reveal: playing, slim (board inherited from pre-reveal client)
        const server = {
            gameStatus: 'playing',
            moveHistory: history,
            boardState: preRevealBoard(),
            settings: { boardSize: 5 },
        } as unknown as LiveGameSession;
        const client = {
            gameStatus: 'hidden_reveal_animating',
            moveHistory: history,
            boardState: preRevealBoard(),
            settings: { boardSize: 5 },
        } as unknown as LiveGameSession;

        const resolved = resolveStrategicPvePlayingBoardAndMoveHistory(server, client);
        expect(resolved.boardState?.[1]?.[1]).toBe(Player.Black);
        expect(resolved.boardState?.[1]?.[2]).toBe(Player.None);
        expect(resolved.boardState?.[0]?.[2]).toBe(Player.Black);
    });

    it('does not replay when previous status was not hidden reveal (same-length stale packets keep client board)', () => {
        const server = {
            gameStatus: 'playing',
            moveHistory: history,
            boardState: preRevealBoard(),
            settings: { boardSize: 5 },
        } as unknown as LiveGameSession;
        const client = {
            gameStatus: 'playing',
            moveHistory: history,
            boardState: preRevealBoard(),
            settings: { boardSize: 5 },
        } as unknown as LiveGameSession;

        const resolved = resolveStrategicPvePlayingBoardAndMoveHistory(server, client);
        // Without the reveal transition the stale-board guard keeps the merged board as-is.
        expect(resolved.boardState?.[1]?.[2]).toBe(Player.White);
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

    it('keeps client when longer chess PVE server snapshot diverges from displayed prefix', () => {
        const client = {
            mode: GameMode.Chess,
            gameStatus: 'playing',
            settings: { boardSize: 13, komi: 6.5 },
            chessPieces,
            moveHistory: [
                { x: 6, y: 6, player: Player.Black },
                { x: 7, y: 7, player: Player.White },
                { x: 5, y: 5, player: Player.Black },
            ],
            currentPlayer: Player.White,
        } as LiveGameSession;
        const server = {
            ...client,
            moveHistory: [
                { x: 6, y: 6, player: Player.Black },
                { x: 8, y: 8, player: Player.White },
                { x: 5, y: 5, player: Player.Black },
                { x: 4, y: 4, player: Player.White },
            ],
            currentPlayer: Player.Black,
        } as LiveGameSession;

        const resolved = resolveChessPvePlayingSession(server, client);
        expect(resolved.moveHistory).toEqual(client.moveHistory);
        expect(resolved.boardState![7]![7]).toBe(Player.White);
        expect(resolved.boardState![8]![8]).toBe(Player.None);
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

    it('PVP preferServer: same-length divergent last move takes server stone (spam-click desync)', () => {
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
            lastMove: { x: 7, y: 7 },
        } as LiveGameSession;
        const client = {
            ...server,
            // 낙관적 착수가 서버와 다른 교차점에 고정된 상태
            moveHistory: [
                { x: 6, y: 6, player: Player.Black },
                { x: 5, y: 5, player: Player.White },
            ],
            currentPlayer: Player.Black,
            lastMove: { x: 5, y: 5 },
        } as LiveGameSession;

        const resolved = resolveChessPvePlayingSession(server, client, {
            preferServerOnHistoryConflict: true,
        });
        expect(resolved.moveHistory![1]).toEqual({ x: 7, y: 7, player: Player.White });
        expect(resolved.boardState![7]![7]).toBe(Player.White);
        expect(resolved.boardState![5]![5]).toBe(Player.None);
        expect(resolved.currentPlayer).toBe(Player.Black);
    });

    it('PVE default: same-length divergent last move keeps client (AI delay display)', () => {
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
});

describe('shouldResolveStrategicPlayingBoardForMatchAxis', () => {
    it('includes mixed_pair for slim WS board replay', () => {
        expect(shouldResolveStrategicPlayingBoardForMatchAxis('mixed_pair')).toBe(true);
        expect(shouldResolveStrategicPlayingBoardForMatchAxis('pvp')).toBe(true);
        expect(shouldResolveStrategicPlayingBoardForMatchAxis('pve')).toBe(true);
    });
});

describe('resolveStrategicPlayingBoardAndMoveHistory for mixed_pair slim server', () => {
    it('derives board when server moveHistory is ahead without boardState', () => {
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
});
