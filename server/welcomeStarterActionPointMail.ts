import { randomUUID } from 'crypto';
import type { Mail, User } from '../types/index.js';

/** 상점·가방 표기 «행동력 회복제(+10)» — 로마 숫자 I 단계 */
export const WELCOME_STARTER_AP_POTION_ITEM_NAME = '행동력 회복제(+10)';

export const WELCOME_STARTER_AP_MAIL_TITLE = '수담에서 바둑실력을 키워보세요!';

export const WELCOME_STARTER_AP_MAIL_MESSAGE = `수담에서 바둑실력을 키워보세요!

신규 모험을 응원하는 행동력 회복제 I 5개를 보내 드립니다. 우편에서 수령한 뒤 가방에서 사용해 보세요.`;

export const WELCOME_STARTER_AP_MAIL_COUNT = 5;

/** 우편 1통(행동력 회복제 I ×5, 수령 기한 없음)을 유저 객체에 추가. `mailId`가 이미 있으면 false. */
export function appendWelcomeStarterActionPointMailToUser(user: User, options?: { mailId?: string }): boolean {
    const mailId = options?.mailId ?? `mail-welcome-ap-starter-${randomUUID()}`;
    if (!Array.isArray(user.mail)) {
        user.mail = [];
    }
    if (user.mail.some((m) => m.id === mailId)) return false;

    const mail: Mail = {
        id: mailId,
        from: '시스템',
        title: WELCOME_STARTER_AP_MAIL_TITLE,
        message: WELCOME_STARTER_AP_MAIL_MESSAGE,
        attachments: {
            items: [{ itemId: WELCOME_STARTER_AP_POTION_ITEM_NAME, quantity: WELCOME_STARTER_AP_MAIL_COUNT }],
        },
        receivedAt: Date.now(),
        isRead: false,
        attachmentsClaimed: false,
    };
    user.mail.unshift(mail);
    return true;
}
