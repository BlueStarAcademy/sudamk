import {
    isScreenGuideId,
    normalizeDismissedScreenGuides,
    type ScreenGuideId,
} from '../shared/constants/screenGuideDismiss.js';

export type { ScreenGuideId } from '../shared/constants/screenGuideDismiss.js';
export { SCREEN_GUIDE_IDS, normalizeDismissedScreenGuides } from '../shared/constants/screenGuideDismiss.js';

const STORAGE_KEY_PREFIX = 'sudamr.screenGuides.dismissed.v1';
/** v1 전역 키(계정 미구분) — 로그인 사용자로 마이그레이션 */
const LEGACY_GLOBAL_STORAGE_KEY = STORAGE_KEY_PREFIX;

function storageKeyForUser(userId: string | null | undefined): string | null {
    if (!userId || typeof userId !== 'string') return null;
    return `${STORAGE_KEY_PREFIX}:${userId}`;
}

function readDismissedSetForKey(key: string): Set<ScreenGuideId> {
    if (typeof window === 'undefined') return new Set();
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(normalizeDismissedScreenGuides(parsed));
    } catch {
        return new Set();
    }
}

function writeDismissedSetForKey(key: string, set: Set<ScreenGuideId>): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, JSON.stringify([...set]));
    } catch {
        // ignore quota / private mode
    }
}

function mergeIntoKey(key: string, ids: Iterable<ScreenGuideId>): void {
    const set = readDismissedSetForKey(key);
    let changed = false;
    for (const id of ids) {
        if (!set.has(id)) {
            set.add(id);
            changed = true;
        }
    }
    if (changed) writeDismissedSetForKey(key, set);
}

/**
 * 로그인·USER_UPDATE 시 서버 `dismissedScreenGuides`를 계정별 localStorage에 반영.
 * 재접속·다른 기기에서도 안내가 다시 뜨지 않도록 한다.
 */
export function syncDismissedScreenGuidesFromUser(
    userId: string | null | undefined,
    serverDismissed?: unknown,
): void {
    const key = storageKeyForUser(userId);
    if (!key) return;

    const fromServer = normalizeDismissedScreenGuides(serverDismissed);
    if (fromServer.length > 0) {
        mergeIntoKey(key, fromServer);
    }

    if (typeof window === 'undefined') return;
    try {
        const legacy = readDismissedSetForKey(LEGACY_GLOBAL_STORAGE_KEY);
        if (legacy.size > 0) {
            mergeIntoKey(key, legacy);
            window.localStorage.removeItem(LEGACY_GLOBAL_STORAGE_KEY);
        }
    } catch {
        // ignore
    }
}

export function isScreenGuideDismissed(id: ScreenGuideId, userId?: string | null): boolean {
    const key = storageKeyForUser(userId);
    if (key && readDismissedSetForKey(key).has(id)) return true;
    if (!userId) {
        return readDismissedSetForKey(LEGACY_GLOBAL_STORAGE_KEY).has(id);
    }
    return false;
}

export function dismissScreenGuide(id: ScreenGuideId, userId?: string | null): void {
    const key = storageKeyForUser(userId) ?? LEGACY_GLOBAL_STORAGE_KEY;
    const set = readDismissedSetForKey(key);
    if (set.has(id)) return;
    set.add(id);
    writeDismissedSetForKey(key, set);
}

/** 개발·QA용 — 필요 시 콘솔에서 호출 */
export function resetAllScreenGuides(userId?: string | null): void {
    if (typeof window === 'undefined') return;
    try {
        if (userId) {
            const key = storageKeyForUser(userId);
            if (key) window.localStorage.removeItem(key);
        } else {
            window.localStorage.removeItem(LEGACY_GLOBAL_STORAGE_KEY);
        }
    } catch {
        // ignore
    }
}
