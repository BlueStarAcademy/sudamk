import type { ChatMessage } from '../types/api.js';

/** 전체(공개) 대기실 채팅에 병합 표시할 채널 — 레거시 strategic/playful 포함 */
export const WAITING_ROOM_PUBLIC_CHAT_CHANNELS = ['global', 'strategic', 'playful'] as const;

export type WaitingRoomPublicChatChannel = (typeof WAITING_ROOM_PUBLIC_CHAT_CHANNELS)[number];

/** strategic/playful 전송을 global 저장소로 통일 (게임·길드 등 다른 채널은 그대로) */
export function resolvePublicWaitingRoomChatStoreChannel(channel: string): string {
    if (channel === 'strategic' || channel === 'playful') return 'global';
    return channel;
}

const PUBLIC_CHAT_DISPLAY_CAP = 100;

/** global + strategic + playful 메시지를 id 기준 중복 제거 후 시간순 병합 */
export function mergeWaitingRoomPublicChatMessages(
    chats: Record<string, ChatMessage[] | undefined>,
    maxMessages = PUBLIC_CHAT_DISPLAY_CAP,
): ChatMessage[] {
    const byId = new Map<string, ChatMessage>();
    for (const channel of WAITING_ROOM_PUBLIC_CHAT_CHANNELS) {
        for (const msg of chats[channel] ?? []) {
            if (!msg?.id || byId.has(msg.id)) continue;
            byId.set(msg.id, msg);
        }
    }
    const sorted = [...byId.values()].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    if (sorted.length <= maxMessages) return sorted;
    return sorted.slice(sorted.length - maxMessages);
}
