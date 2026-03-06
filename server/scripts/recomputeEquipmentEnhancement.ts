/**
 * 장비 메인 옵션을 새로운 강화 배율 규칙에 맞게
 * 일괄 재계산하는 1회성 마이그레이션 스크립트
 *
 * 실행 방법:
 * npx tsx --tsconfig server/tsconfig.json server/scripts/recomputeEquipmentEnhancement.ts
 */

import prisma from '../prismaClient.js';
import { getAllUsers, updateUser } from '../db.js';
import {
    MAIN_ENHANCEMENT_STEP_MULTIPLIER,
    DIVINE_MYTHIC_ENHANCEMENT_STEP_MULTIPLIER,
} from '../../constants/index.js';
import type { User, InventoryItem, ItemOption } from '../../types/index.js';
import { ItemGrade } from '../../types/enums.js';

type EquipmentItem = InventoryItem & {
    options?: {
        main: ItemOption;
        combatSubs: ItemOption[];
        specialSubs: ItemOption[];
        mythicSubs: ItemOption[];
    };
    isDivineMythic?: boolean;
};

/**
 * 단일 장비의 메인 옵션을 새 강화 배율로 재계산.
 * 변경이 발생하면 true를 반환.
 */
function recomputeMainOptionForItem(item: EquipmentItem): boolean {
    if (item.type !== 'equipment') return false;
    if (!item.options || !item.options.main) return false;

    const main = item.options.main;
    if (typeof main.baseValue !== 'number' || !Number.isFinite(main.baseValue)) {
        return false;
    }

    const base = main.baseValue;
    const stars = Math.max(0, Math.min(10, item.stars ?? 0));

    // 0강이면 base만 유지
    if (stars === 0) {
        const newValue = parseFloat(base.toFixed(2));
        const changed = main.value !== newValue;
        if (changed) {
            main.value = newValue;
            main.display = `${main.type} +${main.value}${main.isPercentage ? '%' : ''}`;
        }
        return changed;
    }

    const isDivineMythic =
        item.grade === ItemGrade.Mythic && (item as EquipmentItem).isDivineMythic;

    const multipliers = isDivineMythic
        ? DIVINE_MYTHIC_ENHANCEMENT_STEP_MULTIPLIER
        : MAIN_ENHANCEMENT_STEP_MULTIPLIER[item.grade as ItemGrade];

    if (!multipliers || !Array.isArray(multipliers) || multipliers.length === 0) {
        // 예상치 못한 등급이거나 설정 누락인 경우, 기존 값을 유지
        return false;
    }

    // 새 규칙에 따라 1강 ~ 현재 별 수까지 누적 적용
    let value = base;
    for (let s = 1; s <= stars; s++) {
        const idx = s - 1;
        const m = multipliers[idx] ?? 1;
        value += Math.round(base * m);
    }

    const newValue = parseFloat(value.toFixed(2));
    const changed = main.value !== newValue;

    if (changed) {
        main.value = newValue;
        main.display = `${main.type} +${main.value}${main.isPercentage ? '%' : ''}`;
    }

    return changed;
}

async function main() {
    console.log('=== 장비 메인 옵션 재계산 마이그레이션 시작 ===');

    try {
        // 인벤토리/장비 전체가 포함된 최신 사용자 목록 조회
        const users: User[] = await getAllUsers({
            includeInventory: true,
            includeEquipment: true,
            skipCache: true,
        });

        console.log(`총 사용자 수: ${users.length}명`);

        let usersUpdated = 0;
        let itemsUpdated = 0;

        for (const user of users) {
            let userChanged = false;
            const inventory = user.inventory ?? [];

            for (const rawItem of inventory) {
                const item = rawItem as EquipmentItem;
                if (recomputeMainOptionForItem(item)) {
                    userChanged = true;
                    itemsUpdated++;
                }
            }

            if (userChanged) {
                usersUpdated++;
                await updateUser(user);
                console.log(
                    `[업데이트] 사용자 ${user.id} (${user.nickname ?? user.username}) 장비 재계산 완료`
                );
            }
        }

        console.log('=== 마이그레이션 결과 ===');
        console.log(`업데이트된 사용자 수: ${usersUpdated}명`);
        console.log(`업데이트된 장비 수:   ${itemsUpdated}개`);
        console.log('=== 장비 메인 옵션 재계산 마이그레이션 완료 ===');
    } catch (error) {
        console.error('[오류] 마이그레이션 중 오류 발생:', error);
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error('[치명적 오류] 마이그레이션 실패:', err);
    process.exit(1);
});

