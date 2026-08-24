import { describe, expect, it } from 'vitest';
import { GameMode } from '../../../shared/types/enums.js';
import { aiUserId } from '../../../shared/constants/auth.js';
import { TOWER_AI_BOT_DISPLAY_NAME } from '../../../constants/towerConstants.js';
import {
    pveBotAvatarUrlForMode,
    PVE_SINGLEPLAYER_BOT_AVATAR_URL,
    PVE_TOWER_BOT_AVATAR_URL,
} from '../../../shared/constants/pveBotProfiles.js';
import {
    resolvePveAiSeatDisplayProfile,
    resolvePveAiSeatAvatarUrlOverride,
} from '../../../shared/utils/pveOpponentDisplay.js';

function makeSession(overrides: Record<string, unknown> = {}) {
    return {
        isAiGame: true,
        mode: GameMode.Standard,
        player1: {
            id: 'human-1',
            nickname: '유저닉',
            avatarId: 'profile_5',
            borderId: 'default',
            userLevel: 12,
        },
        player2: {
            id: aiUserId,
            nickname: '클래식 바둑봇',
            avatarId: 'pve_bot_standard',
            userLevel: 50,
        },
        settings: {},
        ...overrides,
    } as any;
}

describe('pveBotProfiles', () => {
    it('maps each lobby mode to a distinct avatar URL', () => {
        const standard = pveBotAvatarUrlForMode(GameMode.Standard);
        const capture = pveBotAvatarUrlForMode(GameMode.Capture);
        const dice = pveBotAvatarUrlForMode(GameMode.Dice);
        expect(standard).toContain('/images/pve-bots/standard.webp');
        expect(capture).toContain('/images/pve-bots/capture.webp');
        expect(dice).toContain('/images/pve-bots/dice.webp');
        expect(standard).not.toBe(capture);
        expect(capture).not.toBe(dice);
    });
});

describe('resolvePveAiSeatDisplayProfile', () => {
    it('uses mode-specific bot nickname from AI seat user', () => {
        const session = makeSession({
            mode: GameMode.Hidden,
            player2: {
                id: aiUserId,
                nickname: '히든 바둑봇',
                avatarId: 'pve_bot_hidden',
                userLevel: 50,
            },
        });
        const profile = resolvePveAiSeatDisplayProfile(session, session.player2);
        expect(profile?.nickname).toBe('히든 바둑봇');
        expect(profile?.avatarUrl).toBe(pveBotAvatarUrlForMode(GameMode.Hidden));
    });

    it('mirrors user profile for 심법 수련 (kata track)', () => {
        const session = makeSession({
            settings: { trainingGround: { track: 'kata', kataLevel: -30, boardSize: 19 } },
        });
        const profile = resolvePveAiSeatDisplayProfile(session, session.player2);
        expect(profile?.nickname).toBe('유저닉');
        expect(profile?.avatarUrl).toContain('/images/profiles/profile5.webp');
        expect(profile?.userLevel).toBe(12);
    });

    it('shows equipped pet portrait for 단짝 수련 (pet track)', () => {
        const session = makeSession({
            player1: {
                id: 'human-1',
                nickname: '유저닉',
                equippedPairPetTemplateId: 'pair-pet-1',
                inventory: [
                    {
                        id: 'pet-row-1',
                        templateId: 'pair-pet-1',
                        name: '펫1',
                        type: 'pairPet',
                        isEquipped: true,
                        slot: 'pairPet',
                        pairPetMeta: { level: 7 },
                    },
                ],
            },
            player2: {
                id: aiUserId,
                nickname: 'Lv.7 테스트펫',
                userLevel: 7,
                equippedPairPetTemplateId: 'pair-pet-1',
            },
            settings: { trainingGround: { track: 'pet', kataLevel: -30, boardSize: 19 } },
        });
        const profile = resolvePveAiSeatDisplayProfile(session, session.player2);
        expect(profile?.nickname).toBe('루미폭스 (봇)');
        expect(profile?.avatarUrl).toBe('/images/pets/pet1.webp');
        expect(profile?.displayLevelText).toBe('1단계');
    });

    it('uses dedicated assets for singleplayer and tower', () => {
        const sp = makeSession({ isSinglePlayer: true, gameCategory: 'singleplayer' });
        expect(resolvePveAiSeatDisplayProfile(sp, sp.player2)?.avatarUrl).toBe(PVE_SINGLEPLAYER_BOT_AVATAR_URL);

        const tower = makeSession({
            gameCategory: 'tower',
            player2: { ...makeSession().player2, nickname: TOWER_AI_BOT_DISPLAY_NAME },
        });
        expect(resolvePveAiSeatDisplayProfile(tower, tower.player2)?.avatarUrl).toBe(PVE_TOWER_BOT_AVATAR_URL);
        expect(resolvePveAiSeatDisplayProfile(tower, tower.player2)?.nickname).toBe(TOWER_AI_BOT_DISPLAY_NAME);
    });

    it('exposes avatar override map for pre-game UI', () => {
        const session = makeSession({ mode: GameMode.Curling });
        expect(resolvePveAiSeatAvatarUrlOverride(session)).toEqual({
            [aiUserId]: pveBotAvatarUrlForMode(GameMode.Curling),
        });
    });
});
