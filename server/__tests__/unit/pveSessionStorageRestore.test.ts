import { describe, expect, it } from 'vitest';
import { Player, GameMode } from '../../../types/enums.js';
import {
    augmentPveFromSessionStorageSnapshot,
    isRecoverablePveSessionStorageSnapshot,
    loadRecoverablePveGameFromSessionStorage,
} from '../../../utils/pveSessionStorageRestore.js';
import type { LiveGameSession } from '../../../types/index.js';
import { aiUserId } from '../../../shared/constants/auth.js';

const shell = (id: string): LiveGameSession =>
    ({
        id,
        mode: GameMode.Standard,
        gameCategory: 'singleplayer',
        isSinglePlayer: true,
        isAiGame: true,
        player1: { id: 'user-1', username: 'u1', nickname: 'u1' } as any,
        player2: { id: aiUserId, username: 'ai', nickname: 'ai' } as any,
        blackPlayerId: 'user-1',
        whitePlayerId: aiUserId,
        currentPlayer: Player.Black,
        settings: { boardSize: 9, komi: 0.5 },
        boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        gameStatus: 'pending',
    }) as LiveGameSession;

describe('pveSessionStorageRestore', () => {
    it('진행 중 스냅샷은 복구 가능으로 판정', () => {
        const parsed = {
            gameId: 'sp-game-1',
            moveHistory: [{ x: 1, y: 1, player: Player.Black }],
            boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        };
        (parsed.boardState as Player[][])[1][1] = Player.Black;
        expect(isRecoverablePveSessionStorageSnapshot(parsed)).toBe(true);
    });

    it('INITIAL_STATE 빈 판 위에 sessionStorage 보드를 병합', () => {
        const incoming = shell('sp-game-1');
        const board = Array.from({ length: 9 }, () => Array(9).fill(Player.None));
        board[2][2] = Player.Black;
        const parsed = {
            gameId: 'sp-game-1',
            boardState: board,
            moveHistory: [{ x: 2, y: 2, player: Player.Black }],
            gameStatus: 'playing',
            currentPlayer: Player.White,
        };
        const merged = augmentPveFromSessionStorageSnapshot(incoming, parsed);
        expect(merged.boardState?.[2]?.[2]).toBe(Player.Black);
        expect(merged.gameStatus).toBe('playing');
        expect(merged.moveHistory?.length).toBe(1);
    });

    it('문양돌만 있는 배치 단계도 복구 가능', () => {
        const parsed = {
            gameId: 'sp-game-1',
            blackPatternStones: [{ x: 1, y: 1 }],
            boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
            gameStatus: 'playing',
        };
        expect(isRecoverablePveSessionStorageSnapshot(parsed)).toBe(true);
        const merged = augmentPveFromSessionStorageSnapshot(shell('sp-game-1'), parsed);
        expect(merged.blackPatternStones?.length).toBe(1);
    });

    it('체스 바둑 오프닝(바둑 수순 0)은 sessionStorage 복구하지 않음', () => {
        const board = Array.from({ length: 13 }, () => Array(13).fill(Player.None));
        board[6][6] = Player.Black;
        const chessShell = {
            ...shell('ai-chess-1'),
            mode: GameMode.Chess,
            isSinglePlayer: false,
            gameCategory: undefined,
            boardState: board,
            chessPieces: [{ id: 'b-king', type: 'king', owner: Player.Black, x: 6, y: 6 }],
        } as LiveGameSession;
        const parsed = {
            gameId: 'ai-chess-1',
            mode: GameMode.Chess,
            isAiGame: true,
            boardState: board,
            moveHistory: [],
            totalTurns: 100,
            gameStatus: 'pending',
        };
        expect(isRecoverablePveSessionStorageSnapshot(parsed)).toBe(true);
        expect(augmentPveFromSessionStorageSnapshot(chessShell, parsed)).toBe(chessShell);
        const storage = new Map<string, string>();
        storage.set('gameState_ai-chess-1', JSON.stringify(parsed));
        const prev = globalThis.sessionStorage;
        Object.defineProperty(globalThis, 'sessionStorage', {
            configurable: true,
            value: {
                getItem: (key: string) => storage.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    storage.set(key, value);
                },
                removeItem: (key: string) => {
                    storage.delete(key);
                },
            },
        });
        try {
            expect(
                loadRecoverablePveGameFromSessionStorage('ai-chess-1', {
                    shell: chessShell,
                    userId: 'user-1',
                }),
            ).toBeNull();
        } finally {
            Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: prev });
        }
    });
});
