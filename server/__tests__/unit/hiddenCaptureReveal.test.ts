import { describe, expect, it } from 'vitest';
import { aiUserId } from '../../aiPlayer.js';
import { updateGameStateAfterMove } from '../../../hooks/useClientGameState.js';
import { GameCategory, GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';

const emptyBoard = (size: number) =>
    Array.from({ length: size }, () => Array(size).fill(Player.None));

const makeTowerHiddenGame = (overrides: Partial<LiveGameSession> = {}): LiveGameSession =>
    ({
        id: 'tower-hidden-reveal-test',
        mode: GameMode.Hidden,
        gameCategory: 'tower' as GameCategory,
        isSinglePlayer: false,
        isAiGame: true,
        stageId: 'tower-21',
        towerFloor: 21,
        blackPlayerId: 'human-1',
        whitePlayerId: aiUserId,
        currentPlayer: Player.Black,
        gameStatus: 'playing',
        settings: { boardSize: 5, hiddenStoneCount: 1, komi: 0.5 },
        moveHistory: [{ x: 1, y: 1, player: Player.Black }],
        hiddenMoves: { 0: true },
        humanHiddenStonePoints: [{ x: 1, y: 1, player: Player.Black }],
        boardState: (() => {
            const board = emptyBoard(5);
            board[1][0] = Player.White;
            board[1][1] = Player.Black;
            return board;
        })(),
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        permanentlyRevealedStones: [],
        ...overrides,
    }) as LiveGameSession;

describe('hidden capture full reveal (tower PVE)', () => {
    it('starts hidden_reveal_animating when a human hidden stone contributed to capture', () => {
        const game = makeTowerHiddenGame();
        const newBoardState = emptyBoard(5);
        newBoardState[1][1] = Player.Black;
        newBoardState[1][2] = Player.Black;

        const result = updateGameStateAfterMove(
            game,
            {
                x: 2,
                y: 1,
                newBoardState,
                capturedStones: [{ x: 0, y: 1 }],
                newKoInfo: null,
                movePlayer: Player.Black,
            },
            'tower',
        );

        expect(result.updatedGame.gameStatus).toBe('hidden_reveal_animating');
        expect(result.updatedGame.animation?.type).toBe('hidden_reveal');
        expect(result.updatedGame.pendingCapture?.stones).toEqual([{ x: 0, y: 1 }]);
        expect(
            (result.updatedGame.animation as { stones?: Array<{ point: { x: number; y: number } }> })?.stones?.some(
                (stone) => stone.point.x === 1 && stone.point.y === 1,
            ),
        ).toBe(true);
    });
});
