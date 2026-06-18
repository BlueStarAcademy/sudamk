
import { GameMode } from "../types/index.js";
import type { ArenaChannel, ArenaLobbyIntent } from "../shared/types/api.js";
export {
    APP_HOME_HASH,
    APP_HOME_ARENA_HASH,
    APP_HOME_RANKING_HASH,
    LEGACY_APP_HOME_HASH,
    isAppHomeHash,
    normalizeLegacyAppHash,
    normalizeLegacyHomeHash,
} from '../shared/types/navigation.js';

export type AppRoute = {
    view: 'login' | 'register' | 'kakao-callback' | 'google-callback' | 'set-nickname' | 'profile' | 'arena' | 'pvp' | 'ai' | 'game' | 'admin' | 'tournament' | 'singleplayer' | 'guild' | 'guildboss' | 'guildwar' | 'tower' | 'adventure';
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

/**
 * 경기장(4뎁스)에서 대기실·홈 등으로 나갈 때 사용.
 * `location.hash` 대입은 스택에 경기장 URL을 남겨 뒤로가기 시 경기장으로 돌아가므로, 현재 항목을 교체한다.
 * replaceState는 hashchange를 발생시키지 않아 수동으로 디스패치한다.
 */
export function replaceAppHash(hash: string): void {
    const normalized = hash.startsWith('#') ? hash : `#${hash}`;
    const base = window.location.pathname + window.location.search;
    const newUrl = base + normalized;
    const currentFull = base + window.location.hash;
    if (currentFull === newUrl) return;
    window.history.replaceState(window.history.state, '', newUrl);
    window.dispatchEvent(new Event('hashchange'));
}

const SKIP_GAME_HASH_LEAVE_INTERCEPT_KEY = 'skipGameHashLeaveIntercept';

type SkipInterceptPayload = { until: number; remaining: number };

/**
 * 비상탈출 등 의도적 홈 이동 시 `Game.tsx`의 hashchange·popstate 인터셉터가
 * 기권 확인 모달을 띄우지 않도록 짧은 구간 안에서 최대 2회 건너뛴다(동일 네비에서 이벤트가 둘 다 올 수 있음).
 */
export function markSkipGameHashLeaveInterceptOnce(): void {
    try {
        const payload: SkipInterceptPayload = { until: Date.now() + 1200, remaining: 2 };
        sessionStorage.setItem(SKIP_GAME_HASH_LEAVE_INTERCEPT_KEY, JSON.stringify(payload));
    } catch {
        /* ignore */
    }
}

const CHAMPIONSHIP_ARENA_EXIT_SUPPRESS_REDIRECT_KEY = 'championshipArenaExitSuppressRedirect';

/** 챔피언십 경기장 나가기 직후 지연된 redirectToTournament가 대기실을 덮어쓰지 않도록 한다. */
export function markChampionshipArenaExitSuppressRedirect(): void {
    try {
        const payload: SkipInterceptPayload = { until: Date.now() + 3000, remaining: 8 };
        sessionStorage.setItem(CHAMPIONSHIP_ARENA_EXIT_SUPPRESS_REDIRECT_KEY, JSON.stringify(payload));
    } catch {
        /* ignore */
    }
}

export function shouldSuppressChampionshipArenaRedirect(): boolean {
    try {
        const route = parseHash(window.location.hash);
        if (route.view === 'tournament' && !route.params?.type) {
            return true;
        }
        const raw = sessionStorage.getItem(CHAMPIONSHIP_ARENA_EXIT_SUPPRESS_REDIRECT_KEY);
        if (!raw) return false;
        const p = JSON.parse(raw) as SkipInterceptPayload;
        if (typeof p.until !== 'number' || typeof p.remaining !== 'number') {
            sessionStorage.removeItem(CHAMPIONSHIP_ARENA_EXIT_SUPPRESS_REDIRECT_KEY);
            return false;
        }
        if (Date.now() > p.until || p.remaining <= 0) {
            sessionStorage.removeItem(CHAMPIONSHIP_ARENA_EXIT_SUPPRESS_REDIRECT_KEY);
            return false;
        }
        const next: SkipInterceptPayload = { until: p.until, remaining: p.remaining - 1 };
        if (next.remaining <= 0) sessionStorage.removeItem(CHAMPIONSHIP_ARENA_EXIT_SUPPRESS_REDIRECT_KEY);
        else sessionStorage.setItem(CHAMPIONSHIP_ARENA_EXIT_SUPPRESS_REDIRECT_KEY, JSON.stringify(next));
        return true;
    } catch {
        try {
            sessionStorage.removeItem(CHAMPIONSHIP_ARENA_EXIT_SUPPRESS_REDIRECT_KEY);
        } catch {
            /* ignore */
        }
        return false;
    }
}

export function consumeSkipGameHashLeaveInterceptOnce(): boolean {
    try {
        const raw = sessionStorage.getItem(SKIP_GAME_HASH_LEAVE_INTERCEPT_KEY);
        if (!raw) return false;
        const p = JSON.parse(raw) as SkipInterceptPayload;
        if (typeof p.until !== 'number' || typeof p.remaining !== 'number') {
            sessionStorage.removeItem(SKIP_GAME_HASH_LEAVE_INTERCEPT_KEY);
            return false;
        }
        if (Date.now() > p.until || p.remaining <= 0) {
            sessionStorage.removeItem(SKIP_GAME_HASH_LEAVE_INTERCEPT_KEY);
            return false;
        }
        const next: SkipInterceptPayload = { until: p.until, remaining: p.remaining - 1 };
        if (next.remaining <= 0) sessionStorage.removeItem(SKIP_GAME_HASH_LEAVE_INTERCEPT_KEY);
        else sessionStorage.setItem(SKIP_GAME_HASH_LEAVE_INTERCEPT_KEY, JSON.stringify(next));
        return true;
    } catch {
        try {
            sessionStorage.removeItem(SKIP_GAME_HASH_LEAVE_INTERCEPT_KEY);
        } catch {
            /* ignore */
        }
        return false;
    }
}

/** 현재 URL이 경기장이고 목적지가 경기장이 아니면 replace, 그 외에는 일반 해시 이동(스택 추가). */
export function navigateFromGameIfApplicable(targetHash: string): void {
    const h = targetHash.startsWith('#') ? targetHash : `#${targetHash}`;
    const onGame = window.location.hash.startsWith('#/game/');
    const toGame = h.startsWith('#/game/');
    if (onGame && !toGame) {
        replaceAppHash(h);
    } else {
        window.location.hash = h;
    }
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
        case 'game': return { view: 'game', params: { id: rest[0] } };
        case 'tournament': return { view: 'tournament', params: { type: rest[0] || null } };
        case 'singleplayer': return { view: 'singleplayer', params: {} };
        case 'guild': return { view: 'guild', params: {} };
        case 'guildboss': return { view: 'guildboss', params: {} };
        case 'guildwar':
        case 'guldwar': // 흔한 오타
            return { view: 'guildwar', params: {} };
        case 'tower': return { view: 'tower', params: {} };
        case 'adventure': return { view: 'adventure', params: { stageId: rest[0] || null } };
        case 'admin': return { view: 'admin', params: {} };
        case 'register': return { view: 'register', params: {} };
        case 'set-nickname': return { view: 'set-nickname', params: {} };
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
        default: return { view: 'login', params: {} };
    }
}

export const stableStringify = (data: any): string => {
    const processValue = (value: any): any => {
        if (value === null || typeof value !== 'object') {
            return value;
        }

        if (Array.isArray(value)) {
            const processedArray = value.map(processValue);
            try {
                return processedArray.sort((a, b) => {
                    const strA = JSON.stringify(a);
                    const strB = JSON.stringify(b);
                    return strA.localeCompare(strB);
                });
            } catch (e) {
                console.error("Could not sort array for stableStringify:", e);
                return processedArray;
            }
        }
        
        const sortedKeys = Object.keys(value).sort();
        const newObj: { [key: string]: any } = {};
        for (const key of sortedKeys) {
            newObj[key] = processValue(value[key]);
        }
        return newObj;
    };
    
    return JSON.stringify(processValue(data));
};