import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/entities.js';
import {
    countNonPassMoves,
    recordChessEvent,
    recordMissileEvent,
    recordScanEvent,
    snapshotChessSetupIfNeeded,
} from '../../../shared/utils/gameRecordSessionEvents.js';
import {
    applyUniformKifuViewToExtras,
    buildGameRecordBoardExtras,
    defaultUniformKifuView,
    gameRecordUsesUniformView,
    restoreBaseStonesFromMissileEvents,
    restoreMoveHistoryCoordsFromMissileEvents,
} from '../../../shared/utils/gameRecordBoardExtras.js';
import { applyGameRecordReplay } from '../../../utils/gameRecordReplay.js';
import { generateSgfFromGame } from '../../../utils/sgfGenerator.js';
import { applyChessMoveToSession, generateChessGoInitialPieces, applyChessPiecesToBoard } from '../../../shared/utils/chessGoRules.js';

function emptyBoard(size: number) {
    return Array.from({ length: size }, () => Array(size).fill(Player.None));
}

function baseGame(overrides: Partial<LiveGameSession> = {}): LiveGameSession {
    const boardState = emptyBoard(9);
    return {
        id: 'kifu-test',
        mode: GameMode.Base,
        settings: { boardSize: 9, komi: 0.5, timeLimit: 0, byoyomiTime: 0, byoyomiCount: 0 },
        player1: { id: 'p1', nickname: 'Black' } as LiveGameSession['player1'],
        player2: { id: 'p2', nickname: 'White' } as LiveGameSession['player2'],
        blackPlayerId: 'p1',
        whitePlayerId: 'p2',
        gameStatus: 'ended',
        currentPlayer: Player.Black,
        boardState,
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        winner: Player.Black,
        winReason: 'score',
        createdAt: Date.now(),
        ...overrides,
    } as LiveGameSession;
}

describe('gameRecordSessionEvents', () => {
    it('records a missile launch once and skips duplicate from/to at the same count', () => {
        const game = baseGame({ mode: GameMode.Missile });
        recordMissileEvent(game, {
            moveIndex: 0,
            afterNonPassCount: 1,
            player: Player.Black,
            from: { x: 1, y: 1 },
            to: { x: 1, y: 4 },
        });
        recordMissileEvent(game, {
            moveIndex: 0,
            afterNonPassCount: 1,
            player: Player.Black,
            from: { x: 1, y: 1 },
            to: { x: 1, y: 4 },
        });
        expect(game.missileEvents).toHaveLength(1);
    });

    it('records scan hits and misses', () => {
        const game = baseGame({ mode: GameMode.Hidden, moveHistory: [{ player: Player.Black, x: 2, y: 2 }] });
        recordScanEvent(game, {
            afterNonPassCount: countNonPassMoves(game.moveHistory),
            player: Player.White,
            x: 2,
            y: 2,
            success: true,
        });
        recordScanEvent(game, {
            afterNonPassCount: 1,
            player: Player.White,
            x: 0,
            y: 0,
            success: false,
        });
        expect(game.scanEvents).toEqual([
            { afterNonPassCount: 1, player: Player.White, x: 2, y: 2, success: true },
            { afterNonPassCount: 1, player: Player.White, x: 0, y: 0, success: false },
        ]);
    });

    it('records a chess move and snapshots setup before the first move', () => {
        const pieces = generateChessGoInitialPieces(13);
        const boardState = applyChessPiecesToBoard(emptyBoard(13), pieces);
        const session = baseGame({
            mode: GameMode.Chess,
            settings: { boardSize: 13, komi: 6.5, timeLimit: 0, byoyomiTime: 0, byoyomiCount: 0 },
            boardState,
            chessPieces: pieces.map((p) => ({ ...p })),
        });
        snapshotChessSetupIfNeeded(session);
        const pawn = session.chessPieces!.find((p) => p.owner === Player.Black && p.type === 'pawn' && p.x === 5)!;
        const from = { x: pawn.x, y: pawn.y };
        applyChessMoveToSession(session, pawn.id, 5, 9, Player.Black);
        expect(session.chessSetup?.length).toBe(pieces.length);
        expect(session.chessSetup?.find((p) => p.id === pawn.id)).toMatchObject(from);
        expect(session.chessEvents).toHaveLength(1);
        expect(session.chessEvents![0]).toMatchObject({
            pieceId: pawn.id,
            from,
            to: { x: 5, y: 9 },
        });
    });
});

