import { describe, expect, it } from 'vitest';
import { aiUserId } from '../../../shared/constants/auth.js';
import { isSyntheticOnlineUserId } from '../../../shared/utils/syntheticOnlineUserIds.js';

describe('isSyntheticOnlineUserId', () => {
    it('treats lobby AI and dungeon bots as synthetic', () => {
        expect(isSyntheticOnlineUserId(aiUserId)).toBe(true);
        expect(isSyntheticOnlineUserId('dungeon-bot-adventure-1')).toBe(true);
        expect(isSyntheticOnlineUserId('pet-ai-seat-1')).toBe(true);
        expect(isSyntheticOnlineUserId('pair-ai-opponent')).toBe(true);
    });

    it('allows real user ids', () => {
        expect(isSyntheticOnlineUserId('user-123')).toBe(false);
        expect(isSyntheticOnlineUserId(undefined)).toBe(false);
        expect(isSyntheticOnlineUserId(null)).toBe(false);
    });
});
