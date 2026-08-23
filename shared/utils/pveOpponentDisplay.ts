import type { LiveGameSession, User } from '../types/entities.js';
import { GameMode } from '../types/enums.js';
import { aiUserId } from '../constants/auth.js';
import { getAdventureCodexMonsterById, getAdventureMonsterPortraitUrl } from '../../constants/adventureMonstersCodex.js';
import { TOWER_AI_BOT_DISPLAY_NAME } from '../../constants/towerConstants.js';
import { isTrainingGroundSession } from '../constants/trainingGround.js';
import {
    PVE_GUILD_WAR_BOT_AVATAR_URL,
    PVE_SINGLEPLAYER_BOT_AVATAR_URL,
    PVE_TOWER_BOT_AVATAR_URL,
    pveBotAvatarUrlForMode,
} from '../constants/pveBotProfiles.js';
import { getPairPetDefinition, getPairPetDisplayName } from '../constants/petLobby.js';
import { getEquippedPairPetInventoryRow } from './pairEquippedPet.js';
import { resolvePairPetMetaFromInventoryRow } from './pairPetRoll.js';
import { resolveUserAvatarUrlOrDefault, resolveUserPortraitUrls } from './userPortrait.js';

export type PveAiSeatDisplayProfile = {
    nickname: string;
    avatarUrl: string;
    borderUrl?: string | null;
    userLevel?: number;
};

function humanUserFromSession(session: LiveGameSession): User | null {
    if (session.player1?.id && session.player1.id !== aiUserId) return session.player1;
    if (session.player2?.id && session.player2.id !== aiUserId) return session.player2;
    return null;
}

function trainingGroundPetPortraitUrl(user: User | null | undefined): string | null {
    if (!user) return null;
    const templateId = user.equippedPairPetTemplateId;
    if (templateId) {
        return getPairPetDefinition(templateId)?.image ?? null;
    }
    const row = getEquippedPairPetInventoryRow(user);
    if (!row?.templateId) return null;
    return getPairPetDefinition(row.templateId)?.image ?? null;
}

function trainingGroundPetDisplayName(user: User | null | undefined, fallbackNickname: string): string {
    if (!user) return fallbackNickname;
    const row = getEquippedPairPetInventoryRow(user);
    if (!row) return fallbackNickname;
    const meta = resolvePairPetMetaFromInventoryRow(row);
    const level = Math.max(1, Math.floor(meta.level) || 1);
    return `Lv.${level} ${getPairPetDisplayName(row)}`;
}

/**
 * PVE AI 좌석(상대) 표시용 프로필.
 * 모험 몬스터는 PlayerPanel·프리게임에서 별도 몬스터 포트레이트 경로를 유지한다.
 */
export function resolvePveAiSeatDisplayProfile(
    session: LiveGameSession,
    aiSeatUser: User,
): PveAiSeatDisplayProfile | null {
    if (!session.isAiGame || aiSeatUser.id !== aiUserId) return null;

    const human = humanUserFromSession(session);
    const category = String(session.gameCategory ?? '');

    if (category === 'adventure' && session.adventureMonsterCodexId) {
        const monster = getAdventureCodexMonsterById(session.adventureMonsterCodexId);
        if (monster?.name) {
            return {
                nickname: monster.name,
                avatarUrl: getAdventureMonsterPortraitUrl(monster),
                userLevel: Math.max(1, session.adventureMonsterLevel ?? 1),
            };
        }
    }

    if (isTrainingGroundSession(session)) {
        const meta = session.settings?.trainingGround;
        if (meta?.track === 'kata' && human) {
            const portrait = resolveUserPortraitUrls({
                avatarId: human.avatarId,
                borderId: human.borderId,
            });
            return {
                nickname: human.nickname,
                avatarUrl: resolveUserAvatarUrlOrDefault(human.avatarId),
                borderUrl: portrait.borderUrl,
                userLevel: human.userLevel,
            };
        }
        if (meta?.track === 'pet') {
            const portraitUrl = trainingGroundPetPortraitUrl(aiSeatUser) ?? trainingGroundPetPortraitUrl(human);
            const nickname =
                typeof aiSeatUser.nickname === 'string' && aiSeatUser.nickname.length > 0
                    ? aiSeatUser.nickname
                    : trainingGroundPetDisplayName(human, aiSeatUser.nickname);
            const petRow = human ? getEquippedPairPetInventoryRow(human) : null;
            const level =
                typeof aiSeatUser.userLevel === 'number'
                    ? aiSeatUser.userLevel
                    : petRow
                      ? resolvePairPetMetaFromInventoryRow(petRow).level
                      : undefined;
            return {
                nickname,
                avatarUrl: portraitUrl ?? '/images/pets/pet1.webp',
                userLevel: level,
            };
        }
    }

    if (session.isSinglePlayer || category === 'singleplayer') {
        return {
            nickname: aiSeatUser.nickname,
            avatarUrl: PVE_SINGLEPLAYER_BOT_AVATAR_URL,
            userLevel: aiSeatUser.userLevel,
        };
    }

    if (category === 'tower') {
        return {
            nickname: TOWER_AI_BOT_DISPLAY_NAME,
            avatarUrl: PVE_TOWER_BOT_AVATAR_URL,
            userLevel: aiSeatUser.userLevel,
        };
    }

    if (category === 'guildwar') {
        return {
            nickname: aiSeatUser.nickname,
            avatarUrl: PVE_GUILD_WAR_BOT_AVATAR_URL,
            userLevel: aiSeatUser.userLevel,
        };
    }

    const mode = session.mode ?? GameMode.Standard;
    return {
        nickname: aiSeatUser.nickname,
        avatarUrl: pveBotAvatarUrlForMode(mode),
        userLevel: aiSeatUser.userLevel,
    };
}

/** 프리게임·색 선택 등 `avatarUrlOverrides`용 */
export function resolvePveAiSeatAvatarUrlOverride(session: LiveGameSession): Partial<Record<string, string>> | undefined {
    const aiSeat = session.player1?.id === aiUserId ? session.player1 : session.player2?.id === aiUserId ? session.player2 : null;
    if (!aiSeat) return undefined;
    const profile = resolvePveAiSeatDisplayProfile(session, aiSeat);
    if (!profile?.avatarUrl) return undefined;
    return { [aiUserId]: profile.avatarUrl };
}

export function applyPveAiSeatDisplayToUser(session: LiveGameSession, user: User): User {
    const profile = resolvePveAiSeatDisplayProfile(session, user);
    if (!profile) return user;
    return {
        ...user,
        nickname: profile.nickname,
        userLevel: profile.userLevel ?? user.userLevel,
    };
}
