import { describe, expect, it } from 'vitest';
import type { User } from '../../../types.js';
import { GameMode } from '../../../types.js';
import {
    championshipKataAbilityScore,
    CHAMPIONSHIP_ABILITY_KATA_LADDER,
} from '../../../shared/constants/championshipRealMatch.js';
import { DEFAULT_GAME_SETTINGS, getAiScoringTurnLimitByBoardSize } from '../../../shared/constants/gameSettings.js';
import {
    TRAINING_GROUND_KATA_LEVELS,
    TRAINING_GROUND_PET_UNLOCK_TOTAL_ABILITY_BY_STAGE,
    TRAINING_GROUND_KATA_UNLOCK_TOTAL_ABILITY_BY_STAGE,
    TRAINING_GROUND_REWARD_BAND_MIN_KATA,
    clampTrainingGroundBoardSize,
    isTrainingGroundSession,
    minAbilityScoreForKataLevel,
    normalizeTrainingGroundKataLevel,
    rewardForKataLevel,
    trainingGroundRewardBandIndex,
    trainingGroundStageNumber,
    trainingGroundUnlockTotalAbility,
    trainingGroundKataMirrorBotNickname,
} from '../../../shared/constants/trainingGround.js';
import {
    claimTrainingGroundWin,
    getTrainingGroundTrackState,
    grantTrainingGroundAdRestore,
} from '../../../shared/utils/trainingGroundDaily.js';
import {
    isTrainingGroundStageUnlocked,
    trainingGroundUserTotalAbility,
} from '../../../shared/utils/trainingGroundProgress.js';
import { isWaitingRoomAiGame } from '../../../shared/utils/strategicAiDifficulty.js';
import { clampAiLobbyStrategicItemCaps } from '../../../shared/utils/strategicAiLobbyItemCaps.js';
import { pairLobbyDraftBoardSizeOptions } from '../../../shared/utils/pairLobbyGameSettingRows.js';
import { sanitizePvpGameSettings } from '../../../shared/utils/sanitizePvpGameSettings.js';
import { transformPairArenaAiMatchSettings } from '../../../shared/utils/pairArenaAiMatchSettings.js';
import { getEquippedPairPetInventoryRow } from '../../../shared/utils/pairEquippedPet.js';
import {
    buildTrainingGroundGameSettings,
    isTrainingGroundModeCompatibleWithBoard,
    refreshTrainingGroundLiveSessionSettings,
    trainingGroundSelectableGameModes,
} from '../../../shared/utils/trainingGroundGameSettings.js';

const baseUser = (overrides: Partial<User> = {}): User =>
    ({
        id: 'u-tg',
        nickname: 'trainer',
        ...overrides,
    }) as User;

