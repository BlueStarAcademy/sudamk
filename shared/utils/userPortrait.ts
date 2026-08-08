import { AVATAR_POOL, BORDER_POOL } from '../constants/ui.js';

const DEFAULT_AVATAR_URL = '/images/profiles/profile1.webp';

export type UserPortraitIds = {
    avatarId?: string | null;
    borderId?: string | null;
};

/** `User.avatarId` / `borderId` → Avatar용 URL (없으면 null) */
export function resolveUserPortraitUrls(ids: UserPortraitIds | null | undefined): {
    avatarUrl: string | null;
    borderUrl: string | null;
} {
    if (!ids) return { avatarUrl: null, borderUrl: null };
    const avatarUrl = ids.avatarId ? AVATAR_POOL.find((a) => a.id === ids.avatarId)?.url ?? null : null;
    const borderUrl = ids.borderId ? BORDER_POOL.find((b) => b.id === ids.borderId)?.url ?? null : null;
    return { avatarUrl, borderUrl };
}

/** Avatar 폴백과 동일 — 반드시 표시용 URL이 필요할 때 */
export function resolveUserAvatarUrlOrDefault(avatarId?: string | null): string {
    return resolveUserPortraitUrls({ avatarId }).avatarUrl ?? DEFAULT_AVATAR_URL;
}

export { DEFAULT_AVATAR_URL };
