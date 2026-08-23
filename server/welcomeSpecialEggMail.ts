import { randomUUID } from 'crypto';
import type { Mail, User } from '../types/index.js';

export const WELCOME_SPECIAL_EGG_MAIL_KV_KEY = 'migrationWelcomeSpecialEggMailV20260507';

export const WELCOME_SPECIAL_EGG_MAIL_TITLE = '수담에 오신 걸 환영합니다';

export const WELCOME_SPECIAL_EGG_MAIL_MESSAGE = `수담에 오신 걸 환영합니다!

인벤토리에 (특)신비로운 알과 일반 알이 준비되어 있어요.
1) 펫 관리 → 부화장에서 특알을 부화하고 대표펫으로 장착하세요.
2) 모험에서 펫 힌트를 눌러 추천 자리에 착점해 보세요.
3) 두 번째 알을 부화한 뒤 기술수련에 보내 성장을 시작하세요.

특징: 특알 첫 부화 약 8초, 10레벨 펫 부화`;

/** 우편 1통(안내만 — 알은 인벤 스타터로 지급)을 유저 객체에 추가합니다. `mailId`가 이미 있으면 false. */
export function appendWelcomeSpecialEggMailToUser(user: User, options?: { mailId?: string }): boolean {
    const mailId = options?.mailId ?? `mail-welcome-egg-${randomUUID()}`;
    if (!Array.isArray(user.mail)) {
        user.mail = [];
    }
    if (user.mail.some((m) => m.id === mailId)) return false;
    const mail: Mail = {
        id: mailId,
        from: '시스템',
        title: WELCOME_SPECIAL_EGG_MAIL_TITLE,
        message: WELCOME_SPECIAL_EGG_MAIL_MESSAGE,
        attachments: {},
        receivedAt: Date.now(),
        isRead: false,
        attachmentsClaimed: true,
    };
    user.mail.unshift(mail);
    return true;
}
