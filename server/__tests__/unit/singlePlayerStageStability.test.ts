import { describe, expect, it } from 'vitest';
import { DEFAULT_SINGLE_PLAYER_STAGES } from '../../../shared/constants/singlePlayerConstants.js';
import { reconcileSinglePlayerProgress } from '../../../shared/utils/singlePlayerProgress.js';
import { normalizeSinglePlayerStagesOverride } from '../../singlePlayerStageConfigService.js';

describe('single-player stage stability', () => {
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
});
