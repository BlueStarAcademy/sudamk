import { describe, expect, it } from 'vitest';
import { CoreStat } from '../../../shared/types/index.js';
import {
    CHAMPIONSHIP_ABILITY_KATA_LADDER,
    CHAMPIONSHIP_REAL_MATCH_RULES_19,
    CHAMPIONSHIP_REAL_MATCH_RULES_9,
    resolveChampionshipDungeonPlaybackSpeedChoices,
    resolveChampionshipDungeonRulesFromStage,
    championshipBestMoveChancePercent,
    championshipEventBranchBestMovePercent,
    championshipKataAbilityScore,
    championshipKataLevelFromAbilityScore,
    championshipKataLevelForPly,
    championshipMistakeChancePercent,
} from '../../../shared/constants/championshipRealMatch.js';
import { DEFAULT_PAIR_PET_ABILITY_KATA_LADDER } from '../../../shared/constants/pairArena.js';
import { resolveChampionshipVersusKataForPly } from '../../../shared/utils/championshipVersusKataResolve.js';

const statsFor = (value: number): Record<CoreStat, number> => ({
    [CoreStat.Concentration]: value,
    [CoreStat.ThinkingSpeed]: value,
    [CoreStat.Judgment]: value,
    [CoreStat.Calculation]: value,
    [CoreStat.CombatPower]: value,
    [CoreStat.Stability]: value,
});

