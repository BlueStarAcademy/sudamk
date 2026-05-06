import * as db from './db.js';
import {
    appendWelcomeSpecialEggMailToUser,
    WELCOME_SPECIAL_EGG_MAIL_KV_KEY,
} from './welcomeSpecialEggMail.js';

/** 기존 전 유저에게 환영 우편 1회 지급(서버 기동 시). 완료 후 KV로 재실행 방지. */
export async function runWelcomeSpecialEggMailMigrationOnce(): Promise<void> {
    try {
        const done = await db.getKV<boolean>(WELCOME_SPECIAL_EGG_MAIL_KV_KEY);
        if (done) return;

        const users = await db.getAllUsers({
            includeEquipment: false,
            includeInventory: false,
            skipCache: true,
        });
        let appendedCount = 0;
        for (const u of users) {
            const mailId = `mail-welcome-egg-migr-20260507-${u.id}`;
            if (u.mail?.some((m) => m.id === mailId)) continue;
            if (appendWelcomeSpecialEggMailToUser(u, { mailId })) {
                await db.updateUser(u);
                appendedCount += 1;
            }
        }
        await db.setKV(WELCOME_SPECIAL_EGG_MAIL_KV_KEY, true);
        console.log(
            `[WelcomeEggMail] Migration complete. Appended mail to ${appendedCount} user(s); skipped existing.`,
        );
    } catch (e: unknown) {
        console.warn('[WelcomeEggMail] Migration failed (non-fatal):', (e as { message?: string })?.message ?? e);
    }
}
