/** 화면별 첫 진입 안내 모달 id — `useScreenGuide`·서버 `dismissedScreenGuides`와 동기화 */
export const SCREEN_GUIDE_IDS = [
    'home',
    'profileEdit',
    'guildHome',
    'singlePlayerAcademy',
    'trainingQuest',
    'tower',
    'pvpArena',
    'championship',
    'adventure',
    'petManagement',
] as const;

export type ScreenGuideId = (typeof SCREEN_GUIDE_IDS)[number];

const SCREEN_GUIDE_ID_SET = new Set<string>(SCREEN_GUIDE_IDS);

export function isScreenGuideId(value: unknown): value is ScreenGuideId {
    return typeof value === 'string' && SCREEN_GUIDE_ID_SET.has(value);
}

export function normalizeDismissedScreenGuides(raw: unknown): ScreenGuideId[] {
    if (!Array.isArray(raw)) return [];
    const out: ScreenGuideId[] = [];
    for (const id of raw) {
        if (isScreenGuideId(id) && !out.includes(id)) out.push(id);
    }
    return out;
}
