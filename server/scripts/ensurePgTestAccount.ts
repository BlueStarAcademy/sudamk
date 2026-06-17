/**
 * PG사 검수용 테스트 계정을 생성·갱신합니다.
 *
 * 실행: npm run script:ensure-pg-test-account
 */

import 'dotenv/config';
import * as db from '../db.js';

async function main(): Promise<void> {
    await db.initializeDatabase();
    console.log('[PgTestAccount] Done.');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('[PgTestAccount] Failed:', error);
        process.exit(1);
    });