describe('trainingGround stages', () => {
    it('builds 40 kata stages and skips 0', () => {
        expect(TRAINING_GROUND_KATA_LEVELS).toHaveLength(40);
        expect(TRAINING_GROUND_KATA_LEVELS).not.toContain(0);
        expect(TRAINING_GROUND_KATA_LEVELS[0]).toBe(-30);
        expect(TRAINING_GROUND_KATA_LEVELS[29]).toBe(-1);
        expect(TRAINING_GROUND_KATA_LEVELS[30]).toBe(1);
        expect(TRAINING_GROUND_KATA_LEVELS[38]).toBe(9);
        expect(TRAINING_GROUND_KATA_LEVELS[39]).toBe(10);
        expect(trainingGroundStageNumber(-30)).toBe(1);
        expect(trainingGroundStageNumber(-1)).toBe(30);
        expect(trainingGroundStageNumber(1)).toBe(31);
        expect(trainingGroundStageNumber(9)).toBe(39);
        expect(trainingGroundStageNumber(10)).toBe(40);
    });

    it('treats computed kata 0 as -1 for unlock ladder lookup', () => {
        expect(normalizeTrainingGroundKataLevel(0)).toBe(-1);
        expect(trainingGroundUnlockTotalAbility(-1, 'kata')).toBe(940 * 3);
        expect(trainingGroundUnlockTotalAbility(10, 'kata')).toBe(1400 * 3);
    });

    it('unlocks kata stages when 초·중·종 합산 바둑능력 meets threshold', () => {
        const stageMinus1Total = trainingGroundUnlockTotalAbility(-1, 'kata');
        expect(isTrainingGroundStageUnlocked(stageMinus1Total, -1, 'kata')).toBe(true);
        expect(isTrainingGroundStageUnlocked(stageMinus1Total - 1, -1, 'kata')).toBe(false);
        expect(isTrainingGroundStageUnlocked(stageMinus1Total, 1, 'kata')).toBe(false);
        expect(isTrainingGroundStageUnlocked(trainingGroundUnlockTotalAbility(1, 'kata'), 1, 'kata')).toBe(true);
    });

    it('maps pet unlock ability per stage from fixed table (초·중·종 합)', () => {
        expect(TRAINING_GROUND_PET_UNLOCK_TOTAL_ABILITY_BY_STAGE).toHaveLength(40);
        expect(trainingGroundUnlockTotalAbility(-30, 'pet')).toBe(270);
        expect(trainingGroundUnlockTotalAbility(10, 'pet')).toBe(630);
        expect(trainingGroundUnlockTotalAbility(-1, 'pet')).toBe(501);

        const petStageMinus1Total = trainingGroundUnlockTotalAbility(-1, 'pet');
        expect(isTrainingGroundStageUnlocked(petStageMinus1Total, -1, 'pet')).toBe(true);
        expect(isTrainingGroundStageUnlocked(petStageMinus1Total - 1, -1, 'pet')).toBe(false);
        expect(isTrainingGroundStageUnlocked(2820, -1, 'kata')).toBe(true);
        expect(isTrainingGroundStageUnlocked(600, -1, 'pet')).toBe(true);
        expect(isTrainingGroundStageUnlocked(600, -1, 'kata')).toBe(false);
    });

    it('never exposes zero unlock thresholds across all 40 stages', () => {
        for (const kataLevel of TRAINING_GROUND_KATA_LEVELS) {
            expect(trainingGroundUnlockTotalAbility(kataLevel, 'kata')).toBeGreaterThan(0);
            expect(trainingGroundUnlockTotalAbility(kataLevel, 'pet')).toBeGreaterThan(0);
        }
        expect(TRAINING_GROUND_KATA_UNLOCK_TOTAL_ABILITY_BY_STAGE.every((v) => v > 0)).toBe(true);
        expect(TRAINING_GROUND_PET_UNLOCK_TOTAL_ABILITY_BY_STAGE.every((v) => v > 0)).toBe(true);
    });

    it('sums opening, midgame, and endgame for user total ability', () => {
        const stats = {
            concentration: 100,
            thinkingSpeed: 100,
            judgment: 100,
            calculation: 100,
            combatPower: 100,
            stability: 100,
        };
        const total = trainingGroundUserTotalAbility(stats);
        expect(total).toBe(
            championshipKataAbilityScore('opening', stats) +
                championshipKataAbilityScore('midgame', stats) +
                championshipKataAbilityScore('endgame', stats),
        );
    });

    it('scales 19/13/9 rewards at 100/50/25 percent', () => {
        expect(rewardForKataLevel(-30, 19)).toEqual({ gold: 1000, diamonds: 5, kataUserXp: 100, petXp: 80 });
        expect(rewardForKataLevel(-30, 13)).toEqual({ gold: 500, diamonds: 3, kataUserXp: 50, petXp: 40 });
        expect(rewardForKataLevel(-30, 9)).toEqual({ gold: 250, diamonds: 1, kataUserXp: 25, petXp: 20 });
        expect(rewardForKataLevel(-1, 19)).toEqual({ gold: 53550, diamonds: 53, kataUserXp: 1800, petXp: 1440 });
        expect(rewardForKataLevel(-1, 13)).toEqual({ gold: 26775, diamonds: 27, kataUserXp: 900, petXp: 720 });
        expect(rewardForKataLevel(-1, 9)).toEqual({ gold: 13388, diamonds: 13, kataUserXp: 450, petXp: 360 });
        expect(rewardForKataLevel(9, 19)).toEqual({ gold: 97850, diamonds: 79, kataUserXp: 4850, petXp: 3880 });
        expect(clampTrainingGroundBoardSize(11)).toBe(19);
    });

    it('kata user xp rises per stage with larger band jumps in later tiers', () => {
        expect(rewardForKataLevel(-30, 19).kataUserXp).toBe(100);
        expect(rewardForKataLevel(10, 19).kataUserXp).toBe(5000);
        expect(rewardForKataLevel(-26, 19).kataUserXp).toBeGreaterThan(rewardForKataLevel(-30, 19).kataUserXp);
        expect(rewardForKataLevel(1, 19).kataUserXp - rewardForKataLevel(-1, 19).kataUserXp).toBeGreaterThanOrEqual(300);
        expect(rewardForKataLevel(10, 19).kataUserXp - rewardForKataLevel(9, 19).kataUserXp).toBeGreaterThanOrEqual(100);
    });

    it('pet xp rises per stage with the same curve shape as kata user xp (×0.8)', () => {
        expect(rewardForKataLevel(-30, 19).petXp).toBe(80);
        expect(rewardForKataLevel(10, 19).petXp).toBe(4000);
        expect(rewardForKataLevel(-26, 19).petXp).toBeGreaterThan(rewardForKataLevel(-30, 19).petXp);
        expect(rewardForKataLevel(1, 19).petXp - rewardForKataLevel(-1, 19).petXp).toBeGreaterThanOrEqual(240);
        expect(rewardForKataLevel(10, 19).petXp - rewardForKataLevel(9, 19).petXp).toBeGreaterThanOrEqual(80);
        expect(rewardForKataLevel(-30, 19).petXp * 10).toBe(rewardForKataLevel(-30, 19).kataUserXp * 8);
    });

    it('increases gold and diamonds each stage with larger jumps at reward bands', () => {
        expect(TRAINING_GROUND_REWARD_BAND_MIN_KATA).toEqual([-25, -18, -10, -5, -1, 1, 3, 5, 7, 9]);
        expect(trainingGroundRewardBandIndex(-30)).toBe(0);
        expect(trainingGroundRewardBandIndex(-26)).toBe(0);
        expect(rewardForKataLevel(-26, 19).gold).toBeGreaterThan(rewardForKataLevel(-30, 19).gold);
        expect(rewardForKataLevel(-26, 19).diamonds).toBeGreaterThan(rewardForKataLevel(-30, 19).diamonds);

        const prevKata = [-26, -19, -11, -6, -2, -1, 2, 4, 6, 8];
        TRAINING_GROUND_REWARD_BAND_MIN_KATA.forEach((minKata, i) => {
            expect(trainingGroundRewardBandIndex(minKata)).toBe(i + 1);
            const jumped = rewardForKataLevel(minKata, 19);
            const previous = rewardForKataLevel(prevKata[i], 19);
            expect(jumped.gold).toBeGreaterThan(previous.gold);
            expect(jumped.diamonds).toBeGreaterThan(previous.diamonds);
        });
        expect(rewardForKataLevel(10, 19)).toEqual({ gold: 100000, diamonds: 80, kataUserXp: 5000, petXp: 4000 });
    });

    it('maps kata -1 unlock ability from the championship ladder table', () => {
        expect(minAbilityScoreForKataLevel(-1, CHAMPIONSHIP_ABILITY_KATA_LADDER)).toBe(940);
        expect(trainingGroundUnlockTotalAbility(-1, 'kata')).toBe(2820);
        expect(minAbilityScoreForKataLevel(10, CHAMPIONSHIP_ABILITY_KATA_LADDER)).toBe(1400);
        expect(trainingGroundUnlockTotalAbility(10, 'kata')).toBe(4200);
        expect(trainingGroundStageNumber(10)).toBe(40);
        expect(rewardForKataLevel(10, 19).kataUserXp).toBe(5000);
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

describe('trainingGround game settings', () => {
    it('lists training-ground selectable modes in fixed order', () => {
        const modes = trainingGroundSelectableGameModes().map((m) => m.mode);
        expect(modes).toEqual([
            GameMode.Standard,
            GameMode.Speed,
            GameMode.Capture,
            GameMode.Base,
            GameMode.Hidden,
            GameMode.Missile,
        ]);
    });

    it('disables 19×19 for capture-style modes', () => {
        expect(isTrainingGroundModeCompatibleWithBoard(GameMode.Standard, 19)).toBe(true);
        expect(isTrainingGroundModeCompatibleWithBoard(GameMode.Capture, 19)).toBe(false);
        expect(isTrainingGroundModeCompatibleWithBoard(GameMode.Capture, 13)).toBe(true);
        expect(isTrainingGroundModeCompatibleWithBoard(GameMode.Hidden, 9)).toBe(true);
    });

    it('formats kata mirror bot nickname from login id', () => {
        expect(trainingGroundKataMirrorBotNickname('mylogin')).toBe('mylogin(봇)');
        expect(trainingGroundKataMirrorBotNickname('  ')).toBe('(봇)');
    });

    it('builds fixed AI lobby settings per mode with trainingGround meta', () => {
        const standard = buildTrainingGroundGameSettings(GameMode.Standard, 'kata', -12, 19);
        expect(standard.boardSize).toBe(19);
        expect(standard.timeLimit).toBe(0);
        expect(standard.kataServerLevel).toBe(-12);
        expect(standard.trainingGround).toEqual({
            track: 'kata',
            kataLevel: -12,
            boardSize: 19,
            gameMode: GameMode.Standard,
        });
        expect(standard.scoringTurnLimit).toBe(getAiScoringTurnLimitByBoardSize(19));

        const speed = buildTrainingGroundGameSettings(GameMode.Speed, 'pet', -1, 13);
        expect(speed.boardSize).toBe(13);
        expect(speed.trainingGround?.track).toBe('pet');
        expect(speed.trainingGround?.gameMode).toBe(GameMode.Speed);

        const hidden = buildTrainingGroundGameSettings(GameMode.Hidden, 'kata', -12, 13);
        expect(hidden.hiddenStoneCount).toBe(1);
        expect(hidden.scanCount).toBeLessThanOrEqual(3);
    });

    it('refreshTrainingGroundLiveSessionSettings restores selected mode and item caps', () => {
        const game = {
            mode: GameMode.Standard,
            settings: buildTrainingGroundGameSettings(GameMode.Missile, 'kata', -5, 13),
        };
        game.mode = GameMode.Standard;
        refreshTrainingGroundLiveSessionSettings(game);
        expect(game.mode).toBe(GameMode.Missile);
        expect(game.settings.missileCount).toBe(3);
        expect(game.settings.trainingGround?.gameMode).toBe(GameMode.Missile);
    });
});
