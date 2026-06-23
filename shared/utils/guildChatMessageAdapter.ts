import { ADMIN_NICKNAME, ADMIN_USER_ID } from '../../constants/index.js';
import type { ChatMessage, UserWithStatus } from '../../types.js';
import type { TFunction } from 'i18next';
import { translateGuildChatText, type GuildChatHistoryEntry } from './guildChatI18n.js';

export type { GuildChatHistoryEntry };

export function guildChatHistoryEntryToChatMessage(
    msg: GuildChatHistoryEntry,
    allUsers: Pick<UserWithStatus, 'id' | 'nickname' | 'isAdmin'>[],
    t?: TFunction,
): ChatMessage {
    const senderId = msg.user?.id || msg.authorId || 'system';
    const isSystem = senderId === 'system' || Boolean(msg.system);
    const sender = !isSystem ? allUsers.find((u) => u.id === senderId) : undefined;
    const nickname = isSystem
        ? t?.('lobby:chatInline.system') ?? '시스템'
        : msg.user?.nickname ||
          (senderId === ADMIN_USER_ID || sender?.isAdmin ? ADMIN_NICKNAME : sender?.nickname) ||
          (t?.('guild:war.unknownUser') ?? 'Unknown');
    const tsRaw = msg.timestamp ?? msg.createdAt;
    const timestamp = typeof tsRaw === 'number' ? tsRaw : new Date(tsRaw || 0).getTime();
    const text = t ? translateGuildChatText(msg, t) : msg.text || msg.content || '';

    return {
        id: msg.id || `guild-${senderId}-${timestamp}`,
        user: { id: senderId, nickname },
        text,
        system: isSystem,
        timestamp,
    };
}
