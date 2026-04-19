/**
 * KV에 남아 «진행 중»으로 막히는 길드전을 초기화한다.
 *
 * 기본: 시계상 아직 끝나지 않은 전쟁만 KV에서 제거 + 관련 길드 매칭 플래그·큐 정리.
 * 선택: --all-active → status가 active인 항목은 종료 시각과 관계없이 KV에서 제거.
 *
 * 실행:
 *   npm run guild-war:reset-in-progress
 *   npm run guild-war:reset-in-progress -- --all-active
 *
 * Prisma GuildWar: id가 DB와 일치하면 status=cancelled 로 맞춤(실패는 건너뜀).
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    const allActive = process.argv.includes('--all-active');

    const { initializeDatabase } = await import('../db.js');
    await initializeDatabase();

    const { resetInProgressGuildWarsKv } = await import('../guildWarKvAdminReset.js');
    const r = await resetInProgressGuildWarsKv({
        removeAllStatusActive: allActive,
        syncPrisma: true,
    });

    console.log('[guild-war:reset-in-progress] Done:', {
        mode: allActive ? 'all-status-active' : 'chrono-active-only',
        removedFromKv: r.removedFromKv,
        remainingInKv: r.remainingInKv,
        clearedGuildIds: r.clearedGuildIds,
        queueEntriesRemoved: r.queueEntriesRemoved,
        prismaCancelled: r.prismaCancelled,
    });
}

main().catch((e) => {
    console.error('[guild-war:reset-in-progress]', e);
    process.exit(1);
});
