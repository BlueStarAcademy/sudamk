import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { finalizeItemPhase } from '../../modes/finalizeItemPhase.js';

const missileAnimatingSession = (overrides: Partial<LiveGameSession> = {}): LiveGameSession => {
    const startTime = 2000;
    const boardState = Array.from({ length: 9 }, () => Array(9).fill(Player.None));
    boardState[1][1] = Player.Black;
    return {
        id: 'finalize-missile',
        mode: GameMode.Missile,
        gameCategory: 'normal',
        isSinglePlayer: false,
        isAiGame: false,
        gameStatus: 'missile_animating',
        currentPlayer: Player.Black,
        player1: { id: 'p1', username: 'p1', nickname: 'p1' } as any,
        player2: { id: 'p2', username: 'p2', nickname: 'p2' } as any,
        blackPlayerId: 'p1',
        whitePlayerId: 'p2',
        settings: { boardSize: 9, komi: 0.5, missileCount: 3, timeLimit: 0 },
        boardState,
        moveHistory: [{ player: Player.Black, x: 1, y: 1 }],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        animation: {
            type: 'missile',
            from: { x: 1, y: 1 },
            to: { x: 1, y: 3 },
            player: Player.Black,
            startTime,
            duration: 400,
        } as any,
        ...overrides,
    } as LiveGameSession;
};

describe('finalizeItemPhase(missile)', () => {
    it('clears animation, sets playing, records lastProcessedMissileAnimationTime', () => {
        const game = missileAnimatingSession();
        const changed = finalizeItemPhase(game, 'missile', 2500, {
            animationStartTime: 2000,
            skipBoardRelocation: true,
            reason: 'test-complete',
        });
        expect(changed).toBe(true);
        expect(game.gameStatus).toBe('playing');
        expect(game.animation).toBeNull();
        expect((game as any).lastProcessedMissileAnimationTime).toBe(2000);
    });

    it('applies board relocation when skipBoardRelocation is false', () => {
        const game = missileAnimatingSession();
        finalizeItemPhase(game, 'missile', 2500, { animationStartTime: 2000 });
        expect(game.boardState[1][1]).toBe(Player.None);
        expect(game.boardState[3][1]).toBe(Player.Black);
        expect(game.moveHistory[0]).toMatchObject({ x: 1, y: 3 });
    });

    it('duplicate-processed path still returns playing with null animation', () => {
        const game = missileAnimatingSession({ lastProcessedMissileAnimationTime: 2000 } as any);
        const changed = finalizeItemPhase(game, 'missile', 5000, {
            animationStartTime: 2000,
            cleanupOnly: true,
        });
        expect(changed).toBe(true);
        expect(game.gameStatus).toBe('playing');
        expect(game.animation).toBeNull();
    });
});

describe('finalizeItemPhase(scan)', () => {
    const scanAnimatingSession = (overrides: Partial<LiveGameSession> = {}): LiveGameSession =>
        ({
            id: 'finalize-scan',
            mode: GameMode.Hidden,
            gameCategory: 'normal',
            gameStatus: 'scanning_animating',
            currentPlayer: Player.Black,
            blackPlayerId: 'p1',
            whitePlayerId: 'p2',
            player1: { id: 'p1', nickname: 'p1' } as any,
            player2: { id: 'p2', nickname: 'p2' } as any,
            settings: { boardSize: 9, komi: 0.5, timeLimit: 0 },
            boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
            animation: {
                type: 'scan',
                playerId: 'p1',
                startTime: 1000,
                duration: 500,
            } as any,
            ...overrides,
        }) as LiveGameSession;

    it('clears animation and returns to playing after duration', () => {
        const game = scanAnimatingSession();
        const changed = finalizeItemPhase(game, 'scan', 1600);
        expect(changed).toBe(true);
        expect(game.gameStatus).toBe('playing');
        expect(game.animation).toBeNull();
        expect((game as any)._itemPhaseStateChanged).toBe(true);
    });

    it('resumes scanning selection when towerResumeScanning', () => {
        const game = scanAnimatingSession({
            animation: {
                type: 'scan',
                playerId: 'p1',
                startTime: 1000,
                duration: 500,
                success: true,
                towerResumeScanning: true,
            } as any,
        });
        const changed = finalizeItemPhase(game, 'scan', 1600, { resumeScanningSelection: true });
        expect(changed).toBe(true);
        expect(game.gameStatus).toBe('scanning');
        expect(game.animation).toBeNull();
    });
});

describe('finalizeItemPhase(hidden_selecting)', () => {
    it('consumes white hidden stone on hidden_placing timeout using itemPhaseActingPlayer', () => {
        const game = {
            id: 'finalize-hidden-timeout-white',
            mode: GameMode.Hidden,
            gameStatus: 'hidden_placing',
            currentPlayer: Player.Black,
            itemPhaseActingPlayer: Player.White,
            blackPlayerId: 'p1',
            whitePlayerId: 'p2',
            player1: { id: 'p1', nickname: '흑' } as any,
            player2: { id: 'p2', nickname: '백' } as any,
            settings: { hiddenStoneCount: 3, timeLimit: 0 },
            hidden_stones_p2: 2,
            hidden_stones_used_p2: 0,
        } as LiveGameSession;
        const changed = finalizeItemPhase(game, 'hidden_selecting', Date.now(), {
            selectingStatus: 'hidden_placing',
        });
        expect(changed).toBe(true);
        expect(game.hidden_stones_p2).toBe(1);
        expect(game.hidden_stones_used_p2).toBe(1);
        expect(game.currentPlayer).toBe(Player.White);
    });

    it('consumes hidden stone on hidden_placing timeout', () => {
        const game = {
            id: 'finalize-hidden-timeout',
            mode: GameMode.Hidden,
            gameStatus: 'hidden_placing',
            currentPlayer: Player.Black,
            blackPlayerId: 'p1',
            whitePlayerId: 'p2',
            player1: { id: 'p1', nickname: '흑' } as any,
            player2: { id: 'p2', nickname: '백' } as any,
            settings: { hiddenStoneCount: 3, timeLimit: 0 },
            hidden_stones_p1: 2,
            hidden_stones_used_p1: 0,
        } as LiveGameSession;
        const changed = finalizeItemPhase(game, 'hidden_selecting', Date.now(), {
            selectingStatus: 'hidden_placing',
        });
        expect(changed).toBe(true);
        expect(game.gameStatus).toBe('playing');
        expect(game.hidden_stones_p1).toBe(1);
        expect(game.hidden_stones_used_p1).toBe(1);
    });
});
