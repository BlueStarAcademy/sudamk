import type { User } from '../types/index.js';

/** 장비·재료 상자를 실제로 연 횟수(업적 누적). 상점 즉시 개봉·인벤 사용·상점 광고 보상 즉시 개봉에 반영 */
export function recordAchievementBoxOpens(user: User, kind: 'equipment' | 'material', count: number): void {
    if (count <= 0 || !user.quests) return;
    if (!user.quests.achievements) {
        user.quests.achievements = { tracks: {} };
    }
    const ach = user.quests.achievements;
    if (kind === 'equipment') {
        ach.totalEquipmentBoxOpens = (ach.totalEquipmentBoxOpens ?? 0) + count;
    } else {
        ach.totalMaterialBoxOpens = (ach.totalMaterialBoxOpens ?? 0) + count;
    }
}
