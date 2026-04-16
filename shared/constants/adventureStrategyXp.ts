/** 모험 몬스터 승리 기본 전략 EXP (판 크기별) — 전략 AI 대기실 보상 등과 동일 기준 */
export const ADVENTURE_STRATEGY_XP_BY_BOARD_SIZE: Record<number, number> = {
    7: 10,
    9: 13,
    11: 15,
    13: 20,
    19: 30,
};

export function getAdventureBaseStrategyXp(boardSizeRaw: unknown): number {
    const boardSize = typeof boardSizeRaw === 'number' ? boardSizeRaw : 9;
    return ADVENTURE_STRATEGY_XP_BY_BOARD_SIZE[boardSize] ?? ADVENTURE_STRATEGY_XP_BY_BOARD_SIZE[9];
}

/** 모험 몬스터 레벨 보너스 EXP: 5레벨마다 +1 (Lv1~5=0, Lv50=+9) */
export function getAdventureMonsterLevelXpBonus(levelRaw: unknown): number {
    const level = Math.max(1, Math.min(50, Math.floor(typeof levelRaw === 'number' ? levelRaw : 1)));
    return Math.max(0, Math.floor((level - 1) / 5));
}
