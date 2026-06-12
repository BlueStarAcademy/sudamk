import {
    emptySlotImages,
    TOURNAMENT_DEFINITIONS,
    SPECIAL_GAME_MODES,
    PLAYFUL_GAME_MODES,
    LEAGUE_DATA,
    AVATAR_POOL,
    BORDER_POOL,
    RANKING_TIERS,
    EQUIPMENT_POOL,
    CONSUMABLE_ITEMS,
    MATERIAL_ITEMS,
} from '../constants.js';
import { ADVENTURE_STAGES } from '../constants/adventureConstants.js';
import { CHAMPIONSHIP_PVP_VENUE_BG_WEBP } from '../constants/tournaments.js';
import { getMainBackgroundUrl } from '../utils/publicAssetUrl.js';
import {
    WHITE_BASE_STONE_IMG,
    BLACK_BASE_STONE_IMG,
    WHITE_HIDDEN_STONE_IMG,
    BLACK_HIDDEN_STONE_IMG,
    STRATEGIC_GO_LOBBY_IMG,
    PLAYFUL_GO_LOBBY_IMG,
    PVP_ARENA_ENTRY_IMG,
    AI_ARENA_ENTRY_IMG,
    TOURNAMENT_LOBBY_IMG,
    SINGLE_PLAYER_LOBBY_IMG,
    TOWER_CHALLENGE_LOBBY_IMG,
    PAIR_GO_LOBBY_IMG,
} from '../assets.js';
import { ItemGrade } from '../types.js';

const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: '/images/equipments/normalbgi.webp',
    uncommon: '/images/equipments/uncommonbgi.webp',
    rare: '/images/equipments/rarebgi.webp',
    epic: '/images/equipments/epicbgi.webp',
    legendary: '/images/equipments/legendarybgi.webp',
    mythic: '/images/equipments/mythicbgi.webp',
    transcendent: '/images/equipments/transcendentbgi.webp',
};

const starImages = [
    '/images/equipments/Star1.webp',
    '/images/equipments/Star2.webp',
    '/images/equipments/Star3.webp',
    '/images/equipments/Star4.webp',
];

const uiImages = [
    '/images/icon/Gold.webp',
    '/images/icon/Zem.webp',
    '/images/quest.webp',
    '/images/gibo.webp',
    '/images/mail.webp',
    '/images/store.webp',
    '/images/bag.webp',
];

const dedupePaths = (paths: readonly (string | null | undefined)[]): string[] =>
    Array.from(new Set(paths.filter((p): p is string => typeof p === 'string' && p.startsWith('/'))));

const normalizeAssetPath = (path: string | null | undefined): string | null => {
    if (typeof path !== 'string' || !path) return null;
    if (path.startsWith('/')) return path;
    if (path.startsWith('images/')) return `/${path}`;
    return null;
};

const dedupeNormalizedPaths = (paths: readonly (string | null | undefined)[]): string[] =>
    Array.from(
        new Set(
            paths
                .map((p) => normalizeAssetPath(p))
                .filter((p): p is string => typeof p === 'string'),
        ),
    );

/** 공통 셸: 메인 배경, 상단/퀵 아이콘, 바둑돌 */
export const ENTRY_BOOT_IMAGE_URLS = dedupePaths([
    getMainBackgroundUrl(),
    ...uiImages,
    WHITE_BASE_STONE_IMG,
    BLACK_BASE_STONE_IMG,
    WHITE_HIDDEN_STONE_IMG,
    BLACK_HIDDEN_STONE_IMG,
]);

const ENTRY_PROFILE_DECORATION_URLS = dedupePaths([
    ...AVATAR_POOL.map((a) => a.url),
    ...BORDER_POOL.map((b) => b.url),
    ...RANKING_TIERS.map((t) => t.icon),
]);

const ENTRY_INVENTORY_ITEM_URLS = dedupeNormalizedPaths([
    ...Object.values(emptySlotImages),
    ...Object.values(gradeBackgrounds),
    ...starImages,
    ...EQUIPMENT_POOL.map((e) => e.image),
    ...CONSUMABLE_ITEMS.map((c) => c.image),
    ...Object.values(MATERIAL_ITEMS).map((m) => m.image),
]);

/** 프로필·가방·상점에 쓰이는 정적 타일 URL 전체(디버그·도구·백그라운드 프리페치용) */
export const ENTRY_PROFILE_ROUTE_IMAGE_URLS = dedupePaths([
    ...ENTRY_BOOT_IMAGE_URLS,
    ...ENTRY_PROFILE_DECORATION_URLS,
    ...ENTRY_INVENTORY_ITEM_URLS,
]);

