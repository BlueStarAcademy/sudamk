/**
 * 모든 유저의 전략·페어 「랭킹전 전용」 전적·시즌 레이팅 필드를 초기화합니다.
 * 실행: npm run reset-ranked-match-stats
 */

import * as db from '../db.js';
import { applyRankedMatchStatsFullResetToUser } from '../rankedMatchStatsReset.js';
import { invalidateRankingCache } from '../rankingCache.js';

const resetAllRankedMatchRecords = async () => {
    console.log('[RankedReset] Starting full ranked match stats reset (strategic + pair)...');
    const now = Date.now();
    const allUsers = await db.getAllUsers({ includeEquipment: false, includeInventory: false, skipCache: true });
    console.log(`[RankedReset] Found ${allUsers.length} users`);

    let updated = 0;
    for (const u of allUsers) {
        applyRankedMatchStatsFullResetToUser(u, now);
        await db.updateUser(u);
        db.invalidateUserCache(u.id);
        updated++;
        if (updated % 200 === 0) console.log(`[RankedReset] ... ${updated}/${allUsers.length}`);
    }

    invalidateRankingCache();
    console.log(`[RankedReset] Done. Updated ${updated} users. Ranking cache invalidated.`);
};

resetAllRankedMatchRecords()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('[RankedReset] Failed:', e);
        process.exit(1);
    });
