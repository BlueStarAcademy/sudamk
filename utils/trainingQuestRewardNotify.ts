import { SINGLE_PLAYER_MISSIONS } from '../constants/singlePlayerConstants.js';

/** 수련과제 저장량이 현재 레벨 maxCapacity 이상(수령 가능)인 미션이 하나라도 있는지 */
export function userHasFullTrainingQuestReward(
    user:
        | {
              singlePlayerMissions?: Record<
                  string,
                  { isStarted?: boolean; level?: number; lastCollectionTime?: number; accumulatedAmount?: number }
              >;
              clearedSinglePlayerStages?: string[];
          }
        | null
        | undefined,
    nowMs = Date.now(),
): boolean {
    if (!user) return false;
    const userMissions = user.singlePlayerMissions || {};
    const clearedStages = user.clearedSinglePlayerStages || [];

    return SINGLE_PLAYER_MISSIONS.some((mission) => {
        const missionState = userMissions[mission.id];
        if (!missionState) return false;

        const isUnlocked = clearedStages.includes(mission.unlockStageId);
        const isStarted = missionState.isStarted;
        if (!isUnlocked || !isStarted) return false;

        const currentLevel = missionState.level || 0;
        if (currentLevel === 0 || currentLevel > mission.levels.length) return false;

        const levelInfo = mission.levels[currentLevel - 1];
        const accumulatedAmount = missionState.accumulatedAmount || 0;

        const productionRateMs = levelInfo.productionRateMinutes * 60 * 1000;
        const lastCollectionTime = missionState.lastCollectionTime || nowMs;
        const elapsed = nowMs - lastCollectionTime;
        const cycles = Math.floor(elapsed / productionRateMs);

        let reward = accumulatedAmount;
        if (cycles > 0) {
            const generatedAmount = cycles * levelInfo.rewardAmount;
            reward = Math.min(levelInfo.maxCapacity, accumulatedAmount + generatedAmount);
        }

        return reward >= levelInfo.maxCapacity;
    });
}
