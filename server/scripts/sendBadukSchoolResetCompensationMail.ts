/**
 * 바둑학원(싱글플레이) 초기화 보상 우편을 전 계정에 1회 발송합니다.
 * - 5일 수령 기한
 * - 골드 3000, 다이아 50, 행동력 +50(수령 시 최대치 초과 누적 가능)
 *
 * 재실행 시 이미 동일 접두사 우편이 있으면 스킵합니다.
 *
 * 실행: npm run script:send-baduk-school-reset-mail
 */

import { randomUUID } from 'crypto';
import * as db from '../db.js';
import type { Mail, User } from '../../types/index.js';

const MAIL_ID_PREFIX = 'mail-baduk-school-reset-comp-20260511';

const TITLE = '바둑학원 초기화로 인한 보상 우편';
const MESSAGE =
    '바둑학원(싱글플레이)이 초기화 되었습니다. 천천히 입문 스테이지부터 클리어 해보세요.';

async function main(): Promise<void> {
    const users = await db.getAllUsers({
        includeEquipment: false,
        includeInventory: false,
        skipCache: true,
    });
    console.log(`[BadukSchoolMail] 대상 유저 ${users.length}명`);

    let appended = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of users) {
        const mailId = `${MAIL_ID_PREFIX}-${row.id}`;
        try {
            const fresh = await db.getUser(row.id, { includeEquipment: true, includeInventory: true });
            if (!fresh) {
                skipped++;
                continue;
            }
            if (fresh.mail?.some((m) => m.id === mailId)) {
                skipped++;
                continue;
            }

            const newMail: Mail = {
                id: mailId,
                from: '운영보상',
                title: TITLE,
                message: MESSAGE,
                attachments: {
                    gold: 3000,
                    diamonds: 50,
                    actionPoints: 50,
                    items: [],
                },
                receivedAt: Date.now(),
                expiresAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
                isRead: false,
                attachmentsClaimed: false,
            };

            if (!Array.isArray(fresh.mail)) fresh.mail = [];
            fresh.mail.unshift(newMail);
            await db.updateUser(fresh as User);
            appended++;
        } catch (e) {
            failed++;
            console.warn(`[BadukSchoolMail] 실패 ${row.id}:`, (e as Error)?.message ?? e);
        }
    }

    console.log('[BadukSchoolMail] 완료 — 발송(추가):', appended, '스킵:', skipped, '실패:', failed);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('[BadukSchoolMail] 스크립트 실패:', err);
        process.exit(1);
    });
