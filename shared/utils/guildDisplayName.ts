import type { TFunction } from 'i18next';
import { GUILD_WAR_BOT_GUILD_ID } from '../constants/auth.js';

const LEGACY_BOT_GUILD_NAMES = new Set(['[시스템]길드전AI', '[시스템] 길드전 AI']);

export function isGuildWarBotGuildId(guildId?: string | null): boolean {
    return guildId === GUILD_WAR_BOT_GUILD_ID;
}

export function translateGuildDisplayName(
    guild: { id?: string; name?: string } | null | undefined,
    t: TFunction,
): string {
    if (!guild) return '';
    if (isGuildWarBotGuildId(guild.id) || (guild.name && LEGACY_BOT_GUILD_NAMES.has(guild.name))) {
        return t('guild:war.systemAiGuild');
    }
    const trimmed = guild.name?.trim();
    return trimmed || t('guild:war.defaultGuildName');
}
