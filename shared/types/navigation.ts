
import { GameMode } from './enums.js';
import type { ArenaChannel, ArenaLobbyIntent } from './api.js';

/** 로그인 후 메인 홈 화면 해시 */
export const APP_HOME_HASH = '#/home';
export const APP_HOME_ARENA_HASH = '#/home/arena';
export const APP_HOME_RANKING_HASH = '#/home/ranking';

/** @deprecated 구 URL — parseHash·리다이렉트에서만 호환 */
export const LEGACY_APP_HOME_HASH = '#/profile';
export const LEGACY_APP_HOME_ARENA_HASH = '#/profile/arena';
export const LEGACY_APP_HOME_RANKING_HASH = '#/profile/ranking';

const LEGACY_APP_HASH_MAP: Record<string, string> = {
    [LEGACY_APP_HOME_HASH]: APP_HOME_HASH,
    [LEGACY_APP_HOME_ARENA_HASH]: APP_HOME_ARENA_HASH,
    [LEGACY_APP_HOME_RANKING_HASH]: APP_HOME_RANKING_HASH,
};

export function isAppHomeHash(hash: string): boolean {
    const path = hash.split('?')[0];
    return path === APP_HOME_HASH || path === LEGACY_APP_HOME_HASH;
}

/** 구 `#/profile` 계열·단독 `#/arena` → `#/home` 계열 정규화 (쿼리 유지) */
export function normalizeLegacyAppHash(hash: string): string {
    const qIdx = hash.indexOf('?');
    const pathOnly = qIdx >= 0 ? hash.slice(0, qIdx) : hash;
    const query = qIdx >= 0 ? hash.slice(qIdx) : '';
    const mapped =
        LEGACY_APP_HASH_MAP[pathOnly] ?? (pathOnly === '#/arena' ? APP_HOME_ARENA_HASH : pathOnly);
    if (mapped === pathOnly) return hash;
    return mapped + query;
}

/** @deprecated `normalizeLegacyAppHash` 사용 */
export function normalizeLegacyHomeHash(hash: string): string {
    return normalizeLegacyAppHash(hash);
}

export type AppRoute = {
    view:
        | 'login'
        | 'register'
        | 'kakao-callback'
        | 'google-callback'
        | 'set-nickname'
        | 'profile'
        | 'arena'
        | 'pvp'
        | 'ai'
        | 'game'
        | 'admin'
        | 'tournament'
        | 'singleplayer'
        | 'guild'
        | 'guildboss'
        | 'guildwar'
        | 'tower'
        | 'adventure';
    params: any;
};

function parseLobbyChannel(value: string | undefined): ArenaChannel | null {
    if (value === 'strategic' || value === 'pair' || value === 'playful') return value;
    return null;
}

function parseLobbyIntent(value: string | undefined): ArenaLobbyIntent | null {
    if (value === 'pvp' || value === 'ai') return value;
    return null;
}

export function parseHash(hash: string): AppRoute {
    const path = hash.replace(/^#\/?/, '').split('?')[0]; // 쿼리 파라미터 제거
    const [view, ...rest] = path.split('/');

    switch (view) {
        case 'arena': {
            const intent = parseLobbyIntent(rest[0]);
            if (intent) return { view: 'arena', params: { intent } };
            return { view: 'profile', params: { tab: 'arena' as const } };
        }
        case 'pvp': {
            const channel = parseLobbyChannel(rest[0]);
            if (channel) return { view: 'pvp', params: { channel } };
            return { view: 'profile', params: { tab: 'arena' as const } };
        }
        case 'ai': {
            const channel = parseLobbyChannel(rest[0]);
            if (channel) return { view: 'ai', params: { channel } };
            return { view: 'profile', params: { tab: 'arena' as const } };
        }
        case 'waiting':
        case 'pair':
        case 'lobby':
            return { view: 'profile', params: { tab: 'arena' as const } };
        case 'game':
            return { view: 'game', params: { id: rest[0] } };
        case 'tournament':
            return { view: 'tournament', params: { type: rest[0] || null } };
        case 'singleplayer':
            return { view: 'singleplayer', params: {} };
        case 'guild':
            return { view: 'guild', params: {} };
        case 'guildboss':
            return { view: 'guildboss', params: {} };
        case 'guildwar':
            return { view: 'guildwar', params: {} };
        case 'tower':
            return { view: 'tower', params: {} };
        case 'adventure':
            return { view: 'adventure', params: { stageId: rest[0] || null } };
        case 'admin':
            return { view: 'admin', params: {} };
        case 'register':
            return { view: 'register', params: {} };
        case 'set-nickname':
            return { view: 'set-nickname', params: {} };
        case 'home': {
            const sub = rest[0];
            if (sub === 'ranking') return { view: 'profile', params: { tab: 'ranking' as const } };
            if (sub === 'arena') return { view: 'profile', params: { tab: 'arena' as const } };
            return { view: 'profile', params: { tab: 'home' as const } };
        }
        case 'profile': {
            const sub = rest[0];
            if (sub === 'ranking') return { view: 'profile', params: { tab: 'ranking' as const } };
            if (sub === 'arena') return { view: 'profile', params: { tab: 'arena' as const } };
            return { view: 'profile', params: { tab: 'home' as const } };
        }
        case 'auth':
            if (rest[0] === 'kakao' && rest[1] === 'callback') {
                return { view: 'kakao-callback', params: {} };
            }
            if (rest[0] === 'google' && rest[1] === 'callback') {
                return { view: 'google-callback', params: {} };
            }
            return { view: 'login', params: {} };
        default:
            return { view: 'login', params: {} };
    }
}

/** Dock·로비·길드 등 "메인 화면" 이동 감지용 라우트 키 (퀵메뉴 자동 닫기 등) */
export function getAppRouteNavigationKey(route: AppRoute): string {
    switch (route.view) {
        case 'profile':
            return `profile:${route.params?.tab ?? 'home'}`;
        case 'tournament':
            return `tournament:${route.params?.type ?? ''}`;
        case 'pvp':
            return `pvp:${route.params?.channel ?? ''}`;
        case 'ai':
            return `ai:${route.params?.channel ?? ''}`;
        case 'arena':
            return `arena:${route.params?.intent ?? ''}`;
        case 'adventure':
            return `adventure:${route.params?.stageId ?? ''}`;
        case 'game':
            return `game:${route.params?.id ?? ''}`;
        default:
            return route.view;
    }
}

/** @deprecated legacy GameMode waiting routes — use arena lobby hash helpers instead */
export type LegacyWaitingMode = GameMode;
