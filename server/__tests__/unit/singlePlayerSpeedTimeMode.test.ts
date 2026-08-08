import { describe, expect, it } from 'vitest';
import { GameMode, SinglePlayerLevel } from '../../../types/index.js';
import type { SinglePlayerStageInfo } from '../../../shared/types/entities.js';
import {
    resolveSinglePlayerSpeedTimeMode,
    resolveSinglePlayerStrategicGameMode,
} from '../../../shared/utils/singlePlayerStrategicRulePreset.js';
import { resolveTutorialForStage } from '../../../shared/constants/pveTutorials.js';

const baseStage = (overrides: Partial<SinglePlayerStageInfo> = {}): SinglePlayerStageInfo =>
    ({
        id: '초급-8',
        name: '관문 8',
        level: SinglePlayerLevel.초급,
        actionPointCost: 3,
        boardSize: 9,
        targetScore: { black: 10, white: 9 },
        placements: { black: 5, white: 11, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 0 },
        timeControl: { type: 'byoyomi', mainTime: 3, byoyomiTime: 30, byoyomiCount: 3 },
        rewards: { firstClear: { gold: 200, exp: 44 }, repeatClear: { gold: 30, exp: 20 } },
        autoScoringTurns: 40,
        ...overrides,
    }) as SinglePlayerStageInfo;

describe('resolveSinglePlayerSpeedTimeMode', () => {
    it('enables speed clocks when autoScoringTurns implies Speed even if timeControl is byoyomi', () => {
        const stage = baseStage();
        expect(resolveSinglePlayerStrategicGameMode(stage)).toBe(GameMode.Speed);
        expect(resolveSinglePlayerSpeedTimeMode(stage)).toBe(true);
    });

    it('keeps classic stages without speed clocks', () => {
        const stage = baseStage({ strategicRulePreset: 'classic' });
        expect(resolveSinglePlayerStrategicGameMode(stage)).toBe(GameMode.Standard);
        expect(resolveSinglePlayerSpeedTimeMode(stage)).toBe(false);
    });
});

describe('resolveTutorialForStage speed', () => {
    it('returns sp_speed for Speed singleplayer stages', () => {
        const stage = baseStage({ timeControl: { type: 'fischer', mainTime: 3, increment: 5 } });
        const session = {
            gameCategory: 'singleplayer',
            mode: GameMode.Speed,
            settings: { autoScoringTurns: 40 },
        } as any;
        expect(resolveTutorialForStage(session, stage)).toBe('sp_speed');
    });

    it('returns sp_auto_scoring for classic auto-scoring stages', () => {
        const stage = baseStage({ strategicRulePreset: 'classic' });
        const session = {
            gameCategory: 'singleplayer',
            mode: GameMode.Standard,
            settings: { autoScoringTurns: 40 },
        } as any;
        expect(resolveTutorialForStage(session, stage)).toBe('sp_auto_scoring');
    });

    it('returns sp_missile for 초급-11 even when runtime stage lost missile fields (code default)', () => {
        const stage = baseStage({
            id: '초급-11',
            strategicRulePreset: 'speed',
            timeControl: { type: 'fischer', mainTime: 3, increment: 5 },
        });
        const session = {
            gameCategory: 'singleplayer',
            mode: GameMode.Speed,
            settings: { autoScoringTurns: 40 },
        } as any;
        expect(resolveTutorialForStage(session, stage)).toBe('sp_missile');
    });

    it('returns sp_hidden for 중급-6 (별빛 계곡 첫 히든)', () => {
        const stage = baseStage({
            id: '중급-6',
            strategicRulePreset: 'hidden',
            hiddenCount: 1,
            scanCount: 2,
            missileCount: undefined,
            autoScoringTurns: 40,
            timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 },
        });
        const session = {
            gameCategory: 'singleplayer',
            mode: GameMode.Hidden,
            settings: { autoScoringTurns: 40, hiddenStoneCount: 1, scanCount: 2 },
        } as any;
        expect(resolveTutorialForStage(session, stage)).toBe('sp_hidden');
    });

    it('prefers sp_hidden over missile when mix has both', () => {
        const stage = baseStage({
            id: '중급-7',
            strategicRulePreset: 'mix',
            mixedStrategicModes: [GameMode.Missile, GameMode.Hidden],
            missileCount: 3,
            hiddenCount: 1,
            scanCount: 2,
            timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 3 },
        });
        const session = {
            gameCategory: 'singleplayer',
            mode: GameMode.Mix,
            settings: {
                autoScoringTurns: 60,
                missileCount: 3,
                hiddenStoneCount: 1,
                mixedModes: [GameMode.Missile, GameMode.Hidden],
            },
        } as any;
        expect(resolveTutorialForStage(session, stage)).toBe('sp_hidden');
    });

    it('returns sp_missile from mix modes even if missileCount was wiped from settings', () => {
        const stage = baseStage({
            id: '초급-11',
            strategicRulePreset: 'mix',
            mixedStrategicModes: [GameMode.Speed, GameMode.Missile],
            timeControl: { type: 'fischer', mainTime: 3, increment: 5 },
        });
        const session = {
            gameCategory: 'singleplayer',
            mode: GameMode.Mix,
            settings: { autoScoringTurns: 40, mixedModes: [GameMode.Speed, GameMode.Missile] },
        } as any;
        expect(resolveTutorialForStage(session, stage)).toBe('sp_missile');
    });

    it('returns sp_pattern when stage has pattern stones (입문-2)', () => {
        const stage = baseStage({
            id: '입문-2',
            autoScoringTurns: undefined,
            timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 },
            placements: { black: 2, white: 2, blackPattern: 0, whitePattern: 1, centerBlackStoneChance: 90 },
            blackTurnLimit: 15,
            targetScore: { black: 5, white: 5 },
        });
        const session = {
            gameCategory: 'singleplayer',
            mode: GameMode.Capture,
            settings: {},
        } as any;
        expect(resolveTutorialForStage(session, stage)).toBe('sp_pattern');
    });

    it('returns sp_capture_basics only for 입문-1, null for later capture stages without new rules', () => {
        const session = {
            gameCategory: 'singleplayer',
            mode: GameMode.Capture,
            settings: {},
        } as any;
        const stage1 = baseStage({
            id: '입문-1',
            autoScoringTurns: undefined,
            timeControl: { type: 'byoyomi', mainTime: 5, byoyomiTime: 30, byoyomiCount: 5 },
            placements: { black: 0, white: 0, blackPattern: 0, whitePattern: 0 },
            blackTurnLimit: 15,
            targetScore: { black: 1, white: 99 },
        });
        expect(resolveTutorialForStage(session, stage1)).toBe('sp_capture_basics');

        const stageLater = baseStage({
            id: '입문-9',
            autoScoringTurns: undefined,
            timeControl: { type: 'byoyomi', mainTime: 3, byoyomiTime: 0, byoyomiCount: 3 },
            placements: { black: 3, white: 4, blackPattern: 0, whitePattern: 0, centerBlackStoneChance: 90 },
            blackTurnLimit: 15,
            targetScore: { black: 6, white: 6 },
        });
        expect(resolveTutorialForStage(session, stageLater)).toBeNull();
    });
});
