import { getGuildWarParticipationRewardMult } from './guildWarParticipationRewards.js';

export type GuildWarClaimedRewardsKv = Record<string, string[]>;

/** 직전 완료 길드전 보상을 해당 유저가 이미 수령했는지 (전쟁 ID 기준, 일일 리셋 없음) */
export function isGuildWarEndRewardClaimed(
    claimedRewards: GuildWarClaimedRewardsKv,
    warId: string,
    userId: string,
): boolean {
    return Boolean(claimedRewards[warId]?.includes(userId));
}

/** 직전 완료 길드전 종료 보상 수령 가능 여부 */
export function isGuildWarEndRewardClaimable(opts: {
    warId: string | null | undefined;
    claimedRewards: GuildWarClaimedRewardsKv;
    userId: string;
    now: number;
    rewardAvailableAt: number;
    participationAttempts: number;
    isAdmin?: boolean;
}): boolean {
    const { warId, claimedRewards, userId, now, rewardAvailableAt, participationAttempts, isAdmin } = opts;
    if (!warId) return false;
    if (isGuildWarEndRewardClaimed(claimedRewards, warId, userId)) return false;
    if (now < rewardAvailableAt) return false;
    if (isAdmin) return true;
    return getGuildWarParticipationRewardMult(participationAttempts) > 0;
}
