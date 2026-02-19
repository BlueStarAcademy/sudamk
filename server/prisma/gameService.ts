import prisma from "../prismaClient.js";
import type { LiveGameSession, GameStatus } from "../../types/index.js";

const ENDED_STATUSES: GameStatus[] = ["ended", "no_contest"];

const isRailwayOrProd = !!(process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL?.includes('railway') || process.env.DATABASE_URL?.includes('rlwy'));
const DB_QUERY_TIMEOUT_MS = isRailwayOrProd ? 18000 : 5000;
// 청크 단위 타임아웃: 한 번에 많은 row를 조회하지 않고 소량씩 나눠 조회해 단일 쿼리 타임아웃 방지
const CHUNK_TIMEOUT_MS = isRailwayOrProd ? 7000 : 4000;
const CHUNK_SIZE = isRailwayOrProd ? 10 : 20;

const mapRowToGame = (row: { id: string; data: unknown; status: string; category: string | null }): LiveGameSession | null => {
  if (!row || !row.data) return null;
  try {
    // 최적화: data가 이미 객체인 경우 JSON.parse/stringify 스킵
    let game: LiveGameSession;
    if (typeof row.data === 'string') {
      game = JSON.parse(row.data) as LiveGameSession;
    } else if (typeof row.data === 'object' && row.data !== null) {
      // 이미 객체인 경우 깊은 복사 대신 얕은 복사 사용 (성능 향상)
      game = { ...row.data } as LiveGameSession;
    } else {
      return null;
    }
    
    if (!game) return null;
    game.id = row.id;
    if (!game.gameStatus) {
      game.gameStatus = row.status as GameStatus;
    }
    if (!game.gameCategory && row.category) {
      game.gameCategory = row.category as any;
    }
    return game;
  } catch (error) {
    console.warn(`[gameService] Failed to parse game ${row.id}:`, error);
    return null;
  }
};

const deriveMeta = (game: LiveGameSession) => {
  const status: GameStatus = (game.gameStatus as GameStatus) ?? "pending";
  const category =
    game.gameCategory ??
    (game.isSinglePlayer ? "singleplayer" : game.gameCategory ?? "normal");
  const isEnded = ENDED_STATUSES.includes(status);
  return { status, category, isEnded };
};

export async function getLiveGame(id: string): Promise<LiveGameSession | null> {
  try {
    const row = await prisma.liveGame.findUnique({
      where: { id }
    });
    if (!row) return null;
    return mapRowToGame(row);
  } catch (error: any) {
    if (error.code === 'P1017' || error.message?.includes('closed the connection')) {
      console.warn('[gameService] Database connection lost, retrying...');
      try {
        await prisma.$connect();
        const row = await prisma.liveGame.findUnique({
          where: { id }
        });
        if (!row) return null;
        return mapRowToGame(row);
      } catch (retryError) {
        console.error('[gameService] Retry failed:', retryError);
        return null;
      }
    }
    console.error('[gameService] Error fetching game:', error);
    return null;
  }
}

/**
 * 경량 버전: data 필드 없이 빠르게 조회 (MainLoop용)
 * 타임아웃 보호 포함
 */
