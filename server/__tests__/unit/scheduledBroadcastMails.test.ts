import { describe, expect, it } from 'vitest';
import type { User } from '../../../types/index.js';
import {
    appendScheduledBroadcastMailToUser,
    buildScheduledBroadcastMailSpec,
    isWeekdayKst,
    isWeekendKst,
    resolveScheduledBroadcastSlot,
    scheduledBroadcastMailId,
    SCHEDULED_BROADCAST_CLAIM_MS,
} from '../../scheduledBroadcastMails.js';

/** 2026-06-09 화요일 13:02 KST */
const WEEKDAY_LUNCH_MS = Date.UTC(2026, 5, 9, 4, 2, 0);
/** 2026-06-07 토요일 13:02 KST */
const WEEKEND_LUNCH_MS = Date.UTC(2026, 5, 6, 4, 2, 0);
/** 2026-06-09 화요일 19:03 KST */
const WEEKDAY_EVENING_MS = Date.UTC(2026, 5, 9, 10, 3, 0);
/** 2026-06-07 토요일 19:03 KST */
const WEEKEND_EVENING_MS = Date.UTC(2026, 5, 6, 10, 3, 0);

describe('scheduledBroadcastMails', () => {
    it('detects weekday vs weekend in KST', () => {
        expect(isWeekdayKst(WEEKDAY_LUNCH_MS)).toBe(true);
        expect(isWeekendKst(WEEKDAY_LUNCH_MS)).toBe(false);
        expect(isWeekendKst(WEEKEND_LUNCH_MS)).toBe(true);
    });

    it('resolves lunch and evening slots within the 5-minute window', () => {
        expect(resolveScheduledBroadcastSlot(WEEKDAY_LUNCH_MS)).toBe('lunch');
        expect(resolveScheduledBroadcastSlot(WEEKDAY_EVENING_MS)).toBe('evening');
        expect(resolveScheduledBroadcastSlot(WEEKDAY_LUNCH_MS + 6 * 60 * 1000)).toBeNull();
        expect(resolveScheduledBroadcastSlot(WEEKDAY_LUNCH_MS - 60 * 60 * 1000)).toBeNull();
    });

    it('builds weekday lunch mail with 10 action points and gold', () => {
        const spec = buildScheduledBroadcastMailSpec('lunch', false);
        expect(spec.message).toContain('즐거운 점심시간 되세요!');
        expect(spec.attachments.actionPoints).toBe(10);
        expect(spec.attachments.gold).toBe(1000);
        expect(spec.attachments.items).toBeUndefined();
    });

    it('builds weekday evening mail with material box II and gold', () => {
        const spec = buildScheduledBroadcastMailSpec('evening', false);
        expect(spec.message).toContain('오늘도 수고많았어요.');
        expect(spec.attachments.gold).toBe(1000);
        expect(spec.attachments.items).toEqual([{ itemId: '재료상자2', quantity: 1 }]);
    });

    it('builds weekend lunch mail with AP, equipment box IV, and gold', () => {
        const spec = buildScheduledBroadcastMailSpec('lunch', true);
        expect(spec.message).toContain('즐거운 주말 보내세요!');
        expect(spec.attachments.actionPoints).toBe(30);
        expect(spec.attachments.gold).toBe(3000);
        expect(spec.attachments.items).toEqual([{ itemId: '장비상자4', quantity: 1 }]);
    });

    it('builds weekend evening mail with option tickets, material box IV, and diamonds', () => {
        const spec = buildScheduledBroadcastMailSpec('evening', true);
        expect(spec.message).toContain('주말은 너무 행복해요');
        expect(spec.attachments.diamonds).toBe(20);
        expect(spec.attachments.items).toEqual([
            { itemId: '옵션 종류 변경권', quantity: 1 },
            { itemId: '옵션 수치 변경권', quantity: 1 },
            { itemId: '재료상자4', quantity: 1 },
        ]);
    });

    it('appends mail with 1-day claim window and prevents duplicates', () => {
        const user = { id: 'u1', mail: [] } as User;
        const dayKey = '2026-06-09';
        const mailId = scheduledBroadcastMailId('lunch', dayKey, user.id);

        expect(
            appendScheduledBroadcastMailToUser(user, 'lunch', WEEKDAY_LUNCH_MS, {
                dayKey,
                isWeekend: false,
            }),
        ).toBe(true);
        expect(user.mail).toHaveLength(1);
        expect(user.mail![0].id).toBe(mailId);
        expect(user.mail![0].expiresAt).toBe(WEEKDAY_LUNCH_MS + SCHEDULED_BROADCAST_CLAIM_MS);

        expect(
            appendScheduledBroadcastMailToUser(user, 'lunch', WEEKDAY_LUNCH_MS, {
                dayKey,
                isWeekend: false,
            }),
        ).toBe(false);
        expect(user.mail).toHaveLength(1);
    });
});
