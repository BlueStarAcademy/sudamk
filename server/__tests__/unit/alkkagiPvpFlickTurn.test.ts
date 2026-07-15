import { describe, expect, it } from 'vitest';
import { GameMode, Player, AlkkagiPlacementType } from '../../../shared/types/enums.js';
import type { AlkkagiStone, LiveGameSession } from '../../../shared/types/index.js';
import { handleAlkkagiAction, updateAlkkagiState } from '../../modes/alkkagi.js';

function makePvpPlayingSession(): LiveGameSession {
    const p1 = { id: 'user-p1', nickname: 'P1' } as LiveGameSession['player1'];
    const p2 = { id: 'user-p2', nickname: 'P2' } as LiveGameSession['player2'];
    const stones: AlkkagiStone[] = [
        { id: 1, player: Player.Black, x: 200, y: 200, vx: 0, vy: 0, radius: 20, onBoard: true },
        { id: 2, player: Player.White, x: 400, y: 400, vx: 0, vy: 0, radius: 20, onBoard: true },
    ];
    return {
        id: 'alkkagi-pvp-flick-1',
        mode: GameMode.Alkkagi,
        gameStatus: 'alkkagi_playing',
        isAiGame: false,
        currentPlayer: Player.Black,
        player1: p1,
        player2: p2,
        blackPlayerId: p1.id,
        whitePlayerId: p2.id,
        alkkagiRound: 1,
        settings: {
            alkkagiPlacementType: AlkkagiPlacementType.TurnByTurn,
            alkkagiStoneCount: 5,
            alkkagiRounds: 1,
            timeControl: false,
        },
        alkkagiStones: stones,
        alkkagiStones_p1: [],
        alkkagiStones_p2: [],
        alkkagiStonesPlacedThisRound: { [p1.id]: 0, [p2.id]: 0 },
    } as LiveGameSession;
}

describe('alkkagi PVP flick turn handoff', () => {
    it('ALKKAGI_FLICK_STONE enters animating without flipping currentPlayer yet', async () => {
        const game = makePvpPlayingSession();
        const result = await handleAlkkagiAction(
            {} as any,
            game,
            {
                type: 'ALKKAGI_FLICK_STONE',
                userId: game.player1.id,
                payload: { gameId: game.id, stoneId: 1, vx: 5, vy: 0 },
            } as any,
            game.player1,
        );

        expect(result).toEqual({});
        expect(game.gameStatus).toBe('alkkagi_animating');
        expect(game.currentPlayer).toBe(Player.Black);
        expect(game.animation?.type).toBe('alkkagi_flick');
    });

    it('after flick duration, updateAlkkagiState switches turn to the opponent', async () => {
        const game = makePvpPlayingSession();
        await handleAlkkagiAction(
            {} as any,
            game,
            {
                type: 'ALKKAGI_FLICK_STONE',
                userId: game.player1.id,
                payload: { gameId: game.id, stoneId: 1, vx: 8, vy: 0 },
            } as any,
            game.player1,
        );

        const anim = game.animation as { startTime: number; duration: number };
        expect(anim?.startTime).toBeTypeOf('number');
        expect(anim?.duration).toBe(2500);

        // duration 직전: 아직 공격자 턴 유지
        updateAlkkagiState(game, anim.startTime + anim.duration - 1);
        expect(game.gameStatus).toBe('alkkagi_animating');
        expect(game.currentPlayer).toBe(Player.Black);

        // duration 종료: 시뮬 후 백 턴
        updateAlkkagiState(game, anim.startTime + anim.duration);
        expect(game.gameStatus).toBe('alkkagi_playing');
        expect(game.currentPlayer).toBe(Player.White);
        expect(game.animation).toBeNull();
    });

    it('rejects flick when it is not the viewer turn (UI desync would stall if server turn is wrong)', async () => {
        const game = makePvpPlayingSession();
        game.currentPlayer = Player.White;

        const result = await handleAlkkagiAction(
            {} as any,
            game,
            {
                type: 'ALKKAGI_FLICK_STONE',
                userId: game.player1.id,
                payload: { gameId: game.id, stoneId: 1, vx: 5, vy: 0 },
            } as any,
            game.player1,
        );

        expect(result).toEqual({ error: '지금은 공격할 수 없습니다.' });
        expect(game.gameStatus).toBe('alkkagi_playing');
    });
});
