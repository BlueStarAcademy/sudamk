/**
 * 현재 레벨에서 다음 레벨까지 필요한 경험치 (서버 `summaryService` / 프로필 UI와 동일 곡선).
 */
export function getXpRequiredForCurrentLevel(level: number): number {
    if (level < 1) return 0;
    if (level > 100) return Number.POSITIVE_INFINITY;

    if (level <= 10) {
        return 200 + level * 100;
    }
    if (level <= 20) {
        return 300 + level * 150;
    }

    let xp = 300 + 20 * 150;
    for (let l = 21; l <= level; l++) {
        if (l <= 50) {
            xp = Math.round(xp * 1.2);
        } else {
            xp = Math.round(xp * 1.3);
        }
    }
    return xp;
}
