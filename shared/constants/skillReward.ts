export const ENABLE_PVP_SKILL_REWARD_MULTIPLIER = true;

/**
 * 상대-내 레이팅 차이(diff=opponent-player)에 따른 보상 배수.
 * threshold 이상(또는 이하)일 때 multiplier를 적용한다.
 */
export const PVP_SKILL_REWARD_STEPS: Array<{ threshold: number; multiplier: number }> = [
    { threshold: 300, multiplier: 1.3 },
    { threshold: 200, multiplier: 1.2 },
    { threshold: 100, multiplier: 1.1 },
    { threshold: -100, multiplier: 0.9 },
    { threshold: -200, multiplier: 0.82 },
    { threshold: -300, multiplier: 0.75 },
];

export const PVP_SKILL_REWARD_MIN_MULTIPLIER = 0.75;
export const PVP_SKILL_REWARD_MAX_MULTIPLIER = 1.3;

/**
 * 랭킹전 실력 기반 보상 배수.
 * - 강한 상대를 이기면 보상 상향
 * - 약한 상대 반복 파밍은 보상 하향
 * - 패배 시에는 배수 영향치를 완화
 */
export const getPvpSkillRewardMultiplier = (
    playerRating: number,
    opponentRating: number,
    isWinner: boolean,
): number => {
    const diff = opponentRating - playerRating;
    let multiplier = 1;

    if (diff >= 300) multiplier = 1.3;
    else if (diff >= 200) multiplier = 1.2;
    else if (diff >= 100) multiplier = 1.1;
    else if (diff <= -300) multiplier = 0.75;
    else if (diff <= -200) multiplier = 0.82;
    else if (diff <= -100) multiplier = 0.9;

    if (!isWinner) {
        multiplier = 1 + (multiplier - 1) * 0.35;
    }

    return Math.max(PVP_SKILL_REWARD_MIN_MULTIPLIER, Math.min(PVP_SKILL_REWARD_MAX_MULTIPLIER, multiplier));
};

