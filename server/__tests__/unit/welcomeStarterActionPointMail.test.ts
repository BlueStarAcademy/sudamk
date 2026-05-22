import { describe, expect, it } from 'vitest';
import type { User } from '../../../types/index.js';
import {
    appendWelcomeStarterActionPointMailToUser,
    WELCOME_STARTER_AP_MAIL_COUNT,
    WELCOME_STARTER_AP_MAIL_TITLE,
    WELCOME_STARTER_AP_POTION_ITEM_NAME,
} from '../../welcomeStarterActionPointMail.js';

describe('appendWelcomeStarterActionPointMailToUser', () => {
    it('adds mail with 5 tier-I AP potions and no expiry', () => {
        const user = { id: 'u1', mail: [] } as User;
        expect(appendWelcomeStarterActionPointMailToUser(user)).toBe(true);
        expect(user.mail).toHaveLength(1);
        const mail = user.mail![0];
        expect(mail.title).toBe(WELCOME_STARTER_AP_MAIL_TITLE);
        expect(mail.expiresAt).toBeUndefined();
        expect(mail.attachments?.items).toEqual([
            { itemId: WELCOME_STARTER_AP_POTION_ITEM_NAME, quantity: WELCOME_STARTER_AP_MAIL_COUNT },
        ]);
    });

    it('does not duplicate when mailId already exists', () => {
        const user = { id: 'u1', mail: [] } as User;
        const mailId = 'mail-welcome-ap-test';
        expect(appendWelcomeStarterActionPointMailToUser(user, { mailId })).toBe(true);
        expect(appendWelcomeStarterActionPointMailToUser(user, { mailId })).toBe(false);
        expect(user.mail).toHaveLength(1);
    });
});
