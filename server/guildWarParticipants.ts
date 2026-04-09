import type { Guild } from '../types/index.js';
/** 매칭 시: 신청 명단이 있으면 사용, 없으면 길드원 전체(자동 참여 정책) */
export function takePendingParticipantsOrDefault(guild: Guild | undefined): string[] {
    const pending = (guild as any)?.guildWarPendingParticipantIds as string[] | undefined;
    if (Array.isArray(pending) && pending.length > 0) {
        return [...new Set(pending.filter((id) => typeof id === 'string' && id.length > 0))];
    }
    return (guild?.members || []).map((m) => m.userId);
}
