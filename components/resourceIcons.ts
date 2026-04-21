export type ResourceIconKey = 'gold' | 'diamonds';
export type SpecialResourceIconKey = 'guildCoins';

const iconPaths: Record<ResourceIconKey | 'actionPlus', string> = {
    gold: new URL('/images/icon/Gold.png', import.meta.url).href,
    diamonds: new URL('/images/icon/Zem.png', import.meta.url).href,
    /** 헤더「행동력 충전」버튼 전용 — 행동력 회복제 아이템·우편 아이콘은 lightning.png(템플릿) */
    actionPlus: new URL('/images/icon/applus.png', import.meta.url).href,
};

const specialResourcePaths: Record<SpecialResourceIconKey, string> = {
    guildCoins: new URL('/images/guild/tokken.png', import.meta.url).href,
};

export const resourceIcons = {
    gold: iconPaths.gold,
    diamonds: iconPaths.diamonds,
    actionPlus: iconPaths.actionPlus,
} as const;

export const specialResourceIcons = {
    guildCoins: specialResourcePaths.guildCoins,
} as const;


