/**
 * Prisma client singleton with optimized connection pooling
 * 1000명 동시 사용자 지원을 위한 연결 풀 최적화
 */

import { PrismaClient } from '@prisma/client';

// Prisma client singleton instance
let prisma: PrismaClient | null = null;

/**
 * Get optimized Prisma client with connection pooling
 * Connection pool size: 최소 20, 최대 50 (1000명 동시 사용자 지원)
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    // DATABASE_URL에서 연결 풀 파라미터 추출
    const databaseUrl = process.env.DATABASE_URL || '';
    
    // 연결 풀 최적화 설정
    // connection_limit: 최대 동시 연결 수 (50)
    // pool_timeout: 연결 풀 타임아웃 (10초)
    // connect_timeout: 연결 타임아웃 (5초)
    const optimizedUrl = databaseUrl.includes('?')
      ? `${databaseUrl}&connection_limit=50&pool_timeout=10&connect_timeout=5`
      : `${databaseUrl}?connection_limit=50&pool_timeout=10&connect_timeout=5`;
    
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
      datasources: {
        db: {
          url: optimizedUrl,
        },
      },
      // 쿼리 타임아웃 설정 (30초)
      // transaction_timeout: 30000,
    });
    
    // Handle connection errors
    prisma.$on('error' as never, (e: any) => {
      console.error('[Prisma] Database error:', e);
    });
    
    // 연결 풀 모니터링
    if (process.env.NODE_ENV === 'development') {
      setInterval(async () => {
        try {
          const result = await prisma?.$queryRaw`SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database()`;
          console.log('[Prisma] Active connections:', result);
        } catch (error) {
          // Ignore monitoring errors
        }
      }, 60000); // 1분마다 체크
    }
  }
  
  return prisma;
}

// Graceful shutdown
export async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

// Auto-disconnect on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await disconnectPrisma();
  });
  
  process.on('SIGTERM', async () => {
    await disconnectPrisma();
  });
  
  process.on('SIGINT', async () => {
    await disconnectPrisma();
  });
}