const ENTRY_ARENA_LOBBY_URLS = dedupePaths([
    ...(TOURNAMENT_DEFINITIONS.neighborhood.image
        ? [TOURNAMENT_DEFINITIONS.neighborhood.image, TOURNAMENT_DEFINITIONS.national.image, TOURNAMENT_DEFINITIONS.world.image]
        : []),
    ...SPECIAL_GAME_MODES.map((m) => m.image),
    ...PLAYFUL_GAME_MODES.map((m) => m.image),
    ...LEAGUE_DATA.map((l) => l.icon),
    STRATEGIC_GO_LOBBY_IMG,
    PLAYFUL_GO_LOBBY_IMG,
    PVP_ARENA_ENTRY_IMG,
    AI_ARENA_ENTRY_IMG,
    CHAMPIONSHIP_PVP_VENUE_BG_WEBP,
    TOURNAMENT_LOBBY_IMG,
    SINGLE_PLAYER_LOBBY_IMG,
    TOWER_CHALLENGE_LOBBY_IMG,
]);

/** 전략/교류 로비, 대기실, 싱글/탑/페어 로비 타일 */
export const ENTRY_ARENA_FLOW_IMAGE_URLS = dedupePaths([...ENTRY_BOOT_IMAGE_URLS, ...ENTRY_ARENA_LOBBY_URLS]);

const adventureImageSet = new Set<string>();
for (const stage of ADVENTURE_STAGES) {
    if (stage.mapWebp && stage.mapWebp.startsWith('/')) {
        adventureImageSet.add(stage.mapWebp);
    }
    for (const monster of stage.monsters) {
        if (monster.imageWebp && monster.imageWebp.startsWith('/')) {
            adventureImageSet.add(monster.imageWebp);
        }
    }
}

export const ADVENTURE_STAGE_IMAGE_URLS = Array.from(adventureImageSet);

export const ENTRY_ADVENTURE_ROUTE_IMAGE_URLS = dedupePaths([...ENTRY_BOOT_IMAGE_URLS, ...ADVENTURE_STAGE_IMAGE_URLS]);

/** 길드 홈·보스·전쟁 첫 화면에서 자주 쓰는 정적 에셋 */
export const ENTRY_GUILD_SURFACE_IMAGE_URLS = dedupePaths([
    '/images/guild/guildbg.webp',
    '/images/guild/tokken.webp',
    '/images/guild/button/guildmission.webp',
    '/images/guild/button/guildlab.webp',
    '/images/guild/guildwar/clearstar.webp',
    '/images/icon/Zem.webp',
]);

export const ENTRY_GUILD_ROUTE_IMAGE_URLS = dedupePaths([...ENTRY_BOOT_IMAGE_URLS, ...ENTRY_GUILD_SURFACE_IMAGE_URLS]);

/** 게임/관리 등 — 인게임 전용 에셋은 판마다 다르므로 셸만 선로드 */
export const ENTRY_MINIMAL_IMAGE_URLS = ENTRY_BOOT_IMAGE_URLS;

const allCatalog = dedupePaths([
    ...ENTRY_PROFILE_ROUTE_IMAGE_URLS,
    ...ENTRY_ARENA_LOBBY_URLS,
    ...ADVENTURE_STAGE_IMAGE_URLS,
    ...ENTRY_GUILD_SURFACE_IMAGE_URLS,
]);

/** 디버그·도구용 전체 목록 */
export const ALL_IMAGE_URLS = allCatalog;

/** @deprecated `ENTRY_PROFILE_ROUTE_IMAGE_URLS` 등으로 분리됨 */
export const LOGIN_PRELOAD_IMAGE_URLS = ENTRY_PROFILE_ROUTE_IMAGE_URLS;

export type PreloadImagesOptions = {
    priority?: 'high' | 'low';
    maxConcurrent?: number;
    isCancelled?: () => boolean;
    /** @deprecated `maxConcurrent` 우선 */
    batchSize?: number;
};

const loadOneImage = (url: string): Promise<Event | string> =>
    new Promise((resolve) => {
        const img = new Image();
        img.onload = resolve;
        img.onerror = (err) => resolve(`Failed to load ${url}: ${String(err)}`);
        img.src = url;
    });

