import { describe, expect, it } from 'vitest';
import type { ChatMessage } from '../../../shared/types/api.js';
import {
    mergeWaitingRoomPublicChatMessages,
    resolvePublicWaitingRoomChatStoreChannel,
} from '../../../shared/utils/waitingRoomGlobalChatMerge.js';

const msg = (id: string, timestamp: number): ChatMessage => ({
    id,
    user: { id: 'u1', nickname: 'tester' },
    text: id,
    system: false,
    timestamp,
});

describe('waitingRoomGlobalChatMerge', () => {
    it('resolves strategic and playful store channels to global', () => {
        expect(resolvePublicWaitingRoomChatStoreChannel('strategic')).toBe('global');
        expect(resolvePublicWaitingRoomChatStoreChannel('playful')).toBe('global');
        expect(resolvePublicWaitingRoomChatStoreChannel('global')).toBe('global');
        expect(resolvePublicWaitingRoomChatStoreChannel('game-abc')).toBe('game-abc');
    });

    it('merges public channels by id and sorts by timestamp', () => {
        const merged = mergeWaitingRoomPublicChatMessages({
            global: [msg('g2', 200), msg('g1', 100)],
            strategic: [msg('s1', 150), msg('g1', 100)],
            playful: [msg('p1', 175)],
        });
        expect(merged.map((m) => m.id)).toEqual(['g1', 's1', 'p1', 'g2']);
    });

    it('caps merged output to the most recent messages', () => {
        const chats: Record<string, ChatMessage[]> = { global: [], strategic: [], playful: [] };
        for (let i = 0; i < 60; i++) chats.global!.push(msg(`g${i}`, i));
        for (let i = 0; i < 60; i++) chats.strategic!.push(msg(`s${i}`, 1000 + i));

        const merged = mergeWaitingRoomPublicChatMessages(chats, 100);
        expect(merged).toHaveLength(100);
        expect(merged[0]?.id).toBe('g20');
        expect(merged[merged.length - 1]?.id).toBe('s59');
    });
});
