/** 2인 페어바둑 정산 시 금액·경험치 롤 구간 (`server/summaryService`와 동일). */
export type PairGoRewardBand = {
    gold: [number, number];
    petXp: [number, number];
    strategyXp: [number, number];
};

export const PAIR_GO_REWARD_BANDS: Record<9 | 13 | 19, PairGoRewardBand> = {
    9: { gold: [100, 200], petXp: [40, 60], strategyXp: [30, 40] },
    13: { gold: [300, 500], petXp: [70, 140], strategyXp: [50, 80] },
    19: { gold: [500, 1000], petXp: [100, 200], strategyXp: [120, 240] },
};
