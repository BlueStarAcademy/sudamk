/**
 * Playwright E2E 기본 계정(푸른별/1217)을 생성·갱신합니다.
 *
 * 실행: npm run script:ensure-e2e-test-account
 */

import 'dotenv/config';
import { ensureE2eTestAccount, isDatabaseConnected } from '../db.js';

async function main(): Promise<void> {
    const connected = await isDatabaseConnected();
    if (!connected) {
        throw new Error('Database is not connected. Check DATABASE_URL and run migrations.');
    }
    await ensureE2eTestAccount();
    console.log('[E2eTestAccount] Done.');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('[E2eTestAccount] Failed:', error);
        process.exit(1);
    });
