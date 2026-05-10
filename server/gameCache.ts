import { LiveGameSession, User } from '../types/index.js';
import { volatileState } from './state.js';
import * as db from './db.js';
import { isPairClassicGame } from '../shared/utils/pairGameTurn.js';

function countPlacedMovesInHistory(h: LiveGameSession['moveHistory'] | undefined): number {
    if (!Array.isArray(h)) return 0;
    let n = 0;
    for (const m of h as { x?: number; y?: number }[]) {
        if (!m || typeof m.x !== 'number' || typeof m.y !== 'number') continue;
        if (m.x < 0 || m.y < 0) continue;
        n++;
    }
    return n;
}

function isServerBaseClientPrePlayStatus(st: string | undefined): boolean {
    return (
        st === 'base_placement' ||
        st === 'base_stone_color_choice' ||
        st === 'base_same_color_points_bid' ||
        st === 'base_game_start_confirmation'
    );
}

function isPastBaseClientFlowGameStatus(st: string | undefined): boolean {
    if (!st) return false;
    if (st === 'pending') return false;
    return !isServerBaseClientPrePlayStatus(st);
}

/**
 * PVE·메인루프 캐시 병합: 수순·본대국 진행·serverRevision으로 더 앞선 세션을 고른다.
 * DB 저장 지연으로 `base_placement`가 남아 본대국 `playing`을 덮으면 흑백 좌석·AI 턴이 깨진다.
 */
export function compareLiveSessionProgressForPveMerge(a: LiveGameSession, b: LiveGameSession): number {
    const ma = countPlacedMovesInHistory(a.moveHistory);
    const mb = countPlacedMovesInHistory(b.moveHistory);
    if (ma !== mb) return ma - mb;
    const aPast = isPastBaseClientFlowGameStatus(a.gameStatus);
    const bPast = isPastBaseClientFlowGameStatus(b.gameStatus);
    if (aPast !== bPast) return aPast ? 1 : -1;
    const ra = a.serverRevision ?? 0;
    const rb = b.serverRevision ?? 0;
    if (ra !== rb) return ra - rb;
    return 0;
}

/** `snap`은 메인루프 스냅샷, `candidate`는 캐시/DB — 앞선 쪽을 반환 */
export function pickFresherLiveSessionForPveCache(
    snap: LiveGameSession,
    candidate: LiveGameSession | null,
): LiveGameSession {
    if (!candidate) return snap;
    const c = compareLiveSessionProgressForPveMerge(snap, candidate);
    if (c > 0) return snap;
    return candidate;
}

const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
const CACHE_TTL_MS = isRailway ? 300 * 1000 : 30 * 1000;
const USER_CACHE_TTL_MS = isRailway ? 1800 * 1000 : 600 * 1000;

/** 싱글/탑 PVE는 오랫동안 터치가 없어도 캐시에 유지 (모달 대기·모바일 백그라운드·WS 끊김). 초과 시에만 정리 */
const PVE_CACHE_ABSOLUTE_MAX_AGE_MS = 72 * 60 * 60 * 1000;

/**
 * 인간 대국 사전 단계(페어 순서 확인·색/니기리 확인 등): getAllCachedGames가 TTL 밖 게임을 제외해
 * 메인 루프가 캐시를 못 만지는 동안에도 HTTP(CONFIRM_COLOR_START)가 살아야 하므로 PVE와 같이 캐시에서 보호한다.
 */
function isPvpPreStartModalGame(game: LiveGameSession | undefined): boolean {
    if (!game) return false;
    const st = game.gameStatus;
    if (st === 'ended' || st === 'no_contest') return false;
    if (game.isSinglePlayer || game.gameCategory === 'tower' || game.gameCategory === 'singleplayer' || game.gameCategory === 'adventure') {
        return false;
    }
    if (st === 'pair_order_reveal' && isPairClassicGame(game.settings, game.mode)) return true;
    if (st === 'color_start_confirmation' || st === 'nigiri_reveal') return true;
    return false;
}

function isProtectedPvpPreStartFromEviction(cached: { game: LiveGameSession; lastUpdated: number }, now: number): boolean {
    if (!isPvpPreStartModalGame(cached.game)) return false;
    if (now - cached.lastUpdated > PVE_CACHE_ABSOLUTE_MAX_AGE_MS) return false;
    return true;
}