export const preloadImages = (urls: string[], options?: PreloadImagesOptions): Promise<(Event | string)[]> => {
    const priority = options?.priority ?? 'low';
    const defaultConcurrent = priority === 'high' ? 12 : 4;
    const maxConcurrent =
        options?.maxConcurrent ??
        (typeof options?.batchSize === 'number' ? Math.min(options.batchSize, defaultConcurrent) : defaultConcurrent);

    const isCancelled = options?.isCancelled;
    const results: (Event | string)[] = new Array(urls.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
        while (true) {
            if (isCancelled?.()) return;
            const i = cursor++;
            if (i >= urls.length) return;
            results[i] = await loadOneImage(urls[i]);
        }
    };

    const pool = Math.min(Math.max(1, maxConcurrent), Math.max(1, urls.length));
    return Promise.all(Array.from({ length: pool }, () => worker())).then(() => results);
};

const warmedRouteViews = new Set<string>();
let activeCriticalImageLoads = 0;
let secondaryPrefetchDeferTimer: ReturnType<typeof setTimeout> | null = null;

function beginCriticalImageLoad(): void {
    activeCriticalImageLoads += 1;
}

function endCriticalImageLoad(): void {
    activeCriticalImageLoads = Math.max(0, activeCriticalImageLoads - 1);
}

function isBrowserActivelyLoadingVisibleImages(): boolean {
    if (typeof document === 'undefined') return false;
    const images = document.images;
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (!img.complete && img.getAttribute('fetchpriority') === 'high') {
            return true;
        }
    }
    return activeCriticalImageLoads > 0;
}

function scheduleSecondaryPrefetch(run: () => void, deferMs = 1200): void {
    if (secondaryPrefetchDeferTimer != null) {
        clearTimeout(secondaryPrefetchDeferTimer);
    }
    const attempt = () => {
        secondaryPrefetchDeferTimer = null;
        if (isBrowserActivelyLoadingVisibleImages()) {
            secondaryPrefetchDeferTimer = globalThis.setTimeout(attempt, deferMs);
            return;
        }
        run();
    };
    secondaryPrefetchDeferTimer = globalThis.setTimeout(attempt, deferMs);
}

const PROFILE_CRITICAL_URLS = dedupePaths([
    getMainBackgroundUrl(),
    ...uiImages,
    STRATEGIC_GO_LOBBY_IMG,
    PAIR_GO_LOBBY_IMG,
    PLAYFUL_GO_LOBBY_IMG,
    PVP_ARENA_ENTRY_IMG,
    AI_ARENA_ENTRY_IMG,
]);

const ARENA_CRITICAL_URLS = dedupePaths([
    getMainBackgroundUrl(),
    ...uiImages.slice(0, 4),
    STRATEGIC_GO_LOBBY_IMG,
    PLAYFUL_GO_LOBBY_IMG,
    PVP_ARENA_ENTRY_IMG,
    AI_ARENA_ENTRY_IMG,
    TOURNAMENT_LOBBY_IMG,
    SINGLE_PLAYER_LOBBY_IMG,
    TOWER_CHALLENGE_LOBBY_IMG,
]);

const ADVENTURE_CRITICAL_URLS = dedupePaths([
    getMainBackgroundUrl(),
    ...uiImages.slice(0, 4),
    ...ADVENTURE_STAGE_IMAGE_URLS.slice(0, 8),
]);

const GUILD_CRITICAL_URLS = dedupePaths([...ENTRY_BOOT_IMAGE_URLS, ...ENTRY_GUILD_SURFACE_IMAGE_URLS]);

function isConstrainedMobilePrefetchDevice(): boolean {
    if (typeof window === 'undefined') return false;
    const nav = navigator as Navigator & {
        connection?: { saveData?: boolean };
        deviceMemory?: number;
    };
    const shortSide = Math.min(window.innerWidth, window.innerHeight);
    const hasTouch = (nav.maxTouchPoints ?? 0) > 0;
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches === true;
    const saveData = nav.connection?.saveData === true;
    const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
    const smallViewport = shortSide <= 768;
    return saveData || lowMemory || (hasTouch && (smallViewport || coarsePointer));
}

function clampRoutePrefetchUrls(view: string, urls: readonly string[], constrainedMobile: boolean): readonly string[] {
    const desktopLimit = (() => {
        switch (view) {
            case 'profile':
                return 48;
            case 'adventure':
                return 32;
            case 'lobby':
            case 'waiting':
            case 'pair':
            case 'pvp':
            case 'ai':
            case 'arena':
            case 'singleplayer':
            case 'tower':
            case 'tournament':
                return 36;
            case 'guild':
            case 'guildboss':
            case 'guildwar':
                return 24;
            default:
                return 20;
        }
    })();
    const limit = constrainedMobile
        ? (() => {
              switch (view) {
                  case 'profile':
                      return 24;
                  case 'adventure':
                      return 16;
                  case 'lobby':
                  case 'waiting':
                  case 'pair':
                  case 'pvp':
                  case 'ai':
                  case 'arena':
                  case 'singleplayer':
                  case 'tower':
                  case 'tournament':
                      return 20;
                  case 'guild':
                  case 'guildboss':
                  case 'guildwar':
                      return 14;
                  default:
                      return 12;
              }
          })()
        : desktopLimit;
    return urls.slice(0, limit);
}

