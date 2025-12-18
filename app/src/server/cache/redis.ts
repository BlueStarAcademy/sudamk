/**
 * Redis cache client (optional)
 * 캐싱이 필요한 경우 사용
 * Railway에서 Redis 서비스를 추가하면 활성화
 */

const REDIS_URL = process.env.REDIS_URL;

let redisClient: any = null;

/**
 * Initialize Redis client (if available)
 */
export async function initRedis(): Promise<void> {
  if (!REDIS_URL) {
    console.log('[Cache] Redis not configured, skipping cache initialization');
    return;
  }

  try {
    // Dynamic import to avoid errors if redis is not installed
    // @ts-expect-error - redis is optional dependency
    const { createClient } = await import('redis');
    redisClient = createClient({ url: REDIS_URL });
    
    redisClient.on('error', (err: Error) => {
      console.error('[Cache] Redis error:', err);
    });

    await redisClient.connect();
    console.log('[Cache] Redis connected successfully');
  } catch (error) {
    console.warn('[Cache] Redis initialization failed:', error);
    redisClient = null;
  }
}

/**
 * Get cached value
 */
export async function getCache<T>(key: string): Promise<T | null> {
  if (!redisClient) return null;

  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('[Cache] Get error:', error);
    return null;
  }
}

/**
 * Set cached value with TTL (time to live in seconds)
 */
export async function setCache(key: string, value: any, ttl: number = 300): Promise<void> {
  if (!redisClient) return;

  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error('[Cache] Set error:', error);
  }
}

/**
 * Delete cached value
 */
export async function deleteCache(key: string): Promise<void> {
  if (!redisClient) return;

  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('[Cache] Delete error:', error);
  }
}

/**
 * Delete cache by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<void> {
  if (!redisClient) return;

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error('[Cache] Delete pattern error:', error);
  }
}

/**
 * Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

