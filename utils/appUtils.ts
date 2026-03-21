
import { GameMode } from "../types/index.js";

export type AppRoute = {
    view: 'login' | 'register' | 'kakao-callback' | 'set-nickname' | 'profile' | 'lobby' | 'waiting' | 'game' | 'admin' | 'tournament' | 'singleplayer' | 'guild' | 'guildboss' | 'guildwar' | 'tower';
    params: any;
};

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
    const path = hash.replace(/^#\/?/, '');
    const [view, ...rest] = path.split('/');

    switch (view) {
        case 'lobby': return { view: 'lobby', params: { type: rest[0] || 'strategic' } };
        case 'waiting': return { view: 'waiting', params: { mode: rest[0] ? decodeURIComponent(rest[0]) as GameMode : null } };
        case 'game': return { view: 'game', params: { id: rest[0] } };
        case 'tournament': return { view: 'tournament', params: { type: rest[0] || null } };
        case 'singleplayer': return { view: 'singleplayer', params: {} };
        case 'guild': return { view: 'guild', params: {} };
        case 'guildboss': return { view: 'guildboss', params: {} };
        case 'guildwar': return { view: 'guildwar', params: {} };
        case 'tower': return { view: 'tower', params: {} };
        case 'admin': return { view: 'admin', params: {} };
        case 'register': return { view: 'register', params: {} };
        case 'set-nickname': return { view: 'set-nickname', params: {} };
        case 'profile': return { view: 'profile', params: {} };
        case 'auth': 
            if (rest[0] === 'kakao' && rest[1] === 'callback') {
                return { view: 'kakao-callback', params: {} };
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