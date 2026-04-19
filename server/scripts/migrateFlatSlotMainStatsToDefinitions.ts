/**
 * 하의(bottom)·바둑통(bowl)·바둑돌(stones) 장비의 메인 주옵 baseValue를
 * MAIN_STAT_DEFINITIONS에 맞추고, 별 강화 누적값을 MAIN_ENHANCEMENT_STEP_MULTIPLIER로 재계산한다.
 *
 * 실행:
 * npx tsx --tsconfig server/tsconfig.json server/scripts/migrateFlatSlotMainStatsToDefinitions.ts
 */

import * as db from '../db.js';
import { syncInventoryEquipmentToDatabase } from '../prisma/userService.js';
import { ItemGrade, type EquipmentSlot } from '../../types/enums.js';
import { MAIN_STAT_DEFINITIONS, MAIN_ENHANCEMENT_STEP_MULTIPLIER } from '../../shared/constants/items.js';
import type { InventoryItem, User } from '../../types/index.js';

const FLAT_SLOTS: EquipmentSlot[] = ['bottom', 'bowl', 'stones'];

function rebuildMainDisplay(main: NonNullable<NonNullable<InventoryItem['options']>['main']>) {
    main.display = `${main.type} +${main.value}${main.isPercentage ? '%' : ''}`;
}

function resyncFlatSlotMain(item: InventoryItem): boolean {
    if (item.type !== 'equipment' || !item.slot || !item.grade || !item.options?.main) return false;
    const slot = item.slot as EquipmentSlot;
    if (!FLAT_SLOTS.includes(slot)) return false;

    const gradeDef = MAIN_STAT_DEFINITIONS[slot]?.options[item.grade as ItemGrade];
    if (!gradeDef) return false;

    const main = item.options.main;
    const prevBase = Number(main.baseValue);
    const prevValue = Number(main.value);
    const expectedBase = gradeDef.value;

    const anyItem = item as InventoryItem & { isDivineMythic?: boolean };
    const legacyDivineMythic = item.grade === ItemGrade.Mythic && anyItem.isDivineMythic === true;
    const gradeForMultiplier = (legacyDivineMythic ? ItemGrade.Transcendent : item.grade) as ItemGrade;
    const multipliers = MAIN_ENHANCEMENT_STEP_MULTIPLIER[gradeForMultiplier];
    if (!multipliers || multipliers.length < 10) return false;

    const stars = Math.max(0, Math.min(10, Math.floor(Number(item.stars) || 0)));

    main.baseValue = expectedBase;

    let value = expectedBase;
    for (let s = 1; s <= stars; s++) {
        const idx = s - 1;
        const m = multipliers[idx] ?? 1;
        value += Math.round(expectedBase * m);
    }
    const nextValue = parseFloat(value.toFixed(2));
    main.value = nextValue;
    rebuildMainDisplay(main);

    const changed =
        !Number.isFinite(prevBase) ||
        prevBase !== expectedBase ||
        !Number.isFinite(prevValue) ||
        Math.abs(prevValue - nextValue) > 0.01;
    return changed;
}

async function run() {
    console.log('='.repeat(60));
    console.log('하의·바둑통·바둑돌 메인 주옵 정의 동기화');
    console.log('='.repeat(60));

    const allUsers = await db.getAllUsers({ includeInventory: true });
    console.log(`[Migrate] 유저 ${allUsers.length}명 조회됨`);

    let usersUpdated = 0;
    let itemsUpdated = 0;

    for (const user of allUsers) {
        const inventory = (user as User).inventory;
        if (!Array.isArray(inventory)) continue;

        let userChanged = false;
        for (const item of inventory) {
            if (!item || item.type !== 'equipment') continue;
            if (resyncFlatSlotMain(item as InventoryItem)) {
                userChanged = true;
                itemsUpdated++;
            }
        }

        if (userChanged) {
            await db.updateUser(user as User);
            // updateUser 내부 sync는 await되지 않아 스크립트 종료 시 DB 반영이 누락될 수 있음 → 반드시 대기
            await syncInventoryEquipmentToDatabase(user as User);
            usersUpdated++;
        }
    }

    console.log('='.repeat(60));
    console.log('완료');
    console.log('='.repeat(60));
    console.log(`유저 수정: ${usersUpdated}명`);
    console.log(`장비 메인 옵션 수정: ${itemsUpdated}개`);
}

run()
    .then(() => {
        console.log('[Migrate] 스크립트 정상 종료');
        process.exit(0);
    })
    .catch((err) => {
        console.error('[Migrate] 스크립트 실패:', err);
        process.exit(1);
    });
