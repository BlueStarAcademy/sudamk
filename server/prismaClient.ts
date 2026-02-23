import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// .env를 프로젝트 루트에서 명시적으로 로드 (서버 진입점보다 먼저 로드될 수 있음)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

import { PrismaClient } from "../generated/prisma/client.ts";

// DATABASE_URL에 연결 풀링 파라미터 추가 (없는 경우)
const getDatabaseUrl = () => {
  // Railway는 때때로 다른 이름으로 DATABASE_URL을 제공합니다
  let url = process.env.DATABASE_URL || 
            process.env.RAILWAY_SERVICE_POSTGRES_URL || 
            process.env.POSTGRES_URL || 
            process.env.POSTGRES_PRIVATE_URL || 
            '';
  
  // Railway 변수 참조 문법 감지 및 처리
  // Railway는 ${{Service.Variable}} 형식의 참조를 사용하는데, 런타임에 해석되지 않을 수 있음
  if (url && (url.includes('${{') || url.includes('{{'))) {
    console.warn('[Prisma] ⚠️ WARNING: DATABASE_URL contains Railway variable reference syntax!');
    console.warn('[Prisma] Railway variable references like ${{Postgres.DATABASE_URL}} may not be resolved at runtime.');
    console.warn('[Prisma] Please use the actual DATABASE_URL value instead of the reference.');
    console.warn('[Prisma]');
    console.warn('[Prisma] 🔧 How to fix:');
    console.warn('[Prisma] 1. Go to Railway Dashboard → Postgres Service → Variables');
    console.warn('[Prisma] 2. Copy the actual DATABASE_URL value (should start with postgresql://)');
    console.warn('[Prisma] 3. Go to Backend Service → Variables');
    console.warn('[Prisma] 4. Delete the ${{Postgres.DATABASE_URL}} variable');
    console.warn('[Prisma] 5. Railway will automatically provide DATABASE_URL when Postgres is connected');
    console.warn('[Prisma]    OR manually set DATABASE_URL with the copied value');
    console.warn('[Prisma]');
    // Railway 자동 변수 확인 (Railway가 Postgres 연결 시 자동으로 제공)
    const autoUrl = process.env.RAILWAY_SERVICE_POSTGRES_URL || 
                   process.env.POSTGRES_PRIVATE_URL ||
                   process.env.POSTGRES_URL;
    if (autoUrl && (autoUrl.startsWith('postgresql://') || autoUrl.startsWith('postgres://'))) {
      console.log('[Prisma] ✅ Found Railway auto-provided DATABASE_URL, using it instead');
      url = autoUrl;
      process.env.DATABASE_URL = url;
    } else {
      console.error('[Prisma] ❌ Cannot resolve Railway variable reference. Please set DATABASE_URL manually.');
      return url; // 원본 반환하여 Prisma가 명확한 에러 표시
    }
  }
  
  // 찾은 경우 DATABASE_URL로 설정
  if (url && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = url;
  }
  
  if (!url) {
    console.error('[Prisma] DATABASE_URL is not set! Please set DATABASE_URL to Railway PostgreSQL connection string.');
    console.error('[Prisma] Checked variables: DATABASE_URL, RAILWAY_SERVICE_POSTGRES_URL, POSTGRES_URL, POSTGRES_PRIVATE_URL');
    return url;
  }
  
  // 프로토콜이 없는 경우 Railway 자동 변수에서 올바른 URL 찾기 시도
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    console.warn('[Prisma] ⚠️ WARNING: DATABASE_URL is missing protocol!');
    console.warn('[Prisma] Current DATABASE_URL (first 50 chars):', url.substring(0, 50));
    console.warn('[Prisma] Attempting to find correct DATABASE_URL from Railway auto-provided variables...');
    
    // Railway가 자동으로 제공하는 다른 환경 변수들 확인
    const alternativeUrls = [
      process.env.RAILWAY_SERVICE_POSTGRES_URL,
      process.env.POSTGRES_PRIVATE_URL,
      process.env.POSTGRES_URL,
      process.env.PGDATABASE_URL,
      process.env.DATABASE_PRIVATE_URL
    ].filter(Boolean);
    
    // 프로토콜이 있는 올바른 URL 찾기
    const correctUrl = alternativeUrls.find(u => 
      u && (u.startsWith('postgresql://') || u.startsWith('postgres://'))
    );
    
    if (correctUrl) {
      console.log('[Prisma] ✅ Found correct DATABASE_URL in Railway auto-provided variables');
      console.log('[Prisma] Using:', correctUrl.replace(/:[^:@]+@/, ':****@').substring(0, 80));
      url = correctUrl;
      process.env.DATABASE_URL = url;
    } else {
      console.error('[Prisma] ❌ ERROR: Could not find valid DATABASE_URL!');
      console.error('[Prisma] DATABASE_URL must start with "postgresql://" or "postgres://"');
      console.error('[Prisma]');
      console.error('[Prisma] 🔧 How to fix in Railway:');
      console.error('[Prisma] 1. Go to Railway Dashboard → Postgres Service → Variables');
      console.error('[Prisma] 2. Find DATABASE_URL or POSTGRES_URL variable');
      console.error('[Prisma] 3. Copy the FULL URL (must start with postgresql://)');
      console.error('[Prisma] 4. Go to Backend Service → Variables');
      console.error('[Prisma] 5. Set DATABASE_URL to the copied value');
      console.error('[Prisma]');
      console.error('[Prisma] Expected format:');
      console.error('[Prisma]   postgresql://postgres:PASSWORD@HOST:PORT/DATABASE');
      console.error('[Prisma]');
      // 원본 URL 반환 (Prisma가 명확한 에러를 표시하도록)
      return url;
    }
  }
  
  // Supabase URL 감지 및 경고
  if (url.includes('supabase.com') || url.includes('supabase.co')) {
    console.error('[Prisma] ⚠️ WARNING: DATABASE_URL appears to be pointing to Supabase!');
    console.error('[Prisma] ⚠️ This application has been migrated to Railway PostgreSQL.');
    console.error('[Prisma] ⚠️ Please update DATABASE_URL to point to Railway PostgreSQL.');
    console.error('[Prisma] ⚠️ Current URL:', url.replace(/:[^:@]+@/, ':****@'));
    console.error('[Prisma] ⚠️ Railway DATABASE_URL should look like: postgresql://postgres:****@postgres.railway.internal:5432/railway');
  }
  
  // Railway URL 확인 및 내부 네트워크로 변환
  const isRailway = url.includes('railway') || process.env.RAILWAY_ENVIRONMENT;
  if (isRailway && url.includes('.up.railway.app')) {
    // Railway 공개 URL을 내부 네트워크로 자동 변환
    // postgres-production-xxx.up.railway.app:5432 -> postgres.railway.internal:5432
    const urlPattern = /(postgresql:\/\/[^@]+@)([^:]+):(\d+)(\/.*)/;
    const match = url.match(urlPattern);
    if (match) {
      const [, protocol, host, port, path] = match;
      if (host.includes('.up.railway.app')) {
        const newHost = 'postgres.railway.internal';
        url = `${protocol}${newHost}:${port}${path}`;
        console.log('[Prisma] Converted Railway public URL to internal network:', `${protocol}${newHost}:${port}${path}`.replace(/:[^:@]+@/, ':****@'));
      }
    }
  }
  
  if (!isRailway && !url.includes('supabase')) {
    console.warn('[Prisma] DATABASE_URL does not appear to be Railway or Supabase. Make sure this is correct.');
  }
  
  // 이미 연결 풀링 파라미터가 있는지 확인
  if (url.includes('connection_limit') || url.includes('pool_timeout')) {
    return url;
  }
  
  // 연결 풀링 파라미터 추가 (Railway 환경 최적화)
  // Railway Postgres 연결 안정성을 위한 설정
  // connection_limit: Railway의 연결 제한을 고려하여 낮게 설정 (연결 끊김 방지)
  // pool_timeout: 연결 대기 시간
  // connect_timeout: 연결 타임아웃
  // statement_cache_size: 쿼리 캐시 크기
  // pgbouncer_mode: transaction 모드로 설정하여 연결 재사용 최적화
  const separator = url.includes('?') ? '&' : '?';
  // Railway DB 연결 최적화
  // Railway Postgres는 연결 수 제한이 있으므로 보수적으로 설정
  // 연결이 끊어지는 문제를 방지하기 위해 connection_limit을 낮춤
  const connectionLimit = isRailway ? '20' : '50'; // Railway: 20개 (연결 끊김 방지), 로컬: 50개
  const poolTimeout = isRailway ? '30' : '20'; // Railway: 30초, 로컬: 20초
  const connectTimeout = isRailway ? '10' : '5'; // Railway: 10초, 로컬: 5초
  const statementCacheSize = '250'; // 쿼리 캐시 크기
  // Railway 내부 네트워크에서 연결이 끊어지는 것을 방지하기 위한 설정
  return `${url}${separator}connection_limit=${connectionLimit}&pool_timeout=${poolTimeout}&connect_timeout=${connectTimeout}&statement_cache_size=${statementCacheSize}`;
};

