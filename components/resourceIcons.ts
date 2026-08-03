export type ResourceIconKey = 'gold' | 'diamonds';
export type SpecialResourceIconKey = 'guildCoins' | 'champCoins';

const iconPaths: Record<ResourceIconKey | 'actionPlus' | 'actionPoint' | 'actionPointSvg', string> = {
    gold: new URL('/images/icon/Gold.webp', import.meta.url).href,
    diamonds: new URL('/images/icon/Zem.webp', import.meta.url).href,
    /** 헤더「행동력 충전」버튼 전용 */
    actionPlus: new URL('/images/icon/applus.webp', import.meta.url).href,
    /** 행동력(번개) — 인라인·보상·비용 표시용 래스터 */
    actionPoint: new URL('/images/icon/action-point.webp', import.meta.url).href,
    /** 작은 UI용 선명 SVG */
    actionPointSvg: new URL('/images/icon/action-point.svg', import.meta.url).href,
};

const specialResourcePaths: Record<SpecialResourceIconKey, string> = {
    guildCoins: new URL('/images/guild/tokken.webp', import.meta.url).href,
    champCoins: new URL('/images/icon/champcoin.webp', import.meta.url).href,
};

export const resourceIcons = {
    gold: iconPaths.gold,
    diamonds: iconPaths.diamonds,
    actionPlus: iconPaths.actionPlus,
    actionPoint: iconPaths.actionPoint,
    actionPointSvg: iconPaths.actionPointSvg,
} as const;

export const specialResourceIcons = {
    guildCoins: specialResourcePaths.guildCoins,
    champCoins: specialResourcePaths.champCoins,
} as const;

/** 정적 경로(서버·비번들 문자열) — 클라이언트 resourceIcons와 동일 에셋 */
export const ACTION_POINT_ICON_PATH = '/images/icon/action-point.webp';
export const ACTION_POINT_ICON_SVG_PATH = '/images/icon/action-point.svg';


