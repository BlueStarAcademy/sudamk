import type { User } from '../types/entities.js';

export type VipProfileMarkerLabel = '보상VIP' | '기능VIP' | 'VVIP';

export function getVipProfileMarkerLabel(user: User): VipProfileMarkerLabel | null {
    const now = Date.now();
    const anyUser = user as unknown as Record<string, unknown>;
    const readExpiry = (keys: string[]): number => {
        for (const key of keys) {
            const value = anyUser[key];
            if (typeof value === 'number' && Number.isFinite(value)) return value;
        }
        return 0;
    };
    const readText = (keys: string[]): string => {
        for (const key of keys) {
            const value = anyUser[key];
            if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase();
        }
        return '';
    };

    const typedVip = readText(['vipType', 'activeVipType', 'vipTier']);
    if (typedVip.includes('vvip')) return 'VVIP';
    if (typedVip.includes('function')) return '기능VIP';
    if (typedVip.includes('reward')) return '보상VIP';

    const vvipExpiresAt = readExpiry(['vvipExpiresAt', 'vvipEndAt', 'vvipUntil']);
    const rewardVipExpiresAt = readExpiry(['rewardVipExpiresAt', 'rewardVipEndAt', 'rewardVipUntil']);
    const functionVipExpiresAt = readExpiry(['functionVipExpiresAt', 'functionVipEndAt', 'functionVipUntil']);

    if (vvipExpiresAt > now) return 'VVIP';
    const rewardActive = rewardVipExpiresAt > now;
    const functionActive = functionVipExpiresAt > now;
    if (rewardActive && functionActive) return 'VVIP';
    if (functionActive) return '기능VIP';
    if (rewardActive) return '보상VIP';
    return null;
}

export function hasProfileStatusMarkers(user: User): boolean {
    return getVipProfileMarkerLabel(user) != null || getActiveDiamondPackageRoman(user) != null;
}

export function getActiveDiamondPackageRoman(user: User): 'I' | 'II' | 'III' | null {
    const now = Date.now();
    if ((user.diamondPackageExpiresAt ?? 0) <= now) return null;
    const t = user.activeDiamondPackageTier;
    if (t === 1) return 'I';
    if (t === 2) return 'II';
    if (t === 3) return 'III';
    return null;
}
