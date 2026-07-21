import { describe, expect, it } from 'vitest';
import type { User } from '../../../shared/types/index.js';
import { DEFAULT_SINGLE_PLAYER_STAGES } from '../../../shared/constants/singlePlayerConstants.js';
import { GameMode } from '../../../shared/types/enums.js';
import { reconcileSinglePlayerProgress } from '../../../shared/utils/singlePlayerProgress.js';
import {
    isFullSinglePlayerStagesPermutation,
    normalizeSinglePlayerStagesOverride,
    resolveSinglePlayerStageKataServerLevel,
} from '../../singlePlayerStageConfigService.js';
import { remapUserSinglePlayerProgressFields } from '../../singlePlayerStageIdMigration.js';
import {
    inferLegacySinglePlayerGameMode,
    inferSinglePlayerStrategicRulePreset,
    resolveSinglePlayerStrategicGameMode,
} from '../../../shared/utils/singlePlayerStrategicRulePreset.js';

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
            },
        ]);

        expect(normalized).toHaveLength(DEFAULT_SINGLE_PLAYER_STAGES.length);
        expect(normalized.map((stage) => stage.id)).toEqual(DEFAULT_SINGLE_PLAYER_STAGES.map((stage) => stage.id));
        const mergedById = normalized.find((s) => s.id === target.id);
        expect(mergedById?.actionPointCost).toBe(7);
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

    it('mix base+hidden without speed: autoScoringTurns must not re-inject 스피드 on normalize/save round-trip', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([
            {
                ...base,
                strategicRulePreset: 'mix',
                mixedStrategicModes: [GameMode.Base, GameMode.Hidden],
                baseStones: 3,
                hiddenCount: 2,
                scanCount: 1,
                autoScoringTurns: 120,
                blackTurnLimit: undefined,
                survivalTurns: undefined,
                timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 },
            },
        ]);
        const stage = normalized.find((s) => s.id === base.id)!;

        expect(stage.strategicRulePreset).toBe('mix');
        expect(stage.mixedStrategicModes).toEqual([GameMode.Base, GameMode.Hidden]);
        expect(stage.mixedStrategicModes).not.toContain(GameMode.Speed);
        expect(stage.autoScoringTurns).toBe(120);
    });

    it('mix including Base preserves Capture while clearing pre-placed stones', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([
            {
                ...base,
                strategicRulePreset: 'mix',
                mixedStrategicModes: [GameMode.Base, GameMode.Capture, GameMode.Speed],
                fixedOpening: [{ x: 1, y: 1, color: 'black', kind: 'plain' }],
                placements: { black: 3, white: 2, blackPattern: 0, whitePattern: 0 },
                blackTurnLimit: 10,
            },
        ]);
        const stage = normalized[0]!;

        expect(stage.mixedStrategicModes).toContain(GameMode.Capture);
        expect(stage.mixedStrategicModes).toContain(GameMode.Base);
        expect(stage.mixedStrategicModes!.length).toBeGreaterThanOrEqual(2);
        expect(stage.fixedOpening).toBeUndefined();
        expect(stage.placements).toEqual({ black: 0, white: 0, blackPattern: 0, whitePattern: 0 });
        expect(stage.blackTurnLimit).toBe(10);
    });

    it('promotes capture preset to mix when missile + 따내기 한도 are both set (관리자 편집 필드 유지)', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES.find((s) => s.targetScore) ?? DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([
            {
                ...base,
                strategicRulePreset: 'capture',
                blackTurnLimit: 12,
                missileCount: 3,
            },
        ]);
        const stage = normalized.find((s) => s.id === base.id)!;

        expect(stage.strategicRulePreset).toBe('mix');
        expect(stage.mixedStrategicModes).toEqual([GameMode.Capture, GameMode.Missile]);
        expect(stage.blackTurnLimit).toBe(12);
        expect(stage.missileCount).toBe(3);
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

    it('missile preset keeps 계가 수 even when merge left blackTurnLimit on the row (repair must not promote to capture mix)', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES.find((s) => s.id === '입문-1') ?? DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([
            {
                ...base,
                strategicRulePreset: 'missile',
                missileCount: 3,
                autoScoringTurns: 8,
                blackTurnLimit: 15,
            },
        ]);
        const stage = normalized.find((s) => s.id === base.id)!;
        expect(stage.strategicRulePreset).toBe('missile');
        expect(stage.autoScoringTurns).toBe(8);
        expect(stage.missileCount).toBe(3);
        expect(stage.blackTurnLimit).toBeUndefined();
    });

    it('preserves 계가까지 수순 for hidden (and other non-speed) strategic presets after normalize', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([
            {
                ...base,
                strategicRulePreset: 'hidden',
                blackTurnLimit: undefined,
                survivalTurns: undefined,
                hiddenCount: 2,
                scanCount: 1,
                autoScoringTurns: 55,
            },
        ]);
        const stage = normalized.find((s) => s.id === base.id)!;
        expect(stage.strategicRulePreset).toBe('hidden');
        expect(stage.autoScoringTurns).toBe(55);
    });

    it('uses class-based KataServer defaults only when a stage has no admin value', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES.find((s) => s.level === '중급') ?? DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([{ ...base, kataServerLevel: undefined }]);
        const stage = normalized.find((s) => s.id === base.id)!;

        expect(stage.kataServerLevel).toBe(base.level === '중급' ? -29 : -31);
        expect(resolveSinglePlayerStageKataServerLevel({ level: base.level, kataServerLevel: undefined })).toBe(
            base.level === '중급' ? -29 : -31
        );
    });

    it('preserves admin-configured KataServer level through normalization', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES.find((s) => s.level === '유단자') ?? DEFAULT_SINGLE_PLAYER_STAGES[0];
        const normalized = normalizeSinglePlayerStagesOverride([{ ...base, kataServerLevel: 9 }]);
        const stage = normalized.find((s) => s.id === base.id)!;

        expect(stage.kataServerLevel).toBe(9);
        expect(resolveSinglePlayerStageKataServerLevel(stage)).toBe(9);
    });

    it('preserves admin-edited gold/exp rewards through normalize round-trip', () => {
        const base = DEFAULT_SINGLE_PLAYER_STAGES[0]!;
        const normalized = normalizeSinglePlayerStagesOverride([
            {
                ...base,
                rewards: {
                    firstClear: {
                        gold: 12345,
                        exp: 678,
                        items: [{ itemId: '테스트재료', quantity: 2 }],
                    },
                    repeatClear: { gold: 11, exp: 22 },
                },
            },
        ]);
        const stage = normalized.find((s) => s.id === base.id)!;

        expect(stage.rewards.firstClear.gold).toBe(12345);
        expect(stage.rewards.firstClear.exp).toBe(678);
        expect(stage.rewards.firstClear.items).toEqual([{ itemId: '테스트재료', quantity: 2 }]);
        expect(stage.rewards.repeatClear.gold).toBe(11);
        expect(stage.rewards.repeatClear.exp).toBe(22);
    });

    it('auto preset + baseStones infers Base (not Capture from ever-present targetScore)', () => {
        const template = DEFAULT_SINGLE_PLAYER_STAGES.find((s) => s.id === '중급-11')!;
        const stage = {
            ...template,
            strategicRulePreset: 'auto' as const,
            baseStones: 4,
        };
        expect(inferLegacySinglePlayerGameMode(stage)).toBe(GameMode.Base);
        expect(resolveSinglePlayerStrategicGameMode(stage)).toBe(GameMode.Base);
        expect(inferSinglePlayerStrategicRulePreset(stage)).toBe('base');
    });
});
