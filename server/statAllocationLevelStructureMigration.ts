import type { User } from '../types/index.js';
import { createDefaultSpentStatPoints } from './initialData.js';

/**
 * 통합 유저 레벨 구조 변경 후 1회: `spentStatPoints`를 비워
 * 새 레벨 기준 능력치 포인트를 다시 분배할 수 있게 한다.
 * `bonusStatPoints` 등은 그대로 둔다.
 */
export function maybeResetStatAllocationAfterLevelStructureChange(user: User): boolean {
    if (user.statAllocationResetForUserLevelStructureV1) {
        return false;
    }
    const prevSpent = Object.values(user.spentStatPoints ?? {}).reduce((sum, p) => sum + (Number(p) || 0), 0);
    user.spentStatPoints = createDefaultSpentStatPoints();
    user.statAllocationResetForUserLevelStructureV1 = true;
    if (prevSpent > 0) {
        console.log(
            `[StatAllocationMigration] Reset spentStatPoints for ${user.nickname} (${user.id}), had ${prevSpent} allocated`
        );
    }
    return true;
}
