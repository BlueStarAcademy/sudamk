import { GameMode } from '../types/enums.js';

/** PVE 봇 전용 프로필 이미지 — 유저 공용 프로필과 분리 */
export const PVE_BOT_AVATAR_BASE = '/images/pve-bots';

const PVE_BOT_AVATAR_SLUG: Record<GameMode, string> = {
    [GameMode.Standard]: 'standard',
    [GameMode.Capture]: 'capture',
    [GameMode.Speed]: 'speed',
    [GameMode.Base]: 'base',
    [GameMode.Hidden]: 'hidden',
    [GameMode.Missile]: 'missile',
    [GameMode.Uniform]: 'uniform',
    [GameMode.Castle]: 'castle',
    [GameMode.Chess]: 'chess',
    [GameMode.Mix]: 'mix',
    [GameMode.Dice]: 'dice',
    [GameMode.Omok]: 'omok',
    [GameMode.Ttamok]: 'ttamok',
    [GameMode.Thief]: 'thief',
    [GameMode.Alkkagi]: 'alkkagi',
    [GameMode.Curling]: 'curling',
};

export const PVE_SINGLEPLAYER_BOT_AVATAR_URL = `${PVE_BOT_AVATAR_BASE}/singleplayer.webp`;
export const PVE_TOWER_BOT_AVATAR_URL = `${PVE_BOT_AVATAR_BASE}/tower.webp`;
export const PVE_GUILD_WAR_BOT_AVATAR_URL = `${PVE_BOT_AVATAR_BASE}/guildwar.webp`;

export const PVE_SINGLEPLAYER_BOT_AVATAR_ID = 'pve_bot_singleplayer';
export const PVE_TOWER_BOT_AVATAR_ID = 'pve_bot_tower';
export const PVE_GUILD_WAR_BOT_AVATAR_ID = 'pve_bot_guildwar';

export function pveBotAvatarIdForMode(mode: GameMode): string {
    const slug = PVE_BOT_AVATAR_SLUG[mode] ?? 'standard';
    return `pve_bot_${slug}`;
}

export function pveBotAvatarUrlForMode(mode: GameMode): string {
    const slug = PVE_BOT_AVATAR_SLUG[mode] ?? 'standard';
    return `${PVE_BOT_AVATAR_BASE}/${slug}.webp`;
}

export const PVE_BOT_AVATAR_ENTRIES: Array<{
    id: string;
    name: string;
    url: string;
}> = [
    ...Object.entries(PVE_BOT_AVATAR_SLUG).map(([mode, slug]) => ({
        id: `pve_bot_${slug}`,
        name: `${mode} PVE 봇`,
        url: `${PVE_BOT_AVATAR_BASE}/${slug}.webp`,
    })),
    { id: 'pve_bot_singleplayer', name: '싱글플레이 봇', url: PVE_SINGLEPLAYER_BOT_AVATAR_URL },
    { id: 'pve_bot_tower', name: '도전의 탑 봇', url: PVE_TOWER_BOT_AVATAR_URL },
    { id: 'pve_bot_guildwar', name: '길드전 봇', url: PVE_GUILD_WAR_BOT_AVATAR_URL },
];
