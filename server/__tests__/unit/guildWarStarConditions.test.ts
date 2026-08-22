import { describe, expect, it } from 'vitest';
import { GameMode, Player } from '../../../shared/types/enums.js';
import type { LiveGameSession } from '../../../shared/types/index.js';
import { getGuildWarBoardMode } from '../../../shared/constants/guildConstants.js';
import {
    computeGuildWarAttemptMetrics,
    evaluateGuildWarStarConditionFlags,
    guildWarStarFlagsFromAwardedStars,
} from '../../../shared/utils/guildWarAttemptMetrics.js';

const humanId = 'human-1';
const aiId = 'ai-player-01';

const baseGame = (over: Partial<LiveGameSession> = {}): LiveGameSession =>
    ({
        id: 'gw-star-test',
        mode: GameMode.Capture,
        gameCategory: 'guildwar' as any,
        guildWarBoardId: 'center',
        player1: { id: humanId } as any,
        player2: { id: aiId } as any,
        blackPlayerId: humanId,
        whitePlayerId: aiId,
        gameStatus: 'ended',
        winner: Player.Black,
        currentPlayer: Player.None,
        settings: { boardSize: 9, komi: 0.5 } as any,
        boardState: Array.from({ length: 9 }, () => Array(9).fill(Player.None)),
        moveHistory: [],
        captures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        baseStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        hiddenStoneCaptures: { [Player.None]: 0, [Player.Black]: 0, [Player.White]: 0 },
        createdAt: 0,
        lastMove: null,
        passCount: 0,
        koInfo: null,
        blackTimeLeft: 60,
        whiteTimeLeft: 60,
        blackByoyomiPeriodsLeft: 0,
        whiteByoyomiPeriodsLeft: 0,
        ...over,
    }) as LiveGameSession;

describe('guild war star conditions', () => {
    it('does not use legacy board-id mode for capture on a center (legacy missile) tile', () => {
        expect(getGuildWarBoardMode('center')).toBe('missile');
        const game = baseGame({
            mode: GameMode.Capture,
            guildWarBoardId: 'center',
            maxSingleCapturePointsByPlayer: { [Player.Black]: 5 } as any,
        } as any);
        const flags = evaluateGuildWarStarConditionFlags(game, Player.Black, true);
        expect(flags.kind).toBe('capture');
        expect(flags.win).toBe(true);
        expect(flags.tier2).toBe(true);
        expect(flags.tier3).toBe(true);
        expect(flags.stars).toBe(3);
    });

    it('treats missile on a top-left (legacy capture) tile as score conditions', () => {
        expect(getGuildWarBoardMode('top-left')).toBe('capture');
        const game = baseGame({
            mode: GameMode.Missile,
            guildWarBoardId: 'top-left',
            finalScores: { black: 32, white: 10 },
        });
        const flags = evaluateGuildWarStarConditionFlags(game, Player.Black, true);
        expect(flags.kind).toBe('score');
        expect(flags.win).toBe(true);
        expect(flags.tier2).toBe(true);
        expect(flags.tier3).toBe(true);
        expect(flags.stars).toBe(3);
    });

    it('shows gold score-tier stars from awarded count when finalScores are missing', () => {
        const game = baseGame({
            mode: GameMode.Hidden,
            guildWarBoardId: 'bottom-right',
            finalScores: undefined,
        });
        const live = evaluateGuildWarStarConditionFlags(game, Player.Black, true);
        expect(live.stars).toBe(1);
        expect(live.tier2).toBe(false);
        expect(live.tier3).toBe(false);

        const awarded = evaluateGuildWarStarConditionFlags(game, Player.Black, true, 3);
        expect(awarded.stars).toBe(3);
        expect(awarded.win).toBe(true);
        expect(awarded.tier2).toBe(true);
        expect(awarded.tier3).toBe(true);
    });

    it('uses analysisResult totals when finalScores are absent', () => {
        const game = baseGame({
            mode: GameMode.Speed,
            guildWarBoardId: 'top-mid',
            finalScores: undefined,
            analysisResult: {
                system: {
                    winRateBlack: 0.8,
                    blackConfirmed: [],
                    whiteConfirmed: [],
                    blackRight: [],
                    whiteRight: [],
                    blackLikely: [],
                    whiteLikely: [],
                    deadStones: [],
                    ownershipMap: null,
                    recommendedMoves: [],
                    areaScore: { black: 20, white: 8 },
                    scoreDetails: {
                        black: {
                            territory: 20,
                            captures: 0,
                            baseStoneBonus: 0,
                            hiddenStoneBonus: 0,
                            timeBonus: 0,
                            itemBonus: 0,
                            total: 20,
                        },
                        white: {
                            territory: 8,
                            captures: 0,
                            komi: 0.5,
                            baseStoneBonus: 0,
                            hiddenStoneBonus: 0,
                            timeBonus: 0,
                            itemBonus: 0,
                            total: 8,
                        },
                    },
                },
            } as any,
        });
        const metrics = computeGuildWarAttemptMetrics(game, Player.Black, true);
        expect(metrics.scoreDiff).toBe(12);
        expect(metrics.stars).toBe(3);
        const flags = evaluateGuildWarStarConditionFlags(game, Player.Black, true);
        expect(flags.tier2).toBe(true);
        expect(flags.tier3).toBe(true);
    });

    it('reconstructs capture flags from awarded stars without a win', () => {
        expect(guildWarStarFlagsFromAwardedStars('capture', false, 2)).toEqual({
            win: false,
            tier2: true,
            tier3: true,
        });
        expect(guildWarStarFlagsFromAwardedStars('capture', true, 2)).toEqual({
            win: true,
            tier2: true,
            tier3: false,
        });
    });
});