const _databaseUrl = getDatabaseUrl();
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: _databaseUrl,
    },
  },
});

// 연결 오류 처리
prisma.$on('error' as never, (e: any) => {
  console.error('[Prisma] Database error:', e);
});

// 연결 끊김 시 재연결 시도
let isReconnecting = false;
let consecutiveConnectionFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;

const reconnectPrisma = async (): Promise<boolean> => {
  if (isReconnecting) return false;
  isReconnecting = true;
  
  try {
    console.log('[Prisma] Attempting to reconnect...');
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      // 연결이 이미 끊어진 경우 무시
    }
    
    await prisma.$connect();
    console.log('[Prisma] Reconnected successfully');
    consecutiveConnectionFailures = 0;
    return true;
  } catch (error: any) {
    consecutiveConnectionFailures++;
    console.error(`[Prisma] Reconnection failed (attempt ${consecutiveConnectionFailures}/${MAX_CONSECUTIVE_FAILURES}):`, error?.message || error);
    
    // 연속 실패가 너무 많으면 경고
    if (consecutiveConnectionFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.error('[Prisma] CRITICAL: Multiple reconnection failures. Database may be unavailable.');
      process.stderr.write(`[CRITICAL] Prisma reconnection failed ${consecutiveConnectionFailures} times\n`);
    }
    
    return false;
  } finally {
    isReconnecting = false;
  }
};

