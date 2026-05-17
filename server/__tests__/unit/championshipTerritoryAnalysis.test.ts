import { describe, expect, it } from 'vitest';
import { Player } from '../../../shared/types/enums.js';
import type { AnalysisResult } from '../../../shared/types/entities.js';
import {
    championshipTerritoryAnalysisForRealGame,
    resolveChampionshipTerritoryAnalysisForRealGame,
} from '../../../utils/championshipLiveScores.js';

const kataSnapshot = {
    source: 'katago',
    winRateBlack: 55,
    blackConfirmed: [],
    whiteConfirmed: [],
    blackRight: [],
    whiteRight: [],
    blackLikely: [],
    whiteLikely: [],
    deadStones: [{ x: 2, y: 2 }],
    ownershipMap: [[0.9, -0.9]],
    recommendedMoves: [],
    areaScore: { black: 10, white: 8 },
    scoreDetails: {
        black: {
            territory: 8,
            captures: 2,
            baseStoneBonus: 0,
            hiddenStoneBonus: 0,
            timeBonus: 0,
            itemBonus: 0,
            total: 10,
        },
        white: {
            territory: 6,
            captures: 1,
            komi: 6.5,
            baseStoneBonus: 0,
            hiddenStoneBonus: 0,
            timeBonus: 0,
            itemBonus: 0,
            total: 8,
        },
    },
} satisfies AnalysisResult;

describe('resolveChampionshipTerritoryAnalysisForRealGame', () => {
    it('uses server KataGo scoringAnalysis when present', () => {
        const rg = {
            boardSize: 9 as const,
            moves: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.White },
            ],
            scoringAnalysis: kataSnapshot,
        };
        expect(resolveChampionshipTerritoryAnalysisForRealGame(rg)).toBe(kataSnapshot);
    });

    it('falls back to manual scoring when scoringAnalysis is missing', () => {
        const rg = {
            boardSize: 9 as const,
            moves: [
                { x: 0, y: 0, player: Player.Black },
                { x: 1, y: 1, player: Player.White },
            ],
        };
        const manual = championshipTerritoryAnalysisForRealGame(rg);
        const resolved = resolveChampionshipTerritoryAnalysisForRealGame(rg);
        expect(resolved).not.toBeNull();
        expect(resolved).toEqual(manual);
    });
});
