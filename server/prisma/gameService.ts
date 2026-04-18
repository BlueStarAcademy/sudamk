import prisma, { prismaErrorImpliesEngineNotConnected } from "../prismaClient.js";
import type { InputJsonValue } from "@prisma/client/runtime/library";
import type { LiveGameSession, GameStatus } from "../../types/index.js";

const ENDED_STATUSES: GameStatus[] = ["ended", "no_contest"];

const ENGINE_NOT_CONNECTED = 'Engine is not yet connected';
const ENGINE_READY_DELAY_MS = 350;
const MAX_ENGINE_RETRIES = 15;
const COOLDOWN_MS = 2500;
const READY_TTL_MS = 15_000;

/** Windows 등에서 $connect() 직후에도 엔진이 준비되지 않을 수 있음. 연결 후 짧은 대기·프로브로 준비될 때까지 대기 */
export async function ensurePrismaEngineReady(): Promise<void> {
  const g = globalThis as any;
  if (!g.__prismaEngineReadyState) {
    g.__prismaEngineReadyState = {
      inFlight: null as Promise<void> | null,
      readyAt: 0,
      lastFailAt: 0,
      lastFailMsg: '',
    };
  }
  const state = g.__prismaEngineReadyState as {
    inFlight: Promise<void> | null;
    readyAt: number;
    lastFailAt: number;
    lastFailMsg: string;
  };

  const now = Date.now();
  if (state.readyAt && (now - state.readyAt) < READY_TTL_MS) return;

  // 최근 실패 후 쿨다운: 재시도 대기 후 한 번 더 시도 (바로 throw하지 않음)
  if (state.lastFailAt && (now - state.lastFailAt) < COOLDOWN_MS) {
    await new Promise(r => setTimeout(r, COOLDOWN_MS - (now - state.lastFailAt)));
    if (state.readyAt && (Date.now() - state.readyAt) < READY_TTL_MS) return;
  }

  if (state.inFlight) return state.inFlight;

  state.inFlight = (async () => {
    try {
      for (let attempt = 0; attempt < MAX_ENGINE_RETRIES; attempt++) {
        try {
          await prisma.$connect();
          await new Promise(r => setTimeout(r, ENGINE_READY_DELAY_MS + 80 * attempt));
          await prisma.$queryRaw`SELECT 1`;
          await new Promise(r => setTimeout(r, 150));
          state.readyAt = Date.now();
          state.lastFailAt = 0;
          state.lastFailMsg = '';
          return;
        } catch (e: unknown) {
          const msg = (e as { message?: string })?.message ?? '';
          const engineNotReady =
            msg.includes(ENGINE_NOT_CONNECTED) || prismaErrorImpliesEngineNotConnected(e);
          if (engineNotReady && attempt < MAX_ENGINE_RETRIES - 1) {
            await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
            continue;
          }
          throw e;
        }
      }
      throw new Error(ENGINE_NOT_CONNECTED);
    } catch (e: any) {
      state.lastFailAt = Date.now();
      state.lastFailMsg = e?.message || String(e);
      throw e;
    } finally {
      state.inFlight = null;
    }
  })();

  return state.inFlight;
}

const isRailwayOrProd = !!(process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL?.includes('railway') || process.env.DATABASE_URL?.includes('rlwy'));
const DB_QUERY_TIMEOUT_MS = isRailwayOrProd ? 18000 : 5000;
// 청크 단위 타임아웃: 한 번에 많은 row를 조회하지 않고 소량씩 나눠 조회해 단일 쿼리 타임아웃 방지
const CHUNK_TIMEOUT_MS = isRailwayOrProd ? 7000 : 4000;
const CHUNK_SIZE = isRailwayOrProd ? 10 : 20;

