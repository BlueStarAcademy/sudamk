import { ADMIN_NICKNAME, ADMIN_USER_ID } from '../../constants/index.js';
import type { ChatMessage, UserWithStatus } from '../../types.js';

export type GuildChatHistoryEntry = {
    id?: string;
    authorId?: string;
    user?: { id: string; nickname: string };
    content?: string;
    text?: string;
    system?: boolean;
    timestamp?: number;
    createdAt?: number | string;
};

export function guildChatHistoryEntryToChatMessage(
    msg: GuildChatHistoryEntry,
    allUsers: Pick<UserWithStatus, 'id' | 'nickname' | 'isAdmin'>[],
): ChatMessage {
    const senderId = msg.user?.id || msg.authorId || 'system';
    const isSystem = senderId === 'system' || Boolean(msg.system);
    const sender = !isSystem ? allUsers.find((u) => u.id === senderId) : undefined;
    const nickname = isSystem
        ? '시스템'
        : msg.user?.nickname ||
          (senderId === ADMIN_USER_ID || sender?.isAdmin ? ADMIN_NICKNAME : sender?.nickname) ||
          'Unknown';
    const tsRaw = msg.timestamp ?? msg.createdAt;
    const timestamp = typeof tsRaw === 'number' ? tsRaw : new Date(tsRaw || 0).getTime();

    return {
        id: msg.id || `guild-${senderId}-${timestamp}`,
        user: { id: senderId, nickname },
        text: msg.text || msg.content || '',
        system: isSystem,
        timestamp,
    };
}
