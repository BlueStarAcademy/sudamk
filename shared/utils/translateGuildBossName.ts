import type { TFunction } from 'i18next';

export function translateGuildBossName(
    bossId: string | undefined,
    fallbackName: string | undefined,
    t: TFunction,
): string {
    if (!bossId) return fallbackName ?? '';
    return t(`guild:boss.names.${bossId}`, { defaultValue: fallbackName ?? bossId });
}