describe('gameRecordBoardExtras + SGF', () => {
    it('emits AB/AW for base stones and restores missile origin coords in SGF', () => {
        const game = baseGame({
            mode: GameMode.Missile,
            settings: { boardSize: 9, komi: 0.5, missileCount: 3, timeLimit: 0, byoyomiTime: 0, byoyomiCount: 0 },
            baseStones: [{ x: 2, y: 6, player: Player.Black }],
            moveHistory: [
                { player: Player.Black, x: 4, y: 4 },
                { player: Player.White, x: 3, y: 3 },
            ],
            missileEvents: [
                {
                    moveIndex: 0,
                    afterNonPassCount: 2,
                    player: Player.Black,
                    from: { x: 1, y: 4 },
                    to: { x: 4, y: 4 },
                },
            ],
        });
        game.moveHistory[0] = { player: Player.Black, x: 4, y: 4 };

        const restored = restoreMoveHistoryCoordsFromMissileEvents(game.moveHistory, game.missileEvents);
        expect(restored[0]).toMatchObject({ x: 1, y: 4 });

        const sgf = generateSgfFromGame(game, game.player1 as any, game.player2 as any);
        expect(sgf).toContain('AB[cg]');
        expect(sgf).toContain(';B[be]');
        expect(sgf).toContain('C[미사일: (1,4) -> (4,4)]');
        expect(sgf).toMatch(/AB\[cg\]/);
        expect(sgf).toMatch(/;B\[be\]/);
    });

    it('builds hidden and scan extras and replays overlays', () => {
        const game = baseGame({
            mode: GameMode.Hidden,
            moveHistory: [
                { player: Player.Black, x: 2, y: 2 },
                { player: Player.White, x: 5, y: 5 },
            ],
            hiddenMoves: { 0: true },
            scanEvents: [
                { afterNonPassCount: 1, player: Player.White, x: 2, y: 2, success: true },
                { afterNonPassCount: 2, player: Player.Black, x: 0, y: 1, success: false },
            ],
        });
        const extras = buildGameRecordBoardExtras(game);
        expect(extras?.hiddenMoveIndices).toEqual([0]);
        expect(extras?.scanEvents).toHaveLength(2);

        const replayAt1 = applyGameRecordReplay(9, [
            { player: Player.Black, x: 2, y: 2 },
            { player: Player.White, x: 5, y: 5 },
        ], extras, 1);
        expect(replayAt1.hiddenKeys.has('2,2')).toBe(true);
        expect(replayAt1.scanMarkers).toEqual([{ x: 2, y: 2, success: true, player: Player.White }]);

        const replayAt2 = applyGameRecordReplay(9, [
            { player: Player.Black, x: 2, y: 2 },
            { player: Player.White, x: 5, y: 5 },
        ], extras, 2);
        expect(replayAt2.scanMarkers).toHaveLength(2);
    });

    it('replays missile relocation and marks the destination stone', () => {
        const extras = {
            missileEvents: [
                {
                    moveIndex: 0,
                    afterNonPassCount: 1,
                    player: Player.Black,
                    from: { x: 1, y: 1 },
                    to: { x: 1, y: 4 },
                    captured: [{ x: 1, y: 3 }],
                },
            ],
        };
        const moves = [{ player: Player.Black, x: 1, y: 1 }];
        const before = applyGameRecordReplay(9, moves, extras, 0);
        expect(before.board[1][1]).toBe(Player.None);

        const afterMove = applyGameRecordReplay(9, moves, extras, 1);
        expect(afterMove.board[1][1]).toBe(Player.None);
        expect(afterMove.board[4][1]).toBe(Player.Black);
        expect(afterMove.missileMarkedKeys.has('1,4')).toBe(true);
        expect(afterMove.board[3][1]).toBe(Player.None);
    });

    it('restores base stone origin after a missile moved it', () => {
        const stones = restoreBaseStonesFromMissileEvents(
            [{ x: 4, y: 4, player: Player.Black }],
            [
                {
                    moveIndex: -1,
                    afterNonPassCount: 0,
                    player: Player.Black,
                    from: { x: 2, y: 2 },
                    to: { x: 4, y: 4 },
                },
            ],
        );
        expect(stones[0]).toMatchObject({ x: 2, y: 2, player: Player.Black });
    });

    it('toggles uniform kifu view between single color and actual black/white', () => {
        const extras = { uniformStoneDisplayColor: Player.White };
        const moves = [
            { player: Player.Black, x: 0, y: 0 },
            { player: Player.White, x: 1, y: 0 },
        ];

        expect(gameRecordUsesUniformView(GameMode.Uniform, undefined)).toBe(true);
        expect(gameRecordUsesUniformView(GameMode.Standard, undefined)).toBe(false);
        expect(gameRecordUsesUniformView(GameMode.Standard, extras)).toBe(true);
        expect(defaultUniformKifuView(extras)).toBe('white');
        expect(defaultUniformKifuView(undefined)).toBe('black');

        const asWhite = applyGameRecordReplay(9, moves, applyUniformKifuViewToExtras(extras, 'white'), 2);
        expect(asWhite.uniformStoneDisplayColor).toBe(Player.White);
        expect(asWhite.board[0][0]).toBe(Player.Black);
        expect(asWhite.board[0][1]).toBe(Player.White);

        const asBlack = applyGameRecordReplay(9, moves, applyUniformKifuViewToExtras(extras, 'black'), 2);
        expect(asBlack.uniformStoneDisplayColor).toBe(Player.Black);

        const actual = applyGameRecordReplay(9, moves, applyUniformKifuViewToExtras(extras, 'actual'), 2);
        expect(actual.uniformStoneDisplayColor).toBeNull();
    });

    it('keeps castle stones in extras and shows them from the empty board', () => {
        const game = baseGame({
            mode: GameMode.Castle,
            castleStonePoints: [
                { x: 4, y: 4 },
                { x: 2, y: 6 },
            ],
            moveHistory: [{ player: Player.Black, x: 0, y: 0 }],
        });
        const extras = buildGameRecordBoardExtras(game);
        expect(extras?.castleStonePoints).toEqual([
            { x: 4, y: 4 },
            { x: 2, y: 6 },
        ]);

        const beforeMoves = applyGameRecordReplay(9, [{ player: Player.Black, x: 0, y: 0 }], extras, 0);
        expect(beforeMoves.castleStonePoints).toEqual([
            { x: 4, y: 4 },
            { x: 2, y: 6 },
        ]);

        const afterMove = applyGameRecordReplay(9, [{ player: Player.Black, x: 0, y: 0 }], extras, 1);
        expect(afterMove.castleStonePoints).toHaveLength(2);
        expect(afterMove.board[0][0]).toBe(Player.Black);
    });
});