function isActivePveCachedGame(gameId: string, game: LiveGameSession | null | undefined): boolean {
    if (!game) return false;
    const isPveId = gameId.startsWith('sp-game-') || gameId.startsWith('tower-game-');
    const isPveCategory =
        game.isSinglePlayer === true ||
        game.gameCategory === 'tower' ||
        game.gameCategory === 'singleplayer' ||
        game.gameCategory === 'adventure';
    const isActive = game.gameStatus !== 'ended' && game.gameStatus !== 'no_contest';
    return (isPveId || isPveCategory) && isActive;
}

function isProtectedPveFromEviction(gameId: string, cached: { game: LiveGameSession; lastUpdated: number }, now: number): boolean {
    if (!isActivePveCachedGame(gameId, cached.game)) return false;
    if (now - cached.lastUpdated > PVE_CACHE_ABSOLUTE_MAX_AGE_MS) return false;
    return true;
}

// 1000명 규모: 접속자 수 기반 캐시 상한 (메모리 폭증 방지)
function getMaxUserCacheSize(): number {
    const connCount = Object.keys(volatileState.userConnections ?? {}).length;
    if (isRailway) return Math.min(2500, 600 + connCount * 2);
    return Math.min(2000, 500 + connCount * 2);
}
function getMaxGameCacheSize(): number {
    const connCount = Object.keys(volatileState.userConnections ?? {}).length;
    if (isRailway) return Math.min(200, 80 + Math.floor(connCount / 10));
    return Math.min(500, 100 + Math.floor(connCount / 5));
}

/**
 * 게임 상태를 캐시에서 가져오거나 DB에서 로드
 */
export async function getCachedGame(gameId: string): Promise<LiveGameSession | null> {
    const cache = volatileState.gameCache;
    if (!cache) {
        return await db.getLiveGame(gameId);
    }

    const cached = cache.get(gameId);
    const now = Date.now();

    if (cached && (now - cached.lastUpdated) < CACHE_TTL_MS) {
        return cached.game;
    }

    // 캐시 미스 또는 만료된 경우 DB에서 로드
    const game = await db.getLiveGame(gameId);
    if (game) {
        // 도전의 탑: CONFIRM이 캐시에서만 'playing'으로 바꾸고 DB 저장은 비동기이므로, 캐시에 이미 'playing'이 있으면 DB의 'pending'으로 덮어쓰지 않음
        const isTowerOrSp = gameId.startsWith('sp-game-') || gameId.startsWith('tower-');
        if (isTowerOrSp && cached?.game && (cached.game as any).gameStatus === 'playing' && (game as any).gameStatus === 'pending') {
            cache.set(gameId, { game: cached.game, lastUpdated: now });
            return cached.game;
        }
        // 페어: 순서 확인 후 캐시는 playing인데 DB가 아직 pair_order_reveal(저장 지연·메인루프 배치)이면 덮어쓰지 않음
        const pairRevealStale =
            cached?.game &&
            isPairClassicGame(game.settings, game.mode) &&
            Boolean(game.settings?.pairGame?.turnOrder?.length) &&
            cached.game.gameStatus === 'playing' &&
            game.gameStatus === 'pair_order_reveal';
        if (pairRevealStale) {
            cache.set(gameId, { game: cached.game, lastUpdated: now });
            return cached.game;
        }
        // 만료 직전 캐시(본대국)가 DB(아직 베이스 사전 등)보다 앞선 경우 — DB로 덮어 캐시·진영이 사라지는 것 방지
        if (cached?.game && compareLiveSessionProgressForPveMerge(cached.game, game) > 0) {
            cache.set(gameId, { game: cached.game, lastUpdated: now });
            return cached.game;
        }
        cache.set(gameId, { game, lastUpdated: now });
        return game;
    }
    // PVE(싱글/탑)·모험: pending 모달·DB 지연 시에도 만료 후 캐시 유지 (CONFIRM_AI_GAME_START 등)
    if (
        cached &&
        (gameId.startsWith('sp-game-') ||
            gameId.startsWith('tower-') ||
            cached.game?.gameCategory === 'adventure')
    ) {
        cache.set(gameId, { game: cached.game, lastUpdated: now });
        return cached.game;
    }
    // DB 일시 실패·조회 null이어도 사전 확인 모달 단계의 PVP 세션은 캐시를 지우지 않음 (페어 순서 확인 후 늦게 눌러도 400 방지)
    if (cached && isPvpPreStartModalGame(cached.game)) {
        cache.set(gameId, { game: cached.game, lastUpdated: now });
        return cached.game;
    }
    if (cached) {
        cache.delete(gameId);
    }
    return null;
}

