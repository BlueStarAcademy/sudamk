/**
 * E2E 계정 AP·active 게임 리셋 (Playwright cleanup fallback)
 * 실행: npm run script:refill-e2e-accounts
 */
import 'dotenv/config';
import { isDatabaseConnected, refillE2eAccountsForTests } from '../db.js';

async function main(): Promise<void> {
    const connected = await isDatabaseConnected();
    if (!connected) {
        throw new Error('Database is not connected. Check DATABASE_URL.');
    }
    await refillE2eAccountsForTests();
    console.log('[E2eRefill] Done.');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('[E2eRefill] Failed:', error);
        process.exit(1);
    });
