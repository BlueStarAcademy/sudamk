import { LiveGameSession, User } from '../types/index.js';
import { volatileState } from './state.js';
import * as db from './db.js';

const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
const CACHE_TTL_MS = isRailway ? 300 * 1000 : 30 * 1000;
const USER_CACHE_TTL_MS = isRailway ? 1800 * 1000 : 600 * 1000;

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
        cache.set(gameId, { game, lastUpdated: now });
    } else if (cached) {
        // 게임이 삭제된 경우 캐시에서도 제거
        cache.delete(gameId);
    }

    return game;
}

/**
 * 게임 상태를 캐시에 업데이트
 */
export function updateGameCache(game: LiveGameSession): void {
    const cache = volatileState.gameCache;
    if (cache) {
        cache.set(game.id, { game, lastUpdated: Date.now() });
    }
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
    
    // 캐시에서 만료되지 않은 활성 게임만 반환
    for (const [gameId, cached] of cache.entries()) {
        if (cached && (now - cached.lastUpdated) < CACHE_TTL_MS) {
            const game = cached.game;
            // 활성 게임만 반환 (ended, no_contest 제외)
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

    // 캐시 미스 또는 만료된 경우 DB에서 로드 (equipment/inventory 제외하여 빠르게)
    const user = await db.getUser(userId, { includeEquipment: false, includeInventory: false });
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
                gameCache.delete(gameId);
                gamesCleaned++;
            }
        }
        if (gameCache.size > maxGameCacheSize) {
            const sorted = Array.from(gameCache.entries()).sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
            const toRemove = sorted.slice(0, gameCache.size - maxGameCacheSize);
            for (const [gameId] of toRemove) {
                gameCache.delete(gameId);
                gamesCleaned++;
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
    
    // 게임 캐시를 절반으로 줄임
    const gameCache = volatileState.gameCache;
    if (gameCache && gameCache.size > 0) {
        const targetSize = Math.floor(gameCache.size / 2);
        const sorted = Array.from(gameCache.entries())
            .sort((a, b) => a[1].lastUpdated - b[1].lastUpdated);
        const toRemove = sorted.slice(0, gameCache.size - targetSize);
        for (const [gameId] of toRemove) {
            gameCache.delete(gameId);
            gamesCleaned++;
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

