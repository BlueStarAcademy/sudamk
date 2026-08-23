export type QuickUtilityPanelKind =
    | 'quests'
    | 'exchange'
    | 'blacksmith'
    | 'shop'
    | 'inventory'
    | 'pet'
    | 'trainingQuest'
    | 'trainingGround'
    | 'matchArena'
    | 'pairArena'
    /** @deprecated 홈 뷰어는 matchArena로 통합 — 레거시 스택/딥링크 호환 */
    | 'rankedMatch'
    /** @deprecated 홈 뷰어는 matchArena로 통합 — 레거시 스택/딥링크 호환 */
    | 'normalMatch'
    | 'friendlyLobby'
    /** @deprecated 홈 뷰어는 friendlyLobby로 리다이렉트 */
    | 'aiArena'
    | 'playgroundLobby'
    | 'championship'
    | 'singleplayer'
    | 'tower'
    | 'adventure'
    | 'guild'
    | 'detailedStats'
    | 'monsterCodex'
    | 'ranking'
    | 'gameRecords'
    | 'encyclopedia'
    | 'announcements'
    | 'help';

/** 홈 입장 카드 → 중앙 뷰어 (해시 이동 없이 해결) */
export const HOME_VIEWER_UTILITY_KINDS = [
    'matchArena',
    'pairArena',
    'friendlyLobby',
    'playgroundLobby',
    'championship',
    'trainingQuest',
    'trainingGround',
    'singleplayer',
    'tower',
    'adventure',
    'guild',
] as const satisfies readonly QuickUtilityPanelKind[];

export type HomeViewerUtilityKind = (typeof HOME_VIEWER_UTILITY_KINDS)[number];

export const QUICK_UTILITY_PANEL_TITLES: Record<QuickUtilityPanelKind, string> = {
    quests: '퀘스트',
    exchange: '거래소',
    blacksmith: '대장간',
    shop: '상점',
    inventory: '가방',
    pet: '펫',
    trainingQuest: '생산소',
    trainingGround: '훈련장',
    matchArena: '경기장',
    pairArena: '페어 경기장',
    rankedMatch: '랭킹전',
    normalMatch: '일반전',
    friendlyLobby: '친선전',
    aiArena: 'AI 대전',
    playgroundLobby: '놀이터',
    championship: '챔피언십',
    singleplayer: '모험',
    tower: '도전의 탑',
    adventure: '탐험',
    guild: '길드',
    detailedStats: 'PVP 경기장 상세 전적',
    monsterCodex: '몬스터 도감',
    ranking: '랭킹',
    gameRecords: '기보',
    encyclopedia: '도감',
    announcements: '공지',
    help: '도움말',
};

export type QuickUtilityPanelChrome = {
    iconUrl?: string;
    iconEmoji?: string;
    /** NavTitleBar border/background */
    titleChromeClass: string;
    /** NavTitleBar 제목 그라데이션 */
    titleHeadingClass: string;
    /** 본문 상단 액센트 라인 via-color */
    hairlineViaClass: string;
    /** 본문 inset 패널 ring */
    bodyRingClass: string;
};

const MATCH_ARENA_CHROME: QuickUtilityPanelChrome = {
    titleChromeClass: 'border-amber-400/50 bg-gradient-to-r from-amber-950/55 via-zinc-900/80 to-yellow-950/45',
    titleHeadingClass:
        'bg-gradient-to-r from-amber-50 via-yellow-100 to-amber-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
    hairlineViaClass: 'via-amber-300/42',
    bodyRingClass: 'ring-amber-400/22',
};

