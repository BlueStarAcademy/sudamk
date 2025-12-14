/**
 * Cache utilities
 * 캐싱 유틸리티 - 간단한 인메모리 캐시
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes

  /**
   * Get value from cache
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set value in cache
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Delete value from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Singleton cache instance
const cache = new SimpleCache();

// Clean up expired entries every minute
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cache.clearExpired();
  }, 60 * 1000); // 1 minute
}

/**
 * Cache decorator for async functions
 * Usage: @cached({ ttl: 60000, key: (args) => `user:${args[0]}` })
 */
export function cached(options: {
  ttl?: number;
  key: (...args: any[]) => string;
  invalidateOn?: string[]; // Keys to invalidate when this is called
}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = options.key(...args);
      
      // Try to get from cache
      const cachedValue = cache.get(cacheKey);
      if (cachedValue !== null) {
        return cachedValue;
      }

      // Execute and cache result
      const result = await originalMethod.apply(this, args);
      cache.set(cacheKey, result, options.ttl);

      // Invalidate related caches if specified
      if (options.invalidateOn) {
        options.invalidateOn.forEach((key) => cache.delete(key));
      }

      return result;
    };

    return descriptor;
  };
}

/**
 * Cache helper functions
 */
export const cacheUtils = {
  /**
   * Get from cache
   */
  get: <T>(key: string): T | null => cache.get<T>(key),

  /**
   * Set in cache
   */
  set: <T>(key: string, value: T, ttl?: number): void => cache.set(key, value, ttl),

  /**
   * Delete from cache
   */
  delete: (key: string): void => cache.delete(key),

  /**
   * Clear all cache
   */
  clear: (): void => cache.clear(),

  /**
   * Generate cache key
   */
  key: (...parts: (string | number)[]): string => parts.join(':'),
};

