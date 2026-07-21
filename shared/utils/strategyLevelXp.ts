/**
 * 전략바둑 / 놀이바둑 레벨업에 쓰이는 구간별 필요 경험치 (프로필·대국 결과와 동일 규칙).
 * Lv21–50: ×1.12, Lv51–100: ×1.15 (중·후반 복리 완화).
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
            xp = Math.round(xp * 1.12);
        } else {
            xp = Math.round(xp * 1.15);
        }
    }
    return xp;
}

/**
 * 페어 대표펫 레벨업에 필요한 구간별 EXP — 유저/놀이 레벨 곡선(`getXpRequirementForLevel`)의 절반(최소 1).
 */
export function getPairPetXpRequirementForLevel(level: number): number {
    const full = getXpRequirementForLevel(level);
    if (!Number.isFinite(full) || full <= 0) return full;
    return Math.max(1, Math.ceil(full / 2));
}
