/** 길드 마크 기본 에셋·레거시 경로 정규화 */

export const GUILD_ICON_DEFAULT = '/images/guild/profile/icon1.webp';
export const GUILD_ICON_COUNT = 11;

export const GUILD_ICON_POOL: readonly string[] = Array.from(
    { length: GUILD_ICON_COUNT },
    (_, i) => `/images/guild/profile/icon${i + 1}.webp`,
);

/**
 * 저장된 `icon`/`emblem`을 표시용 URL로 정규화합니다.
 * - 레거시 `/images/guild/icon…` → `/images/guild/profile/icon…`
 * - `.png` → `.webp`
 */
export function resolveGuildIconPath(icon?: string | null): string {
    if (!icon || !String(icon).trim()) return GUILD_ICON_DEFAULT;
    let path = String(icon).trim();
    if (path.startsWith('/images/guild/icon')) {
        path = path.replace('/images/guild/icon', '/images/guild/profile/icon');
    }
    if (/\/images\//.test(path) && /\.png$/i.test(path)) {
        path = path.replace(/\.png$/i, '.webp');
    }
    return path;
}
