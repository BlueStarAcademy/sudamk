export type RewardConfig = {
    questGoldBonus: number;
    questDiamondBonus: number;
    questActionPointBonus: number;
    activityGoldBonus: number;
    activityDiamondBonus: number;
    activityActionPointBonus: number;
    tournamentScoreBonus: number;
    tournamentGoldBonus: number;
    tournamentDiamondBonus: number;
    shopAdDiamondBonus: number;
    singleMissionGoldBonus: number;
    singleMissionDiamondBonus: number;
    guildCheckInCoinBonus: number;
    guildMissionCoinBonus: number;
    pvpStrategicWinGoldBonus: number;
    pvpStrategicLossGoldBonus: number;
    pvpStrategicWinDiamondBonus: number;
    pvpStrategicLossDiamondBonus: number;
    pvpPlayfulWinGoldBonus: number;
    pvpPlayfulLossGoldBonus: number;
    pvpPlayfulWinDiamondBonus: number;
    pvpPlayfulLossDiamondBonus: number;
};

export const DEFAULT_REWARD_CONFIG: RewardConfig = {
    questGoldBonus: 0,
    questDiamondBonus: 0,
    questActionPointBonus: 0,
    activityGoldBonus: 0,
    activityDiamondBonus: 0,
    activityActionPointBonus: 0,
    tournamentScoreBonus: 0,
    tournamentGoldBonus: 0,
    tournamentDiamondBonus: 0,
    shopAdDiamondBonus: 0,
    singleMissionGoldBonus: 0,
    singleMissionDiamondBonus: 0,
    guildCheckInCoinBonus: 0,
    guildMissionCoinBonus: 0,
    pvpStrategicWinGoldBonus: 0,
    pvpStrategicLossGoldBonus: 0,
    pvpStrategicWinDiamondBonus: 0,
    pvpStrategicLossDiamondBonus: 0,
    pvpPlayfulWinGoldBonus: 0,
    pvpPlayfulLossGoldBonus: 0,
    pvpPlayfulWinDiamondBonus: 0,
    pvpPlayfulLossDiamondBonus: 0,
};

const REWARD_CONFIG_KEYS = Object.keys(DEFAULT_REWARD_CONFIG) as Array<keyof RewardConfig>;

const clampRewardValue = (value: unknown): number => {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.max(0, Math.min(1000000, Math.floor(num)));
};

export const normalizeRewardConfig = (raw: unknown): RewardConfig => {
    const out: RewardConfig = { ...DEFAULT_REWARD_CONFIG };
    if (!raw || typeof raw !== 'object') return out;
    const source = raw as Record<string, unknown>;
    for (const key of REWARD_CONFIG_KEYS) {
        out[key] = clampRewardValue(source[key]);
    }
    return out;
};