const mapRowToGame = (row: {
  id: string;
  data: unknown;
  status: string;
  category: string | null;
  aiHiddenItemAnimationEndTime?: bigint | null;
}): LiveGameSession | null => {
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
    // 길드전: JSON에 guildWarId 등은 있는데 gameCategory가 빠진 구버전/누락 데이터 보정
    const gw = game as any;
    if (
      (!game.gameCategory || game.gameCategory === "normal") &&
      ((typeof gw.guildWarId === "string" && gw.guildWarId.length > 0) ||
        (typeof gw.guildWarBoardId === "string" && gw.guildWarBoardId.length > 0))
    ) {
      game.gameCategory = "guildwar" as any;
    }
    if (
      (game.aiHiddenItemAnimationEndTime == null || !Number.isFinite(game.aiHiddenItemAnimationEndTime)) &&
      row.aiHiddenItemAnimationEndTime != null
    ) {
      game.aiHiddenItemAnimationEndTime = Number(row.aiHiddenItemAnimationEndTime);
    }
    return game;
  } catch (error) {
    console.warn(`[gameService] Failed to parse game ${row.id}:`, error);
    return null;
  }
};

const prismaAiHiddenItemAnimationEndTime = (game: LiveGameSession): bigint | null => {
  const t = game.aiHiddenItemAnimationEndTime;
  if (t == null || !Number.isFinite(t)) return null;
  return BigInt(Math.trunc(t));
};

const deriveMeta = (game: LiveGameSession) => {
  const status: GameStatus = (game.gameStatus as GameStatus) ?? "pending";
  const g = game as any;
  const hasGuildWarKeys =
    (typeof g.guildWarId === "string" && g.guildWarId.length > 0) ||
    (typeof g.guildWarBoardId === "string" && g.guildWarBoardId.length > 0);
  // gameCategory가 비어 있으면 deriveMeta가 'normal'로 덮어 길드전이 깨지는 것을 방지
  const category =
    g.gameCategory === "guildwar" || hasGuildWarKeys
      ? "guildwar"
      : game.gameCategory ??
        (game.isSinglePlayer ? "singleplayer" : "normal");
  const isEnded = ENDED_STATUSES.includes(status);
  return { status, category, isEnded };
};

/**
 * 전용 컬럼을 쓸 수 없을 때: (1) 오래된 Prisma 클라이언트 — Unknown argument
 * (2) 마이그레이션 미적용 DB — "column ... does not exist in the current database"
 */
function isAiHiddenDedicatedColumnUnavailableError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? "");
  if (!msg.includes("aiHiddenItemAnimationEndTime")) return false;
  if (msg.includes("Unknown argument")) return true;
  if (msg.includes("does not exist in the current database")) return true;
  return false;
}

/** 한 프로세스에서 한 번 실패하면 전용 컬럼 없이만 저장 (로그·쿼리 반복 방지) */
let liveGameAiHiddenDedicatedColumnDisabled = false;

async function upsertLiveGameRow(game: LiveGameSession, includeAiHiddenColumn: boolean): Promise<void> {
  const { status, category, isEnded } = deriveMeta(game);
  const dataJson = JSON.parse(JSON.stringify(game)) as InputJsonValue;
  const baseCreate = {
    id: game.id,
    status,
    category,
    isEnded,
    data: dataJson,
  };
  const baseUpdate = {
    status,
    category,
    isEnded,
    data: dataJson,
    updatedAt: new Date(),
  };
  if (includeAiHiddenColumn) {
    const aiHiddenEnd = prismaAiHiddenItemAnimationEndTime(game);
    await prisma.liveGame.upsert({
      where: { id: game.id },
      create: { ...baseCreate, aiHiddenItemAnimationEndTime: aiHiddenEnd },
      update: { ...baseUpdate, aiHiddenItemAnimationEndTime: aiHiddenEnd },
    });
  } else {
    await prisma.liveGame.upsert({
      where: { id: game.id },
      create: baseCreate,
      update: baseUpdate,
    });
  }
}

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
    await ensurePrismaEngineReady();
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
  await ensurePrismaEngineReady();
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
    await ensurePrismaEngineReady();
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
    if (prismaErrorImpliesEngineNotConnected(error) || error?.message?.includes?.(ENGINE_NOT_CONNECTED)) {
      return [];
    }
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
    if (!prismaErrorImpliesEngineNotConnected(error)) {
      console.error('[gameService] Error fetching active games:', error);
    }
    return []; // 다른 오류 시에도 빈 배열 반환
  }
}

