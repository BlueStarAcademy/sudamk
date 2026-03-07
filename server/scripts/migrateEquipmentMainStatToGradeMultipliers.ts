/**
 * 장비 메인 옵션 능력치 1회 마이그레이션 스크립트
 *
 * 등급별 강화 배수(MAIN_ENHANCEMENT_STEP_MULTIPLIER / DIVINE_MYTHIC) 도입에 맞춰,
 * 기존에 저장된 모든 장비(인벤토리·장착)의 메인 옵션 value를 새 공식으로 재계산합니다.
 *
 * 실행 방법:
 * npx tsx --tsconfig server/tsconfig.json server/scripts/migrateEquipmentMainStatToGradeMultipliers.ts
 */

import * as db from '../db.js';
import { ItemGrade } from '../../types/enums.js';
import { MAIN_ENHANCEMENT_STEP_MULTIPLIER, DIVINE_MYTHIC_ENHANCEMENT_STEP_MULTIPLIER } from '../../shared/constants/items.js';
import type { InventoryItem, User } from '../../types/index.js';

function recomputeMainOption(item: InventoryItem): boolean {
    if (item.type !== 'equipment' || !item.options?.main?.baseValue) return false;

    const base = item.options.main.baseValue;
    const stars = item.stars ?? 0;
    if (stars <= 0) return false;

    const isDivine = item.grade === ItemGrade.Mythic && item.isDivineMythic;
    const multipliers = isDivine
        ? DIVINE_MYTHIC_ENHANCEMENT_STEP_MULTIPLIER
        : MAIN_ENHANCEMENT_STEP_MULTIPLIER[item.grade as ItemGrade];
    if (!multipliers || multipliers.length < 10) return false;

    let value = base;
    for (let s = 1; s <= stars; s++) {
        const idx = s - 1;
        const m = multipliers[idx] ?? 1;
        value += Math.round(base * m);
    }

    const main = item.options.main;
    main.value = parseFloat(value.toFixed(2));
    main.display = `${main.type} +${main.value}${main.isPercentage ? '%' : ''}`;
    return true;
}

async function run() {
    console.log('='.repeat(60));
    console.log('장비 메인 옵션 능력치 마이그레이션 시작');
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
            if (recomputeMainOption(item as InventoryItem)) {
                userChanged = true;
                itemsUpdated++;
            }
        }

        if (userChanged) {
            await db.updateUser(user as User);
            usersUpdated++;
        }
    }

    console.log('='.repeat(60));
    console.log('마이그레이션 완료');
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
