import { describe, expect, it } from 'vitest';
import type { User } from '../../../shared/types/index.js';
import { DEFAULT_SINGLE_PLAYER_STAGES } from '../../../shared/constants/singlePlayerConstants.js';
import { GameMode } from '../../../shared/types/enums.js';
import { reconcileSinglePlayerProgress } from '../../../shared/utils/singlePlayerProgress.js';
import { isFullSinglePlayerStagesPermutation, normalizeSinglePlayerStagesOverride } from '../../singlePlayerStageConfigService.js';
import { remapUserSinglePlayerProgressFields } from '../../singlePlayerStageIdMigration.js';

describe('single-player stage stability', () => {
    it('accepts a full permutation: canonical slot ids with content from payload order', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES;
        expect(base.length).toBeGreaterThan(3);
        const permuted = [base[1], base[2], base[0], ...base.slice(3)].map((s) => ({ ...s }));
        expect(isFullSinglePlayerStagesPermutation(permuted)).toBe(true);
        const normalized = normalizeSinglePlayerStagesOverride(permuted);
        expect(normalized.map((s) => s.id)).toEqual(base.map((s) => s.id));
        expect(normalized[0].id).toBe(base[0].id);
        expect(normalized[0].name).toBe(base[0].name);
        expect(normalized[0].targetScore).toEqual(base[1].targetScore);
    });

    it('normalizes partial overrides into the full default stage list with stable order', () => {
        const target = DEFAULT_SINGLE_PLAYER_STAGES[2];
        const normalized = normalizeSinglePlayerStagesOverride([
            {
                ...target,
                actionPointCost: 7,
                rewards: {
                    ...target.rewards,
                    repeatClear: {
                        ...target.rewards.repeatClear,
                        gold: target.rewards.repeatClear.gold + 123,
                    },
                },
            },
        ]);

        expect(normalized).toHaveLength(DEFAULT_SINGLE_PLAYER_STAGES.length);
        expect(normalized.map((stage) => stage.id)).toEqual(DEFAULT_SINGLE_PLAYER_STAGES.map((stage) => stage.id));
        expect(normalized[2].actionPointCost).toBe(7);
        expect(normalized[2].rewards.repeatClear.gold).toBe(target.rewards.repeatClear.gold + 123);
        expect(normalized[0].id).toBe(DEFAULT_SINGLE_PLAYER_STAGES[0].id);
    });

    it('stage reorder migration: late explicit clear implies all earlier stages under prev order', () => {
        const prev = DEFAULT_SINGLE_PLAYER_STAGES.slice(0, 5);
        const prevPick = prev.map((s) => ({ id: s.id }));
        const newOrder = prev.map((s) => ({ id: s.id }));
        const remap = Object.fromEntries(prev.map((s) => [s.id, s.id]));
        const user = {
            clearedSinglePlayerStages: [prev[4]!.id],
            singlePlayerProgress: 0,
        } as unknown as User;

        remapUserSinglePlayerProgressFields(user, prevPick, remap, newOrder);

        expect(user.clearedSinglePlayerStages).toEqual(prev.map((s) => s.id));
        expect(user.singlePlayerProgress).toBe(5);
    });

    it('uses numeric progress as compatible cleared-stage proof for legacy users', () => {
        const stages = DEFAULT_SINGLE_PLAYER_STAGES.slice(0, 5);
        const progress = reconcileSinglePlayerProgress(stages, [], 3);

        expect(progress.progress).toBe(3);
        expect(progress.effectiveClearedStageIds).toEqual(stages.slice(0, 3).map((stage) => stage.id));
    });

    it('filters stale cleared stage ids while preserving valid clears', () => {
        const stages = DEFAULT_SINGLE_PLAYER_STAGES.slice(0, 3);
        const progress = reconcileSinglePlayerProgress(stages, [stages[1].id, 'removed-stage'], 0);

        expect(progress.clearedStageIds).toEqual([stages[1].id]);
        expect(progress.effectiveClearedStageIds).toEqual([stages[1].id]);
    });

    it('preserves editable stage descriptions through normalization', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([
            {
                ...base,
                description: '  이 스테이지에서는 축과 단수를 연습합니다.  ',
            },
        ]);

        expect(normalized[0].description).toBe('이 스테이지에서는 축과 단수를 연습합니다.');
    });

    it('preserves disabled placement refresh through normalization', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([
            {
                ...base,
                allowPlacementRefresh: false,
            },
        ]);

        expect(normalized[0].allowPlacementRefresh).toBe(false);
        expect(normalized[1].allowPlacementRefresh).toBe(true);
    });

    it('deduplicates fixed openings and clamps random placements to available board capacity', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([
            {
                ...base,
                boardSize: 7,
                mergeRandomPlacementsWithFixed: true,
                fixedOpening: [
                    { x: 0, y: 0, color: 'black', kind: 'plain' },
                    { x: 0, y: 0, color: 'white', kind: 'pattern' },
                ],
                placements: {
                    black: 49,
                    white: 49,
                    blackPattern: 49,
                    whitePattern: 49,
                    centerBlackStoneChance: 100,
                },
            },
        ]);
        const stage = normalized[0];
        const totalRandomStones =
            stage.placements.black
            + stage.placements.white
            + stage.placements.blackPattern
            + stage.placements.whitePattern;

        expect(stage.fixedOpening).toHaveLength(1);
        expect(totalRandomStones).toBeLessThanOrEqual(48);
    });

    it('does not revive default rule fields after admin editor saves a clean mix stage', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES.find((s) => s.hiddenCount != null && s.autoScoringTurns != null) ?? DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([
            {
                ...base,
                strategicRulePreset: 'mix',
                mixedStrategicModes: [GameMode.Speed, GameMode.Base],
                autoScoringTurns: 33,
                hiddenCount: undefined,
                scanCount: undefined,
                missileCount: undefined,
                blackTurnLimit: undefined,
                survivalTurns: undefined,
            },
        ]);
        const stage = normalized.find((s) => s.id === base.id)!;

        expect(stage.strategicRulePreset).toBe('mix');
        expect(stage.mixedStrategicModes).toEqual([GameMode.Speed, GameMode.Base]);
        expect(stage.autoScoringTurns).toBe(33);
        expect(stage.hiddenCount).toBeUndefined();
        expect(stage.scanCount).toBeUndefined();
        expect(stage.missileCount).toBeUndefined();
        expect(stage.blackTurnLimit).toBeUndefined();
    });

    it('drops auto scoring turns for admin-configured capture mix stages', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES.find((s) => s.autoScoringTurns != null) ?? DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([
            {
                ...base,
                strategicRulePreset: 'mix',
                mixedStrategicModes: [GameMode.Capture, GameMode.Hidden],
                blackTurnLimit: 15,
                hiddenCount: 2,
                scanCount: 1,
                autoScoringTurns: 40,
            },
        ]);
        const stage = normalized.find((s) => s.id === base.id)!;

        expect(stage.strategicRulePreset).toBe('mix');
        expect(stage.mixedStrategicModes).toEqual([GameMode.Capture, GameMode.Hidden]);
        expect(stage.blackTurnLimit).toBe(15);
        expect(stage.hiddenCount).toBe(2);
        expect(stage.autoScoringTurns).toBeUndefined();
    });

    it('preserves admin-configured AI hidden use count', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([
            {
                ...base,
                strategicRulePreset: 'hidden',
                hiddenCount: 2,
                scanCount: 1,
                aiHiddenItemUseWithinTurn: 8,
                aiHiddenItemUseCount: 3,
            },
        ]);

        expect(normalized[0].aiHiddenItemUseWithinTurn).toBe(8);
        expect(normalized[0].aiHiddenItemUseCount).toBe(3);
    });

    it('keeps class-based KataServer defaults instead of weakening every normalized stage', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES.find((s) => s.level === '중급') ?? DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([{ ...base, kataServerLevel: undefined }]);
        const stage = normalized.find((s) => s.id === base.id)!;

        expect(stage.kataServerLevel).toBe(base.level === '중급' ? -29 : -31);
    });

    it('preserves admin-configured KataServer level through normalization', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES.find((s) => s.level === '유단자') ?? DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([{ ...base, kataServerLevel: 9 }]);
        const stage = normalized.find((s) => s.id === base.id)!;

        expect(stage.kataServerLevel).toBe(9);
    });
});
