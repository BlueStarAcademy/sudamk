import { describe, expect, it } from 'vitest';
import { Player } from '../../../types/index.js';
import {
    resolvePveScoringBoardAndMoveHistory,
    resolveStrategicPvePlayingBoardAndMoveHistory,
} from '../../../utils/deferredWsBoardSnapshot.js';
import type { LiveGameSession } from '../../../types/index.js';

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
});
