
import { GameMode } from './enums.js';
import type { ArenaChannel, ArenaLobbyIntent } from './api.js';

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
