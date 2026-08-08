import { resolvePublicUrl } from '../utils/publicAssetUrl.js';

export type ResourceIconKey = 'gold' | 'diamonds';
export type SpecialResourceIconKey = 'guildCoins' | 'champCoins';

/** public/ 정적 경로 — Vite `base`·모바일 WebView에서도 동일하게 해석 */
const iconPaths: Record<ResourceIconKey | 'actionPlus' | 'actionPoint' | 'actionPointPng' | 'actionPointSvg', string> = {
    gold: resolvePublicUrl('/images/icon/Gold.webp'),
    diamonds: resolvePublicUrl('/images/icon/Zem.webp'),
    /** 헤더「행동력 충전」버튼 전용 */
    actionPlus: resolvePublicUrl('/images/icon/applus.webp'),
    /** 행동력(번개) — 모바일 호환용 PNG 우선 */
    actionPointPng: resolvePublicUrl('/images/icon/action-point.png'),
    /** 행동력(번개) webp */
    actionPoint: resolvePublicUrl('/images/icon/action-point.png'),
    /** 작은 UI용 선명 SVG */
    actionPointSvg: resolvePublicUrl('/images/icon/action-point.svg'),
};

const specialResourcePaths: Record<SpecialResourceIconKey, string> = {
    guildCoins: resolvePublicUrl('/images/guild/tokken.webp'),
    champCoins: resolvePublicUrl('/images/icon/champcoin.webp'),
};

export const resourceIcons = {
    gold: iconPaths.gold,
    diamonds: iconPaths.diamonds,
    actionPlus: iconPaths.actionPlus,
    actionPoint: iconPaths.actionPoint,
    actionPointPng: iconPaths.actionPointPng,
    actionPointSvg: iconPaths.actionPointSvg,
} as const;

export const specialResourceIcons = {
    guildCoins: specialResourcePaths.guildCoins,
    champCoins: specialResourcePaths.champCoins,
} as const;

/** 정적 경로(서버·비번들 문자열) — 클라이언트 resourceIcons와 동일 에셋 */
export const ACTION_POINT_ICON_PATH = '/images/icon/action-point.png';
export const ACTION_POINT_ICON_WEBP_PATH = '/images/icon/action-point.webp';
export const ACTION_POINT_ICON_SVG_PATH = '/images/icon/action-point.svg';