/**
 * 게임 상태를 캐시에 업데이트
 */
export function updateGameCache(game: LiveGameSession): void {
    const cache = volatileState.gameCache;
    if (!cache) return;
    const prev = cache.get(game.id);
    if (
        prev?.game &&
        isPairClassicGame(game.settings, game.mode) &&
        Boolean(game.settings?.pairGame?.turnOrder?.length) &&
        prev.game.gameStatus === 'playing' &&
        game.gameStatus === 'pair_order_reveal'
    ) {
        return;
    }
    const isPve =
        game.isSinglePlayer === true ||
        game.gameCategory === 'tower' ||
        game.gameCategory === 'singleplayer' ||
        game.gameCategory === 'adventure';
    if (isPve && prev?.game && compareLiveSessionProgressForPveMerge(prev.game, game) > 0) {
        return;
    }
    cache.set(game.id, { game, lastUpdated: Date.now() });
}

/**
 * 게임을 캐시에서 제거
 */
export function removeGameFromCache(gameId: string): void {
    const cache = volatileState.gameCache;
    if (cache) {
        cache.delete(gameId);
    }
}

/**
 * 캐시에서 모든 활성 게임 가져오기 (MainLoop 최적화용)
 */
export function getAllCachedGames(): LiveGameSession[] {
    const cache = volatileState.gameCache;
    if (!cache) {
        return [];
    }
    
    const now = Date.now();
    const games: LiveGameSession[] = [];
    
    // 캐시에서 만료되지 않은 활성 게임 + TTL 밖이어도 PVP 사전 확인 모달 단계는 메인 루프에 포함 (저장·타임아웃 처리)
    for (const [gameId, cached] of cache.entries()) {
        if (!cached?.game) continue;
        const ttlFresh = now - cached.lastUpdated < CACHE_TTL_MS;
        const stalePreStart = !ttlFresh && isPvpPreStartModalGame(cached.game);
        if (ttlFresh || stalePreStart) {
            const game = cached.game;
            if (game && game.gameStatus !== 'ended' && game.gameStatus !== 'no_contest') {
                games.push(game);
            }
        }
    }
    
    return games;
}

/**
 * 사용자 정보를 캐시에서 가져오거나 DB에서 로드
 */
export async function getCachedUser(userId: string): Promise<User | null> {
    const cache = volatileState.userCache;
    if (!cache) {
        return await db.getUser(userId);
    }

    const cached = cache.get(userId);
    const now = Date.now();

    if (cached && (now - cached.lastUpdated) < USER_CACHE_TTL_MS) {
        return cached.user;
    }

    // 캐시 미스: 인벤토리·장비 포함 — calculateUserEffects(행동력 최대/회복 간격)가 클라이언트와 일치해야 함.
    // 제외 시 장비 특수옵션(행동력 최대 등)이 빠져 current가 max보다 크다고 잘못 클램프되거나 부족 판정이 난다.
    const user = await db.getUser(userId, { includeEquipment: true, includeInventory: true });
    if (user) {
        cache.set(userId, { user, lastUpdated: now });
    } else if (cached) {
        // 사용자가 삭제된 경우 캐시에서도 제거
        cache.delete(userId);
    }

    return user;
}

/**
 * 사용자 정보를 캐시에 업데이트
 */
export function updateUserCache(user: User): void {
    const cache = volatileState.userCache;
    if (cache) {
        cache.set(user.id, { user, lastUpdated: Date.now() });
    }
}

/**
 * 사용자를 캐시에서 제거
 */
export function removeUserFromCache(userId: string): void {
    const cache = volatileState.userCache;
    if (cache) {
        cache.delete(userId);
    }
}

/**
 * 만료된 캐시 항목 정리 (메모리 누수 방지 강화)
 */
