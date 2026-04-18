export type LevelUpBranchDelta = { from: number; to: number };

/** 전략·놀이 중 실제로 오른 축만 채움 (동시 상승 시 둘 다 존재 가능) */
export type LevelUpCelebrationPayload = {
    strategy?: LevelUpBranchDelta;
    playful?: LevelUpBranchDelta;
};