// DATABASE_URL이 있을 때만 주기적으로 연결 상태 확인 (없으면 쿼리 시 Prisma 에러 반복 방지)
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL?.includes('railway');
const connectionCheckInterval = isRailway ? 10000 : 15000; // Railway: 10초, 로컬: 15초

if (_databaseUrl) {
  setInterval(async () => {
    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)) // 3초 타임아웃
      ]);
      // 연결 성공 시 실패 카운터 리셋
      if (consecutiveConnectionFailures > 0) {
        consecutiveConnectionFailures = 0;
      }
    } catch (error: any) {
      // Engine not yet connected: skip (no reconnect), avoids spam before first $connect()
      if (error.message?.includes?.('Engine is not yet connected')) {
        return;
      }
      const isConnectionError =
        error.code === 'P1017' ||
        error.code === 'P1001' ||
        error.message?.includes('closed the connection') ||
        error.message?.includes('timeout') ||
        error.message?.includes("Can't reach database server") ||
        error.kind === 'Closed';

      if (isConnectionError) {
        console.warn('[Prisma] Connection lost or timeout, attempting to reconnect...');
        const reconnected = await reconnectPrisma();
        if (!reconnected && consecutiveConnectionFailures >= MAX_CONSECUTIVE_FAILURES) {
          // 연속 실패가 너무 많으면 프로세스 종료 (Railway가 재시작)
          console.error('[Prisma] CRITICAL: Too many reconnection failures. Exiting for Railway restart.');
          process.stderr.write('[CRITICAL] Database connection lost - exiting for restart\n');
          setTimeout(() => {
            process.exit(1);
          }, 5000);
        }
      }
    }
  }, connectionCheckInterval);
}

// 프로세스 종료 시 정리
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;

