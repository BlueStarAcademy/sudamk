/**
 * 전략바둑 / 놀이바둑 레벨업에 쓰이는 구간별 필요 경험치 (프로필·대국 결과와 동일 규칙).
 */
export function getXpRequirementForLevel(level: number): number {
    if (level < 1) return 0;
    if (level > 100) return Number.POSITIVE_INFINITY;

    if (level <= 10) {
        return 200 + level * 100;
    }

    if (level <= 20) {
        return 300 + level * 150;
    }

    let xp = 300 + 20 * 150;
    for (let l = 21; l <= level; l += 1) {
        if (l <= 50) {
            xp = Math.round(xp * 1.2);
        } else {
            xp = Math.round(xp * 1.3);
        }
    }
    return xp;
}
