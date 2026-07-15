import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { AlkkagiStone, LiveGameSession } from '../../../shared/types/index.js';
import { handleCurlingAction, updateCurlingState } from '../../modes/curling.js';

function makePvpCurlingPlaying(): LiveGameSession {
    const p1 = { id: 'user-p1', nickname: 'P1' } as LiveGameSession['player1'];
    const p2 = { id: 'user-p2', nickname: 'P2' } as LiveGameSession['player2'];
    return {
        id: 'curling-pvp-flick-1',
        mode: GameMode.Curling,
        gameStatus: 'curling_playing',
        isAiGame: false,
        currentPlayer: Player.Black,
        player1: p1,
        player2: p2,
        blackPlayerId: p1.id,
        whitePlayerId: p2.id,
        curlingRound: 1,
        stonesThrownThisRound: { [p1.id]: 0, [p2.id]: 0 },
        curlingStones: [] as AlkkagiStone[],
        settings: {
            curlingStoneCount: 5,
            curlingRounds: 3,
            timeControl: false,
        },
    } as LiveGameSession;
}

describe('curling PVP flick turn handoff', () => {
    it('CURLING_FLICK_STONE enters animating without flipping currentPlayer yet', async () => {
        const game = makePvpCurlingPlaying();
        const result = await handleCurlingAction(
            {} as any,
            game,
            {
                type: 'CURLING_FLICK_STONE',
                userId: game.player1.id,
                payload: {
                    gameId: game.id,
                    launchPosition: { x: 420, y: 800 },
                    velocity: { x: 0, y: -20 },
                },
            } as any,
            game.player1,
        );
        expect(result).toEqual({});
        expect(game.gameStatus).toBe('curling_animating');
        expect(game.currentPlayer).toBe(Player.Black);
        expect(game.animation?.type).toBe('curling_flick');
    });

    it('after flick duration, updateCurlingState switches turn to the opponent', async () => {
        const game = makePvpCurlingPlaying();
        await handleCurlingAction(
            {} as any,
            game,
            {
                type: 'CURLING_FLICK_STONE',
                userId: game.player1.id,
                payload: {
                    gameId: game.id,
                    launchPosition: { x: 420, y: 800 },
                    velocity: { x: 0, y: -15 },
                },
            } as any,
            game.player1,
        );
        const anim = game.animation as { startTime: number; duration: number };
        expect(anim.duration).toBe(3000);

        updateCurlingState(game, anim.startTime + anim.duration - 1);
        expect(game.gameStatus).toBe('curling_animating');
        expect(game.currentPlayer).toBe(Player.Black);

        updateCurlingState(game, anim.startTime + anim.duration);
        expect(game.gameStatus).toBe('curling_playing');
        expect(game.currentPlayer).toBe(Player.White);
        expect(game.animation).toBeNull();
    });
});