export async function getAllActiveGamesLight(): Promise<Array<{ id: string; status: string; category: string | null; updatedAt: Date }>> {
  try {
    const timeoutPromise = new Promise<Array<{ id: string; status: string; category: string | null; updatedAt: Date }>>((resolve) => {
      setTimeout(() => resolve([]), DB_QUERY_TIMEOUT_MS);
    });

    const queryPromise = prisma.liveGame.findMany({
      where: { isEnded: false },
      select: {
        id: true,
        status: true,
        category: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 100 // 최대 100개로 제한하여 성능 보장
    });

    return await Promise.race([queryPromise, timeoutPromise]);
  } catch (error: any) {
    console.error('[gameService] Error fetching active games (light):', error);
    return [];
  }
}

/** 단일 대형 쿼리 대신 소량 청크로 나눠 조회해 타임아웃 없이 완료 (Railway 등) */
async function fetchActiveGamesChunk(skip: number, take: number): Promise<LiveGameSession[]> {
  const rows = await prisma.liveGame.findMany({
    where: { isEnded: false },
    select: { id: true, data: true, status: true, category: true },
    orderBy: { updatedAt: 'desc' },
    skip,
    take,
  });
  const results: LiveGameSession[] = [];
  for (const row of rows) {
    try {
      const g = mapRowToGame(row);
      if (g) results.push(g);
    } catch {
      // skip parse error
    }
  }
  return results;
}

export async function getAllActiveGamesChunked(): Promise<LiveGameSession[]> {
  if (!isRailwayOrProd) {
    return getAllActiveGames();
  }
  const totalTake = 25;
  const results: LiveGameSession[] = [];
  for (let skip = 0; skip < totalTake; skip += CHUNK_SIZE) {
    const take = Math.min(CHUNK_SIZE, totalTake - skip);
    const chunkTimeout = new Promise<LiveGameSession[]>((resolve) => setTimeout(() => resolve([]), CHUNK_TIMEOUT_MS));
    try {
      const chunk = await Promise.race([
        fetchActiveGamesChunk(skip, take),
        chunkTimeout,
      ]);
      results.push(...chunk);
      if (chunk.length < take) break;
    } catch {
      break;
    }
  }
  return results;
}

export async function getAllActiveGames(): Promise<LiveGameSession[]> {
  try {
    const timeoutPromise = new Promise<LiveGameSession[]>((resolve) => {
      setTimeout(() => resolve([]), DB_QUERY_TIMEOUT_MS);
    });

    // 성능 최적화: DB 부하 감소 (Railway에서 타임아웃 완화를 위해 조회 수 제한)
    const takeLimit = isRailwayOrProd ? 25 : 40;
    const queryPromise = prisma.liveGame.findMany({
      where: { isEnded: false },
      select: {
        id: true,
        data: true,
        status: true,
        category: true
      },
      orderBy: { updatedAt: 'desc' },
      take: takeLimit
    }).then(rows => {
      // 배치 처리로 파싱 최적화 (한 번에 너무 많은 JSON 파싱 방지)
      const batchSize = 5; // 배치 크기 더 감소 (JSON 파싱 부하 고려)
      const results: LiveGameSession[] = [];
      
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const parsed = batch.map((row) => {
          try {
            return mapRowToGame(row);
          } catch (parseError) {
            console.warn(`[gameService] Failed to parse game ${row.id}:`, parseError);
            return null;
          }
        }).filter((g): g is LiveGameSession => g !== null);
        results.push(...parsed);
        
        // 각 배치 사이에 짧은 지연을 추가하여 이벤트 루프에 양보 (메모리 압박 완화)
        if (i + batchSize < rows.length) {
          // 비동기 지연 없이 바로 다음 배치 처리 (성능 우선)
        }
      }
      
      return results;
    });

    return await Promise.race([queryPromise, timeoutPromise]);
  } catch (error: any) {
    // 연결 오류 시 재시도
    if (error.code === 'P1017' || error.message?.includes('closed the connection')) {
      console.warn('[gameService] Database connection lost, retrying...');
      try {
        await prisma.$connect();
        const rows = await prisma.liveGame.findMany({
          where: { isEnded: false },
          select: {
            id: true,
            data: true,
            status: true,
            category: true
          },
          orderBy: { updatedAt: 'desc' },
          take: 20
        });
        // 배치 처리로 파싱 최적화
        const batchSize = 5;
        const results: LiveGameSession[] = [];
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const parsed = batch.map((row) => {
            try {
              return mapRowToGame(row);
            } catch (parseError) {
              console.warn(`[gameService] Failed to parse game ${row.id} on retry:`, parseError);
              return null;
            }
          }).filter((g): g is LiveGameSession => g !== null);
          results.push(...parsed);
        }
        return results;
      } catch (retryError) {
        console.error('[gameService] Retry failed:', retryError);
        return []; // 재시도 실패 시 빈 배열 반환
      }
    }
    console.error('[gameService] Error fetching active games:', error);
    return []; // 다른 오류 시에도 빈 배열 반환
  }
}

export async function getAllEndedGames(): Promise<LiveGameSession[]> {
  try {
    // Prisma Engine 연결 보장 (getAllEndedGames가 메인루프에서 호출되므로 연결 전 호출 시 무한 에러 방지)
    await prisma.$connect();
    // 성능 최적화: 필요한 필드만 선택
    const rows = await prisma.liveGame.findMany({
      where: { isEnded: true },
      select: {
        id: true,
        data: true,
        status: true,
        category: true
      },
      // 최신 게임 우선 (최근 종료된 게임이 더 중요)
      orderBy: { updatedAt: 'desc' },
      // 최대 100개로 제한하여 성능 보장
      take: 100
    });
    return rows.map((row) => mapRowToGame(row)).filter((g): g is LiveGameSession => g !== null);
  } catch (error: any) {
    const isConnectionError =
      error.code === 'P1017' ||
      error.message?.includes('closed the connection') ||
      error.message?.includes('Engine is not yet connected');
    if (isConnectionError) {
      if (error.message?.includes('Engine is not yet connected')) {
        console.warn('[gameService] Prisma engine not ready, connecting and retrying...');
      } else {
        console.warn('[gameService] Database connection lost, retrying...');
      }
      try {
        await prisma.$connect();
        const rows = await prisma.liveGame.findMany({
          where: { isEnded: true },
          select: {
            id: true,
            data: true,
            status: true,
            category: true
          },
          orderBy: { updatedAt: 'desc' },
          take: 100
        });
        return rows.map((row) => mapRowToGame(row)).filter((g): g is LiveGameSession => g !== null);
      } catch (retryError) {
        console.error('[gameService] Retry failed:', retryError);
        return [];
      }
    }
    console.error('[gameService] Error fetching ended games:', error);
    return [];
  }
}