export const QUICK_UTILITY_PANEL_CHROME: Record<QuickUtilityPanelKind, QuickUtilityPanelChrome> = {
    quests: {
        iconUrl: '/images/quickmenu/quest.webp',
        titleChromeClass: 'border-amber-400/50 bg-gradient-to-r from-amber-950/55 via-zinc-900/80 to-amber-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-amber-50 via-amber-100 to-yellow-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-amber-300/45',
        bodyRingClass: 'ring-amber-400/20',
    },
    exchange: {
        iconUrl: '/images/quickmenu/trade.webp',
        titleChromeClass: 'border-cyan-400/45 bg-gradient-to-r from-cyan-950/50 via-zinc-900/80 to-slate-950/55',
        titleHeadingClass:
            'bg-gradient-to-r from-cyan-50 via-sky-100 to-cyan-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-cyan-300/40',
        bodyRingClass: 'ring-cyan-400/22',
    },
    blacksmith: {
        iconUrl: '/images/quickmenu/enhance.webp',
        titleChromeClass: 'border-orange-400/45 bg-gradient-to-r from-orange-950/50 via-zinc-900/80 to-amber-950/40',
        titleHeadingClass:
            'bg-gradient-to-r from-orange-50 via-amber-100 to-orange-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-orange-300/38',
        bodyRingClass: 'ring-orange-400/20',
    },
    shop: {
        iconUrl: '/images/quickmenu/store.webp',
        titleChromeClass: 'border-sky-400/45 bg-gradient-to-r from-sky-950/50 via-zinc-900/80 to-indigo-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-sky-50 via-blue-100 to-indigo-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-sky-300/38',
        bodyRingClass: 'ring-sky-400/20',
    },
    inventory: {
        iconUrl: '/images/quickmenu/bag.webp',
        titleChromeClass: 'border-emerald-400/45 bg-gradient-to-r from-emerald-950/45 via-zinc-900/80 to-teal-950/40',
        titleHeadingClass:
            'bg-gradient-to-r from-emerald-50 via-teal-100 to-emerald-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-emerald-300/38',
        bodyRingClass: 'ring-emerald-400/20',
    },
    pet: {
        iconUrl: '/images/quickmenu/pet.webp',
        titleChromeClass: 'border-violet-400/50 bg-gradient-to-r from-violet-950/55 via-zinc-900/80 to-fuchsia-950/40',
        titleHeadingClass:
            'bg-gradient-to-r from-violet-50 via-fuchsia-100 to-violet-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-violet-300/42',
        bodyRingClass: 'ring-violet-400/24',
    },
    trainingQuest: {
        titleChromeClass: 'border-emerald-400/50 bg-gradient-to-r from-emerald-950/55 via-zinc-900/80 to-teal-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-emerald-50 via-teal-100 to-emerald-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-emerald-300/42',
        bodyRingClass: 'ring-emerald-400/22',
    },
    trainingGround: {
        iconUrl: '/images/bg/trainingground.webp',
        titleChromeClass: 'border-amber-400/55 bg-gradient-to-r from-amber-950/60 via-zinc-900/80 to-yellow-950/50',
        titleHeadingClass:
            'bg-gradient-to-r from-amber-50 via-yellow-100 to-amber-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-amber-300/45',
        bodyRingClass: 'ring-amber-400/25',
    },
    matchArena: MATCH_ARENA_CHROME,
    pairArena: {
        titleChromeClass: 'border-violet-400/50 bg-gradient-to-r from-violet-950/55 via-zinc-900/80 to-fuchsia-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-violet-50 via-fuchsia-100 to-violet-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-violet-300/42',
        bodyRingClass: 'ring-violet-400/22',
    },
    rankedMatch: MATCH_ARENA_CHROME,
    normalMatch: {
        titleChromeClass: 'border-sky-400/50 bg-gradient-to-r from-sky-950/55 via-zinc-900/80 to-cyan-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-sky-50 via-cyan-100 to-sky-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-sky-300/42',
        bodyRingClass: 'ring-sky-400/22',
    },
    friendlyLobby: {
        titleChromeClass: 'border-violet-400/50 bg-gradient-to-r from-violet-950/55 via-zinc-900/80 to-fuchsia-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-violet-50 via-fuchsia-100 to-violet-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-violet-300/42',
        bodyRingClass: 'ring-violet-400/22',
    },
    aiArena: {
        titleChromeClass: 'border-cyan-400/50 bg-gradient-to-r from-cyan-950/55 via-zinc-900/80 to-teal-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-cyan-50 via-teal-100 to-cyan-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-cyan-300/42',
        bodyRingClass: 'ring-cyan-400/22',
    },
    playgroundLobby: {
        titleChromeClass: 'border-rose-400/50 bg-gradient-to-r from-rose-950/55 via-zinc-900/80 to-orange-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-rose-50 via-orange-100 to-rose-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-rose-300/42',
        bodyRingClass: 'ring-rose-400/22',
    },
    championship: {
        titleChromeClass: 'border-amber-400/55 bg-gradient-to-r from-amber-950/60 via-zinc-900/80 to-yellow-950/50',
        titleHeadingClass:
            'bg-gradient-to-r from-amber-50 via-yellow-100 to-amber-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-amber-300/45',
        bodyRingClass: 'ring-amber-400/25',
    },
    singleplayer: {
        titleChromeClass: 'border-emerald-400/50 bg-gradient-to-r from-emerald-950/55 via-zinc-900/80 to-teal-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-emerald-50 via-teal-100 to-emerald-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-emerald-300/42',
        bodyRingClass: 'ring-emerald-400/22',
    },
    tower: {
        titleChromeClass: 'border-amber-400/55 bg-gradient-to-r from-amber-950/60 via-zinc-900/80 to-orange-950/50',
        titleHeadingClass:
            'bg-gradient-to-r from-amber-50 via-yellow-100 to-orange-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-amber-300/45',
        bodyRingClass: 'ring-amber-400/25',
    },
    adventure: {
        titleChromeClass: 'border-fuchsia-400/50 bg-gradient-to-r from-fuchsia-950/55 via-zinc-900/80 to-violet-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-fuchsia-50 via-violet-100 to-cyan-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-fuchsia-300/42',
        bodyRingClass: 'ring-fuchsia-400/22',
    },
    guild: {
        iconUrl: '/images/button/guild.webp',
        titleChromeClass: 'border-stone-400/50 bg-gradient-to-r from-stone-950/60 via-zinc-900/80 to-amber-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-stone-50 via-amber-100 to-stone-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-amber-300/40',
        bodyRingClass: 'ring-amber-400/22',
    },
    detailedStats: {
        titleChromeClass: 'border-fuchsia-400/50 bg-gradient-to-r from-fuchsia-950/55 via-zinc-900/80 to-violet-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-fuchsia-50 via-violet-100 to-fuchsia-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-fuchsia-300/40',
        bodyRingClass: 'ring-fuchsia-400/22',
    },
    monsterCodex: {
        titleChromeClass: 'border-violet-400/50 bg-gradient-to-r from-violet-950/55 via-zinc-900/80 to-purple-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-violet-50 via-purple-100 to-fuchsia-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-violet-300/40',
        bodyRingClass: 'ring-violet-400/22',
    },
    ranking: {
        iconUrl: '/images/quickmenu/ranking.webp',
        titleChromeClass: 'border-amber-400/50 bg-gradient-to-r from-amber-950/55 via-zinc-900/80 to-yellow-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-amber-50 via-yellow-100 to-amber-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-amber-300/42',
        bodyRingClass: 'ring-amber-400/22',
    },
    gameRecords: {
        iconUrl: '/images/quickmenu/gibo.webp',
        titleChromeClass: 'border-orange-400/45 bg-gradient-to-r from-orange-950/50 via-zinc-900/80 to-amber-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-orange-50 via-amber-100 to-orange-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-orange-300/38',
        bodyRingClass: 'ring-orange-400/20',
    },
    encyclopedia: {
        iconUrl: '/images/quickmenu/encyclopedia.webp',
        titleChromeClass: 'border-teal-400/45 bg-gradient-to-r from-teal-950/50 via-zinc-900/80 to-emerald-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-teal-50 via-emerald-100 to-teal-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-teal-300/38',
        bodyRingClass: 'ring-teal-400/20',
    },
    announcements: {
        iconUrl: '/images/quickmenu/news.webp',
        titleChromeClass: 'border-rose-400/45 bg-gradient-to-r from-rose-950/50 via-zinc-900/80 to-amber-950/40',
        titleHeadingClass:
            'bg-gradient-to-r from-rose-50 via-amber-100 to-rose-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-rose-300/38',
        bodyRingClass: 'ring-rose-400/20',
    },
    help: {
        iconUrl: '/images/button/help.webp',
        titleChromeClass: 'border-sky-400/45 bg-gradient-to-r from-sky-950/50 via-zinc-900/80 to-indigo-950/45',
        titleHeadingClass:
            'bg-gradient-to-r from-sky-50 via-blue-100 to-indigo-200/90 bg-clip-text text-base font-black tracking-tight text-transparent sm:text-lg',
        hairlineViaClass: 'via-sky-300/38',
        bodyRingClass: 'ring-sky-400/20',
    },
};

/** 레거시 퀵유틸 kind → 현재 홈 뷰어 kind */
export function resolveHomeViewerUtilityKind(kind: QuickUtilityPanelKind): QuickUtilityPanelKind {
    if (kind === 'rankedMatch' || kind === 'normalMatch') return 'matchArena';
    if (kind === 'aiArena') return 'friendlyLobby';
    return kind;
}
