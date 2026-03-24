import type { Guild } from '../types/index.js';
import { GUILD_WAR_MAX_PARTICIPANTS } from '../shared/constants/index.js';

/** 매칭 시: 신청 명단이 있으면 사용, 없으면 길드원 중 최대 10명(레거시·백필) */
export function takePendingParticipantsOrDefault(guild: Guild | undefined): string[] {
    const pending = (guild as any)?.guildWarPendingParticipantIds as string[] | undefined;
    if (Array.isArray(pending) && pending.length > 0) {
        return [...new Set(pending.filter((id) => typeof id === 'string' && id.length > 0))];
    }
    const ids = (guild?.members || []).map((m) => m.userId);
    return ids.slice(0, GUILD_WAR_MAX_PARTICIPANTS);
}