async function fetchEndedGamesRows() {
  return prisma.liveGame.findMany({
    where: { isEnded: true },
    select: { id: true, data: true, status: true, category: true },
    orderBy: { updatedAt: 'desc' },
    take: 100
  });
}

export async function getAllEndedGames(): Promise<LiveGameSession[]> {
  const run = async (): Promise<LiveGameSession[]> => {
    const rows = await fetchEndedGamesRows();
    return rows.map((row) => mapRowToGame(row)).filter((g): g is LiveGameSession => g !== null);
  };
  try {
    await ensurePrismaEngineReady();
    try {
      return await run();
    } catch (runErr: unknown) {
      const runMsg = (runErr as { message?: string })?.message ?? '';
      if (runMsg.includes(ENGINE_NOT_CONNECTED)) return [];
      throw runErr;
    }
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.message?.includes(ENGINE_NOT_CONNECTED)) {
      // Windows/startup: 엔진 미연결 시 재시도 없이 [] 반환 (로그 스팸 방지)
      return [];
    }
    const isConnectionError =
      err.code === 'P1017' ||
      err.message?.includes('closed the connection');
    if (isConnectionError) {
      console.warn('[gameService] Database connection lost, retrying...');
      for (let retry = 0; retry < 3; retry++) {
        try {
          await new Promise(r => setTimeout(r, 300 * (retry + 1)));
          await ensurePrismaEngineReady();
          return await run();
        } catch (retryError) {
          if (retry === 2) return [];
        }
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
  const runUpsert = async () => {
    if (liveGameAiHiddenDedicatedColumnDisabled) {
      await upsertLiveGameRow(game, false);
      return;
    }
    try {
      await upsertLiveGameRow(game, true);
    } catch (first: any) {
      if (isAiHiddenDedicatedColumnUnavailableError(first)) {
        liveGameAiHiddenDedicatedColumnDisabled = true;
        console.warn(
          "[gameService] saveGame: LiveGame.aiHiddenItemAnimationEndTime column/client mismatch — saving without dedicated column. " +
            "Value remains in `data` JSON. Apply DB: `npx prisma migrate deploy`; then `npx prisma generate` if needed.",
        );
        await upsertLiveGameRow(game, false);
        return;
      }
      throw first;
    }
  };

  try {
    const gw = game as any;
    if (
      ((typeof gw.guildWarId === "string" && gw.guildWarId.length > 0) ||
        (typeof gw.guildWarBoardId === "string" && gw.guildWarBoardId.length > 0)) &&
      (!game.gameCategory || game.gameCategory === ("normal" as any))
    ) {
      game.gameCategory = "guildwar" as any;
    }
    await runUpsert();
  } catch (error: any) {
    if (error.code === 'P1017' || error.message?.includes('closed the connection')) {
      console.warn('[gameService] Database connection lost, retrying saveGame...');
      try {
        await prisma.$connect();
        await runUpsert();
      } catch (retryError) {
        console.error('[gameService] Retry saveGame failed:', retryError);
        throw retryError;
      }
    } else {
      console.error('[gameService] Error saving game:', error?.message || error);
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
    await ensurePrismaEngineReady();
    const result = await prisma.liveGame.deleteMany({
      where: { isEnded: false },
    });
    if (result.count > 0) {
      console.log(`[gameService] cleanupOrphanedGamesInDb: deleted ${result.count} orphaned/active games`);
    }
    return result.count;
  } catch (error: any) {
    if (prismaErrorImpliesEngineNotConnected(error) || error?.message?.includes?.(ENGINE_NOT_CONNECTED)) {
      return 0;
    }
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

