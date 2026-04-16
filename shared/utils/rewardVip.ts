import type { User } from '../types/entities.js';

function readExpiry(user: User, keys: string[]): number {
    const anyUser = user as unknown as Record<string, unknown>;
    for (const key of keys) {
        const value = anyUser[key];
        if (typeof value === 'number' && Number.isFinite(value)) return value;
    }
    return 0;
}

function readText(user: User, keys: string[]): string {
    const anyUser = user as unknown as Record<string, unknown>;
    for (const key of keys) {
        const value = anyUser[key];
        if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase();
    }
    return '';
}

/** 보상 VIP(또는 VVIP에 포함된 보상 VIP) 유효기간이 남았는지 */
export function isRewardVipActive(user: User, nowMs: number = Date.now()): boolean {
    const typed = readText(user, ['vipType', 'activeVipType', 'vipTier']);
    if (typed.includes('vvip')) return true;
    if (typed.includes('reward')) return true;

    const vvipExpiresAt = readExpiry(user, ['vvipExpiresAt', 'vvipEndAt', 'vvipUntil']);
    if (vvipExpiresAt > nowMs) return true;

    const rewardVipExpiresAt = readExpiry(user, ['rewardVipExpiresAt', 'rewardVipEndAt', 'rewardVipUntil']);
    const functionVipExpiresAt = readExpiry(user, ['functionVipExpiresAt', 'functionVipEndAt', 'functionVipUntil']);
    const rewardActive = rewardVipExpiresAt > nowMs;
    const functionActive = functionVipExpiresAt > nowMs;
    if (rewardActive && functionActive) return true;
    return rewardActive;
}
