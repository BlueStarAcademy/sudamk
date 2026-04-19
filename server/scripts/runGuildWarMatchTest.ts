/**
 * 길드전 자동 매칭 통합 테스트 (KST 월·목 23시 / 화·금 0시를 기다리지 않음).
 *
 * 사용법:
 *   1) .env 에 GUILD_WAR_MATCH_TEST_MODE=1 추가
 *   2) npm run guild-war:match-test
 *   3) 테스트 끝나면 GUILD_WAR_MATCH_TEST_MODE 제거 (운영 서버에 두지 말 것)
 *
 * 선택: 화수 전쟁 기간만 쓰고 싶으면
 *   GUILD_WAR_MATCH_TEST_WAR_TYPE=tue_wed  또는 fri_sun
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
    if (process.env.GUILD_WAR_MATCH_TEST_MODE !== '1') {
        console.error(
            '[guild-war:match-test] GUILD_WAR_MATCH_TEST_MODE=1 이 필요합니다. npm run guild-war:match-test 는 자동으로 넣습니다. tsx 직접 실행 시에는 cross-env 또는 .env 를 사용하세요.',
        );
        process.exit(1);
    }
    const wt = process.env.GUILD_WAR_MATCH_TEST_WAR_TYPE;
    const warType = wt === 'tue_wed' || wt === 'fri_sun' ? wt : undefined;

    const { initializeDatabase } = await import('../db.js');
    await initializeDatabase();

    const { runGuildWarMatchingTestCycle } = await import('../scheduledTasks.js');
    await runGuildWarMatchingTestCycle(warType ? { warType } : undefined);
    console.log('[guild-war:match-test] OK');
}

main().catch((e) => {
    console.error('[guild-war:match-test]', e);
    process.exit(1);
});
