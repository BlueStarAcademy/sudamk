/**
 * One-off: set cumulativeTournamentScore = 0 for every user (Prisma / getAllUsers path).
 * Run from repo root: npx tsx server/scripts/clearLegacyCumulativeTournamentScore.ts
 */
import * as db from '../db.js';
import { invalidateRankingCache } from '../rankingCache.js';

async function main() {
    const users = await db.getAllUsers();
    let n = 0;
    for (const u of users) {
        if ((u.cumulativeTournamentScore ?? 0) === 0) continue;
        await db.updateUser({ ...u, cumulativeTournamentScore: 0 });
        n++;
    }
    invalidateRankingCache();
    console.log(`[clearLegacyCumulativeTournamentScore] Zeroed legacy field for ${n} users (scanned ${users.length}).`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
