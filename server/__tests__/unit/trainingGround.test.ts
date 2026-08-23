import { describe, expect, it } from 'vitest';
import type { User } from '../../../types.js';
import { GameMode } from '../../../types.js';
import {
    CHAMPIONSHIP_ABILITY_KATA_LADDER,
} from '../../../shared/constants/championshipRealMatch.js';
import { DEFAULT_GAME_SETTINGS, getAiScoringTurnLimitByBoardSize } from '../../../shared/constants/gameSettings.js';
import {
    TRAINING_GROUND_KATA_LEVELS,
    clampTrainingGroundBoardSize,
    isTrainingGroundSession,
    minAbilityScoreForKataLevel,
    normalizeTrainingGroundKataLevel,
    rewardForKataLevel,
} from '../../../shared/constants/trainingGround.js';
import {
    claimTrainingGroundWin,
    getTrainingGroundTrackState,
    grantTrainingGroundAdRestore,
} from '../../../shared/utils/trainingGroundDaily.js';
import { isTrainingGroundStageUnlocked } from '../../../shared/utils/trainingGroundProgress.js';
import { isWaitingRoomAiGame } from '../../../shared/utils/strategicAiDifficulty.js';
import { clampAiLobbyStrategicItemCaps } from '../../../shared/utils/strategicAiLobbyItemCaps.js';
import { pairLobbyDraftBoardSizeOptions } from '../../../shared/utils/pairLobbyGameSettingRows.js';
import { sanitizePvpGameSettings } from '../../../shared/utils/sanitizePvpGameSettings.js';
import { transformPairArenaAiMatchSettings } from '../../../shared/utils/pairArenaAiMatchSettings.js';
import { getEquippedPairPetInventoryRow } from '../../../shared/utils/pairEquippedPet.js';

const baseUser = (overrides: Partial<User> = {}): User =>
    ({
        id: 'u-tg',
        nickname: 'trainer',
        ...overrides,
    }) as User;

describe('trainingGround stages', () => {
    it('builds 39 kata stages and skips 0', () => {
        expect(TRAINING_GROUND_KATA_LEVELS).toHaveLength(39);
        expect(TRAINING_GROUND_KATA_LEVELS).not.toContain(0);
        expect(TRAINING_GROUND_KATA_LEVELS[0]).toBe(-30);
        expect(TRAINING_GROUND_KATA_LEVELS[29]).toBe(-1);
        expect(TRAINING_GROUND_KATA_LEVELS[30]).toBe(1);
        expect(TRAINING_GROUND_KATA_LEVELS[38]).toBe(9);
    });

    it('treats computed kata 0 as -1 for unlock', () => {
        expect(normalizeTrainingGroundKataLevel(0)).toBe(-1);
        expect(isTrainingGroundStageUnlocked(0, -1)).toBe(true);
        expect(isTrainingGroundStageUnlocked(-1, 1)).toBe(false);
        expect(isTrainingGroundStageUnlocked(1, -1)).toBe(true);
        expect(isTrainingGroundStageUnlocked(-1, -1)).toBe(true);
    });

    it('scales 19/13/9 rewards at 100/50/25 percent', () => {
        expect(rewardForKataLevel(-30, 19)).toEqual({ gold: 8000, diamonds: 8 });
        expect(rewardForKataLevel(-30, 13)).toEqual({ gold: 4000, diamonds: 4 });
        expect(rewardForKataLevel(-30, 9)).toEqual({ gold: 2000, diamonds: 2 });
        expect(rewardForKataLevel(-1, 19)).toEqual({ gold: 66000, diamonds: 44 });
        expect(rewardForKataLevel(-1, 13)).toEqual({ gold: 33000, diamonds: 22 });
        expect(rewardForKataLevel(-1, 9)).toEqual({ gold: 16500, diamonds: 11 });
        expect(rewardForKataLevel(9, 19)).toEqual({ gold: 84000, diamonds: 80 });
        expect(clampTrainingGroundBoardSize(11)).toBe(19);
    });

    it('maps kata -1 unlock ability from the championship ladder', () => {
        expect(minAbilityScoreForKataLevel(-1, CHAMPIONSHIP_ABILITY_KATA_LADDER)).toBe(940);
    });
});