export function cleanupExpiredCache(): void {
    const now = Date.now();
    let gamesCleaned = 0;
    let usersCleaned = 0;
    
    const maxGameCacheSize = getMaxGameCacheSize();
    const maxUserCacheSize = getMaxUserCacheSize();

    const gameCache = volatileState.gameCache;
    if (gameCache) {
        for (const [gameId, cached] of gameCache.entries()) {
            if (now - cached.lastUpdated > CACHE_TTL_MS * 2) {
                // 싱글/탑 등 PVE는 WS·userStatuses와 무관하게 보호 (제거 시 DB 없으면 CONFIRM 등 400)
                if (isProtectedPveFromEviction(gameId, cached, now) || isProtectedPvpPreStartFromEviction(cached, now)) {
                    gameCache.set(gameId, { game: cached.game, lastUpdated: now });
                    continue;
                }
                gameCache.delete(gameId);
                gamesCleaned++;
            }
        }
        if (gameCache.size > maxGameCacheSize) {
            const sorted = Array.from(gameCache.entries()).sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
            let over = gameCache.size - maxGameCacheSize;
            for (const [gameId, cached] of sorted) {
                if (over <= 0) break;
                if (isProtectedPveFromEviction(gameId, cached, now) || isProtectedPvpPreStartFromEviction(cached, now)) {
                    continue;
                }
                gameCache.delete(gameId);
                gamesCleaned++;
                over--;
            }
            if (gameCache.size > maxGameCacheSize) {
                const stillSorted = Array.from(gameCache.entries()).sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
                let over2 = gameCache.size - maxGameCacheSize;
                for (const [gameId, cached] of stillSorted) {
                    if (over2 <= 0) break;
                    if (isProtectedPveFromEviction(gameId, cached, now) || isProtectedPvpPreStartFromEviction(cached, now)) continue;
                    gameCache.delete(gameId);
                    gamesCleaned++;
                    over2--;
                }
            }
        }
    }

    const userCache = volatileState.userCache;
    if (userCache) {
        for (const [userId, cached] of userCache.entries()) {
            if (now - cached.lastUpdated > USER_CACHE_TTL_MS * 2) {
                userCache.delete(userId);
                usersCleaned++;
            }
        }
        if (userCache.size > maxUserCacheSize) {
            const sorted = Array.from(userCache.entries()).sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
            const toRemove = sorted.slice(0, userCache.size - maxUserCacheSize);
            for (const [userId] of toRemove) {
                userCache.delete(userId);
                usersCleaned++;
            }
        }
    }
    
    if (gamesCleaned > 0 || usersCleaned > 0) {
        console.log(`[Cache] Cleaned up ${gamesCleaned} games, ${usersCleaned} users from cache`);
    }
}

/**
 * 모든 캐시를 강제로 정리 (메모리 부족 시 사용)
 */
export function clearAllCache(): void {
    const gameCache = volatileState.gameCache;
    const userCache = volatileState.userCache;
    
    let gamesCleared = 0;
    let usersCleared = 0;
    
    if (gameCache) {
        gamesCleared = gameCache.size;
        gameCache.clear();
    }
    
    if (userCache) {
        usersCleared = userCache.size;
        userCache.clear();
    }
    
    if (gamesCleared > 0 || usersCleared > 0) {
        console.log(`[Cache] Cleared all cache: ${gamesCleared} games, ${usersCleared} users`);
    }
}

/**
 * 적극적인 캐시 정리 (메모리 사용량이 높을 때 사용)
 * 캐시 크기를 절반으로 줄임
 */
export function aggressiveCacheCleanup(): void {
    const now = Date.now();
    let gamesCleaned = 0;
    let usersCleaned = 0;
    
    const gameCache = volatileState.gameCache;
    if (gameCache && gameCache.size > 0) {
        const targetSize = Math.floor(gameCache.size / 2);
        const sorted = Array.from(gameCache.entries()).sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
        let needRemove = gameCache.size - targetSize;
        for (const [gameId, cached] of sorted) {
            if (needRemove <= 0) break;
            if (isProtectedPveFromEviction(gameId, cached, now) || isProtectedPvpPreStartFromEviction(cached, now)) continue;
            gameCache.delete(gameId);
            gamesCleaned++;
            needRemove--;
        }
    }
    
    // 사용자 캐시를 절반으로 줄임
    const userCache = volatileState.userCache;
    if (userCache && userCache.size > 0) {
        const targetSize = Math.floor(userCache.size / 2);
        const sorted = Array.from(userCache.entries())
            .sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
        const toRemove = sorted.slice(0, userCache.size - targetSize);
        for (const [userId] of toRemove) {
            userCache.delete(userId);
            usersCleaned++;
        }
    }
    
    if (gamesCleaned > 0 || usersCleaned > 0) {
        console.log(`[Cache] Aggressive cleanup: removed ${gamesCleaned} games, ${usersCleaned} users from cache`);
    }
}

