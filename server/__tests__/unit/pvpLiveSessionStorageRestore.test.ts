import { describe, expect, it } from 'vitest';
import { Player, GameMode } from '../../../types/enums.js';
import type { LiveGameSession } from '../../../types/index.js';
import {
    augmentLiveSessionFromSessionStorageSnapshot,
    augmentPveFromSessionStorageSnapshot,
} from '../../../utils/pveSessionStorageRestore.js';
import { aiUserId } from '../../../shared/constants/auth.js';

const pvpShell = (): LiveGameSession =>
    ({
        id: 'pvp-game-1',
        mode: GameMode.Standard,
        gameCategory: 'normal',
        isAiGame: false,
        player1: { id: 'u1' } as any,
        player2: { id: 'u2' } as any,
        blackPlayerId: 'u1',
        whitePlayerId: 'u2',
        currentPlayer: Player.Black,
        settings: { boardSize: 9, komi: 0.5 },
        boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        moveHistory: [{ x: 0, y: 0, player: Player.Black }],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        gameStatus: 'playing',
    }) as LiveGameSession;

describe('augmentLiveSessionFromSessionStorageSnapshot', () => {
    it('does not merge stale storage when server moveHistory is current', () => {
        const incoming = pvpShell();
        const board = Array.from({ length: 9 }, () => Array(9).fill(Player.None));
        board[0][0] = Player.Black;
        board[1][1] = Player.White;
        incoming.boardState = board as LiveGameSession['boardState'];
        incoming.moveHistory = [
            { x: 0, y: 0, player: Player.Black },
            { x: 1, y: 1, player: Player.White },
        ];

        const parsed = {
            gameId: 'pvp-game-1',
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
            boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        };
        (parsed.boardState as Player[][])[0][0] = Player.Black;

        const merged = augmentLiveSessionFromSessionStorageSnapshot(incoming, parsed);
        expect(merged.moveHistory?.length).toBe(2);
        expect(merged.boardState?.[1]?.[1]).toBe(Player.White);
    });

    it('merges optimistic storage when ahead of server on moves', () => {
        const incoming = pvpShell();
        const board = Array.from({ length: 9 }, () => Array(9).fill(Player.None));
        board[0][0] = Player.Black;
        board[2][2] = Player.White;
        const parsed = {
            gameId: 'pvp-game-1',
            moveHistory: [
                { x: 0, y: 0, player: Player.Black },
                { x: 2, y: 2, player: Player.White },
            ],
            boardState: board,
            currentPlayer: Player.Black,
        };
        const merged = augmentLiveSessionFromSessionStorageSnapshot(incoming, parsed);
        expect(merged.moveHistory?.length).toBe(2);
        expect(merged.boardState?.[2]?.[2]).toBe(Player.White);
    });

    it('does not restore gameStatus from storage on terminal incoming', () => {
        const incoming = { ...pvpShell(), gameStatus: 'scoring' as const };
        const parsed = {
            gameId: 'pvp-game-1',
            gameStatus: 'playing',
            moveHistory: [{ x: 0, y: 0, player: Player.Black }, { x: 1, y: 1, player: Player.White }],
        };
        const merged = augmentLiveSessionFromSessionStorageSnapshot(incoming, parsed);
        expect(merged.gameStatus).toBe('scoring');
        expect(merged.moveHistory?.length).toBe(1);
    });

    it('delegates PVE sessions to augmentPveFromSessionStorageSnapshot', () => {
        const incoming = {
            ...pvpShell(),
            gameCategory: 'singleplayer',
            isSinglePlayer: true,
            isAiGame: true,
            player2: { id: aiUserId } as any,
            whitePlayerId: aiUserId,
            gameStatus: 'pending' as const,
            moveHistory: [],
        } as LiveGameSession;
        const parsed = {
            gameId: 'pvp-game-1',
            gameStatus: 'playing',
            moveHistory: [{ x: 0, y: 0, player: Player.Black }],
        };
        const viaLive = augmentLiveSessionFromSessionStorageSnapshot(incoming, parsed);
        const viaPve = augmentPveFromSessionStorageSnapshot(incoming, parsed);
        expect(viaLive.gameStatus).toBe(viaPve.gameStatus);
    });
});
