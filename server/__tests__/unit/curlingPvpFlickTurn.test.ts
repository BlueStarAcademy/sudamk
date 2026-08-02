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

describe('curling knockout scoring', () => {
    it('awards knockout to opponent when the attacker own stone leaves the board', async () => {
        const game = makePvpCurlingPlaying();
        game.curlingScores = { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 };
        (game as any).curlingKnockoutScores = { [Player.Black]: 0, [Player.White]: 0 };

        // 강한 속도로 발사해 공격자(흑) 돌이 판 밖으로 나가게 함
        await handleCurlingAction(
            {} as any,
            game,
            {
                type: 'CURLING_FLICK_STONE',
                userId: game.player1.id,
                payload: {
                    gameId: game.id,
                    launchPosition: { x: 420, y: 800 },
                    velocity: { x: 0, y: -40 },
                },
            } as any,
            game.player1,
        );
        const anim = game.animation as { startTime: number; duration: number };
        updateCurlingState(game, anim.startTime + anim.duration);

        expect((game as any).curlingKnockoutScores[Player.White]).toBeGreaterThanOrEqual(1);
        expect(game.curlingScores![Player.White]).toBeGreaterThanOrEqual(1);
        expect((game as any).curlingKnockoutScores[Player.Black]).toBe(0);
    });

    it('awards knockout for each fallen stone to that stone opposing side', async () => {
        const game = makePvpCurlingPlaying();
        game.curlingScores = { [Player.Black]: 0, [Player.White]: 0, [Player.None]: 0 };
        (game as any).curlingKnockoutScores = { [Player.Black]: 0, [Player.White]: 0 };
        const radius = (840 / 19) * 0.47;
        // 보드 가장자리 근처 백 돌 — 흑 공격으로 함께 아웃될 수 있는 배치
        game.curlingStones = [
            { id: 1, player: Player.White, x: 420, y: 30, radius, vx: 0, vy: 0, onBoard: true },
        ];

        await handleCurlingAction(
            {} as any,
            game,
            {
                type: 'CURLING_FLICK_STONE',
                userId: game.player1.id,
                payload: {
                    gameId: game.id,
                    launchPosition: { x: 420, y: 120 },
                    velocity: { x: 0, y: -35 },
                },
            } as any,
            game.player1,
        );
        const anim = game.animation as { startTime: number; duration: number };
        updateCurlingState(game, anim.startTime + anim.duration);

        const blackKo = (game as any).curlingKnockoutScores[Player.Black] as number;
        const whiteKo = (game as any).curlingKnockoutScores[Player.White] as number;
        // 백 돌이 아웃되면 흑 득점, 흑 돌이 아웃되면 백 득점 — 둘 다 아웃되면 각각 1점 이상
        expect(blackKo + whiteKo).toBeGreaterThanOrEqual(1);
        if (blackKo > 0) {
            expect(game.curlingScores![Player.Black]).toBe(blackKo);
        }
        if (whiteKo > 0) {
            expect(game.curlingScores![Player.White]).toBe(whiteKo);
        }
    });
});