describe('trainingGround tickets', () => {
    it('keeps 1/1 on a fresh day and after a loss (no claim)', () => {
        const user = baseUser();
        const fresh = getTrainingGroundTrackState(user, 'kata');
        expect(fresh.remaining).toBe(1);
        expect(fresh.canWatchAd).toBe(false);
        expect(getTrainingGroundTrackState(user, 'kata').remaining).toBe(1);
    });

    it('consumes to 0/1 only after a win claim and grants table isolation from waiting-room AI', () => {
        const user = baseUser();
        const claimed = claimTrainingGroundWin(user, 'kata', -30);
        expect(claimed.ok).toBe(true);
        const afterWin = getTrainingGroundTrackState(user, 'kata');
        expect(afterWin.remaining).toBe(0);
        expect(afterWin.canWatchAd).toBe(true);
        expect(isWaitingRoomAiGame({ isAiGame: true, settings: { trainingGround: { track: 'kata', kataLevel: -30, boardSize: 19 } } })).toBe(false);
        expect(isWaitingRoomAiGame({ isAiGame: true })).toBe(true);
        expect(isTrainingGroundSession({ settings: { trainingGround: { track: 'kata', kataLevel: -30, boardSize: 19 } } })).toBe(true);
        expect(isTrainingGroundSession({ settings: {} })).toBe(false);
    });

    it('restores with ad once per KST day then blocks further ads', () => {
        const user = baseUser();
        claimTrainingGroundWin(user, 'kata', -20);
        const granted = grantTrainingGroundAdRestore(user, 'kata');
        expect(granted.ok).toBe(true);
        expect(getTrainingGroundTrackState(user, 'kata').remaining).toBe(1);
        claimTrainingGroundWin(user, 'kata', -20);
        expect(getTrainingGroundTrackState(user, 'kata').remaining).toBe(0);
        expect(getTrainingGroundTrackState(user, 'kata').canWatchAd).toBe(false);
        expect(grantTrainingGroundAdRestore(user, 'kata').ok).toBe(false);
    });

    it('resets claimed and ad flags on a new KST day', () => {
        const user = baseUser({
            trainingGround: {
                kata: { dayKST: '2000-01-01', rewardsClaimed: 2, adRestored: true },
                pet: { dayKST: '2000-01-01', rewardsClaimed: 1, adRestored: true },
            },
        });
        const kata = getTrainingGroundTrackState(user, 'kata');
        const pet = getTrainingGroundTrackState(user, 'pet');
        expect(kata.remaining).toBe(1);
        expect(kata.canWatchAd).toBe(false);
        expect(kata.adRestored).toBe(false);
        expect(pet.remaining).toBe(1);
    });
});

describe('training machine option clamps', () => {
    it('reuses strategic AI item, board, scoring-turn, and clock clamps', () => {
        const hidden = clampAiLobbyStrategicItemCaps(GameMode.Hidden, {
            ...DEFAULT_GAME_SETTINGS,
            hiddenStoneCount: 4,
            scanCount: 9,
        });
        expect(hidden.hiddenStoneCount).toBe(1);
        expect(hidden.scanCount).toBe(3);

        const missile = clampAiLobbyStrategicItemCaps(GameMode.Missile, {
            ...DEFAULT_GAME_SETTINGS,
            missileCount: 9,
        });
        expect(missile.missileCount).toBe(3);

        const komi = clampAiLobbyStrategicItemCaps(GameMode.Standard, {
            ...DEFAULT_GAME_SETTINGS,
            komi: 20.5,
        });
        expect(komi.komi).toBe(8.5);

        expect(pairLobbyDraftBoardSizeOptions(GameMode.Capture, 'strategic')).toEqual([9, 13]);
        expect(pairLobbyDraftBoardSizeOptions(GameMode.Standard, 'strategic')).toEqual([9, 13, 19]);
        expect(pairLobbyDraftBoardSizeOptions(GameMode.Speed, 'strategic')).toEqual([9, 13, 19]);
        expect(pairLobbyDraftBoardSizeOptions(GameMode.Mix, 'strategic')).toEqual([9, 13]);

        expect(getAiScoringTurnLimitByBoardSize(9)).toBe(50);
        expect(getAiScoringTurnLimitByBoardSize(13)).toBe(80);
        expect(getAiScoringTurnLimitByBoardSize(19)).toBe(200);

        const clocks = sanitizePvpGameSettings(
            GameMode.Standard,
            { ...DEFAULT_GAME_SETTINGS, timeLimit: 10, byoyomiTime: 30, byoyomiCount: 3, timeIncrement: 5 },
            { isAiGame: true },
        );
        expect(clocks.timeLimit).toBe(0);
        expect(clocks.byoyomiTime).toBe(0);
        expect(clocks.byoyomiCount).toBe(0);
        expect(clocks.timeIncrement).toBe(0);

        const pairClocks = transformPairArenaAiMatchSettings(GameMode.Standard, {
            ...DEFAULT_GAME_SETTINGS,
            timeLimit: 10,
        }, 'strategic');
        expect(pairClocks.timeLimit).toBe(0);
    });

    it('rejects mix submodes below 2 and requires an equipped pair pet', () => {
        const mixSettings = { ...DEFAULT_GAME_SETTINGS, mixedModes: [GameMode.Hidden] };
        const mixStartInvalid = mixSettings.mixedModes.length < 2;
        expect(mixStartInvalid).toBe(true);
        expect(getEquippedPairPetInventoryRow(baseUser())).toBeNull();
    });
});