/**
 * 사용자 ID로 활성 게임 찾기 (로그인 최적화용)
 */
export async function getLiveGameByPlayerId(playerId: string): Promise<LiveGameSession | null> {
  try {
    // JSON 필드에서 player1.id 또는 player2.id로 검색
    // Prisma는 JSON 필드 검색이 제한적이므로, 모든 활성 게임을 가져와서 필터링
    // 하지만 성능을 위해 최대 50개만 조회하고 필요한 필드만 선택
    const rows = await prisma.liveGame.findMany({
      where: { isEnded: false },
      select: {
        id: true,
        data: true,
        status: true,
        category: true
      },
      orderBy: { updatedAt: 'desc' },
      take: 20 // 최대 20개만 조회하여 성능 최적화
    });
    
    for (const row of rows) {
      const game = mapRowToGame(row);
      if (game && (game.player1?.id === playerId || game.player2?.id === playerId)) {
        return game;
      }
    }
    return null;
  } catch (error: any) {
    console.error('[gameService] Error fetching game by player ID:', error);
    return null;
  }
}

export async function saveGame(game: LiveGameSession): Promise<void> {
  try {
    const { status, category, isEnded } = deriveMeta(game);
    await prisma.liveGame.upsert({
      where: { id: game.id },
      create: {
        id: game.id,
        status,
        category,
        isEnded,
        data: game
      },
      update: {
        status,
        category,
        isEnded,
        data: game,
        updatedAt: new Date()
      }
    });
  } catch (error: any) {
    if (error.code === 'P1017' || error.message?.includes('closed the connection')) {
      console.warn('[gameService] Database connection lost, retrying saveGame...');
      try {
        await prisma.$connect();
        const { status, category, isEnded } = deriveMeta(game);
        await prisma.liveGame.upsert({
          where: { id: game.id },
          create: {
            id: game.id,
            status,
            category,
            isEnded,
            data: game
          },
          update: {
            status,
            category,
            isEnded,
            data: game,
            updatedAt: new Date()
          }
        });
      } catch (retryError) {
        console.error('[gameService] Retry saveGame failed:', retryError);
        throw retryError;
      }
    } else {
      console.error('[gameService] Error saving game:', error);
      throw error;
    }
  }
}

/**
 * 고아 게임 정리: isEnded: false로 남아있는 모든 게임 삭제
 * - 종료처리 실패로 DB에 남은 게임
 * - AI 게임 정상 종료되지 않고 남아있는 게임
 * - 오류 대국 등
 *
 * ⚠️ MainLoop에서 호출 시 반드시 onlineUserIds.length === 0 일 때만 호출할 것.
 *    (접속 중인 유저가 있으면 진행 중인 대국이 삭제될 수 있음)
 */
export async function cleanupOrphanedGamesInDb(): Promise<number> {
  try {
    const result = await prisma.liveGame.deleteMany({
      where: { isEnded: false },
    });
    if (result.count > 0) {
      console.log(`[gameService] cleanupOrphanedGamesInDb: deleted ${result.count} orphaned/active games`);
    }
    return result.count;
  } catch (error: any) {
    console.error('[gameService] cleanupOrphanedGamesInDb error:', error?.message || error);
    return 0;
  }
}

export async function deleteGame(id: string): Promise<void> {
  try {
    // deleteMany를 사용하여 레코드가 없어도 에러를 던지지 않음
    const result = await prisma.liveGame.deleteMany({
      where: { id }
    });
    // 삭제된 레코드가 없어도 정상 처리 (이미 삭제되었거나 캐시에만 있는 경우)
    if (result.count === 0) {
      console.log(`[gameService] Game ${id} not found in database (may be cache-only or already deleted)`);
    }
  } catch (error: any) {
    // P2025 에러는 레코드가 없다는 의미이므로 무시
    if (error.code === 'P2025') {
      console.log(`[gameService] Game ${id} not found in database (already deleted or cache-only)`);
      return; // 정상 종료
    }
    if (error.code === 'P1017' || error.message?.includes('closed the connection')) {
      console.warn('[gameService] Database connection lost, retrying deleteGame...');
      try {
        await prisma.$connect();
        const retryResult = await prisma.liveGame.deleteMany({
          where: { id }
        });
        if (retryResult.count === 0) {
          console.log(`[gameService] Game ${id} not found in database after retry`);
        }
      } catch (retryError: any) {
        // P2025 에러는 무시
        if (retryError.code === 'P2025') {
          console.log(`[gameService] Game ${id} not found in database after retry`);
          return;
        }
        console.error('[gameService] Retry deleteGame failed:', retryError);
        throw retryError;
      }
    } else {
      console.error('[gameService] Error deleting game:', error);
      throw error;
    }
  }
}

