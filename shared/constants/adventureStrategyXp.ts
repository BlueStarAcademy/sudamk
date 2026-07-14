/** 모험 몬스터 승리 기본 EXP (판 크기별). 정산 시 `ADVENTURE_BATTLE_XP_MULTIPLIER`가 추가로 곱해짐. */
export const ADVENTURE_STRATEGY_XP_BY_BOARD_SIZE: Record<number, number> = {
    7: 30,
    9: 75,
    11: 100,
    13: 150,
    19: 300,
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
