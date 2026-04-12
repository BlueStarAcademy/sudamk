import { LiveGameSession, User } from '../types.js';
import { aiUserId } from '../constants';
import { getAdventureCodexMonsterById } from '../constants/adventureMonstersCodex.js';

/** 모험 맵 AI 대국 등에서 봇 닉네임 대신 몬스터명을 쓸 때 */
export function getSessionPlayerDisplayName(session: LiveGameSession, user: User | null | undefined): string {
    if (!user) return '';
    if (
        session.gameCategory === 'adventure' &&
        session.isAiGame &&
        user.id === aiUserId &&
        session.adventureMonsterCodexId
    ) {
        const m = getAdventureCodexMonsterById(session.adventureMonsterCodexId);
        if (m?.name) return m.name;
    }
    return user.nickname;
}
