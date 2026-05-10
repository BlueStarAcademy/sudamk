import { describe, expect, it, vi } from 'vitest';
import { GameCategory, GameMode, Player } from '../../../types/index.js';
import { getCaptureTargetWinner } from '../../utils/captureTargets.js';
import { handleCaptureAction, initializeCapture, updateCaptureState } from '../../modes/capture.js';
import { aiUserId } from '../../aiPlayer.js';

const baseGame = (overrides: Record<string, unknown> = {}) => ({
    id: 'capture-target-test',
    gameStatus: 'playing',
    gameCategory: GameCategory.Adventure,
    mode: GameMode.Capture,
    settings: { captureTarget: 20 },
    captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
    ...overrides,
}) as any;

describe('capture target winner detection', () => {
    it('capture bidding keeps black target and lowers white target by bid points', () => {
        const game = baseGame({
            gameCategory: GameCategory.Normal,
            mode: GameMode.Capture,
            settings: { captureTarget: 20 },
            player1: { id: 'p1' },
            player2: { id: 'p2' },
            bids: { p1: 7, p2: 3 },
            biddingRound: 1,
            gameStatus: 'capture_bidding',
        });

        updateCaptureState(game, Date.now());

        expect(game.blackPlayerId).toBe('p1');
        expect(game.whitePlayerId).toBe('p2');
        expect(game.effectiveCaptureTargets).toMatchObject({
            [Player.Black]: 20,
            [Player.White]: 13,
        });
        expect(game.gameStatus).toBe('capture_reveal');
    });

    it('clamps capture bids to captureTarget minus one', () => {
        const game = baseGame({
            gameCategory: GameCategory.Normal,
            mode: GameMode.Capture,
            settings: { captureTarget: 20 },
            player1: { id: 'p1' },
            player2: { id: 'p2' },
            bids: {},
            biddingRound: 1,
            gameStatus: 'capture_bidding',
        });

        const result = handleCaptureAction(
            game,
            { type: 'UPDATE_CAPTURE_BID', userId: 'p1', payload: { gameId: game.id, bid: 99 } } as any,
            { id: 'p1' } as any
        );

        expect(result).toEqual({});
        expect(game.bids?.p1).toBe(19);
    });

    it('uses 1 to 5 random AI capture bids and no countdowns in AI capture games', () => {
        const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
        try {
            const game = baseGame({
                gameCategory: GameCategory.Normal,
                mode: GameMode.Capture,
                isAiGame: true,
                settings: { captureTarget: 20 },
                player1: { id: 'human-user' },
                player2: { id: aiUserId },
                bids: undefined,
                biddingRound: undefined,
                gameStatus: 'pending',
            });

            initializeCapture(game, Date.now());
            expect(game.captureBidDeadline).toBeUndefined();

            game.bids = { [game.player1.id]: 6, [game.player2.id]: null };
            updateCaptureState(game, Date.now());

            expect(game.bids?.[aiUserId]).toBe(5);
            expect(game.gameStatus).toBe('capture_reveal');
            expect(game.revealEndTime).toBeUndefined();
            expect(game.preGameConfirmations?.[aiUserId]).toBe(true);
            expect(game.effectiveCaptureTargets).toMatchObject({
                [Player.Black]: 20,
                [Player.White]: 14,
            });
        } finally {
            randomSpy.mockRestore();
        }
    });

    it('detects adventure capture target immediately from effective targets', () => {
        const game = baseGame({
            effectiveCaptureTargets: {
                [Player.None]: 0,
                [Player.Black]: 7,
                [Player.White]: 9,
            },
            captures: {
                [Player.None]: 0,
                [Player.Black]: 7,
                [Player.White]: 0,
            },
        });

        expect(getCaptureTargetWinner(game, Player.White)).toBe(Player.Black);
    });

    it('does not end tower auto-scoring stages by stale capture targets', () => {
        const game = baseGame({
            gameCategory: GameCategory.Tower,
            settings: { autoScoringTurns: 40, captureTarget: 5 },
            captures: {
                [Player.None]: 0,
                [Player.Black]: 10,
                [Player.White]: 0,
            },
        });

        expect(getCaptureTargetWinner(game, Player.Black)).toBeNull();
    });

    it('ends mix speed+capture when speed bonus reaches capture target', () => {
        const game = baseGame({
            gameCategory: GameCategory.Normal,
            mode: GameMode.Mix,
            settings: {
                captureTarget: 20,
                mixedModes: [GameMode.Speed, GameMode.Capture],
                __speedBonusConsumedSec: { black: 200, white: 0 },
            },
            captures: {
                [Player.None]: 0,
                [Player.Black]: 0,
                [Player.White]: 0,
            },
        });

        // 흑이 200초를 사용 -> 백 시간 보너스 +20, 목표 20 도달로 즉시 백 승리
        expect(getCaptureTargetWinner(game, Player.Black)).toBe(Player.White);
    });

    it('ignores AI used time in AI mix speed+capture games', () => {
        const game = baseGame({
            gameCategory: GameCategory.Normal,
            mode: GameMode.Mix,
            isAiGame: true,
            player1: { id: 'human-user' },
            player2: { id: 'ai-bot' },
            blackPlayerId: 'human-user',
            whitePlayerId: 'ai-bot',
            settings: {
                captureTarget: 20,
                mixedModes: [GameMode.Speed, GameMode.Capture],
                __speedBonusConsumedSec: { black: 0, white: 200 },
            },
            captures: {
                [Player.None]: 0,
                [Player.Black]: 0,
                [Player.White]: 0,
            },
        });

        // AI(백)가 200초 사용해도 유저(흑) 보너스는 무시되어 즉시 종료되지 않아야 한다.
        expect(getCaptureTargetWinner(game, Player.White)).toBeNull();
    });

    it('capture_reveal does not treat missing bids as round-one tie; both confirmed advances to playing', () => {
        const game = baseGame({
            gameCategory: GameCategory.Normal,
            mode: GameMode.Capture,
            player1: { id: 'p1' },
            player2: { id: 'p2' },
            blackPlayerId: 'p1',
            whitePlayerId: 'p2',
            gameStatus: 'capture_reveal',
            bids: undefined,
            biddingRound: 1,
            effectiveCaptureTargets: { [Player.None]: 0, [Player.Black]: 20, [Player.White]: 15 },
            preGameConfirmations: { p1: true, p2: true },
            revealEndTime: undefined,
        });
        updateCaptureState(game, Date.now());
        expect(game.gameStatus).toBe('playing');
    });
});
