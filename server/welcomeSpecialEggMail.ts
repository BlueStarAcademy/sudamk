import { randomUUID } from 'crypto';
import type { InventoryItem, Mail, User } from '../types/index.js';
import { MATERIAL_ITEMS } from '../constants/index.js';
import {
    PAIR_WELCOME_EGG_MATERIAL_NAME,
    PAIR_WELCOME_EGG_TEMPLATE_ID,
} from '../shared/constants/petLobby.js';

export const WELCOME_SPECIAL_EGG_MAIL_KV_KEY = 'migrationWelcomeSpecialEggMailV20260507';

export const WELCOME_SPECIAL_EGG_MAIL_TITLE = '수담에 오신 걸 환영합니다';

export const WELCOME_SPECIAL_EGG_MAIL_MESSAGE = `수담에 오신걸 환영합니다. 신비로운 알을 부화시켜서 자신의 펫을 얻고 펫과 함께 바둑수련을 떠나봐요! 서로 도움을 주고받으며 성장하면 바둑도 어렵지 않답니다.

사용방법 : 전략/페어/놀이 경기장 - 펫 - 부화장 - 부화
펫 기능 : 펫 힌트, 대표펫 페어바둑 가능
특징 : 첫 부화시 부화시간 1분, 10레벨 펫 부화

부화 후 대표펫으로 지정하세요.
전략/페어/놀이 경기장 - 펫 - 인벤토리 - 펫 선택 - 대표펫 지정`;

function buildWelcomeSpecialEggAttachmentItem(): InventoryItem {
    const base = MATERIAL_ITEMS[PAIR_WELCOME_EGG_MATERIAL_NAME as keyof typeof MATERIAL_ITEMS];
    if (!base) throw new Error(`Missing MATERIAL_ITEMS entry: ${PAIR_WELCOME_EGG_MATERIAL_NAME}`);
    return {
        id: `item-${randomUUID()}`,
        name: base.name,
        description: base.description,
        type: 'material',
        slot: null,
        level: 1,
        stars: 0,
        isEquipped: false,
        createdAt: Date.now(),
        image: base.image,
        grade: base.grade,
        quantity: 1,
        templateId: PAIR_WELCOME_EGG_TEMPLATE_ID,
    };
}

/** 우편 1통(첨부 (특)신비로운 알 ×1)을 유저 객체에 추가합니다. `mailId`가 이미 있으면 false. */
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
        attachments: {
            items: [buildWelcomeSpecialEggAttachmentItem()],
        },
        receivedAt: Date.now(),
        isRead: false,
        attachmentsClaimed: false,
    };
    user.mail.unshift(mail);
    return true;
}
