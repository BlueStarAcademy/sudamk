import * as db from './db.js';
import type { Mail, User } from '../types/index.js';
import {
    getKSTDay,
    getKSTHours,
    getKSTMinutes,
    getTodayKSTDateString,
} from '../shared/utils/timeUtils.js';

export type ScheduledBroadcastSlot = 'lunch' | 'evening';

export const SCHEDULED_BROADCAST_CLAIM_MS = 24 * 60 * 60 * 1000;

const LUNCH_KST_HOUR = 13;
const EVENING_KST_HOUR = 19;
const SLOT_WINDOW_MINUTES = 5;

let lastCompletedSlotKey: string | null = null;

export function isWeekendKst(now: number = Date.now()): boolean {
    const day = getKSTDay(now);
    return day === 0 || day === 6;
}

export function isWeekdayKst(now: number = Date.now()): boolean {
    const day = getKSTDay(now);
    return day >= 1 && day <= 5;
}

export function resolveScheduledBroadcastSlot(now: number = Date.now()): ScheduledBroadcastSlot | null {
    const hours = getKSTHours(now);
    const minutes = getKSTMinutes(now);
    if (minutes >= SLOT_WINDOW_MINUTES) return null;
    if (hours === LUNCH_KST_HOUR) return 'lunch';
    if (hours === EVENING_KST_HOUR) return 'evening';
    return null;
}

export function scheduledBroadcastMailId(
    slot: ScheduledBroadcastSlot,
    dayKey: string,
    userId: string,
): string {
    return `mail-scheduled-${slot}-${dayKey}-${userId}`;
}

type ScheduledBroadcastMailSpec = {
    title: string;
    message: string;
    attachments: NonNullable<Mail['attachments']>;
};

export function buildScheduledBroadcastMailSpec(
    slot: ScheduledBroadcastSlot,
    isWeekend: boolean,
): ScheduledBroadcastMailSpec {
    if (slot === 'lunch') {
        if (isWeekend) {
            return {
                title: '주말 점심 선물',
                message: '즐거운 주말 보내세요!\n\n1일 이내에 수령해 주세요.',
                attachments: {
                    gold: 3000,
                    items: [{ itemId: '장비상자4', quantity: 1 }],
                },
            };
        }
        return {
            title: '점심 선물',
            message: '즐거운 점심시간 되세요!\n\n1일 이내에 수령해 주세요.',
            attachments: {
                gold: 1000,
            },
        };
    }

    if (isWeekend) {
        return {
            title: '주말 저녁 선물',
            message: '주말은 너무 행복해요\n\n1일 이내에 수령해 주세요.',
            attachments: {
                diamonds: 20,
                items: [
                    { itemId: '옵션 종류 변경권', quantity: 1 },
                    { itemId: '옵션 수치 변경권', quantity: 1 },
                    { itemId: '재료상자4', quantity: 1 },
                ],
            },
        };
    }

    return {
        title: '저녁 선물',
        message: '오늘도 수고많았어요.\n\n1일 이내에 수령해 주세요.',
        attachments: {
            gold: 1000,
            items: [{ itemId: '재료상자2', quantity: 1 }],
        },
    };
}

export function appendScheduledBroadcastMailToUser(
    user: User,
    slot: ScheduledBroadcastSlot,
    now: number,
    options?: { dayKey?: string; isWeekend?: boolean },
): boolean {
    if (!user?.id) return false;

    const dayKey = options?.dayKey ?? getTodayKSTDateString(now);
    const mailId = scheduledBroadcastMailId(slot, dayKey, user.id);
    if (!Array.isArray(user.mail)) {
        user.mail = [];
    }
    if (user.mail.some((m) => m.id === mailId)) return false;

    const spec = buildScheduledBroadcastMailSpec(slot, options?.isWeekend ?? isWeekendKst(now));
    const mail: Mail = {
        id: mailId,
        from: 'System',
        title: spec.title,
        message: spec.message,
        attachments: spec.attachments,
        receivedAt: now,
        expiresAt: now + SCHEDULED_BROADCAST_CLAIM_MS,
        isRead: false,
        attachmentsClaimed: false,
    };
    user.mail.unshift(mail);
    return true;
}

/** 테스트/재시작 시 슬롯 완료 마커 초기화 */
export function resetScheduledBroadcastMailSlotMarkerForTests(): void {
    lastCompletedSlotKey = null;
}

export async function processScheduledBroadcastMails(now: number = Date.now()): Promise<void> {
    const slot = resolveScheduledBroadcastSlot(now);
    if (!slot) return;

    const dayKey = getTodayKSTDateString(now);
    const slotKey = `${slot}-${dayKey}`;
    if (lastCompletedSlotKey === slotKey) return;

    const isWeekend = isWeekendKst(now);
    const spec = buildScheduledBroadcastMailSpec(slot, isWeekend);
    const allUsers = await db.getAllUsers();
    let sentCount = 0;

    const { broadcastUserUpdate } = await import('./socket.js');

    for (const user of allUsers) {
        if (!user?.id) continue;
        const added = appendScheduledBroadcastMailToUser(user, slot, now, { dayKey, isWeekend });
        if (!added) continue;
        await db.updateUser(user);
        broadcastUserUpdate(user, ['mail']);
        sentCount++;
    }

    lastCompletedSlotKey = slotKey;
    console.log(
        `[ScheduledBroadcastMail] Sent ${slot} mail (${isWeekend ? 'weekend' : 'weekday'}) ` +
            `to ${sentCount}/${allUsers.length} users: ${spec.title}`,
    );
}
