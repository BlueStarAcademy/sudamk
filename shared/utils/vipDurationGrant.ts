import type { User } from '../types/entities.js';

export type AdminVipGrantFlags = {
    grantRewardVip: boolean;
    grantFunctionVip: boolean;
    grantVvip: boolean;
};

const MAX_DURATION_MS = 100 * 365 * 24 * 60 * 60 * 1000;

/** 선택한 VIP 종류에만 `현재 또는 만료 시각 중 큰 값 + duration`을 적용합니다. */
export function applyVipDurationExtensionToUser(
    user: User,
    flags: AdminVipGrantFlags,
    durationMs: number,
    nowMs: number = Date.now(),
): void {
    if (!flags.grantRewardVip && !flags.grantFunctionVip && !flags.grantVvip) return;
    const clampedMs = Math.max(0, Math.min(Math.floor(durationMs), MAX_DURATION_MS));
    if (clampedMs <= 0) return;

    if (flags.grantRewardVip) {
        const cur =
            typeof user.rewardVipExpiresAt === 'number' && Number.isFinite(user.rewardVipExpiresAt)
                ? user.rewardVipExpiresAt
                : 0;
        user.rewardVipExpiresAt = Math.max(nowMs, cur) + clampedMs;
    }
    if (flags.grantFunctionVip) {
        const cur =
            typeof user.functionVipExpiresAt === 'number' && Number.isFinite(user.functionVipExpiresAt)
                ? user.functionVipExpiresAt
                : 0;
        user.functionVipExpiresAt = Math.max(nowMs, cur) + clampedMs;
    }
    if (flags.grantVvip) {
        const cur = typeof user.vvipExpiresAt === 'number' && Number.isFinite(user.vvipExpiresAt) ? user.vvipExpiresAt : 0;
        user.vvipExpiresAt = Math.max(nowMs, cur) + clampedMs;
    }
}
