import { LiveGameSession, User } from '../types.js';
import { aiUserId } from '../constants';
import { resolvePveAiSeatDisplayProfile } from '../shared/utils/pveOpponentDisplay.js';

/** 모험 맵 AI 대국 등에서 봇 닉네임 대신 몬스터명을 쓸 때 + PVE AI 좌석 전용 표시명 */
export function getSessionPlayerDisplayName(session: LiveGameSession, user: User | null | undefined): string {
    if (!user) return '';
    if (session.isAiGame && user.id === aiUserId) {
        const profile = resolvePveAiSeatDisplayProfile(session, user);
        if (profile?.nickname) return profile.nickname;
    }
    return user.nickname;
}

export type SessionPlayerRosterDisplay = {
    nickname: string;
    avatarUrl?: string;
    borderUrl?: string;
    userLevel: number;
};

/** 결과 모달 등: PVE AI 좌석 프로필·닉·레벨을 인게임과 동일하게 */
export function resolveSessionPlayerRosterDisplay(
    session: LiveGameSession | undefined,
    user: User,
): SessionPlayerRosterDisplay {
    if (session?.isAiGame && user.id === aiUserId) {
        const profile = resolvePveAiSeatDisplayProfile(session, user);
        if (profile) {
            return {
                nickname: profile.nickname,
                avatarUrl: profile.avatarUrl,
                borderUrl: profile.borderUrl ?? undefined,
                userLevel: profile.userLevel ?? user.userLevel,
            };
        }
    }
    return {
        nickname: user.nickname,
        userLevel: user.userLevel,
    };
}
