import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { handleDiceGoAction, updateDiceGoState } from '../../modes/diceGo.js';
import { handleThiefAction, updateThiefState } from '../../modes/thief.js';

function emptyBoard(size = 9): number[][] {
    return Array.from({ length: size }, () => Array(size).fill(Player.None));
}

describe('dice/thief PVP roll anim finalize', () => {
    it('DICE_ROLL animating resolves to placing or turn handoff after duration', async () => {
        const p1 = { id: 'user-p1', nickname: 'P1' } as LiveGameSession['player1'];
        const p2 = { id: 'user-p2', nickname: 'P2' } as LiveGameSession['player2'];
        const game = {
            id: 'dice-pvp-roll-1',
            mode: GameMode.Dice,
            gameStatus: 'dice_rolling',
            isAiGame: false,
            currentPlayer: Player.Black,
            player1: p1,
            player2: p2,
            blackPlayerId: p1.id,
            whitePlayerId: p2.id,
            boardState: emptyBoard(),
            moveHistory: [],
            settings: { boardSize: 9, diceGoRounds: 3, timeControl: false },
            round: 1,
        } as LiveGameSession;

        await handleDiceGoAction(
            {} as any,
            game,
            { type: 'DICE_ROLL', userId: p1.id, payload: { gameId: game.id } } as any,
            p1,
        );
        expect(game.gameStatus).toBe('dice_rolling_animating');
        const anim = game.animation as { startTime: number; duration: number; type: string };
        expect(anim.type).toBe('dice_roll_main');

        updateDiceGoState(game, anim.startTime + anim.duration - 1);
        expect(game.gameStatus).toBe('dice_rolling_animating');

        updateDiceGoState(game, anim.startTime + anim.duration + 1);
        expect(['dice_placing', 'dice_rolling']).toContain(game.gameStatus);
        expect(game.animation).toBeNull();
    });

    it('THIEF_ROLL_DICE animating resolves to thief_placing after duration', async () => {
        const p1 = { id: 'user-p1', nickname: 'P1' } as LiveGameSession['player1'];
        const p2 = { id: 'user-p2', nickname: 'P2' } as LiveGameSession['player2'];
        const game = {
            id: 'thief-pvp-roll-1',
            mode: GameMode.Thief,
            gameStatus: 'thief_rolling',
            isAiGame: false,
            currentPlayer: Player.Black,
            player1: p1,
            player2: p2,
            blackPlayerId: p1.id,
            whitePlayerId: p2.id,
            thiefPlayerId: p1.id,
            policePlayerId: p2.id,
            boardState: emptyBoard(),
            moveHistory: [],
            settings: { boardSize: 9, timeControl: false },
            turnInRound: 1,
        } as LiveGameSession;

        await handleThiefAction(
            {} as any,
            game,
            { type: 'THIEF_ROLL_DICE', userId: p1.id, payload: { gameId: game.id } } as any,
            p1,
        );
        expect(game.gameStatus).toBe('thief_rolling_animating');
        const anim = game.animation as { startTime: number; duration: number };
        expect(anim.duration).toBe(1500);

        updateThiefState(game, anim.startTime + anim.duration - 1);
        expect(game.gameStatus).toBe('thief_rolling_animating');

        updateThiefState(game, anim.startTime + anim.duration + 1);
        expect(game.gameStatus).toBe('thief_placing');
        expect(game.animation).toBeNull();
    });
});
