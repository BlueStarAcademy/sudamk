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
import { getMainBackgroundUrl } from '../utils/publicAssetUrl.js';
import {
    WHITE_BASE_STONE_IMG,
    BLACK_BASE_STONE_IMG,
    WHITE_HIDDEN_STONE_IMG,
    BLACK_HIDDEN_STONE_IMG,
    STRATEGIC_GO_LOBBY_IMG,
    PLAYFUL_GO_LOBBY_IMG,
    TOURNAMENT_LOBBY_IMG,
    SINGLE_PLAYER_LOBBY_IMG,
    TOWER_CHALLENGE_LOBBY_IMG,
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

const ENTRY_INVENTORY_ITEM_URLS = dedupePaths([
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

function clampMobileRoutePrefetchUrls(view: string, urls: readonly string[]): readonly string[] {
    switch (view) {
        case 'profile':
            return urls.slice(0, 36);
        case 'adventure':
            return urls.slice(0, 24);
        case 'lobby':
        case 'waiting':
        case 'pair':
        case 'pvp':
        case 'ai':
        case 'arena':
        case 'singleplayer':
        case 'tower':
        case 'tournament':
            return urls.slice(0, 28);
        case 'guild':
        case 'guildboss':
        case 'guildwar':
            return urls.slice(0, 20);
        default:
            return urls.slice(0, 16);
    }
}

/**
 * 라우트 전환 직후 UI를 막지 않고, 브라우저 유휴 시에만 해당 화면 관련 이미지를 워밍한다.
 * (진입 게이트로 `preloadImages`를 await 하면 URL이 많은 화면에서 수십 초~수 분 대기가 될 수 있음)
 */
export function scheduleRouteImagePrefetch(view: string): void {
    if (typeof window === 'undefined') return;
    if (warmedRouteViews.has(view)) return;

    let urls: readonly string[];
    switch (view) {
        case 'profile':
            urls = ENTRY_PROFILE_ROUTE_IMAGE_URLS;
            break;
        case 'lobby':
        case 'waiting':
        case 'pair':
        case 'pvp':
        case 'ai':
        case 'arena':
        case 'singleplayer':
        case 'tower':
        case 'tournament':
            urls = ENTRY_ARENA_FLOW_IMAGE_URLS;
            break;
        case 'adventure':
            urls = ENTRY_ADVENTURE_ROUTE_IMAGE_URLS;
            break;
        case 'guild':
        case 'guildboss':
        case 'guildwar':
            urls = ENTRY_GUILD_ROUTE_IMAGE_URLS;
            break;
        default:
            urls = ENTRY_BOOT_IMAGE_URLS;
            break;
    }

    const constrainedMobile = isConstrainedMobilePrefetchDevice();
    const selectedUrls = constrainedMobile ? clampMobileRoutePrefetchUrls(view, urls) : urls;

    const run = () => {
        warmedRouteViews.add(view);
        void preloadImages([...selectedUrls], {
            priority: 'low',
            maxConcurrent: constrainedMobile ? 1 : 2,
        }).catch(() => {});
    };

    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(run, { timeout: 8000 });
    } else {
        globalThis.setTimeout(run, 50);
    }
}