describe('championship real match policy', () => {
    it('sums six core stats with opening/midgame/endgame weights (가중치 합 2.0 → 능력치 전부 100이면 200)', () => {
        const s = statsFor(100);
        expect(championshipKataAbilityScore('opening', s)).toBe(200);
        expect(championshipKataAbilityScore('midgame', s)).toBe(200);
        expect(championshipKataAbilityScore('endgame', s)).toBe(200);
    });

    it('pet championship uses pair-pet KATA ladder (140 vs 100 are not both -30)', () => {
        const stats140 = statsFor(70);
        const stats100 = statsFor(50);
        const petConfig = { mode: 'petOnly' as const, pairPetLadder: DEFAULT_PAIR_PET_ABILITY_KATA_LADDER };
        const r140 = resolveChampionshipVersusKataForPly({
            ply: 1,
            boardSize: 19,
            rules: CHAMPIONSHIP_REAL_MATCH_RULES_19,
            config: petConfig,
            actorUserId: 'a',
            actorStats: stats140,
            seat: null,
        });
        const r100 = resolveChampionshipVersusKataForPly({
            ply: 1,
            boardSize: 19,
            rules: CHAMPIONSHIP_REAL_MATCH_RULES_19,
            config: petConfig,
            actorUserId: 'b',
            actorStats: stats100,
            seat: null,
        });
        expect(r140.kataLevel).toBeGreaterThan(r100.kataLevel);
        expect(championshipKataLevelFromAbilityScore(140)).toBe(-30);
    });

    it('userOnly (PVP versus) resolves kata level with phase from levelInfo', () => {
        const stats = statsFor(200);
        const result = resolveChampionshipVersusKataForPly({
            ply: 1,
            boardSize: 19,
            rules: CHAMPIONSHIP_REAL_MATCH_RULES_19,
            config: { mode: 'userOnly', userLadder: CHAMPIONSHIP_ABILITY_KATA_LADDER },
            actorUserId: 'pvp-user',
            actorStats: stats,
            seat: null,
        });
        expect(result.phase).toBe('opening');
        expect(Number.isFinite(result.kataLevel)).toBe(true);
        expect(Number.isFinite(result.abilityScore)).toBe(true);
    });

    it('petpair split uses user ladder for user seat and pair-pet ladder for pet seat', () => {
        const userCore = statsFor(500);
        const petSix = { concentration: 70, thinkingSpeed: 70, judgment: 70, calculation: 70, combatPower: 70, stability: 70 };
        const splitConfig = {
            mode: 'petPairSplit' as const,
            userLadder: CHAMPIONSHIP_ABILITY_KATA_LADDER,
            pairPetLadder: DEFAULT_PAIR_PET_ABILITY_KATA_LADDER,
            userCoreByUserId: { u1: userCore },
            petSixByUserId: { u1: petSix },
        };
        const userTurn = resolveChampionshipVersusKataForPly({
            ply: 1,
            boardSize: 19,
            rules: CHAMPIONSHIP_REAL_MATCH_RULES_19,
            config: splitConfig,
            actorUserId: 'u1',
            actorStats: userCore,
            seat: { kind: 'user' },
        });
        const petTurn = resolveChampionshipVersusKataForPly({
            ply: 2,
            boardSize: 19,
            rules: CHAMPIONSHIP_REAL_MATCH_RULES_19,
            config: splitConfig,
            actorUserId: 'u1',
            actorStats: {},
            seat: { kind: 'pet' },
        });
        expect(userTurn.kataLevel).not.toBe(petTurn.kataLevel);
    });

    it('maps ability score boundaries without level zero', () => {
        const cases: Array<[number, number]> = [
            [199, -30],
            [200, -30],
            [219, -29],
            [220, -28],
            [1000, -1],
            [1019, -1],
            [1020, 1],
            [1250, 5],
            [1320, 6],
            [1590, 8],
            [1600, 9],
        ];

        for (const [ability, level] of cases) {
            expect(championshipKataLevelFromAbilityScore(ability)).toBe(level);
        }
    });

    it('uses 19-line phase boundaries in three 60-move thirds up to 180 moves', () => {
        expect(championshipKataLevelForPly(1, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_19).phase).toBe('opening');
        expect(championshipKataLevelForPly(60, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_19).phase).toBe('opening');
        expect(championshipKataLevelForPly(61, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_19).phase).toBe('midgame');
        expect(championshipKataLevelForPly(120, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_19).phase).toBe('midgame');
        expect(championshipKataLevelForPly(121, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_19).phase).toBe('endgame');
        expect(championshipKataLevelForPly(180, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_19).phase).toBe('endgame');
    });

    it('uses 9-line phase boundaries in three 14-move thirds up to 42 moves', () => {
        expect(championshipKataLevelForPly(1, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_9).phase).toBe('opening');
        expect(championshipKataLevelForPly(14, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_9).phase).toBe('opening');
        expect(championshipKataLevelForPly(15, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_9).phase).toBe('midgame');
        expect(championshipKataLevelForPly(28, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_9).phase).toBe('midgame');
        expect(championshipKataLevelForPly(29, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_9).phase).toBe('endgame');
        expect(championshipKataLevelForPly(42, statsFor(200), CHAMPIONSHIP_REAL_MATCH_RULES_9).phase).toBe('endgame');
    });

    it('maps dungeon stage to board size rules', () => {
        expect(resolveChampionshipDungeonRulesFromStage(1).boardSize).toBe(9);
        expect(resolveChampionshipDungeonRulesFromStage(3).boardSize).toBe(9);
        expect(resolveChampionshipDungeonRulesFromStage(4).boardSize).toBe(13);
        expect(resolveChampionshipDungeonRulesFromStage(5).boardSize).toBe(13);
        expect(resolveChampionshipDungeonRulesFromStage(6).boardSize).toBe(19);
        expect(resolveChampionshipDungeonRulesFromStage(10).boardSize).toBe(19);
        expect(resolveChampionshipDungeonRulesFromStage(0).boardSize).toBe(19);
    });

    it('maps dungeon stage to playback speed choices', () => {
        expect(resolveChampionshipDungeonPlaybackSpeedChoices(1)).toEqual([0.5, 1, 2]);
        expect(resolveChampionshipDungeonPlaybackSpeedChoices(3)).toEqual([0.5, 1, 2]);
        expect(resolveChampionshipDungeonPlaybackSpeedChoices(4)).toEqual([0.5, 1, 2]);
        expect(resolveChampionshipDungeonPlaybackSpeedChoices(5)).toEqual([0.5, 1, 2]);
        expect(resolveChampionshipDungeonPlaybackSpeedChoices(6)).toEqual([0.5, 1, 2, 3]);
        expect(resolveChampionshipDungeonPlaybackSpeedChoices(0)).toEqual([0.5, 1, 2, 3]);
    });

    it('applies condition to mistake and best move chances', () => {
        expect(championshipMistakeChancePercent(500, 100)).toBe(15);
        expect(championshipBestMoveChancePercent(1000, 100)).toBe(40);
    });

    it('weights scheduled event branch toward best move by 2%p per phase ability score', () => {
        expect(championshipEventBranchBestMovePercent(0)).toBe(50);
        expect(championshipEventBranchBestMovePercent(1000)).toBe(70);
        expect(championshipEventBranchBestMovePercent(500)).toBe(60);
        expect(championshipEventBranchBestMovePercent(2500)).toBe(100);
    });
});
