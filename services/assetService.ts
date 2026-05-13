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
    normal: '/images/equipments/normalbgi.png',
    uncommon: '/images/equipments/uncommonbgi.png',
    rare: '/images/equipments/rarebgi.png',
    epic: '/images/equipments/epicbgi.png',
    legendary: '/images/equipments/legendarybgi.png',
    mythic: '/images/equipments/mythicbgi.png',
    transcendent: '/images/equipments/transcendentbgi.webp',
};

const starImages = [
    '/images/equipments/Star1.png',
    '/images/equipments/Star2.png',
    '/images/equipments/Star3.png',
    '/images/equipments/Star4.png',
];

const uiImages = [
    '/images/icon/Gold.png',
    '/images/icon/Zem.png',
    '/images/quest.png',
    '/images/gibo.png',
    '/images/mail.png',
    '/images/store.png',
    '/images/bag.png',
];

const dedupePaths = (paths: readonly string[]): string[] =>
    Array.from(new Set(paths.filter((p) => typeof p === 'string' && p.startsWith('/'))));

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

/**
 * 프로필 라우트 게이트: 공통 셸만(배경·퀵 아이콘·바둑돌).
 * 아바타/테두리/티어/장비 풀을 진입 시 선로드하면 URL이 수백 개가 되어 모바일에서 수 분 단위 지연·버벅임을 유발하므로 넣지 않는다.
 * 실제 아바타·장비 썸네일은 화면의 img가 지연 로드한다.
 */
export const ENTRY_PROFILE_ROUTE_GATE_IMAGE_URLS = ENTRY_BOOT_IMAGE_URLS;

/** 프로필·가방·상점에 쓰이는 정적 타일 URL 전체(디버그·도구용; 라우트 게이트에는 사용하지 않음) */
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
    '/images/guild/tokken.png',
    '/images/guild/button/guildmission.png',
    '/images/guild/button/guildlab.png',
    '/images/guild/guildwar/clearstar.png',
    '/images/icon/Diamond.png',
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
