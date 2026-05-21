const STORAGE_KEY = 'sudamr.screenGuides.dismissed.v1';

export type ScreenGuideId =
    | 'home'
    | 'profileEdit'
    | 'guildHome'
    | 'singlePlayerAcademy'
    | 'trainingQuest'
    | 'tower'
    | 'pvpArena'
    | 'championship'
    | 'adventure'
    | 'petManagement';

function readDismissedSet(): Set<ScreenGuideId> {
    if (typeof window === 'undefined') return new Set();
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((id): id is ScreenGuideId => typeof id === 'string'));
    } catch {
        return new Set();
    }
}

function writeDismissedSet(set: Set<ScreenGuideId>): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
    } catch {
        // ignore quota / private mode
    }
}

export function isScreenGuideDismissed(id: ScreenGuideId): boolean {
    return readDismissedSet().has(id);
}

export function dismissScreenGuide(id: ScreenGuideId): void {
    const set = readDismissedSet();
    if (set.has(id)) return;
    set.add(id);
    writeDismissedSet(set);
}

/** 개발·QA용 — 필요 시 콘솔에서 호출 */
export function resetAllScreenGuides(): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore
    }
}