function resolveRoutePrefetchSets(view: string): { critical: readonly string[]; secondary: readonly string[] } {
    switch (view) {
        case 'profile': {
            const criticalSet = new Set(PROFILE_CRITICAL_URLS);
            return {
                critical: PROFILE_CRITICAL_URLS,
                secondary: ENTRY_PROFILE_ROUTE_IMAGE_URLS.filter((url) => !criticalSet.has(url)),
            };
        }
        case 'lobby':
        case 'waiting':
        case 'pair':
        case 'pvp':
        case 'ai':
        case 'arena':
        case 'singleplayer':
        case 'tower':
        case 'tournament': {
            const criticalSet = new Set(ARENA_CRITICAL_URLS);
            return {
                critical: ARENA_CRITICAL_URLS,
                secondary: ENTRY_ARENA_FLOW_IMAGE_URLS.filter((url) => !criticalSet.has(url)),
            };
        }
        case 'adventure': {
            const criticalSet = new Set(ADVENTURE_CRITICAL_URLS);
            return {
                critical: ADVENTURE_CRITICAL_URLS,
                secondary: ENTRY_ADVENTURE_ROUTE_IMAGE_URLS.filter((url) => !criticalSet.has(url)),
            };
        }
        case 'guild':
        case 'guildboss':
        case 'guildwar': {
            const criticalSet = new Set(GUILD_CRITICAL_URLS);
            return {
                critical: GUILD_CRITICAL_URLS,
                secondary: ENTRY_GUILD_ROUTE_IMAGE_URLS.filter((url) => !criticalSet.has(url)),
            };
        }
        default:
            return { critical: ENTRY_BOOT_IMAGE_URLS, secondary: [] };
    }
}

/**
 * 라우트 전환 직후 UI를 막지 않고, 브라우저 유휴 시에만 해당 화면 관련 이미지를 워밍한다.
 * (진입 게이트로 `preloadImages`를 await 하면 URL이 많은 화면에서 수십 초~수 분 대기가 될 수 있음)
 */
/** 첫 화면 LCP 후보 — 라우트 진입 직후 소량 high-priority로 선로드 */
export function preloadCriticalRouteImages(view: string): void {
    if (typeof window === 'undefined') return;
    const { critical } = resolveRoutePrefetchSets(view);
    if (critical.length === 0) return;
    beginCriticalImageLoad();
    void preloadImages([...critical], {
        priority: 'high',
        maxConcurrent: 3,
    })
        .catch(() => {})
        .finally(() => {
            endCriticalImageLoad();
        });
}

export function scheduleRouteImagePrefetch(view: string): void {
    if (typeof window === 'undefined') return;
    if (warmedRouteViews.has(view)) return;

    const constrainedMobile = isConstrainedMobilePrefetchDevice();
    const { critical, secondary } = resolveRoutePrefetchSets(view);
    const selectedSecondary = clampRoutePrefetchUrls(view, secondary, constrainedMobile);

    const runCritical = () => {
        if (critical.length === 0) return;
        beginCriticalImageLoad();
        void preloadImages([...critical], {
            priority: 'high',
            maxConcurrent: constrainedMobile ? 2 : 3,
        })
            .catch(() => {})
            .finally(() => {
                endCriticalImageLoad();
            });
    };

    const runSecondary = () => {
        warmedRouteViews.add(view);
        if (selectedSecondary.length === 0) return;
        void preloadImages([...selectedSecondary], {
            priority: 'low',
            maxConcurrent: constrainedMobile ? 1 : 2,
        }).catch(() => {});
    };

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(runCritical, { timeout: 1500 });
        scheduleSecondaryPrefetch(() => {
            if (typeof window.requestIdleCallback === 'function') {
                window.requestIdleCallback(runSecondary, { timeout: 12000 });
            } else {
                runSecondary();
            }
        });
    } else {
        globalThis.setTimeout(runCritical, 0);
        scheduleSecondaryPrefetch(runSecondary, 1500);
    }
}
