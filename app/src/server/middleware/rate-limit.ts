/**
 * Rate limiting middleware
 * 1000명 동시 사용자 지원을 위한 요청 제한
 */

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

/**
 * Simple in-memory rate limiter
 * 프로덕션에서는 Redis를 사용하는 것이 좋습니다
 */
export function rateLimit(options: {
  windowMs: number; // 시간 윈도우 (밀리초)
  maxRequests: number; // 최대 요청 수
  keyGenerator?: (req: Request) => string; // 키 생성 함수
}): (req: Request) => Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const { windowMs, maxRequests, keyGenerator } = options;

  return async (req: Request) => {
    const key = keyGenerator ? keyGenerator(req) : 'default';
    const now = Date.now();

    // 기존 항목 확인
    const entry = store[key];

    if (!entry || entry.resetAt < now) {
      // 새 윈도우 시작
      store[key] = {
        count: 1,
        resetAt: now + windowMs,
      };
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: now + windowMs,
      };
    }

    // 요청 수 증가
    entry.count++;

    if (entry.count > maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  };
}

/**
 * Cleanup expired entries (주기적으로 실행)
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  Object.keys(store).forEach((key) => {
    if (store[key].resetAt < now) {
      delete store[key];
    }
  });
}

// 5분마다 정리
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
}

