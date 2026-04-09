/**
 * 비정상 신화옵션 일괄 정리 스크립트
 *
 * 대상:
 * - 등급별 허용 개수를 초과한 mythicSubs
 *   normal~legendary: 0줄, mythic: 1줄, transcendent: 2줄
 *
 * 실행:
 * - 점검만: npx tsx --tsconfig server/tsconfig.json server/scripts/fixInvalidMythicOptions.ts --dry-run
 * - 실제 반영: npx tsx --tsconfig server/tsconfig.json server/scripts/fixInvalidMythicOptions.ts
 */

import * as db from '../db.js';
import { GRADE_SUB_OPTION_RULES } from '../../shared/constants/items.js';
import type { InventoryItem, User } from '../../types/index.js';
import type { ItemGrade } from '../../shared/types/enums.js';

type FixResult = {
    changed: boolean;
    removedLines: number;
};

function maxMythicLinesByGrade(grade: ItemGrade): number {
    const rule = GRADE_SUB_OPTION_RULES[grade];
    if (!rule || !Array.isArray(rule.mythicCount)) return 0;
    return Math.max(0, Math.floor(Number(rule.mythicCount[1]) || 0));
}

function sanitizeEquipmentMythicSubs(item: InventoryItem): FixResult {
    if (item.type !== 'equipment' || !item.options) return { changed: false, removedLines: 0 };
    const current = Array.isArray(item.options.mythicSubs) ? item.options.mythicSubs : [];
    const allowed = maxMythicLinesByGrade(item.grade as ItemGrade);

    if (current.length <= allowed) return { changed: false, removedLines: 0 };

    const next = current.slice(0, allowed);
    item.options.mythicSubs = next;
    return { changed: true, removedLines: current.length - next.length };
}

async function run() {
    const dryRun = process.argv.includes('--dry-run');

    console.log('='.repeat(72));
    console.log(`[fixInvalidMythicOptions] start (dryRun=${dryRun})`);
    console.log('='.repeat(72));

    await db.initializeDatabase();
    const users = await db.getAllUsers({ includeInventory: true, skipCache: true });
    console.log(`[fixInvalidMythicOptions] loaded users: ${users.length}`);

    let usersChanged = 0;
    let itemsChanged = 0;
    let removedTotal = 0;

    for (const user of users) {
        const inventory = Array.isArray((user as User).inventory) ? (user as User).inventory : [];
        if (inventory.length === 0) continue;

        let userChanged = false;
        for (const item of inventory) {
            const result = sanitizeEquipmentMythicSubs(item as InventoryItem);
            if (!result.changed) continue;
            userChanged = true;
            itemsChanged += 1;
            removedTotal += result.removedLines;
        }

        if (userChanged) {
            usersChanged += 1;
            if (!dryRun) {
                await db.updateUser(user as User);
            }
        }
    }

    console.log('-'.repeat(72));
    console.log(`[fixInvalidMythicOptions] users changed : ${usersChanged}`);
    console.log(`[fixInvalidMythicOptions] items changed : ${itemsChanged}`);
    console.log(`[fixInvalidMythicOptions] removed lines : ${removedTotal}`);
    console.log(`[fixInvalidMythicOptions] mode         : ${dryRun ? 'DRY RUN (no write)' : 'APPLIED'}`);
    console.log('='.repeat(72));
}

run()
    .then(() => {
        console.log('[fixInvalidMythicOptions] done');
        process.exit(0);
    })
    .catch((error) => {
        console.error('[fixInvalidMythicOptions] failed:', error);
        process.exit(1);
    });

