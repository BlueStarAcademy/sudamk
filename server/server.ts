import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// .env를 프로젝트 루트에서 명시적으로 로드 (cwd에 의존하지 않음)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env');
dotenv.config({ path: envPath });
// 즉시 stderr 출력 (크래시 시 로그에 아무것도 안 남는 경우 원인 파악용)
process.stderr.write(`[Server] Bootstrap: pid=${process.pid} cwd=${process.cwd()} env_loaded\n`);

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { randomUUID, timingSafeEqual } from 'crypto';
import process from 'process';
import http from 'http';
import { createWebSocketServer, broadcast, broadcastUserUpdate, sendToUser } from './socket.js';
import { startServerLoadMonitoring, buildAdminServerMetricsPayload } from './serverLoadMetrics.js';

// Railway 환경 자동 감지
// Railway는 RAILWAY_ENVIRONMENT_NAME, RAILWAY_SERVICE_NAME 등을 제공하지만
// RAILWAY_ENVIRONMENT는 자동으로 설정되지 않으므로 수동으로 설정
if (!process.env.RAILWAY_ENVIRONMENT && 
    (process.env.RAILWAY_ENVIRONMENT_NAME || 
     process.env.RAILWAY_SERVICE_NAME || 
     process.env.RAILWAY_PROJECT_NAME ||
     process.env.DATABASE_URL?.includes('railway'))) {
    process.env.RAILWAY_ENVIRONMENT = 'true';
    console.log('[Server] Railway environment auto-detected');
}
import { handleAction, resetAndGenerateQuests, updateQuestProgress } from './gameActions.js';
import { regenerateActionPoints } from './effectService.js';
import { updateGameStates } from './gameModes.js';
import * as db from './db.js';
// FIX: Import missing types from the centralized types file.
import * as types from '../shared/types/index.js';
import { Player } from '../shared/types/index.js';
import { processGameSummary, endGame } from './summaryService.js';
// FIX: Correctly import from the placeholder module.
import * as aiPlayer from './aiPlayer.js';
import { processRankingRewards, processWeeklyLeagueUpdates, updateWeeklyCompetitorsIfNeeded, processWeeklyTournamentReset, resetAllTournamentScores, resetAllUsersLeagueScoresForNewWeek, processDailyRankings, processDailyQuestReset, resetAllChampionshipScoresToZero, processTowerRankingRewards } from './scheduledTasks.js';
import * as tournamentService from './tournamentService.js';
import { AVATAR_POOL, BOT_NAMES, PLAYFUL_GAME_MODES, SPECIAL_GAME_MODES, SINGLE_PLAYER_MISSIONS, GRADE_LEVEL_REQUIREMENTS, NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '../shared/constants';
import { calculateTotalStats } from './statService.js';
import { isSameDayKST, getKSTDate } from '../shared/utils/timeUtils.js';
import { createDefaultBaseStats, createDefaultUser } from './initialData.ts';
import { containsProfanity } from '../profanity.js';
import {
    nicknameContainsReservedStaffTerms,
    RESERVED_STAFF_NICKNAME_USER_MESSAGE,
} from '../shared/utils/staffNicknameDisplay.js';
import { volatileState } from './state.js';
import { ensureClientIpAllowsSession, releaseIpBindingForUser } from './ipLoginPolicy.js';
import { CoreStat } from '../types/index.js';
import { clearAiSession, syncAiSession } from './aiSessionManager.js';
import { hashPassword, verifyPassword } from './utils/passwordUtils.js';
import { sendEmailVerification, verifyEmailCode } from './services/emailVerificationService.js';
import { getKakaoAuthUrl, getKakaoAccessToken, getKakaoUserInfo } from './services/kakaoAuthService.js';
import { getGoogleAuthUrl, getGoogleAccessToken, getGoogleUserInfo } from './services/googleAuthService.js';
import { DEFAULT_REWARD_CONFIG, normalizeRewardConfig } from '../shared/constants/rewardConfig.js';

const getTournamentStateByType = (user: types.User, type: types.TournamentType): types.TournamentState | null => {
    switch (type) {
        case 'neighborhood':
            return user.lastNeighborhoodTournament ?? null;
        case 'national':
            return user.lastNationalTournament ?? null;
        case 'world':
            return user.lastWorldTournament ?? null;
        default:
            return null;
    }
};

let isProcessingTournamentTick = false;
let isProcessingMainLoop = false;
let hasLoggedMainLoopSkip = false;
let hasCompletedFirstRun = false; // 첫 실행 완료 플래그 (전역)
let lastPrismaNotReadyLogAt = 0; // "Prisma engine not ready" 로그 억제 (60초에 한 번)
let mainLoopConsecutiveFailures = 0; // 연속 실패 횟수 추적
const MAX_CONSECUTIVE_FAILURES = 10; // 최대 연속 실패 횟수

// Railway 32GB 환경: 5분 주기로 DB 부하·메모리 피크 감소 (1분→5분)
const OFFLINE_REGEN_INTERVAL_MS = 300_000; // 5분
const OFFLINE_REGEN_BATCH_SIZE = 25; // 배치당 25명 (메모리 피크 감소)
const OFFLINE_REGEN_MAX_USERS_PER_CYCLE = 200; // 주기당 최대 200명 처리
// 메모리 가드: RSS가 이 값을 넘으면 해당 회차 스킵
// RAILWAY_REPLICA_MEMORY_LIMIT_MB=32768 설정 시 8GB, 미설정 시 Railway 2GB·로컬 250MB
const _replicaLimitMb = parseInt(process.env.RAILWAY_REPLICA_MEMORY_LIMIT_MB || '0', 10);
const OFFLINE_REGEN_SKIP_RSS_MB = _replicaLimitMb > 4000 ? 8000 : (process.env.RAILWAY_ENVIRONMENT ? 2000 : 250);
let lastOfflineRegenAt = 0;
const DAILY_TASK_CHECK_INTERVAL_MS = 60_000; // 1 minute
let lastDailyTaskCheckAt = 0;
/** 0시 스케줄러 완료 브로드캐스트를 해당 날짜에 이미 보냈는지 (KST 0시 기준 타임스탬프) */
let lastSchedulerMidnightBroadcastDay = 0;
let lastBotScoreUpdateAt = 0;
let lastStaleUserStatusCleanupAt = 0;
const STALE_USER_STATUS_CLEANUP_INTERVAL_MS = 60_000; // 1000명 규모: userStatuses 무한 증가 방지

/** 소규모 플랜(기본 512MB)에서 RSS가 이 값을 넘으면 재시작. `MEMORY_EXIT_RSS_MB`로 재정의 가능 */
const MEMORY_EXIT_RSS_MB_SMALL = parseInt(process.env.MEMORY_EXIT_RSS_MB || '440', 10);
/** 메모리 한계로 종료 시도 중복 방지 */
let pendingMemoryCriticalExit = false;

// 고아 게임 정리: 온라인 0명일 때만 실행 (접속자가 없을 때 DB에 남은 AI/오류 대국 삭제)
let lastOrphanedGameCleanupAt = 0;
const ORPHANED_GAME_CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15분

// getAllActiveGames 타임아웃 백오프 추적
let lastGetAllActiveGamesTimeout = 0;
const GET_ALL_ACTIVE_GAMES_BACKOFF_MS = 120000; // 타임아웃 발생 시 120초 동안 DB 조회 스킵 (캐시 사용)
let lastGetAllActiveGamesSuccess = 0; // 마지막 성공한 게임 로드 시간
// Railway 등 배포 환경에서는 DB 지연이 클 수 있어 타임아웃 완화 (반복 타임아웃 시 서버 불안정 방지)
const isRailwayOrProd = !!(process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL?.includes('railway') || process.env.DATABASE_URL?.includes('rlwy'));
const GET_ALL_ACTIVE_GAMES_INTERVAL_MS = isRailwayOrProd ? 45000 : 30000; // Railway: 45초(부하 감소), 로컬: 30초
const MAINLOOP_DB_TIMEOUT_MS = isRailwayOrProd ? 18000 : 5000;
// updateGameStates: 사이클당 1게임 처리, 내부 2.5초 데드라인. 이벤트 루프 지연 시를 위해 메인루프 타임아웃은 여유있게
const MAINLOOP_UPDATE_GAMES_TIMEOUT_MS = isRailwayOrProd ? 10000 : 8000; // 8~10초 (updateGameStates 내부 2.5초와 조화, 타임아웃 방지)

// 타임아웃 연속 발생 추적 (크래시 방지)
let consecutiveTimeouts = 0;
let lastTimeoutResetTime = 0;
const MAX_CONSECUTIVE_TIMEOUTS = 10; // 연속 타임아웃 10회 초과 시 크래시 가능성
const TIMEOUT_RESET_WINDOW_MS = 60000; // 1분 내 타임아웃이 연속 발생하면 카운트

/** 게임 변경 감지용 경량 시그니처 (전체 JSON 직렬화 대체, MainLoop 경량화). 초읽기/제한시간 갱신 감지에 turnDeadline·남은시간·초읽기 횟수 포함 */
function getGameSignature(g: types.LiveGameSession): string {
    if (!g?.id) return '';
    const rev = g.serverRevision ?? 0;
    const moves = (g.moveHistory?.length) ?? 0;
    const status = g.gameStatus ?? '';
    const synced = g.lastSyncedAt ?? 0;
    const turn = g.turnDeadline ?? 0;
    const winner = g.winner ?? '';
    const blackTime = g.blackTimeLeft ?? 0;
    const whiteTime = g.whiteTimeLeft ?? 0;
    const blackByo = g.blackByoyomiPeriodsLeft ?? 0;
    const whiteByo = g.whiteByoyomiPeriodsLeft ?? 0;
    return `${g.id}\t${rev}\t${moves}\t${status}\t${synced}\t${turn}\t${winner}\t${blackTime}\t${whiteTime}\t${blackByo}\t${whiteByo}`;
}

// 만료된 negotiation 정리 함수
const cleanupExpiredNegotiations = (volatileState: types.VolatileState, now: number): void => {
    const expiredNegIds: string[] = [];
    
    for (const [negId, neg] of Object.entries(volatileState.negotiations)) {
        if (neg.deadline && now > neg.deadline && neg.status === 'pending') {
            expiredNegIds.push(negId);
            
            // 사용자 상태 복구
            if (volatileState.userStatuses[neg.challenger.id]?.status === types.UserStatus.Negotiating) {
                volatileState.userStatuses[neg.challenger.id].status = types.UserStatus.Waiting;
            }
            if (volatileState.userStatuses[neg.opponent.id]?.status === types.UserStatus.Negotiating) {
                volatileState.userStatuses[neg.opponent.id].status = types.UserStatus.Waiting;
            }
        }
    }
    
    for (const negId of expiredNegIds) {
        delete volatileState.negotiations[negId];
    }
    
    if (expiredNegIds.length > 0) {
        broadcast({ type: 'NEGOTIATION_UPDATE', payload: { negotiations: volatileState.negotiations, userStatuses: volatileState.userStatuses } });
    }
};

const processSinglePlayerMissions = (user: types.User): types.User => {
    const now = Date.now();
    if (!user.singlePlayerMissions) {
        return user;
    }

    let userModified = false;
    // We make a copy of the user object to modify. This is safer and avoids null issues.
    const updatedUser: types.User = JSON.parse(JSON.stringify(user));

    for (const missionId in updatedUser.singlePlayerMissions) {
        const missionState = updatedUser.singlePlayerMissions[missionId];
        const missionInfo = SINGLE_PLAYER_MISSIONS.find(m => m.id === missionId);

        if (missionState && missionInfo && missionState.isStarted) {
            // Ensure accumulatedAmount and level are numbers
            if (typeof missionState.accumulatedAmount !== 'number') {
                missionState.accumulatedAmount = 0;
                userModified = true;
            }
            if (typeof missionState.level !== 'number') {
                missionState.level = 1;
                userModified = true;
            }

            const currentLevel = missionState.level || 1;
            const levelInfo = missionInfo.levels[currentLevel - 1];
            if (!levelInfo) continue;

            if (missionState.accumulatedAmount >= levelInfo.maxCapacity) {
                continue; 
            }

            const elapsedMs = now - missionState.lastCollectionTime;
            const productionIntervalMs = levelInfo.productionRateMinutes * 60 * 1000;
            if (productionIntervalMs <= 0) continue;

            const cycles = Math.floor(elapsedMs / productionIntervalMs);

            if (cycles > 0) {
                const amountToAdd = cycles * levelInfo.rewardAmount;
                const newAmount = Math.min(levelInfo.maxCapacity, missionState.accumulatedAmount + amountToAdd);
                
                if (newAmount > missionState.accumulatedAmount) {
                    missionState.accumulatedAmount = newAmount;
                    missionState.lastCollectionTime += cycles * productionIntervalMs;
                    userModified = true;
                }
            }
        }
    }
    // Return the updated user only if there were modifications.
    return userModified ? updatedUser : user;
};


// 타임아웃 상수 정의 (startServer 함수 밖에서도 사용 가능하도록)
const LOBBY_TIMEOUT_MS = 90 * 1000;
const GAME_DISCONNECT_TIMEOUT_MS = 90 * 1000;

/** Testability: refs passed into createApp so health/root handlers can read server state without closing over startServer locals. */
export interface ServerRef {
    serverInstance: http.Server | null;
    isServerReady: boolean;
}

/** Optional ref for DB init state (used by root handler). */
export interface DbInitializedRef {
    value: boolean;
}

/** 콤마 구분 추가 origin (Railway Variables: CORS_ALLOWED_ORIGINS) */
function parseCommaSeparatedOrigins(envVal: string | undefined): string[] {
    if (!envVal?.trim()) return [];
    return envVal.split(',').map(s => s.trim()).filter(Boolean);
}

/** Railway 등 분리 배포 시 프론트 origin 허용 여부 (단일 소스로 preflight·에러·raw 응답에 동일 적용) */
function isCorsAllowedOrigin(origin: string | undefined, productionAllowedOrigins: readonly string[]): boolean {
    if (!origin) return false;
    if (process.env.NODE_ENV !== 'production') return true;
    const trimmed = (s: string) => s.replace(/\/$/, '');
    if (productionAllowedOrigins.some(allowed => origin === trimmed(allowed) || origin.startsWith(trimmed(allowed)))) {
        return true;
    }
    try {
        const { hostname } = new URL(origin);
        if (hostname.endsWith('.up.railway.app') || hostname.endsWith('.railway.app')) {
            return true;
        }
    } catch {
        /* ignore malformed origin */
    }
    return false;
}

function applyCorsHeaders(req: express.Request, res: express.Response, productionAllowedOrigins: readonly string[]): void {
    const origin = req.headers.origin;
    if (!isCorsAllowedOrigin(origin, productionAllowedOrigins)) return;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Vary', 'Origin');
}

/**
 * Creates the Express application with all middleware and routes.
 * Exported for integration tests (supertest) without starting listen or WebSocket.
 * When testMode is true, skips DB init and server ref setup (caller passes serverRef/dbInitializedRef).
 */
export function createApp(serverRef: ServerRef, dbInitializedRef?: DbInitializedRef, options?: { testMode?: boolean }): express.Application {
    let app: express.Application;
    let dbInitPromise: Promise<void> | undefined;
    let serverInstance: http.Server | null = null;
    let isServerReady = false;
    let port = 4000;
    if (options?.testMode) {
        app = express();
    } else {
    let dbInitialized = false;
    dbInitPromise = (async () => {
        // --- Debug: Check DATABASE_URL ---
        // Railway는 때때로 다른 이름으로 DATABASE_URL을 제공합니다 (예: RAILWAY_SERVICE_POSTGRES_URL)
        // 모든 DATABASE 관련 환경 변수 확인 및 로깅
        const allDbVars = Object.keys(process.env).filter(k => 
            k.includes('DATABASE') || k.includes('POSTGRES')
        );
        console.log(`[Server Startup] All DATABASE/POSTGRES environment variables: ${allDbVars.join(', ')}`);
        
        // 각 변수의 첫 50자만 로깅 (보안을 위해)
        allDbVars.forEach(key => {
            const value = process.env[key];
            if (value) {
                const preview = value.length > 50 ? value.substring(0, 50) + '...' : value;
                console.log(`[Server Startup] ${key}: ${preview} (length: ${value.length})`);
            }
        });
        
        let dbUrl = process.env.DATABASE_URL;
        if (!dbUrl) {
            // Railway 자동 연결 변수 확인
            dbUrl = process.env.RAILWAY_SERVICE_POSTGRES_URL || 
                    process.env.POSTGRES_URL || 
                    process.env.POSTGRES_PRIVATE_URL ||
                    process.env.DATABASE_URL;
            
            // 찾은 경우 DATABASE_URL로 설정
            if (dbUrl && !process.env.DATABASE_URL) {
                process.env.DATABASE_URL = dbUrl;
                console.log(`[Server Startup] Using ${Object.keys(process.env).find(k => process.env[k] === dbUrl)} as DATABASE_URL`);
            }
        }
        
        // DATABASE_URL이 프로토콜 없이 시작하는 경우, Railway 자동 변수에서 올바른 값 찾기
        if (dbUrl && !dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
            console.warn(`[Server Startup] ⚠️ DATABASE_URL is missing protocol! Looking for correct value...`);
            const correctUrl = process.env.RAILWAY_SERVICE_POSTGRES_URL || 
                              process.env.POSTGRES_PRIVATE_URL ||
                              process.env.POSTGRES_URL;
            if (correctUrl && (correctUrl.startsWith('postgresql://') || correctUrl.startsWith('postgres://'))) {
                console.log(`[Server Startup] ✅ Found correct DATABASE_URL in Railway auto-provided variables`);
                dbUrl = correctUrl;
                process.env.DATABASE_URL = dbUrl;
            }
        }
        
        console.log(`[Server Startup] DATABASE_URL check: ${dbUrl ? `Set (length: ${dbUrl.length}, starts with: ${dbUrl.substring(0, 20)}...)` : 'NOT SET'}`);
        if (!dbUrl) {
            console.error("[Server Startup] DATABASE_URL is not set! Please check Railway Variables.");
            console.error("[Server Startup] All environment variables:", Object.keys(process.env).filter(k => k.includes('DATABASE') || k.includes('POSTGRES')).join(', '));
            if (!process.env.RAILWAY_ENVIRONMENT) {
                console.error("[Server] 로컬 실행: .env에 DATABASE_URL을 설정하세요.");
                console.error("[Server] 예: DATABASE_URL=postgresql://user:password@localhost:5432/sudamr");
                console.error("[Server] 참고: .env.local.example");
            }
        } else {
            // Railway 환경에서 내부 네트워크 사용 권장
            const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL?.includes('railway');
            if (isRailway && !dbUrl.includes('postgres.railway.internal')) {
                console.warn("[Server Startup] WARNING: DATABASE_URL is not using Railway internal network.");
                console.warn("[Server Startup] For better performance and reliability, consider using: postgres.railway.internal:5432");
                console.warn("[Server Startup] Current URL uses:", dbUrl.includes('railway.app') ? 'public Railway URL' : 'external URL');
            } else if (isRailway && dbUrl.includes('postgres.railway.internal')) {
                console.log("[Server Startup] Using Railway internal network (recommended)");
            }
        }
        
        // --- Initialize Database on Start ---
        try {
            // Railway 환경에서는 데이터베이스 연결이 더 오래 걸릴 수 있으므로 타임아웃 증가
            const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL?.includes('railway');
            const timeoutDuration = isRailway ? 30000 : 10000; // Railway: 30초, 로컬: 10초
            const dbTimeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`Database initialization timeout after ${timeoutDuration}ms`)), timeoutDuration);
            });
            console.log(`[Server Startup] Attempting database initialization (timeout: ${timeoutDuration}ms)...`);
            await Promise.race([db.initializeDatabase(), dbTimeout]);
            dbInitialized = true;
            if (dbInitializedRef) dbInitializedRef.value = true;
            console.log('[Server Startup] Database initialized successfully');
            // 길드전 1회 부트스트랩: GUILD_WAR_BOOTSTRAP_MATCH=1 이면 KV에 플래그를 올린 뒤 즉시 매칭 1회(다음 메인루프까지 기다리지 않음). 운영에서 1회만 켠 다음 env 제거 권장.
            if (process.env.GUILD_WAR_BOOTSTRAP_MATCH === '1') {
                try {
                    await db.setKV('guildWarBootstrapMatchOnce', true);
                    console.log('[Server Startup] GUILD_WAR_BOOTSTRAP_MATCH=1 → guildWarBootstrapMatchOnce=true (will be consumed by processGuildWarMatching)');
                    const { processGuildWarMatching } = await import('./scheduledTasks.js');
                    await processGuildWarMatching();
                } catch (gwBootErr: any) {
                    console.warn('[Server Startup] Guild war bootstrap (non-fatal):', gwBootErr?.message);
                }
            }
            // 길드 표시 이름이 정확히 일치하는 길드(기본: 푸른별)를 봇과 즉시 전쟁 — 클라이언트 신청 버튼 없이 입장만 하면 됨. 1회 적용 후 env 제거 권장.
            if (process.env.GUILD_WAR_AUTO_MATCH_BLUE_STAR === '1') {
                try {
                    const guildName = (process.env.GUILD_WAR_AUTO_MATCH_GUILD_NAME || '푸른별').trim();
                    const { ensureNamedGuildVsBotGuildWar } = await import('./scheduledTasks.js');
                    await ensureNamedGuildVsBotGuildWar(guildName);
                    console.log(
                        `[Server Startup] GUILD_WAR_AUTO_MATCH_BLUE_STAR=1 → ensureNamedGuildVsBotGuildWar("${guildName}")`,
                    );
                } catch (blueStarErr: any) {
                    console.warn('[Server Startup] ensureNamedGuildVsBotGuildWar (non-fatal):', blueStarErr?.message);
                }
            }
            // Prisma 엔진이 모든 쿼리 경로에서 준비되도록 gameService 쪽 probe 실행 후 잠시 대기
            try {
                const { ensurePrismaEngineReady } = await import('./prisma/gameService.js');
                await ensurePrismaEngineReady();
                await new Promise(r => setTimeout(r, 500));
            } catch (engineErr: any) {
                console.warn('[Server Startup] ensurePrismaEngineReady (non-fatal):', engineErr?.message);
            }
            // DB 초기화 완료 후에만 연결 상태 주기 확인 시작 (Prisma 엔진 준비 전 호출 방지)
            if (dbUrl) {
                let lastDbConnectionStatus: boolean | null = null;
                setInterval(async () => {
                    const connected = await db.isDatabaseConnected();
                    if (lastDbConnectionStatus !== null && lastDbConnectionStatus !== connected) {
                        if (!connected) {
                            console.warn(`[Server Startup] Database connection status: DISCONNECTED (will retry in background)`);
                        } else {
                            console.log(`[Server Startup] Database connection status: CONNECTED`);
                        }
                    }
                    lastDbConnectionStatus = connected;
                }, 30000);
            }
            // 서버 시작 시 고아 게임 정리 (접속자가 없으므로 안전)
            try {
                const cleaned = await db.cleanupOrphanedGamesInDb();
                if (cleaned > 0) {
                    console.log(`[Server Startup] Cleaned ${cleaned} orphaned games before MainLoop start`);
                }
            } catch (cleanupErr: any) {
                console.warn('[Server Startup] Orphaned game cleanup failed (non-fatal):', cleanupErr?.message);
            }
        } catch (err: any) {
            console.error("Error during server startup:", err);
            
            // 데이터베이스 연결 오류인 경우 더 자세한 안내
            if (err.code === 'P1001' || err.message?.includes("Can't reach database server") || 
                err.message?.includes('connection') || err.code?.startsWith('P') || err.message?.includes('timeout')) {
                console.error("\n[Server] Database connection failed or timed out!");
                console.error("[Server] Please ensure:");
                console.error("[Server] 1. DATABASE_URL environment variable is set correctly");
                console.error("[Server] 2. Database server is running and accessible");
                console.error("[Server] 3. Network connection allows access to the database");
                
                const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.DATABASE_URL?.includes('railway');
                if (isRailway) {
                    console.error("\n[Server] Railway-specific checks:");
                    console.error("[Server] 1. Railway Postgres service is running");
                    console.error("[Server] 2. Postgres service is connected to your backend service");
                    console.error("[Server] 3. Check Railway Dashboard → Your Service → Variables → DATABASE_URL");
                    console.error("[Server] 4. DATABASE_URL should use internal network: postgres.railway.internal:5432");
                    console.error("[Server] 5. If using public URL, ensure it's correct and accessible");
                }
                
                console.error("\n[Server] Example DATABASE_URL format:");
                console.error("[Server] postgresql://user:password@host:port/database");
            }
            
            // Railway 환경에서는 데이터베이스 연결 실패해도 서버를 계속 실행
            // 헬스체크에서 데이터베이스 상태를 확인하고, 백그라운드에서 재시도
            if (process.env.RAILWAY_ENVIRONMENT) {
                console.error("[Server] Railway environment detected. Continuing server startup despite database error.");
                console.error("[Server] Server will continue running and retry database connection in background.");
                console.error("[Server] Health check will report database status.");
                
                // 백그라운드에서 데이터베이스 연결 재시도
                (async () => {
                    let retries = 10;
                    while (retries > 0 && !dbInitialized) {
                        await new Promise(resolve => setTimeout(resolve, 10000)); // 10초 대기
                        try {
                            await db.initializeDatabase();
                            dbInitialized = true;
                            if (dbInitializedRef) dbInitializedRef.value = true;
                            console.log("[Server] Database connection established after retry!");
                        } catch (retryError: any) {
                            retries--;
                            console.warn(`[Server] Database retry failed (${10 - retries}/10):`, retryError.message);
                        }
                    }
                })();
            } else {
                // 로컬 환경에서는 즉시 종료하지 않고 경고만 출력
                // 서버가 시작되지 않으면 헬스체크가 실패하므로 Railway가 재시작할 수 있음
                console.error("[Server] Local environment: Database connection failed. Server will start but may not function correctly.");
                console.error("[Server] Please check DATABASE_URL and ensure database is running.");
            }
        }
    })();
    
    // 데이터베이스 초기화를 기다리지 않고 서버 시작 (서버 리스닝 최우선)
    // 데이터베이스 초기화는 백그라운드에서 계속 진행

    // Fetch all users from DB (optimized: without equipment/inventory to reduce memory usage)
    // 데이터베이스 초기화 완료 후 비동기로 처리 (서버 리스닝 시작 후 실행)
    // 서버 리스닝을 최우선으로 하기 위해 데이터베이스 초기화 완료를 기다리지 않음
    dbInitPromise.then(() => {
        // 데이터베이스 초기화 완료 후 사용자 업데이트 실행
        setImmediate(() => {
            (async () => {
                try {
                    const { listUsers } = await import('./prisma/userService.js');
                    // 타임아웃 추가 (30초)
                    const usersTimeout = new Promise<types.User[]>((resolve) => {
                        setTimeout(() => resolve([]), 30000);
                    });
                    const allDbUsers = await Promise.race([
                        listUsers({ includeEquipment: false, includeInventory: false }),
                        usersTimeout
                    ]);
                    
                    if (allDbUsers.length === 0) {
                        console.warn('[Server Startup] No users found for base stats update, skipping...');
                        return;
                    }
                    
                    const coreStats = Object.values(CoreStat) as CoreStat[];
                    let usersUpdatedCount = 0;

                    // First, run the migration logic to ensure all users have correct base stats
                    for (const user of allDbUsers) {
                    const defaultBaseStats = createDefaultBaseStats();
                    let needsUpdate = false;

                    // More robust check: if baseStats is missing, or any stat is not a number or is less than 100
                    if (!user.baseStats || coreStats.some(stat => typeof user.baseStats?.[stat] !== 'number' || user.baseStats[stat] < 100)) {
                        user.baseStats = defaultBaseStats;
                        needsUpdate = true;
                    }
                    
                    if (needsUpdate) {
                        console.log(`[Server Startup] Updating base stats for user: ${user.nickname}`);
                        await db.updateUser(user);
                        usersUpdatedCount++;
                    }
                }

                    console.log(`[Server Startup] Base stats update complete. ${usersUpdatedCount} user(s) had their base stats updated.`);
                } catch (error: any) {
                    console.error('[Server Startup] Failed to fetch/update users:', error?.message || error);
                    console.error('[Server Startup] Continuing server startup despite user update error...');
                }
            })().catch((outerError: any) => {
                // async 함수 자체가 실패한 경우
                console.error('[Server Startup] Critical error in base stats update wrapper:', outerError);
                // 프로세스를 종료하지 않음
            });
        });
    }).catch(() => {
        console.warn('[Server Startup] Database not initialized. Skipping user updates. Will retry when database is available.');
    });

    // --- 1회성 작업들 (환경 변수로 제어) ---
    // 필요시에만 주석을 해제하여 실행하세요.
    // 서버 시작 속도를 위해 비동기로 처리 (서버 리스닝 시작 후 실행)
    
    // --- 1회성 챔피언십 점수 초기화 ---
    // await resetAllTournamentScores();
    
    // --- 1회성: 모든 유저의 리그 점수를 0으로 초기화 ---
    // await resetAllUsersLeagueScoresForNewWeek();
    
    // --- 1회성: 모든 유저의 챔피언십 점수를 0으로 초기화 ---
    // await resetAllChampionshipScoresToZero();
    
    // --- 1회성: 어제 점수가 0으로 되어있는 봇 점수 수정 (서버 시작 후 5분 지연 실행) ---
    // 서버가 안정화된 후 실행하여 크래시 방지
    // 절대 실패하지 않도록 다중 보호
    setTimeout(() => {
        (async () => {
            try {
                console.log(`[Server Startup] Fixing bot yesterday scores (delayed execution)...`);
                const scheduledTasks = await import('./scheduledTasks.js');
                if (scheduledTasks.fixBotYesterdayScores && typeof scheduledTasks.fixBotYesterdayScores === 'function') {
                    // 타임아웃 추가 (2분) - 배치 처리로 변경되어 더 오래 걸릴 수 있음
                    const timeout = new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('fixBotYesterdayScores timeout')), 120000);
                    });
                    await Promise.race([
                        scheduledTasks.fixBotYesterdayScores(),
                        timeout
                    ]);
                } else {
                    console.warn('[Server Startup] fixBotYesterdayScores function not found, skipping...');
                }
            } catch (error: any) {
                console.error('[Server Startup] Failed to fix bot yesterday scores:', error?.message || error);
                // 서버 시작을 계속 진행 (치명적 오류가 아님)
            }
        })().catch((outerError: any) => {
            // async 함수 자체가 실패한 경우
            console.error('[Server Startup] Critical error in fixBotYesterdayScores wrapper:', outerError);
            // 프로세스를 종료하지 않음
        });
    }, 5 * 60 * 1000); // 5분 지연
    
    // --- 봇 점수 관련 로직은 이미 개선되어 서버 시작 시 실행 불필요 ---
    // const { grantThreeDaysBotScores } = await import('./scheduledTasks.js');
    // await grantThreeDaysBotScores();
    // 
    // --- 모든 유저의 경쟁 상대 봇 점수 즉시 계산 및 업데이트 ---
    // console.log(`[Server Startup] Updating bot scores for all users...`);
    // const { updateBotLeagueScores } = await import('./scheduledTasks.js');
    // let botScoreUpdateCount = 0;
    // for (const user of allDbUsers) {
    //     const updatedUser = await updateBotLeagueScores(user);
    //     if (JSON.stringify(user) !== JSON.stringify(updatedUser)) {
    //         await db.updateUser(updatedUser);
    //         botScoreUpdateCount++;
    //     }
    // }
    // console.log(`[Server Startup] Bot scores update complete. ${botScoreUpdateCount} user(s) had their bot scores updated.`);

    app = express();
    
    // 포트 검증 및 설정 (port 선언은 createApp 상단에 있음)
    const portEnv = process.env.PORT;
    if (portEnv) {
        port = parseInt(portEnv, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
            console.error(`[Server] Invalid PORT environment variable: ${portEnv}. Using default port 4000.`);
            port = 4000;
        } else {
            console.log(`[Server] Using PORT from environment: ${port}`);
        }
    } else {
        port = 4000;
        console.log(`[Server] PORT not set, using default: ${port}`);
    }
    
    // Railway는 PORT 환경 변수를 자동으로 설정함
    // Railway의 경우 process.env.PORT를 사용해야 함
    console.log(`[Server] Server will listen on port: ${port}`);
    
    // 서버 리스닝 상태를 전역으로 저장 (헬스체크용) - 선언은 createApp 상단에 있음
    isServerReady = false;
    serverInstance = null;
    }

    // Railway 등 리버스 프록시 뒤에서 실제 클라이언트 IP 인식 (IP당 로그인 제한)
    if (process.env.RAILWAY_ENVIRONMENT || process.env.TRUST_PROXY === '1') {
        app.set('trust proxy', 1);
    }

    // === 중요: Express 미들웨어를 서버 리스닝 전에 설정 ===
    // 서버가 리스닝을 시작하기 전에 최소한의 미들웨어를 설정하여 요청이 처리되도록 함
    
    // 프로덕션 허용 origin 목록 (에러·raw 타임아웃 응답에도 동일 헤더 적용)
    const PRODUCTION_ALLOWED_ORIGINS = [
        process.env.FRONTEND_URL,
        'https://sudam.up.railway.app',
        'https://suadam.up.railway.app',
        ...parseCommaSeparatedOrigins(process.env.CORS_ALLOWED_ORIGINS),
    ].filter((o): o is string => typeof o === 'string' && o !== '');
    
    // CORS 헤더를 모든 응답에 먼저 붙이는 미들웨어 (preflight 및 에러 응답 대응)
    app.use((req, res, next) => {
        applyCorsHeaders(req, res, PRODUCTION_ALLOWED_ORIGINS);
        if (req.method === 'OPTIONS') {
            return res.status(204).end();
        }
        next();
    });
    
    // CORS 설정 - 프로덕션에서는 특정 origin만 허용
    const corsOptions: cors.CorsOptions = {
        origin: (origin, callback) => {
            // 개발 환경에서는 모든 origin 허용
            if (process.env.NODE_ENV !== 'production') {
                callback(null, true);
                return;
            }
            
            // 프로덕션 환경
            // origin이 없는 경우 (같은 origin에서의 요청 등) 허용
            if (!origin) {
                callback(null, true);
                return;
            }
            
            const nodeEnv = process.env.NODE_ENV as string | undefined;
            const isDevelopment = nodeEnv === 'development';
            if (isDevelopment) {
                console.log('[CORS] Request from origin:', origin);
                console.log('[CORS] FRONTEND_URL:', process.env.FRONTEND_URL || 'NOT SET');
                console.log('[CORS] Allowed origins:', PRODUCTION_ALLOWED_ORIGINS);
            }
            
            if (isCorsAllowedOrigin(origin, PRODUCTION_ALLOWED_ORIGINS)) {
                if (isDevelopment) {
                    console.log('[CORS] ✅ Origin allowed:', origin);
                }
                callback(null, true);
            } else {
                console.warn('[CORS] ❌ Origin blocked:', origin);
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        optionsSuccessStatus: 204,
        preflightContinue: false
    };
    app.use(cors(corsOptions));
    // POST 등 비동기 요청 시 브라우저 preflight(OPTIONS)가 확실히 CORS 헤더로 응답하도록
    app.options('/api/auth/login', cors(corsOptions));
    app.options('/api/auth/kakao/url', cors(corsOptions));
    // 모든 /api 경로에 대한 preflight 허용 (배포 환경에서 Failed to fetch 방지)
    app.options(/^\/api\//, cors(corsOptions));
    
    // Ignore development tooling noise such as Vite/Esbuild status pings
    // This route should be early in the middleware stack to avoid unnecessary processing
    // Only needed in development when Vite dev server is running
    if (process.env.NODE_ENV === 'development') {
        app.use('/@esbuild', (_req, res) => {
            res.status(204).end();
        });
    }
    
    app.use(express.json({ limit: '10mb' }) as any);
    
    app.use(express.urlencoded({ extended: true, limit: '10mb' }) as any);
    
    // 헬스체크 엔드포인트를 서버 리스닝 전에 등록 (즉시 응답 가능하도록)
    // Railway 헬스체크는 서버가 시작되면 즉시 통과해야 함
    // 초기 헬스체크 엔드포인트 (서버 시작 전에도 응답)
    // Railway health check를 위해 매우 빠르고 안정적으로 응답
    app.get('/api/health', async (req, res) => {
        // 타임아웃 설정 (1초 내에 응답 보장)
        const healthTimeout = setTimeout(() => {
            if (!res.headersSent) {
                res.status(200).json({
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    pid: process.pid,
                    warning: 'Health check response delayed'
                });
            }
        }, 1000);
        
        try {
            // 서버 객체가 있으면 실제 리스닝 상태 확인, 없으면 false
            const isListening = serverRef.serverInstance ? serverRef.serverInstance.listening : false;
            let kataMoveApi: { configured: boolean; host: string | null; timeoutMs: number } | undefined;
            try {
                const { getKataServerConfigSummary } = await import('./kataServerService.js');
                const k = getKataServerConfigSummary();
                kataMoveApi = {
                    configured: k.moveApiConfigured,
                    host: k.host,
                    timeoutMs: k.timeoutMs,
                };
            } catch {
                kataMoveApi = undefined;
            }
            const response = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                listening: isListening,
                ready: serverRef.isServerReady,
                pid: process.pid,
                message: isListening ? 'Server is running' : 'Server starting up',
                ...(kataMoveApi ? { kataMoveApi } : {}),
            };
            clearTimeout(healthTimeout);
            res.status(200).json(response);
        } catch (error: any) {
            // 헬스체크 자체가 실패하지 않도록 보호
            clearTimeout(healthTimeout);
            console.error('[Health] Health check error:', error);
            if (!res.headersSent) {
                res.status(200).json({
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    uptime: process.uptime(),
                    pid: process.pid,
                    error: 'Health check handler error (non-fatal)'
                });
            }
        }
    });

    /** 관리자 부하 모니터 — 파일 하단보다 먼저 등록해 라우트 누락·호환 포트(4000) 이슈를 피함 */
    const handleAdminServerMetrics: express.RequestHandler = async (req, res) => {
        try {
            const userId = String(req.query.userId || '').trim();
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized', message: 'userId가 필요합니다.' });
            }
            const adminUser = await db.getUser(userId, { includeEquipment: false, includeInventory: false });
            if (!adminUser || !adminUser.isAdmin) {
                return res.status(403).json({ error: 'Forbidden: Admin access required' });
            }
            const volatileOnline = Object.keys(volatileState.userConnections).length;
            const probeKata = String(req.query.probeKata || '') === '1';
            const payload = await buildAdminServerMetricsPayload(volatileOnline, { probeKataServer: probeKata });
            res.json(payload);
        } catch (error: any) {
            console.error('[Admin] server-metrics:', error);
            res.status(500).json({ error: error.message });
        }
    };
    app.get('/api/admin/server-metrics', handleAdminServerMetrics);
    app.get('/admin/server-metrics', handleAdminServerMetrics);
    
    console.log('[Server] Health check endpoint registered (before server listen)');
    
    if (!options?.testMode) {
    const listenPort = (typeof port !== 'undefined' && port != null) ? port : (Number(process.env.PORT) || 4000);
    // 서버를 생성하고 리스닝 시작 (Express 미들웨어가 이미 설정됨)
    const server = http.createServer((req, res) => {
        // Health check는 매우 빠르게 처리 (Railway health check 대응)
        if (req.url === '/api/health' || req.url === '/') {
            // Health check는 타임아웃 없이 즉시 처리
            app(req, res);
            return;
        }
        
        // 타임아웃 설정 (2분으로 증가 - 대용량 데이터 처리 시간 고려)
        req.setTimeout(120000, () => {
            if (!res.headersSent) {
                applyCorsHeaders(req as express.Request, res as express.Response, PRODUCTION_ALLOWED_ORIGINS);
                res.writeHead(408, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Request timeout' }));
            }
        });
        
        app(req, res);
    });
    
    // 서버 타임아웃 설정 (1000명 동시 접속 대응)
    server.timeout = 120000; // 2분으로 증가 (1000명 처리 시간 고려)
    server.keepAliveTimeout = 120000; // 2분으로 증가
    server.headersTimeout = 130000; // 2분 10초로 증가
    
    // Railway health check를 위한 루트 경로 추가 (Railway는 기본적으로 / 경로를 체크)
    app.get('/', (req, res) => {
        // Health check와 동일한 응답
        try {
            const response = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                listening: serverRef.serverInstance?.listening ?? false,
                ready: serverRef.isServerReady,
                pid: process.pid,
                database: (dbInitializedRef?.value ?? false) ? 'connected' : 'initializing'
            };
            res.status(200).json(response);
        } catch (error: any) {
            res.status(200).json({
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                pid: process.pid
            });
        }
    });
    
    // 서버 객체를 전역 변수에 저장 (헬스체크에서 사용)
    serverInstance = server;
    serverRef.serverInstance = server;
    
    // 서버 리스닝 시작 (Express 미들웨어가 이미 설정되어 있음)
    process.stderr.write(`[Server] Bootstrap: about to listen port=${listenPort}\n`);
    console.log('[Server] Starting server listen...');
    server.listen(listenPort, '0.0.0.0', () => {
        console.log(`[Server] ========================================`);
        console.log(`[Server] Server listening on port ${listenPort}`);
        console.log(`[Server] Process PID: ${process.pid}`);
        console.log(`[Server] Health check endpoint is available at /api/health`);
        console.log(`[Server] ========================================`);
        
        // 서버 준비 상태 설정
        isServerReady = true;
        serverRef.isServerReady = true;
        
        // 헬스체크 엔드포인트는 이미 등록되어 있고, serverInstance를 통해 리스닝 상태를 확인함
        // Railway health check를 위해 매우 빠르고 안정적으로 응답
        // (중복 등록 방지: 이미 위에서 등록됨)
    });

    // Railway/런타임에서 헬스체크 포트를 `EXPOSE`(예: 4000)로 타는 경우가 있어,
    // 서버가 실제로는 다른 PORT(예: 8080)로 리스닝 중이면 헬스체크가 "서비스를 찾지 못함"으로 실패할 수 있습니다.
    // 그래서 PORT와 4000이 다를 때, 4000에서도 /api/health (및 /)만 빠르게 응답하도록 보완합니다.
    if (listenPort !== 4000) {
        const healthCompatPort = 4000;
        const healthCompatServer = http.createServer((req, res) => {
            const url = req.url || '';
            const pathOnly = url.split('?')[0] || '';
            // 메인 앱이 다른 PORT일 때, 4000으로 오는 /api/* 는 전부 Express로 넘김 (관리자 API·프록시 URL 대응)
            if (pathOnly === '/' || pathOnly === '/api' || pathOnly.startsWith('/api/')) {
                app(req, res);
                return;
            }
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ message: 'Not found' }));
        });
        healthCompatServer.on('error', (err: any) => {
            // 로컬에서 4000이 이미 사용 중이면 헬스 호환 서버만 스킵
            if (err?.code === 'EADDRINUSE') return;
            console.error('[Server] Health compat server error:', err);
        });
        healthCompatServer.listen(healthCompatPort, '0.0.0.0', () => {
            console.log(`[Server] Health compat endpoint is available at :${healthCompatPort}/api/health`);
        });
    }

    // 전역 에러 핸들러 미들웨어 (모든 라우트 이후에 추가)
    // 이 핸들러는 모든 라우트 정의 후에 추가됩니다

    // --- Constants ---
    const DISCONNECT_TIMER_S = 90;

    // 나머지 초기화 작업은 서버 리스닝 후 비동기로 처리
    // 서버가 이미 리스닝 중이므로 헬스체크는 통과할 수 있음
    setImmediate(() => {
        // 상세 로그 출력
        const initialMemUsage = process.memoryUsage();
        const initialMemMB = {
            rss: Math.round(initialMemUsage.rss / 1024 / 1024),
            heapTotal: Math.round(initialMemUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(initialMemUsage.heapUsed / 1024 / 1024),
            external: Math.round(initialMemUsage.external / 1024 / 1024)
        };
        console.log(`[Server] Initial memory usage: RSS=${initialMemMB.rss}MB, Heap=${initialMemMB.heapUsed}/${initialMemMB.heapTotal}MB, External=${initialMemMB.external}MB`);
        console.log(`[Server] Node version: ${process.version}`);
        console.log(`[Server] Railway environment: ${process.env.RAILWAY_ENVIRONMENT || 'not set'}`);
        console.log('[Server] Server is ready and accepting connections');
        
        // Keep-alive: 주기적으로 로그를 출력하여 프로세스가 살아있음을 확인
        // Railway가 프로세스를 종료하지 않도록 하기 위함 (더 자주 출력)
        setInterval(() => {
            const memUsage = process.memoryUsage();
            const memMB = {
                rss: Math.round(memUsage.rss / 1024 / 1024),
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
            };
            console.log(`[Server] Keep-alive: Server is running (uptime: ${Math.round(process.uptime())}s, PID: ${process.pid}, Memory: ${memMB.rss}MB RSS, ${memMB.heapUsed}/${memMB.heapTotal}MB Heap)`);
        }, 60000); // 1분마다 (더 자주 출력하여 Railway가 프로세스를 종료하지 않도록)
        
        // WebSocket 서버 생성 (실패해도 HTTP 서버는 계속 실행)
        try {
            createWebSocketServer(server);
            console.log('[Server] WebSocket server initialization attempted');
        } catch (wsError: any) {
            console.error('[Server] Failed to create WebSocket server:', wsError);
            console.error('[Server] HTTP server will continue without WebSocket support');
            // WebSocket 서버 생성 실패해도 HTTP 서버는 계속 실행
        }
        startServerLoadMonitoring();
        
        // 무거운 초기화 작업은 비동기로 처리 (서버 리스닝 후)
        // NOTE: Railway 멀티서비스 구조에서는 KataGo를 별도 서비스로 운영하므로
        // 백엔드에서 KataGo 로컬 프로세스를 사전 초기화하지 않습니다.
    });

    // 서버 에러 핸들러 등록 (리스닝 전에 등록)
    server.on('error', (error: NodeJS.ErrnoException) => {
        const errorInfo = {
            timestamp: new Date().toISOString(),
            type: 'serverError',
            error: error,
            errorCode: error.code,
            errorMessage: error.message,
            errorStack: error.stack,
            port: listenPort,
            pid: process.pid,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            railwayEnv: process.env.RAILWAY_ENVIRONMENT || 'not set'
        };
        
        // 상세한 에러 로깅
        console.error('[Server] ========== SERVER ERROR ==========');
        console.error('[Server] Timestamp:', errorInfo.timestamp);
        console.error('[Server] PID:', errorInfo.pid);
        console.error('[Server] Port:', errorInfo.port);
        console.error('[Server] Error code:', errorInfo.errorCode);
        console.error('[Server] Error message:', errorInfo.errorMessage);
        console.error('[Server] Error stack:', errorInfo.errorStack);
        console.error('[Server] Memory:', JSON.stringify(errorInfo.memory));
        console.error('[Server] Full error info:', JSON.stringify(errorInfo, null, 2));
        console.error('[Server] ===================================');
        
        // stderr로도 직접 출력 (Railway 로그에 확실히 기록)
        process.stderr.write(`\n[SERVER ERROR] at ${errorInfo.timestamp}\n`);
        process.stderr.write(`Port: ${errorInfo.port}\n`);
        process.stderr.write(`Error: ${errorInfo.errorCode} - ${errorInfo.errorMessage}\n`);
        if (errorInfo.errorStack) {
            process.stderr.write(`Stack: ${errorInfo.errorStack}\n`);
        }
        process.stderr.write(`Memory: ${JSON.stringify(errorInfo.memory)}\n\n`);
        
        if (error.code === 'EADDRINUSE') {
            console.error(`[Server] Port ${listenPort} is already in use. Please stop the process using this port or use a different port.`);
            console.error(`[Server] To find and kill the process: netstat -ano | findstr ":${listenPort}"`);
            process.stderr.write(`[SERVER ERROR] Port ${listenPort} is already in use\n`);
            // Railway 환경에서는 포트 충돌 시에도 프로세스를 종료하지 않음
            // Railway가 자동으로 재시작하는 것을 방지
            if (!process.env.RAILWAY_ENVIRONMENT) {
                process.exit(1);
            }
        } else {
            console.error('[Server] Server error:', error);
            console.error('[Server] Server error code:', error.code);
            console.error('[Server] Server error message:', error.message);
            // Railway 환경에서는 즉시 종료하지 않고 로그만 남김
            // 서버가 계속 실행되도록 보장
            if (!process.env.RAILWAY_ENVIRONMENT) {
                process.exit(1);
            }
        }
    });
    }

    // Serve static files from public directory with optimized caching
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const publicPath = path.join(__dirname, '..', 'public');
    
    // 이미지 파일 서빙 (1년 캐싱, 압축 지원)
    app.use('/images', express.static(path.join(publicPath, 'images'), {
        maxAge: '1y',
        etag: true,
        lastModified: true,
        setHeaders: (res, filePath) => {
            // 이미지 파일에 대한 캐싱 헤더
            if (filePath.match(/\.(png|jpg|jpeg|gif|ico|svg|webp)$/i)) {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
                res.setHeader('Vary', 'Accept-Encoding');
            }
        }
    }));
    
    // 사운드 파일 서빙 (1년 캐싱)
    // NOTE: 디렉토리명은 `public/sounds` — Vite가 public을 dist 루트로 복사할 때 URL이 /sounds/*와 일치해야
    // 정적 프론트(serve -s, nginx try_files)에서 SPA 폴백 HTML이 아닌 실제 mp3가 나간다.
    app.use('/sounds', express.static(path.join(publicPath, 'sounds'), {
        maxAge: '1y',
        etag: true,
        lastModified: true,
        setHeaders: (res) => {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }));
    
    // Serve frontend build files (integrated deployment only)
    // Railway 멀티서비스(Frontend/Backend 분리) 구조에서는 기본적으로 비활성화하는 것이 안전합니다.
    // 통합 배포가 필요하면 ENABLE_FRONTEND_SERVING=true 를 명시적으로 설정하세요.
    const defaultFrontendServing = process.env.NODE_ENV !== 'production';
    const enableFrontendServing = process.env.ENABLE_FRONTEND_SERVING
        ? process.env.ENABLE_FRONTEND_SERVING === 'true'
        : defaultFrontendServing;
    console.log(`[Server] ENABLE_FRONTEND_SERVING: ${process.env.ENABLE_FRONTEND_SERVING || `not set (defaulting to ${defaultFrontendServing ? 'true' : 'false'})`}`);
    console.log(`[Server] Frontend serving: ${enableFrontendServing ? 'ENABLED' : 'DISABLED'}`);
    
    if (enableFrontendServing) {
        const distPath = path.join(__dirname, '..', 'dist');
        
        // dist 디렉토리 존재 여부 확인 및 로깅
        const distExists = fs.existsSync(distPath);
        if (!distExists) {
            console.error(`[Server] ERROR: dist directory not found at ${distPath}. Frontend files may not be available.`);
            console.error(`[Server] This will cause 502 errors. Please ensure the frontend is built and dist/ directory exists.`);
        } else {
            const distFiles = fs.readdirSync(distPath);
            console.log(`[Server] ✅ dist directory found at ${distPath} with ${distFiles.length} files/directories`);
            
            // index.html 존재 여부 확인
            const indexPath = path.join(distPath, 'index.html');
            if (fs.existsSync(indexPath)) {
                console.log(`[Server] ✅ index.html found - frontend can be served`);
            } else {
                console.error(`[Server] ERROR: index.html not found in dist directory. Frontend cannot be served.`);
            }
        }
        
        // API 경로는 정적 파일 서빙에서 제외
        app.use((req, res, next) => {
            // API, WebSocket, 이미지, 사운드 경로는 건너뛰기
            if (req.path.startsWith('/api') || 
                req.path.startsWith('/ws') || 
                req.path.startsWith('/socket.io') ||
                req.path.startsWith('/images') ||
                req.path.startsWith('/sounds')) {
                return next();
            }
            // 정적 파일 서빙으로 전달
            express.static(distPath, {
                maxAge: '1h', // Cache HTML for 1 hour (shorter for SPA updates)
                etag: true,
                lastModified: true,
                index: false, // Don't serve index.html for directory requests
                setHeaders: (res, filePath) => {
                    // Set proper MIME types for JS modules
                    if (filePath.endsWith('.js')) {
                        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                    }
                },
                // 404 에러를 조용히 처리 (SPA fallback으로 넘어가도록)
                fallthrough: true
            })(req, res, next);
        });
    } else {
        console.log('[Server] Frontend serving is disabled. Frontend should be served by a separate service.');
    }
    
      // 응답 압축 미들웨어 (네트워크 전송량 감소)
      app.use(compression({
        filter: (req, res) => {
            // JSON 응답과 텍스트만 압축 (이미지 등은 제외)
            if (req.headers['x-no-compression']) {
                return false;
            }
            return compression.filter(req, res);
        },
        level: 6, // 압축 레벨 (1-9, 6이 속도와 압축률의 균형)
        threshold: 1024, // 1KB 이상만 압축
    }));

    // WebSocket 서버 생성은 server.listen() 콜백 내부에서 처리됨

    // Graceful shutdown 함수
    const gracefulShutdown = async (server: http.Server) => {
        console.log('[Server] Initiating graceful shutdown...');
        isServerReady = false;
        try {
            const { broadcastServerRestarting } = await import('./socket.js');
            broadcastServerRestarting('maintenance');
            await new Promise((r) => setTimeout(r, 1200));
        } catch {
            /* ignore */
        }

        // 30초 내에 종료되지 않으면 강제 종료
        const shutdownTimeout = setTimeout(() => {
            console.error('[Server] Graceful shutdown timeout. Forcing exit...');
            process.exit(1);
        }, 30000);
        
        server.close(() => {
            clearTimeout(shutdownTimeout);
            console.log('[Server] HTTP server closed.');
            process.exit(0);
        });
        
        // WebSocket 서버 종료
        try {
            const socketModule = await import('./socket.js') as any;
            if (socketModule.getWebSocketServer) {
                const wss = socketModule.getWebSocketServer();
                if (wss) {
                    wss.close(() => {
                        console.log('[Server] WebSocket server closed.');
                    });
                }
            }
        } catch (error) {
            console.error('[Server] Error closing WebSocket server:', error);
        }
    };

    // SIGTERM, SIGINT 시그널 처리 (Railway에서 컨테이너 종료 시)
    process.on('SIGTERM', () => {
        console.log('[Server] SIGTERM received. Initiating graceful shutdown...');
        const s = serverRef.serverInstance;
        if (s) {
            gracefulShutdown(s).catch(err => {
                console.error('[Server] Error during graceful shutdown:', err);
                process.exit(1);
            });
        } else {
            process.exit(0);
        }
    });

    process.on('SIGINT', () => {
        console.log('[Server] SIGINT received. Initiating graceful shutdown...');
        const s = serverRef.serverInstance;
        if (s) {
            gracefulShutdown(s).catch(err => {
                console.error('[Server] Error during graceful shutdown:', err);
                process.exit(1);
            });
        } else {
            process.exit(0);
        }
    });


    const processActiveTournamentSimulations = async () => {
        if (isProcessingTournamentTick) return;
        const activeTournaments = volatileState.activeTournaments;
        if (!activeTournaments || Object.keys(activeTournaments).length === 0) {
            return;
        }

        isProcessingTournamentTick = true;
        try {
            // 각 토너먼트를 독립적으로 병렬 처리 (PVE 게임처럼)
            const tournamentEntries = Object.entries(activeTournaments);
            
            // 각 토너먼트를 독립적으로 처리하는 함수
            const processTournament = async ([userId, activeState]: [string, types.TournamentState]) => {
                try {
                    // 캐시를 사용하여 DB 조회 최소화
                    const { getCachedUser, updateUserCache } = await import('./gameCache.js');
                    const user = await getCachedUser(userId);
                    if (!user) {
                        delete activeTournaments[userId];
                        return;
                    }

                    const tournamentState = getTournamentStateByType(user, activeState.type);
                    if (!tournamentState || tournamentState.status !== 'round_in_progress') {
                        delete activeTournaments[userId];
                        return;
                    }

                    const advanced = await tournamentService.advanceSimulation(tournamentState, user);
                    if (!advanced) {
                        return;
                    }

                    // Keep volatile state reference updated
                    activeTournaments[userId] = tournamentState;

                    // 사용자 캐시 업데이트
                    updateUserCache(user);
                    // DB 저장은 비동기로 처리하여 응답 지연 최소화
                    db.updateUser(user).catch(err => {
                        console.error(`[TournamentTicker] Failed to save user ${userId}:`, err);
                    });

                    const sanitizedUser = JSON.parse(JSON.stringify(user));
                    broadcast({ type: 'USER_UPDATE', payload: { [user.id]: sanitizedUser } });

                    if (tournamentState.status !== 'round_in_progress') {
                        delete activeTournaments[userId];
                    }
                } catch (error) {
                    console.error(`[TournamentTicker] Failed to advance simulation for user ${userId}`, error);
                }
            };

            // 모든 토너먼트를 병렬로 처리 (각 토너먼트는 독립적)
            await Promise.all(tournamentEntries.map(processTournament));
        } catch (error) {
            console.error('[TournamentTicker] Failed to process tournament simulations', error);
        } finally {
            isProcessingTournamentTick = false;
        }
    };

    // Tournament simulation ticker - 클라이언트에서 실행하도록 변경되어 비활성화
    // const scheduleTournamentTick = () => {
    //     const startTime = Date.now();
    //     processActiveTournamentSimulations().finally(() => {
    //         const elapsed = Date.now() - startTime;
    //         // 다음 틱은 정확히 1초 후에 실행 (실행 시간 보정)
    //         const nextDelay = Math.max(0, 1000 - elapsed);
    //         setTimeout(scheduleTournamentTick, nextDelay);
    //     });
    // };
    // scheduleTournamentTick();

    const scheduleMainLoop = (delay = 1000) => {
        // 절대 실패하지 않도록 보호
        try {
            setTimeout(() => {
                // setTimeout 내부도 보호
                (async () => {
                    try {
                        // DB 초기화가 지연돼도 인메모리/캐시 기반 게임 루프는 계속 돌린다.
                        // (주사위/놀이 모드의 애니메이션→턴 전환이 멈추는 현상 방지)
                        const isDbReadyForLoop = !!(dbInitializedRef?.value ?? false);
                        if (!isDbReadyForLoop) {
                            console.warn('[MainLoop] Database not initialized yet; running loop in degraded mode.');
                        }
                        
                        if (isProcessingMainLoop) {
                            scheduleMainLoop(Math.min(delay * 2, 5000));
                            return;
                        }

                        isProcessingMainLoop = true;

                        // Prisma 엔진 연결 확인 ("Engine is not yet connected" 방지)
                        try {
                            const prismaClient = await import('./prismaClient.js');
                            if (prismaClient.ensurePrismaConnected && !(await prismaClient.ensurePrismaConnected())) {
                                const now = Date.now();
                                if (now - lastPrismaNotReadyLogAt >= 60_000) {
                                    lastPrismaNotReadyLogAt = now;
                                    console.warn('[MainLoop] Prisma engine not ready, skipping this cycle (will retry reconnect every 5s, log at most once/min)...');
                                }
                                isProcessingMainLoop = false;
                                scheduleMainLoop(5000);
                                return;
                            }
                        } catch (connErr: any) {
                            console.warn('[MainLoop] ensurePrismaConnected failed:', connErr?.message);
                            isProcessingMainLoop = false;
                            scheduleMainLoop(5000);
                            return;
                        }
                        
                        // 첫 실행 확인 (전역 플래그 사용)
                        const isFirstRun = !hasCompletedFirstRun;
                        if (isFirstRun) {
                            console.log('[MainLoop] ========== FIRST RUN STARTING ==========');
                            console.log('[MainLoop] Database initialized:', dbInitializedRef?.value ?? false);
                            console.log('[MainLoop] Memory:', JSON.stringify(process.memoryUsage()));
                        }
                        
                        try {
                            const now = Date.now();
                            
                            // 첫 실행에서는 최소한의 작업만 수행
                            if (isFirstRun) {
                                console.log('[MainLoop] First run: Skipping all database queries for fast startup...');
                                // 첫 실행에서는 모든 데이터베이스 쿼리를 완전히 스킵하여 서버 시작 속도 최대화
                                // 게임은 필요할 때 개별적으로 로드되므로 전체 로드 불필요
                                // 사용자도 필요할 때 로드되므로 첫 실행에서 로드 불필요
                                console.log('[MainLoop] ✅ First run completed: Skipped all heavy operations');
                                console.log('[MainLoop] =========================================');
                                // 첫 실행 완료 플래그 설정
                                hasCompletedFirstRun = true;
                                // 첫 실행 완료 후 다음 루프로 진행
                                isProcessingMainLoop = false;
                                scheduleMainLoop(10000); // 10초 후 정상 루프 시작 (서버 부하 감소)
                                return;
                            }
                
                // 랭킹전 매칭 처리 (1초마다) - 에러 핸들링 추가
                if (volatileState.rankedMatchingQueue) {
                    try {
                        const { tryMatchPlayers } = await import('./actions/socialActions.js');
                        for (const lobbyType of ['strategic', 'playful'] as const) {
                            if (volatileState.rankedMatchingQueue[lobbyType] && Object.keys(volatileState.rankedMatchingQueue[lobbyType]).length >= 2) {
                                try {
                                    await tryMatchPlayers(volatileState, lobbyType);
                                } catch (matchError: any) {
                                    console.warn(`[MainLoop] Error matching players for ${lobbyType}:`, matchError?.message);
                                }
                            }
                        }
                    } catch (matchingError: any) {
                        console.error('[MainLoop] Error in ranked matching:', matchingError?.message);
                        console.error('[MainLoop] Matching error stack:', matchingError?.stack);
                    }
                }

            // --- START NEW OFFLINE AP REGEN LOGIC ---
            if (now - lastOfflineRegenAt >= OFFLINE_REGEN_INTERVAL_MS) {
                try {
                    // 메모리 가드: RSS가 임계치를 넘으면 해당 회차 스킵 (메모리 스파이크 방지)
                    const memMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
                    if (memMB > OFFLINE_REGEN_SKIP_RSS_MB) {
                        if (memMB % 100 < 10) { // 로그 스팸 방지
                            console.warn(`[MainLoop] Offline regen skipped: RSS ${memMB}MB > ${OFFLINE_REGEN_SKIP_RSS_MB}MB`);
                        }
                        lastOfflineRegenAt = now;
                        // fall through - skip to next MainLoop section
                    } else {
                    // Railway 최적화: equipment/inventory 없이 사용자 목록만 로드 (타임아웃 추가)
                    const { listUsers } = await import('./prisma/userService.js');
                    const usersTimeout = new Promise<types.User[]>((resolve) => {
                        setTimeout(() => resolve([]), 5000); // 5초 타임아웃
                    });
                    const allUsers = await Promise.race([
                        listUsers({ includeEquipment: false, includeInventory: false }),
                        usersTimeout
                    ]);
                    
                    if (allUsers.length === 0) {
                        console.warn('[MainLoop] No users loaded for offline regen, skipping...');
                        lastOfflineRegenAt = now;
                        // fall through
                    } else {
                    // 주기당 최대 N명만 처리 (메모리·DB 부하 분산)
                    const usersToProcess = allUsers.slice(0, OFFLINE_REGEN_MAX_USERS_PER_CYCLE);
                    
                    // 매일 0시에 토너먼트 상태 자동 리셋 확인 (processDailyQuestReset에서 처리되지만, 
                    // 메인 루프에서도 날짜 변경 시 체크하여 오프라인 사용자도 리셋되도록 보장)
                    const { getKSTHours, getKSTMinutes } = await import('../utils/timeUtils.js');
                    const kstHoursForReset = getKSTHours(now);
                    const kstMinutesForReset = getKSTMinutes(now);
                    const isMidnightForReset = kstHoursForReset === 0 && kstMinutesForReset < 5;
                    
                    for (let i = 0; i < usersToProcess.length; i += OFFLINE_REGEN_BATCH_SIZE) {
                        const batch = usersToProcess.slice(i, i + OFFLINE_REGEN_BATCH_SIZE);
                        await Promise.allSettled(batch.map(async (user) => {
                            try {
                                let updatedUser = user;
                                
                                // 매일 0시에만 토너먼트 상태 리셋 (로그인하지 않은 사용자도 포함)
                                if (isMidnightForReset) {
                                    updatedUser = await resetAndGenerateQuests(updatedUser);
                                }
                                
                                updatedUser = await regenerateActionPoints(updatedUser);
                                updatedUser = processSinglePlayerMissions(updatedUser);
                                
                                // 봇 점수 업데이트 제거됨 - 던전 시스템으로 변경
                                // const { updateBotLeagueScores } = await import('./scheduledTasks.js');
                                // updatedUser = await updateBotLeagueScores(updatedUser);
                                
                                // 최적화: 간단한 필드 비교로 변경 (JSON.stringify 대신)
                                const hasChanges = user.actionPoints !== updatedUser.actionPoints ||
                                    user.gold !== updatedUser.gold ||
                                    user.singlePlayerMissions !== updatedUser.singlePlayerMissions;
                                    // user.weeklyCompetitors 제거됨 - 던전 시스템으로 변경
                                if (hasChanges) {
                                    await db.updateUser(updatedUser);
                                }
                            } catch (userError: any) {
                                // 개별 사용자 처리 실패는 조용히 무시 (다음 사용자 계속 처리)
                                console.warn(`[MainLoop] Failed to process user ${user.id} for offline regen:`, userError?.message);
                            }
                        }));
                    }

                    lastOfflineRegenAt = now;
                    } // end else (allUsers.length > 0)
                    } // end else (mem check)
                } catch (regenError: any) {
                    console.error('[MainLoop] Error in offline regen logic:', regenError?.message || regenError);
                    // 오프라인 리젠 실패해도 서버는 계속 실행
                    lastOfflineRegenAt = now; // 다음 시도 방지
                }
            }
            // --- END NEW OFFLINE AP REGEN LOGIC ---

            // 캐시 정리 (주기적으로 실행) - 에러 핸들링 추가
            try {
                const { cleanupExpiredCache } = await import('./gameCache.js');
                cleanupExpiredCache();
            } catch (cacheError: any) {
                console.error('[MainLoop] Error in cache cleanup:', cacheError?.message);
            }
            
            // 만료된 negotiation 정리 - 에러 핸들링 추가
            try {
                cleanupExpiredNegotiations(volatileState, now);
            } catch (negError: any) {
                console.error('[MainLoop] Error in negotiation cleanup:', negError?.message);
            }
            
            // 만료된 메일 정리 (5일 지난 메일 자동 삭제)
            if (now - (lastDailyTaskCheckAt || 0) >= DAILY_TASK_CHECK_INTERVAL_MS) {
                const { deleteExpiredMails } = await import('./prisma/mailRepository.js');
                try {
                    const deletedCount = await deleteExpiredMails();
                    if (deletedCount > 0) {
                        console.log(`[MainLoop] Deleted ${deletedCount} expired mails`);
                    }
                } catch (error) {
                    console.error('[MainLoop] Error deleting expired mails:', error);
                }
            }
            
            // 메모리 사용량 모니터링 (Railway 환경에서만, 5분마다)
            if (process.env.RAILWAY_ENVIRONMENT) {
                const memCheckInterval = 5 * 60 * 1000; // 5분
                const lastMemCheck = (global as any).lastMemCheck || 0;
                if (now - lastMemCheck >= memCheckInterval) {
                    (global as any).lastMemCheck = now;
                    const memUsage = process.memoryUsage();
                    const memUsageMB = {
                        rss: Math.round(memUsage.rss / 1024 / 1024),
                        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                        external: Math.round(memUsage.external / 1024 / 1024)
                    };
                    console.log(`[Memory] RSS: ${memUsageMB.rss}MB, Heap: ${memUsageMB.heapUsed}/${memUsageMB.heapTotal}MB, External: ${memUsageMB.external}MB`);
                    
                    // Railway 메모리 관리: 32GB 플랜은 스케일된 임계치 (RAILWAY_REPLICA_MEMORY_LIMIT_MB=32768 권장)
                    const memLimitMb = _replicaLimitMb > 0 ? _replicaLimitMb : 512;
                    const MEM_WARN = memLimitMb > 4000 ? Math.floor(memLimitMb * 0.10) : 200;
                    const MEM_CLEANUP = memLimitMb > 4000 ? Math.floor(memLimitMb * 0.12) : 250;
                    const MEM_AGGRESSIVE = memLimitMb > 4000 ? Math.floor(memLimitMb * 0.15) : 300;
                    const MEM_CLEAR_ALL = memLimitMb > 4000 ? Math.floor(memLimitMb * 0.20) : 350;
                    const MEM_EXIT = memLimitMb > 4000 ? Math.floor(memLimitMb * 0.25) : MEMORY_EXIT_RSS_MB_SMALL;
                    if (memUsageMB.rss > MEM_WARN) {
                        console.warn(`[Memory] High memory usage detected: ${memUsageMB.rss}MB RSS`);
                        
                        // 메모리 사용량이 250MB를 초과하면 강제 캐시 정리
                        if (memUsageMB.rss > MEM_CLEANUP) {
                            console.warn(`[Memory] Forcing aggressive cache cleanup due to high memory usage (${memUsageMB.rss}MB)`);
                            try {
                                const { cleanupExpiredCache, clearAllCache } = await import('./gameCache.js');
                                // 먼저 만료된 캐시 정리
                                cleanupExpiredCache();
                                
                                // 메모리가 여전히 높으면 더 적극적으로 정리
                                if (memUsageMB.rss > MEM_AGGRESSIVE) {
                                    console.warn(`[Memory] Very high memory usage (${memUsageMB.rss}MB). Performing aggressive cache cleanup.`);
                                    try {
                                        const { aggressiveCacheCleanup, clearAllCache } = await import('./gameCache.js');
                                        // 350MB 이상이면 모든 캐시 클리어
                                        if (memUsageMB.rss > MEM_CLEAR_ALL) {
                                            clearAllCache();
                                        } else {
                                            // 300-350MB 사이면 적극적인 정리만 수행
                                            aggressiveCacheCleanup();
                                        }
                                    } catch (cleanupError: any) {
                                        console.error('[Memory] Failed to perform aggressive cleanup:', cleanupError?.message);
                                    }
                                }
                                
                                // 추가 메모리 정리: 가비지 컬렉션 힌트
                                if (global.gc) {
                                    global.gc();
                                    console.log('[Memory] Manual garbage collection triggered');
                                    
                                    // GC 후 메모리 재확인
                                    const memAfterGC = process.memoryUsage();
                                    const memAfterGCMB = Math.round(memAfterGC.rss / 1024 / 1024);
                                    console.log(`[Memory] After GC: ${memAfterGCMB}MB RSS (reduced by ${memUsageMB.rss - memAfterGCMB}MB)`);
                                }
                            } catch (cleanupError: any) {
                                console.error('[Memory] Failed to cleanup cache:', cleanupError?.message);
                            }
                        }
                        
                        // RSS가 임계치 초과 시: 접속자에게 WS 안내 → 짧은 유예 후 종료 (Railway 재시작)
                        if (memUsageMB.rss > MEM_EXIT) {
                            if (pendingMemoryCriticalExit) {
                                // 이미 종료 예약됨
                            } else {
                                pendingMemoryCriticalExit = true;
                                console.error(`[Memory] CRITICAL: Memory usage too high (${memUsageMB.rss}MB). Scheduling restart after client notice.`);
                                process.stderr.write(`[CRITICAL] Memory too high (${memUsageMB.rss}MB) - scheduling restart\n`);
                                try {
                                    if (global.gc) {
                                        global.gc();
                                    }
                                } catch {
                                    // ignore
                                }
                                void (async () => {
                                    try {
                                        const { broadcastServerRestarting } = await import('./socket.js');
                                        broadcastServerRestarting('memory');
                                    } catch (e) {
                                        console.warn('[Memory] broadcastServerRestarting failed:', (e as Error)?.message);
                                    }
                                    // 클라이언트가 토스트를 받고 재연결 준비할 시간
                                    await new Promise((r) => setTimeout(r, 2800));
                                    try {
                                        if (global.gc) global.gc();
                                    } catch {
                                        /* ignore */
                                    }
                                    process.exit(1);
                                })();
                            }
                        }
                    }
                }
            }

            // 고아 게임 정리: 온라인 0명일 때 주기적으로 실행 (AI/오류 대국이 DB에 쌓이는 것 방지)
            const onlineCount = Object.keys(volatileState.userConnections).length;
            if (onlineCount === 0 && now - lastOrphanedGameCleanupAt >= ORPHANED_GAME_CLEANUP_INTERVAL_MS) {
                lastOrphanedGameCleanupAt = now;
                try {
                    const cleaned = await db.cleanupOrphanedGamesInDb();
                    if (cleaned > 0) {
                        const { clearAllCache } = await import('./gameCache.js');
                        clearAllCache();
                        console.log(`[MainLoop] No players online: cleaned ${cleaned} orphaned games from DB`);
                    }
                } catch (cleanupErr: any) {
                    console.warn('[MainLoop] Orphaned game cleanup failed:', cleanupErr?.message);
                }
            }

            // 게임 로드에 타임아웃 추가 (첫 실행: 30초, 이후: 10초)
            // 백오프 로직: 타임아웃이 발생하면 일정 시간 동안 스킵
            // 성능 최적화: 게임 목록을 일정 간격으로만 로드 (10초마다)
            let activeGames: types.LiveGameSession[] = [];
            const timeSinceLastTimeout = now - lastGetAllActiveGamesTimeout;
            const timeSinceLastSuccess = now - lastGetAllActiveGamesSuccess;
            const shouldSkipDueToBackoff = lastGetAllActiveGamesTimeout > 0 && timeSinceLastTimeout < GET_ALL_ACTIVE_GAMES_BACKOFF_MS;
            const shouldSkipDueToInterval = !isFirstRun && timeSinceLastSuccess < GET_ALL_ACTIVE_GAMES_INTERVAL_MS;
            
            if (shouldSkipDueToBackoff) {
                // 백오프 중: DB 조회는 스킵하되 캐시된 게임으로 updateGameStates 계속 수행 (진행 중인 게임 유지)
                const { getAllCachedGames } = await import('./gameCache.js');
                activeGames = getAllCachedGames();
            } else if (shouldSkipDueToInterval) {
                // 간격 제한: 캐시에서 게임 로드 시도
                const { getAllCachedGames } = await import('./gameCache.js');
                activeGames = getAllCachedGames();
                if (activeGames.length === 0) {
                    // 캐시가 비어있으면 강제로 로드 (첫 실행 후). 로그는 30초마다만 출력 (스팸 방지)
                    const lastLog = (global as any).__mainLoopCacheEmptyLog ?? 0;
                    if (Date.now() - lastLog > 30000) {
                        console.log('[MainLoop] Cache empty, forcing game load with timeout...');
                        (global as any).__mainLoopCacheEmptyLog = Date.now();
                    }
                    try {
                        activeGames = await db.getAllActiveGamesChunked();
                        if (activeGames.length > 0) {
                            lastGetAllActiveGamesSuccess = now;
                        }
                    } catch (error: any) {
                        console.error('[MainLoop] Forced game load failed:', error?.message || error);
                        activeGames = [];
                    }
                } else {
                    // 캐시에서 로드 성공, DB 쿼리 스킵
                    // console.log(`[MainLoop] Using cached games (${activeGames.length} games, ${Math.round(timeSinceLastSuccess / 1000)}s since last DB load)`);
                }
            } else {
                // 첫 실행에서는 DB 쿼리를 완전히 스킵하고 캐시만 사용
                if (isFirstRun) {
                    console.log('[MainLoop] First run: Skipping DB query, using cache only...');
                    const { getAllCachedGames } = await import('./gameCache.js');
                    activeGames = getAllCachedGames();
                    if (activeGames.length === 0) {
                        console.log('[MainLoop] First run: Cache is empty, will load from DB on next run');
                        // 첫 실행에서는 빈 배열 반환 (다음 루프에서 로드)
                    } else {
                        console.log(`[MainLoop] First run: Using ${activeGames.length} cached games`);
                    }
                } else {
                    try {
                        // 청크 단위 조회로 단일 18초 타임아웃/Skipping DB 방지 (각 청크 7초 이내 완료)
                        const dbQueryStartTime = Date.now();
                        activeGames = await db.getAllActiveGamesChunked();
                        const dbQueryDuration = Date.now() - dbQueryStartTime;
                        
                        if (activeGames.length > 0) {
                            lastGetAllActiveGamesTimeout = 0;
                            lastGetAllActiveGamesSuccess = now;
                            // DB 쿼리가 너무 오래 걸리면 경고
                            if (dbQueryDuration > MAINLOOP_DB_TIMEOUT_MS * 0.8) {
                                console.warn(`[MainLoop] getAllActiveGamesChunked took ${dbQueryDuration}ms (close to timeout ${MAINLOOP_DB_TIMEOUT_MS}ms)`);
                            }
                        } else {
                            // 빈 배열 반환 시 타임아웃 가능성 체크
                            if (dbQueryDuration >= MAINLOOP_DB_TIMEOUT_MS * 0.9) {
                                lastGetAllActiveGamesTimeout = now;
                                console.warn(`[MainLoop] getAllActiveGames timeout after ${dbQueryDuration}ms. Skipping DB for ${GET_ALL_ACTIVE_GAMES_BACKOFF_MS / 1000}s (using cache)`);
                            }
                        }
                    } catch (error: any) {
                        console.error('[MainLoop] getAllActiveGamesChunked error:', error?.message || error);
                        activeGames = [];
                        lastGetAllActiveGamesTimeout = now;
                    }
                }
            }
            
            let originalGameSignatures = activeGames.map(g => getGameSignature(g));
            const onlineUserIdsSet = new Set(Object.keys(volatileState.userConnections));
            // 1000명 경량화: 접속 중인 플레이어가 있는 게임만 updateGameStates에 전달 (미접속 게임은 스킵)
            // AI 대국도 인간 플레이어가 접속 중일 때만 처리 (고아 AI 대국으로 인한 불필요한 업데이트/타임아웃 방지)
            const gamesWithOnlinePlayers = activeGames.filter((g) => {
                if (!g?.player1?.id && !g?.player2?.id) return false;
                if (g.isAiGame) {
                    const humanId = g.player1?.id === aiPlayer.aiUserId ? g.player2?.id : g.player1?.id;
                    if (humanId && onlineUserIdsSet.has(humanId)) return true;
                    // 주사위/도둑: 굴림 애니 종료 시 update*State에서 턴 전환(오버샷 포함)이 일어난다.
                    // 인간 WS가 잠깐 끊겨 userConnections에서 빠지면 이 틱이 스킵되어 AI 오버샷 후 유저 턴으로 영구 고착될 수 있다.
                    const playfulRollAnimNeedsTick =
                        (g.mode === types.GameMode.Dice &&
                            (g.gameStatus === 'dice_rolling_animating' || g.gameStatus === 'dice_turn_rolling_animating')) ||
                        (g.mode === types.GameMode.Thief && g.gameStatus === 'thief_rolling_animating');
                    return playfulRollAnimNeedsTick;
                }
                return onlineUserIdsSet.has(g.player1?.id ?? '') || onlineUserIdsSet.has(g.player2?.id ?? '');
            });

            // 게임을 캐시에 미리 로드
            const { updateGameCache } = await import('./gameCache.js');
            for (const game of activeGames) {
                updateGameCache(game);
            }
            
                // Handle weekly league updates (Monday 0:00 KST) - 점수 리셋 전에 실행
                // 리그 업데이트는 각 사용자 로그인 시 processWeeklyLeagueUpdates에서 처리되지만,
                // 월요일 0시에 명시적으로 모든 사용자에 대해 리그 업데이트를 실행
                if (now - (lastDailyTaskCheckAt || 0) >= DAILY_TASK_CHECK_INTERVAL_MS) {
                try {
                const { getKSTDay, getKSTHours, getKSTMinutes, getKSTFullYear, getKSTMonth, getKSTDate_UTC, getKSTDate } = await import('../utils/timeUtils.js');
                const kstDay = getKSTDay(now);
                const kstHours = getKSTHours(now);
                const kstMinutes = getKSTMinutes(now);
                // 월요일 0시(KST): 0:00~0:59 전체 구간으로 넓혀 실행 누락 방지 (길드 보스/미션 주간 리셋 포함)
                const isMondayFirstHour = kstDay === 1 && kstHours === 0;
                const isMondayMidnightNarrow = kstDay === 1 && kstHours === 0 && kstMinutes < 5;
                
                // 디버깅: 현재 KST 시간 정보 로그 (0시 근처에만)
                if (process.env.NODE_ENV === 'development' && (kstHours === 0 || (kstHours === 23 && kstMinutes >= 55))) {
                    console.log(`[Server] Daily task check: KST Day=${kstDay}, Hours=${kstHours}, Minutes=${kstMinutes}, isMondayFirstHour=${isMondayFirstHour}`);
                }
                
                // 길드 보스/미션 주간 리셋: 월요일 0시대(0:00~0:59)마다 실행. 리그 업데이트와 분리하여 누락 방지.
                if (isMondayFirstHour) {
                    try {
                        const { processWeeklyResetAndRematch } = await import('./scheduledTasks.js');
                        await processWeeklyResetAndRematch(true);
                    } catch (guildResetErr: any) {
                        console.error('[MainLoop] Error in weekly guild (boss/mission) reset:', guildResetErr?.message);
                    }
                }
                
                // 리그 업데이트·경쟁상대 매칭·점수 리셋: 중복 실행 방지 후 1회만 실행 (기존 0:00~0:05 구간 유지)
                if (isMondayMidnightNarrow) {
                    const { getLastWeeklyLeagueUpdateTimestamp, setLastWeeklyLeagueUpdateTimestamp, processWeeklyResetAndRematch } = await import('./scheduledTasks.js');
                    const { getStartOfDayKST } = await import('../utils/timeUtils.js');
                    const lastUpdateTimestamp = getLastWeeklyLeagueUpdateTimestamp();
                    
                    // 실행 조건: lastUpdateTimestamp가 null이거나, 현재 날짜와 다른 경우 (KST 기준)
                    const shouldProcess = lastUpdateTimestamp === null || getStartOfDayKST(lastUpdateTimestamp) !== getStartOfDayKST(now);
                    if (shouldProcess) {
                        console.log(`[WeeklyLeagueUpdate] Processing weekly league updates for all users at Monday 0:00 KST`);
                        setLastWeeklyLeagueUpdateTimestamp(now);
                        
                        // Railway 최적화: equipment/inventory 없이 사용자 목록만 로드 (타임아웃 추가)
                        const { listUsers } = await import('./prisma/userService.js');
                        const leagueUsersTimeout = new Promise<types.User[]>((resolve) => {
                            setTimeout(() => resolve([]), 10000); // 10초 타임아웃
                        });
                        const allUsersForLeagueUpdate = await Promise.race([
                            listUsers({ includeEquipment: false, includeInventory: false }),
                            leagueUsersTimeout
                        ]);
                        
                        if (allUsersForLeagueUpdate.length === 0) {
                            console.warn('[WeeklyLeagueUpdate] No users loaded, skipping...');
                        } else {
                            let usersUpdated = 0;
                            let mailsSent = 0;
                            
                            // 배치 처리로 최적화 (한 번에 50명씩 처리)
                            const batchSize = 50;
                            for (let i = 0; i < allUsersForLeagueUpdate.length; i += batchSize) {
                                const batch = allUsersForLeagueUpdate.slice(i, i + batchSize);
                                await Promise.allSettled(batch.map(async (user) => {
                                    try {
                                        const updatedUser = await processWeeklyLeagueUpdates(user);
                                        
                                        // 메일이 추가되었는지 확인
                                        const mailAdded = (updatedUser.mail?.length || 0) > (user.mail?.length || 0);
                                        if (mailAdded) {
                                            mailsSent++;
                                            console.log(`[WeeklyLeagueUpdate] Mail sent to user ${user.nickname} (${user.id})`);
                                        }
                                        
                                        // 최적화: 간단한 필드 비교로 변경 (JSON.stringify 대신)
                                        const hasChanges = user.league !== updatedUser.league ||
                                            user.tournamentScore !== updatedUser.tournamentScore ||
                                            user.mail?.length !== updatedUser.mail?.length ||
                                            user.weeklyCompetitors !== updatedUser.weeklyCompetitors;
                                        if (hasChanges) {
                                            await db.updateUser(updatedUser);
                                            usersUpdated++;
                                        }
                                    } catch (userError: any) {
                                        console.warn(`[WeeklyLeagueUpdate] Failed to update user ${user.id}:`, userError?.message);
                                    }
                                }));
                            }
                            console.log(`[WeeklyLeagueUpdate] Updated ${usersUpdated} users, sent ${mailsSent} mails`);
                        }
                        // 경쟁상대 매칭·점수 리셋은 processWeeklyResetAndRematch에서 처리 (이미 위에서 길드 리셋만 먼저 호출함)
                        await processWeeklyResetAndRematch(true);
                    }
                }
                
                    // Handle weekly tournament reset (Monday 0:00 KST) - 이제 processWeeklyResetAndRematch에서 처리됨
                    // 기존 함수는 호환성을 위해 유지하지만 실제 처리는 processWeeklyResetAndRematch에서 수행
                    if (!isMondayMidnightNarrow) {
                        try {
                            await processWeeklyTournamentReset();
                        } catch (error: any) {
                            console.error('[MainLoop] Error in processWeeklyTournamentReset:', error?.message);
                        }
                    }
                    
                    // Handle ranking rewards
                    try {
                        await processRankingRewards(volatileState);
                    } catch (error: any) {
                        console.error('[MainLoop] Error in processRankingRewards:', error?.message);
                    }
                    
                    // Handle daily ranking calculations (매일 0시 정산)
                    try {
                        await processDailyRankings();
                    } catch (error: any) {
                        console.error('[MainLoop] Error in processDailyRankings:', error?.message);
                    }
                    
                    try {
                        await processTowerRankingRewards();
                    } catch (error: any) {
                        console.error('[MainLoop] Error in processTowerRankingRewards:', error?.message);
                    }
                    
                    // Handle daily quest reset (매일 0시 KST)
                    try {
                        await processDailyQuestReset();
                    } catch (error: any) {
                        console.error('[MainLoop] Error in processDailyQuestReset:', error?.message);
                    }

                    try {
                        const { tryRunDailyDatabaseBackup } = await import('./scheduledTasks.js');
                        await tryRunDailyDatabaseBackup(now);
                    } catch (error: any) {
                        console.error('[MainLoop] Error in tryRunDailyDatabaseBackup:', error?.message);
                    }
                    
                    // 길드전 자동 매칭: 정규 창(월·목 23시, 화·금 캐치업) + 큐 잔여 시 즉시 봇 매칭(processGuildWarMatching 내부)
                    try {
                        const { processGuildWarMatching } = await import('./scheduledTasks.js');
                        await processGuildWarMatching();
                    } catch (error: any) {
                        console.error('[MainLoop] Error in processGuildWarMatching:', error?.message);
                    }
                    
                    // Handle guild war end check
                    try {
                        const { processGuildWarEnd } = await import('./scheduledTasks.js');
                        await processGuildWarEnd();
                    } catch (error: any) {
                        console.error('[MainLoop] Error in processGuildWarEnd:', error?.message);
                    }

                    // 데모 모드: 0시(KST)에 길드전 공격 횟수 회복 (테스트용)
                    try {
                        const { resetGuildWarAttemptsAtMidnightForDemo } = await import('./scheduledTasks.js');
                        await resetGuildWarAttemptsAtMidnightForDemo(now);
                    } catch (error: any) {
                        console.error('[MainLoop] Error in resetGuildWarAttemptsAtMidnightForDemo:', error?.message);
                    }

                    lastDailyTaskCheckAt = now;
                    // 0시(자정) 스케줄러 실행 후 접속 중인 클라이언트에 새로고침 요청 → 스케줄러 반영 보장 (해당 날짜 1회만)
                    const isMidnightKST = kstHours === 0 && kstMinutes < 5;
                    if (isMidnightKST) {
                        const { getStartOfDayKST } = await import('../utils/timeUtils.js');
                        const todayStartKST = getStartOfDayKST(now);
                        if (lastSchedulerMidnightBroadcastDay !== todayStartKST) {
                            lastSchedulerMidnightBroadcastDay = todayStartKST;
                            try {
                                broadcast({ type: 'SCHEDULER_MIDNIGHT_COMPLETE' });
                                console.log('[MainLoop] Broadcast SCHEDULER_MIDNIGHT_COMPLETE for client refresh');
                            } catch (broadcastErr: any) {
                                console.warn('[MainLoop] Failed to broadcast SCHEDULER_MIDNIGHT_COMPLETE:', broadcastErr?.message);
                            }
                        }
                    }
                } catch (dailyTaskError: any) {
                    console.error('[MainLoop] Error in daily task check:', dailyTaskError?.message);
                    // 일일 작업 실패해도 서버는 계속 실행
                    lastDailyTaskCheckAt = now; // 다음 시도 방지
                }
            }
            
            // 봇 점수 업데이트 제거됨 - 던전 시스템으로 변경
            // 모든 유저의 봇 점수를 주기적으로 업데이트하는 로직 제거
            // 던전 시스템에서는 더 이상 주간 경쟁상대 봇 점수가 필요 없음
            /*
            const BOT_SCORE_UPDATE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
            if (!lastBotScoreUpdateAt || (now - lastBotScoreUpdateAt >= BOT_SCORE_UPDATE_INTERVAL_MS)) {
                try {
                    // 메모리 사용량 확인 (Railway 환경에서 중요)
                    const memUsage = process.memoryUsage();
                    const memUsageMB = {
                        rss: Math.round(memUsage.rss / 1024 / 1024),
                        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
                    };
                    
                    // 메모리 사용량이 너무 높으면 스킵 (Railway 메모리 제한 고려)
                    if (memUsageMB.rss > 400) { // 400MB 이상이면 스킵
                        console.warn(`[BotScoreUpdate] Memory usage too high (${memUsageMB.rss}MB RSS), skipping update to prevent crash`);
                        lastBotScoreUpdateAt = now;
                        return;
                    }
                    
                    const { updateBotLeagueScores } = await import('./scheduledTasks.js');
                    // Railway 최적화: equipment/inventory 없이 사용자 목록만 로드 (타임아웃 추가)
                    const { listUsers } = await import('./prisma/userService.js');
                    const botUsersTimeout = new Promise<types.User[]>((resolve) => {
                        setTimeout(() => resolve([]), 10000); // 10초 타임아웃
                    });
                    const allUsersForBotUpdate = await Promise.race([
                        listUsers({ includeEquipment: false, includeInventory: false }),
                        botUsersTimeout
                    ]);
                    
                    if (allUsersForBotUpdate.length === 0) {
                        console.warn('[BotScoreUpdate] No users loaded, skipping...');
                        lastBotScoreUpdateAt = now;
                    } else {
                        let botsUpdated = 0;
                        
                        // 배치 처리로 최적화 (한 번에 50명씩 처리)
                        const batchSize = 50;
                        for (let i = 0; i < allUsersForBotUpdate.length; i += batchSize) {
                            const batch = allUsersForBotUpdate.slice(i, i + batchSize);
                            await Promise.allSettled(batch.map(async (user) => {
                                try {
                                    if (!user.weeklyCompetitors || user.weeklyCompetitors.length === 0) {
                                        return;
                                    }
                                    
                                    // 봇 점수가 모두 0인지 확인
                                    const hasZeroBotScores = user.weeklyCompetitors.some(c => 
                                        c.id.startsWith('bot-') && 
                                        (!user.weeklyCompetitorsBotScores?.[c.id] || 
                                         user.weeklyCompetitorsBotScores[c.id].score === 0)
                                    );
                                    
                                    // 봇 점수가 모두 0이면 강제 업데이트
                                    // 1시간마다 실행되므로, 어제 날짜의 lastUpdate가 있으면 오늘 날짜 점수만 추가
                                    const updatedUser = await updateBotLeagueScores(user, hasZeroBotScores);
                                    if (JSON.stringify(user.weeklyCompetitorsBotScores || {}) !== JSON.stringify(updatedUser.weeklyCompetitorsBotScores || {})) {
                                        await db.updateUser(updatedUser);
                                        botsUpdated++;
                                    }
                                } catch (userError: any) {
                                    console.warn(`[BotScoreUpdate] Failed to update bot scores for user ${user.id}:`, userError?.message);
                                }
                            }));
                            
                            // 배치 간 짧은 대기 (메모리 정리 시간 확보)
                            if (i + batchSize < allUsersForBotUpdate.length) {
                                await new Promise(resolve => setTimeout(resolve, 50));
                            }
                        }
                        
                        if (botsUpdated > 0) {
                            console.log(`[BotScoreUpdate] Updated bot scores for ${botsUpdated} users (Memory: ${memUsageMB.rss}MB RSS, ${memUsageMB.heapUsed}MB Heap)`);
                        }
                        
                        lastBotScoreUpdateAt = now;
                    }
                } catch (botScoreError: any) {
                    console.error('[MainLoop] Error in bot score update:', botScoreError?.message);
                    // 봇 점수 업데이트 실패해도 서버는 계속 실행
                    lastBotScoreUpdateAt = now; // 다음 시도 방지
                }
            }
            */

            // Handle user timeouts and disconnections (타임아웃 추가)
            const onlineUserIdsBeforeTimeoutCheck = Object.keys(volatileState.userConnections);
            for (const userId of onlineUserIdsBeforeTimeoutCheck) {
                try {
                    // Re-check if user is still connected, as they might have been removed by a previous iteration
                    if (!volatileState.userConnections[userId]) continue;

                    // 사용자 조회에 타임아웃 추가 (2초)
                    const userTimeout = new Promise<null>((resolve) => {
                        setTimeout(() => resolve(null), 2000);
                    });
                    const user = await Promise.race([
                        db.getUser(userId),
                        userTimeout
                    ]) as types.User | null;
                    if (!user) continue;

                    const userStatus = volatileState.userStatuses[userId];
                    const activeGame = activeGames.find(g => (g.player1.id === userId || g.player2.id === userId));
                    const timeoutDuration = (activeGame || (userStatus?.status === 'in-game' && userStatus?.gameId)) ? GAME_DISCONNECT_TIMEOUT_MS : LOBBY_TIMEOUT_MS;

                    if (now - volatileState.userConnections[userId] > timeoutDuration) {
                    // User timed out. Check if they are in a local PVE game first.
                    // 주의: adventure/대기실 AI 대국(isAiGame)은 재접속 복구 대상이므로 여기서 싱글처럼 취급하지 않는다.
                    const isLocalPveGame =
                        activeGame &&
                        (activeGame.isSinglePlayer ||
                            activeGame.gameCategory === 'tower' ||
                            activeGame.gameCategory === 'singleplayer');
                    
                    // 싱글플레이 게임에서는 타임아웃이 발생해도 연결을 유지하고 게임을 계속 진행
                    if (isLocalPveGame) {
                        // 연결 시간을 갱신하여 타임아웃을 방지 (게임이 진행 중이므로)
                        volatileState.userConnections[userId] = now;
                        continue;
                    }
                    
                        // 일반 게임에서만 타임아웃 처리
                        // User timed out. They are now disconnected. Remove them from active connections.
                        releaseIpBindingForUser(volatileState, userId);
                        delete volatileState.userConnections[userId];
                        volatileState.activeTournamentViewers.delete(userId);
                
                        if (activeGame) {
                            // User was in a game. Set the disconnection state for the single-player-disconnect logic.
                            // Their userStatus remains for now, so we know they were in this game.
                            // 도전의 탑/싱글플레이는 접속 끊김 패널티 없음
                            // (온라인 AI 대국은 여기서 삭제하지 않고 재접속 복구를 허용)
                            const isNoPenaltyGame =
                                activeGame.isSinglePlayer ||
                                activeGame.gameCategory === 'tower' ||
                                activeGame.gameCategory === 'singleplayer';
                            if (!activeGame.disconnectionState) {
                                if (!isNoPenaltyGame) {
                                    // 일반 게임에서만 접속 끊김 카운트 및 패널티 적용
                                    if (!activeGame.disconnectionCounts) activeGame.disconnectionCounts = {};
                                    activeGame.disconnectionCounts[userId] = (activeGame.disconnectionCounts[userId] || 0) + 1;
                                    if (activeGame.disconnectionCounts[userId] >= 3) {
                                        const winner = activeGame.blackPlayerId === userId ? types.Player.White : types.Player.Black;
                                        await endGame(activeGame, winner, 'disconnect');
                                    } else {
                                        activeGame.disconnectionState = { disconnectedPlayerId: userId, timerStartedAt: now };
                                        if (activeGame.moveHistory.length < 10) {
                                            const otherPlayerId = activeGame.player1.id === userId ? activeGame.player2.id : activeGame.player1.id;
                                            if (!activeGame.canRequestNoContest) activeGame.canRequestNoContest = {};
                                            activeGame.canRequestNoContest[otherPlayerId] = true;
                                        }
                                        await db.saveGame(activeGame);
                                    }
                                } else {
                                    // 로컬 PVE(싱글/탑)만 연결 끊김 시 즉시 삭제.
                                    // 온라인 AI 대국(모험 포함)은 여기서 삭제하지 않고 유저 재접속을 허용한다.
                                    const shouldDeleteLocalPveGame =
                                        activeGame.isSinglePlayer ||
                                        activeGame.gameCategory === 'tower' ||
                                        activeGame.gameCategory === 'singleplayer';
                                    if (shouldDeleteLocalPveGame) {
                                        console.log(`[Disconnect] Deleting local PVE game ${activeGame.id} for user ${userId} due to disconnect`);
                                        
                                        // 사용자 상태에서 gameId 제거
                                        if (volatileState.userStatuses[userId]) {
                                            delete volatileState.userStatuses[userId].gameId;
                                            volatileState.userStatuses[userId].status = types.UserStatus.Waiting;
                                        }
                                        
                                        // AI 세션 정리
                                        clearAiSession(activeGame.id);
                                        
                                        // 게임 삭제
                                        await db.deleteGame(activeGame.id);
                                        delete volatileState.gameChats[activeGame.id];
                                        // 게임 삭제 브로드캐스트
                                        broadcast({ type: 'GAME_DELETED', payload: { gameId: activeGame.id } });
                                    } else if (activeGame.isAiGame) {
                                        // 온라인 AI 대국은 접속 끊김으로 삭제/강제종료하지 않음.
                                        // userStatus(gameId)를 유지해 재접속 시 같은 게임으로 복귀 가능하게 한다.
                                        console.log(
                                            `[Disconnect] Keeping online AI game ${activeGame.id} for reconnect recovery (user=${userId})`
                                        );
                                    } else {
                                        const winner = activeGame.blackPlayerId === userId ? types.Player.White : types.Player.Black;
                                        await endGame(activeGame, winner, 'disconnect');
                                    }
                                }
                            }
                        } else if (userStatus?.status === types.UserStatus.Waiting) {
                            // User was in waiting room, just remove connection, keep status for potential reconnect.
                            // This allows them to refresh without being kicked out of the user list.
                            releaseIpBindingForUser(volatileState, userId);
                            delete volatileState.userConnections[userId];
                        }
                    }
                } catch (timeoutError: any) {
                    // 개별 사용자 타임아웃 처리 실패는 조용히 무시
                    console.warn(`[MainLoop] Timeout processing user ${userId} for timeout check:`, timeoutError?.message);
                }
            }
            
            // Cleanup expired negotiations - 에러 핸들링 추가
            try {
                for (const negId of Object.keys(volatileState.negotiations)) {
                    try {
                        const neg = volatileState.negotiations[negId];
                        if (now > neg.deadline) {
                    const challengerId = neg.challenger.id;
                    const opponentId = neg.opponent.id;
                    const challengerStatus = volatileState.userStatuses[challengerId];
                    const opponentStatus = volatileState.userStatuses[opponentId];

                    // Challenger 상태 업데이트
                    if (challengerStatus?.status === 'negotiating') {
                        // Check if they are part of another negotiation before setting to waiting
                        const hasOtherNegotiations = Object.values(volatileState.negotiations).some(
                            otherNeg => otherNeg.id !== negId && otherNeg.challenger.id === challengerId
                        );
                        if (!hasOtherNegotiations) {
                             volatileState.userStatuses[challengerId].status = types.UserStatus.Waiting;
                        }
                    }

                    // Opponent 상태 업데이트 (상대방이 응답하지 않아서 자동 거절)
                    if (opponentStatus?.status === 'negotiating') {
                        // Check if they are part of another negotiation before setting to waiting
                        const hasOtherNegotiations = Object.values(volatileState.negotiations).some(
                            otherNeg => otherNeg.id !== negId && (otherNeg.challenger.id === opponentId || otherNeg.opponent.id === opponentId)
                        );
                        if (!hasOtherNegotiations) {
                             volatileState.userStatuses[opponentId].status = types.UserStatus.Waiting;
                        }
                    }

                     if (neg.rematchOfGameId) {
                         // 캐시에서 게임을 가져오기 (DB 조회 최소화)
                         const { getCachedGame } = await import('./gameCache.js');
                         const originalGame = await getCachedGame(neg.rematchOfGameId);
                         if (originalGame && originalGame.gameStatus === 'rematch_pending') {
                             originalGame.gameStatus = 'ended';
                             await db.saveGame(originalGame);
                         }
                     }
                            delete volatileState.negotiations[negId];
                            
                            // 만료된 negotiation 삭제 후 브로드캐스트하여 양쪽 클라이언트에 알림
                            try {
                                broadcast({ type: 'NEGOTIATION_UPDATE', payload: { negotiations: volatileState.negotiations, userStatuses: volatileState.userStatuses } });
                            } catch (broadcastError: any) {
                                console.warn(`[MainLoop] Error broadcasting negotiation update:`, broadcastError?.message);
                            }
                            
                            // USER_STATUS_UPDATE도 브로드캐스트하여 상태 변경을 확실히 전달
                            try {
                                broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
                            } catch (broadcastError: any) {
                                console.warn(`[MainLoop] Error broadcasting user status update:`, broadcastError?.message);
                            }
                        }
                    } catch (negError: any) {
                        console.warn(`[MainLoop] Error processing negotiation ${negId}:`, negError?.message);
                    }
                }
            } catch (negotiationCleanupError: any) {
                console.error('[MainLoop] Error in negotiation cleanup loop:', negotiationCleanupError?.message);
            }

            const onlineUserIds = Object.keys(volatileState.userConnections);
            let updatedGames: types.LiveGameSession[] = [];
            if (gamesWithOnlinePlayers.length > 0) {
                try {
                    let timeoutOccurred = false;
                    const updateGamesTimeoutMs = gamesWithOnlinePlayers.length === 1
                        ? Math.max(MAINLOOP_UPDATE_GAMES_TIMEOUT_MS, 24000)
                        : MAINLOOP_UPDATE_GAMES_TIMEOUT_MS;
                    const updateGamesTimeout = new Promise<types.LiveGameSession[]>((resolve) => {
                        setTimeout(() => {
                            timeoutOccurred = true;
                            const shouldLog = !(global as any).lastUpdateGamesTimeout || (Date.now() - (global as any).lastUpdateGamesTimeout > 30000);
                            if (shouldLog) {
                                console.warn(`[MainLoop] updateGameStates timeout (${updateGamesTimeoutMs}ms) for ${gamesWithOnlinePlayers.length} games, using original state`);
                                (global as any).lastUpdateGamesTimeout = Date.now();
                            }
                            resolve(gamesWithOnlinePlayers);
                        }, updateGamesTimeoutMs);
                    });
                    const updatedSubset = await Promise.race([
                        updateGameStates(gamesWithOnlinePlayers, now).then((result) => {
                            // 성공 시 타임아웃 카운터 리셋
                            if (now - lastTimeoutResetTime > TIMEOUT_RESET_WINDOW_MS) {
                                consecutiveTimeouts = 0;
                            }
                            return result;
                        }).catch((err: any) => {
                            console.error('[MainLoop] Error in updateGameStates:', err?.message || err);
                            return gamesWithOnlinePlayers;
                        }),
                        updateGamesTimeout
                    ]);
                    
                    // 타임아웃 발생 시 카운터 증가
                    if (timeoutOccurred) {
                        if (now - lastTimeoutResetTime > TIMEOUT_RESET_WINDOW_MS) {
                            consecutiveTimeouts = 1;
                            lastTimeoutResetTime = now;
                        } else {
                            consecutiveTimeouts++;
                        }
                        
                        // 연속 타임아웃이 너무 많으면 크래시 방지를 위해 재시작
                        if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
                            console.error(`[MainLoop] CRITICAL: ${consecutiveTimeouts} consecutive timeouts detected. Server may be unstable. Exiting for restart.`);
                            process.stderr.write(`[CRITICAL] Too many consecutive timeouts (${consecutiveTimeouts}) - exiting for restart\n`);
                            process.stderr.write(`[CRASH_REASON] main_loop_consecutive_timeouts count=${consecutiveTimeouts}\n`, () => {});
                            setTimeout(() => {
                                process.exit(1);
                            }, 2000);
                            return; // 루프 종료
                        }
                    }
                    
                    const updatedById = new Map<string, types.LiveGameSession>();
                    for (const g of updatedSubset) updatedById.set(g.id, g);
                    updatedGames = activeGames.map((g) => updatedById.get(g.id) ?? g);
                } catch (error: any) {
                    console.error('[MainLoop] Fatal error in updateGameStates:', error?.message || error);
                    updatedGames = activeGames;
                    // 치명적 에러도 타임아웃으로 간주
                    consecutiveTimeouts++;
                    if (consecutiveTimeouts >= MAX_CONSECUTIVE_TIMEOUTS) {
                        console.error(`[MainLoop] CRITICAL: ${consecutiveTimeouts} consecutive errors/timeouts. Exiting for restart.`);
                        process.stderr.write(`[CRASH_REASON] main_loop_consecutive_errors_or_timeouts count=${consecutiveTimeouts}\n`, () => {});
                        setTimeout(() => {
                            process.exit(1);
                        }, 2000);
                        return;
                    }
                }
            } else {
                updatedGames = activeGames;
            }

            // 1000명 규모: 접속 끊긴 유저 중 대국 참가자가 아닌 경우 userStatuses에서 제거 (메모리 상한)
            if (now - lastStaleUserStatusCleanupAt >= STALE_USER_STATUS_CLEANUP_INTERVAL_MS) {
                lastStaleUserStatusCleanupAt = now;
                const inGameUserIds = new Set<string>();
                for (const g of activeGames) {
                    if (g.player1?.id) inGameUserIds.add(g.player1.id);
                    if (g.player2?.id) inGameUserIds.add(g.player2.id);
                }
                let removed = 0;
                for (const uid of Object.keys(volatileState.userStatuses)) {
                    if (volatileState.userConnections[uid]) continue;
                    if (inGameUserIds.has(uid)) continue;
                    delete volatileState.userStatuses[uid];
                    removed++;
                }
                if (removed > 0 && process.env.NODE_ENV === 'development') {
                    console.log(`[MainLoop] Cleaned ${removed} stale userStatuses`);
                }
            }

            // Check for mutual disconnection - 양쪽 모두 끊기면 대국실 삭제 후 재접속 시 안내
            const disconnectedGamesToBroadcast: Record<string, types.LiveGameSession> = {};
            const mutualDisconnectGameIds = new Set<string>();
            const MUTUAL_DISCONNECT_MESSAGE = '양쪽 유저의 접속이 모두 끊어져 대국이 종료되었습니다.';

            for (const game of updatedGames) {
                try {
                    // scoring 상태의 게임은 연결 끊김으로 처리하지 않음 (자동계가 진행 중)
                    if (game.isAiGame || game.gameStatus === 'ended' || game.gameStatus === 'no_contest' || game.gameStatus === 'scoring' || game.disconnectionState) continue;

                    const p1Online = onlineUserIds.includes(game.player1.id);
                    const p2Online = onlineUserIds.includes(game.player2.id);
                    
                    const isSpectatorPresent = Object.keys(volatileState.userStatuses).some(spectatorId => {
                        return onlineUserIds.includes(spectatorId) &&
                               volatileState.userStatuses[spectatorId].status === types.UserStatus.Spectating &&
                               volatileState.userStatuses[spectatorId].spectatingGameId === game.id;
                    });

                    if (!p1Online && !p2Online && !isSpectatorPresent) {
                        console.log(`[Game ${game.id}] Both players disconnected and no spectators. Deleting game and notifying on reconnect.`);
                            try {
                                const p1Id = game.player1?.id;
                                const p2Id = game.player2?.id;
                                clearAiSession(game.id);
                                await db.deleteGame(game.id);
                                delete volatileState.gameChats[game.id];
                                if (!volatileState.pendingMutualDisconnectByUser) volatileState.pendingMutualDisconnectByUser = {};
                            if (p1Id) volatileState.pendingMutualDisconnectByUser[p1Id] = MUTUAL_DISCONNECT_MESSAGE;
                            if (p2Id) volatileState.pendingMutualDisconnectByUser[p2Id] = MUTUAL_DISCONNECT_MESSAGE;
                            if (volatileState.userStatuses[p1Id]) {
                                delete volatileState.userStatuses[p1Id].gameId;
                                volatileState.userStatuses[p1Id].status = types.UserStatus.Waiting;
                            }
                            if (volatileState.userStatuses[p2Id]) {
                                delete volatileState.userStatuses[p2Id].gameId;
                                volatileState.userStatuses[p2Id].status = types.UserStatus.Waiting;
                            }
                            mutualDisconnectGameIds.add(game.id);
                            broadcast({ type: 'GAME_DELETED', payload: { gameId: game.id, reason: 'mutual_disconnect' } });
                        } catch (delError: any) {
                            console.error(`[MainLoop] Failed to delete mutually disconnected game ${game.id}:`, delError?.message);
                        }
                        continue;
                    }
                } catch (disconnectError: any) {
                    console.warn(`[MainLoop] Error checking disconnection for game ${game.id}:`, disconnectError?.message);
                }
            }

            // 양쪽 끊김으로 삭제된 게임은 이후 루프에서 제외 (updatedGames와 originalGameSignatures 인덱스 일치 유지)
            if (mutualDisconnectGameIds.size > 0) {
                updatedGames = updatedGames.filter(g => !mutualDisconnectGameIds.has(g.id));
                originalGameSignatures = originalGameSignatures.filter((_, i) => !mutualDisconnectGameIds.has(activeGames[i]?.id));
            }
            
            // 연결 끊김으로 인한 게임 상태 변경 브로드캐스트 (게임 참가자에게만 전송) - 에러 핸들링 추가
            if (Object.keys(disconnectedGamesToBroadcast).length > 0) {
                try {
                    const { broadcastToGameParticipants } = await import('./socket.js');
                    for (const [gameId, game] of Object.entries(disconnectedGamesToBroadcast)) {
                        try {
                            broadcastToGameParticipants(gameId, { type: 'GAME_UPDATE', payload: { [gameId]: game } }, game);
                        } catch (broadcastError: any) {
                            console.warn(`[MainLoop] Error broadcasting disconnected game ${gameId}:`, broadcastError?.message);
                        }
                    }
                } catch (broadcastError: any) {
                    console.error('[MainLoop] Error in disconnected games broadcast:', broadcastError?.message);
                }
            }
            
            // Save any game that has been modified by the update function and broadcast updates
            const gamesToBroadcast: Record<string, types.LiveGameSession> = {};
            for (let i = 0; i < updatedGames.length; i++) {
                const updatedGame = updatedGames[i];
                
                // PVE 중 도전의 탑은 서버에서 초읽기/제한시간을 갱신하므로 변경 시 브로드캐스트 필요 (클라이언트 타이머 동기화)
                // 싱글플레이어(단순 PVE)만 서버 루프 브로드캐스트 제외
                const isPVESkipBroadcast = (updatedGame.isSinglePlayer || updatedGame.gameCategory === 'singleplayer') && updatedGame.gameCategory !== 'tower';
                if (isPVESkipBroadcast) {
                    continue;
                }

                // 멀티플레이 게임만 상세 처리 (경량 시그니처로 변경 감지, JSON 직렬화 제거)
                if (getGameSignature(updatedGame) !== originalGameSignatures[i]) {
                    const currentMoveCount = updatedGame.moveHistory?.length ?? 0;
                    const localRevision = updatedGame.serverRevision ?? 0;
                    const localSyncedAt = updatedGame.lastSyncedAt ?? 0;
                    // 캐시에서 게임을 가져오기 (DB 조회 최소화)
                    const { getCachedGame } = await import('./gameCache.js');
                    const latestGame = await getCachedGame(updatedGame.id);

                    if (latestGame) {
                        const latestMoveCount = latestGame.moveHistory?.length ?? 0;
                        const latestRevision = latestGame.serverRevision ?? 0;
                        const latestSyncedAt = latestGame.lastSyncedAt ?? 0;

                        let newerReason: string | null = null;
                        if (latestRevision > localRevision) {
                            newerReason = `revision ${latestRevision} > local ${localRevision}`;
                        } else if (latestRevision === localRevision && latestSyncedAt > localSyncedAt) {
                            newerReason = `sync ${latestSyncedAt} > ${localSyncedAt}`;
                        } else if (latestRevision === localRevision && latestSyncedAt === localSyncedAt && latestMoveCount > currentMoveCount) {
                            newerReason = `move history ${latestMoveCount} > ${currentMoveCount}`;
                        }

                        if (newerReason) {
                            console.warn(`[Game Loop] Detected newer game state for ${updatedGame.id} (${newerReason}). Refreshing local copy instead of saving.`);
                            syncAiSession(latestGame, aiPlayer.aiUserId);
                            const { updateGameCache } = await import('./gameCache.js');
                            updateGameCache(latestGame);
                            updatedGames[i] = latestGame;
                            originalGameSignatures[i] = getGameSignature(latestGame);
                            continue;
                        }
                    }

                    const { updateGameCache } = await import('./gameCache.js');
                    updateGameCache(updatedGame);
                    db.saveGame(updatedGame).catch(err => {
                        console.error(`[Game Loop] Failed to save game ${updatedGame.id}:`, err);
                    });
                    syncAiSession(updatedGame, aiPlayer.aiUserId);
                    gamesToBroadcast[updatedGame.id] = updatedGame;
                }
            }
            
            // 실시간 게임 상태 업데이트 브로드캐스트 (게임 참가자에게만 전송) - 에러 핸들링 추가
            // 무한 루프 방지: 실제로 변경된 게임만 브로드캐스트 (JSON 비교로 실제 변경 여부 확인)
            if (Object.keys(gamesToBroadcast).length > 0) {
                try {
                    const { broadcastToGameParticipants } = await import('./socket.js');
                    for (const [gameId, game] of Object.entries(gamesToBroadcast)) {
                        try {
                            const gameIndex = activeGames.findIndex(g => g.id === gameId);
                            if (gameIndex !== -1) {
                                const currentSig = getGameSignature(game);
                                if (currentSig !== originalGameSignatures[gameIndex]) {
                                    broadcastToGameParticipants(gameId, { type: 'GAME_UPDATE', payload: { [gameId]: game } }, game);
                                    activeGames[gameIndex] = game;
                                    originalGameSignatures[gameIndex] = currentSig;
                                }
                            }
                        } catch (gameBroadcastError: any) {
                            console.warn(`[MainLoop] Error broadcasting game ${gameId}:`, gameBroadcastError?.message);
                        }
                    }
                } catch (broadcastError: any) {
                    console.error('[MainLoop] Error in games broadcast:', broadcastError?.message);
                }
            }

            // Process any system messages generated by time-based events - 에러 핸들링 추가
            const systemMessageGamesToBroadcast: Record<string, types.LiveGameSession> = {};
            for (const game of updatedGames) {
                try {
                    if (game.pendingSystemMessages && game.pendingSystemMessages.length > 0) {
                        if (!volatileState.gameChats[game.id]) {
                            volatileState.gameChats[game.id] = [];
                        }
                        volatileState.gameChats[game.id].push(...game.pendingSystemMessages);
                        game.pendingSystemMessages = [];
                        try {
                            await db.saveGame(game);
                            systemMessageGamesToBroadcast[game.id] = game;
                        } catch (saveError: any) {
                            console.warn(`[MainLoop] Failed to save game ${game.id} for system messages:`, saveError?.message);
                        }
                    }
                } catch (systemMsgError: any) {
                    console.warn(`[MainLoop] Error processing system messages for game ${game.id}:`, systemMsgError?.message);
                }
            }
            
            // 시스템 메시지로 인한 게임 상태 변경 브로드캐스트 (게임 참가자에게만 전송) - 에러 핸들링 추가
            if (Object.keys(systemMessageGamesToBroadcast).length > 0) {
                try {
                    const { broadcastToGameParticipants } = await import('./socket.js');
                    for (const [gameId, game] of Object.entries(systemMessageGamesToBroadcast)) {
                        try {
                            broadcastToGameParticipants(gameId, { type: 'GAME_UPDATE', payload: { [gameId]: game } }, game);
                        } catch (broadcastError: any) {
                            console.warn(`[MainLoop] Error broadcasting system message for game ${gameId}:`, broadcastError?.message);
                        }
                    }
                } catch (broadcastError: any) {
                    console.error('[MainLoop] Error in system message broadcast:', broadcastError?.message);
                }
            }

            // Handle post-game summary processing for all games that finished - 에러 핸들링 추가
            const summaryGamesToBroadcast: Record<string, types.LiveGameSession> = {};
            for (const game of updatedGames) {
                try {
                    // 타워 게임 종료 처리
                    if (game.gameCategory === 'tower' && (game.gameStatus === 'ended' || game.gameStatus === 'no_contest') && !game.statsUpdated) {
                        try {
                            // 타워 게임은 클라이언트에서 실행되지만, 서버에서 종료 처리 필요
                            const { endGame } = await import('./summaryService.js');
                            if (game.winner !== undefined && game.winner !== null) {
                                await endGame(game, game.winner as Player, game.winReason || 'score');
                            }
                            summaryGamesToBroadcast[game.id] = game;
                        } catch (towerError: any) {
                            console.error(`[MainLoop] Error processing tower game summary for ${game.id}:`, towerError?.message);
                        }
                    }
                    // 일반 게임 종료 처리
                    const isPlayful = PLAYFUL_GAME_MODES.some(m => m.mode === game.mode);
                    const isStrategic = SPECIAL_GAME_MODES.some(m => m.mode === game.mode);
                    if (!game.isSinglePlayer && (isPlayful || isStrategic) && (game.gameStatus === 'ended' || game.gameStatus === 'no_contest') && !game.statsUpdated) {
                        try {
                            await processGameSummary(game);
                            game.statsUpdated = true;
                            await db.saveGame(game);
                            summaryGamesToBroadcast[game.id] = game;
                        } catch (summaryError: any) {
                            console.error(`[MainLoop] Error processing game summary for ${game.id}:`, summaryError?.message);
                        }
                    }
                } catch (gameError: any) {
                    console.warn(`[MainLoop] Error processing game ${game.id} for summary:`, gameError?.message);
                }
            }
            
            // 게임 종료 요약 처리 후 브로드캐스트 (게임 참가자에게만 전송) - 에러 핸들링 추가
            if (Object.keys(summaryGamesToBroadcast).length > 0) {
                try {
                    const { broadcastToGameParticipants } = await import('./socket.js');
                    for (const [gameId, game] of Object.entries(summaryGamesToBroadcast)) {
                        try {
                            broadcastToGameParticipants(gameId, { type: 'GAME_UPDATE', payload: { [gameId]: game } }, game);
                        } catch (broadcastError: any) {
                            console.warn(`[MainLoop] Error broadcasting summary for game ${gameId}:`, broadcastError?.message);
                        }
                    }
                } catch (broadcastError: any) {
                    console.error('[MainLoop] Error in summary broadcast:', broadcastError?.message);
                }
            }
            
            // --- Game Room Garbage Collection for Ended Games ---
            let endedGames: types.LiveGameSession[] = [];
            try {
                const endedGamesTimeout = new Promise<types.LiveGameSession[]>((resolve) => {
                    setTimeout(() => resolve([]), 5000); // 5초 타임아웃
                });
                endedGames = await Promise.race([
                    db.getAllEndedGames(),
                    endedGamesTimeout
                ]);
            } catch (error: any) {
                console.error('[MainLoop] Failed to load ended games:', error?.message || error);
                endedGames = [];
            }

            for (const game of endedGames) {
                try {
                    const isAnyoneInRoom = Object.keys(volatileState.userConnections).some(onlineUserId => {
                        const status = volatileState.userStatuses[onlineUserId];
                        return status && (status.gameId === game.id || status.spectatingGameId === game.id);
                    });

                    if (!isAnyoneInRoom) {
                        // Also check if a rematch negotiation is active for this game
                        const isRematchBeingNegotiated = Object.values(volatileState.negotiations).some(
                            neg => neg.rematchOfGameId === game.id
                        );

                        if (!isRematchBeingNegotiated) {
                            console.log(`[GC] Deleting empty, ended game room: ${game.id}`);
                            clearAiSession(game.id);
                            await db.deleteGame(game.id);
                            delete volatileState.gameChats[game.id];
                        }
                    }
                } catch (gcError: any) {
                    // 개별 게임 GC 실패는 조용히 무시
                    console.warn(`[MainLoop] Failed to GC game ${game.id}:`, gcError?.message);
                }
            }
                            
                            // 메인 루프가 성공적으로 완료되면 연속 실패 카운터 리셋
                            if (mainLoopConsecutiveFailures > 0) {
                                console.log(`[MainLoop] Loop completed successfully. Resetting failure counter (was ${mainLoopConsecutiveFailures}).`);
                                mainLoopConsecutiveFailures = 0;
                            }
                            
                            } catch (e: any) {
                                mainLoopConsecutiveFailures++;
                                console.error(`[FATAL] Unhandled error in main loop (failure #${mainLoopConsecutiveFailures}):`, e);
                                console.error('[FATAL] Error stack:', e?.stack);
                                console.error('[FATAL] Error details:', {
                                    message: e?.message,
                                    name: e?.name,
                                    code: e?.code
                                });
                                
                                // 연속 실패가 너무 많으면 프로세스 종료 (Railway가 재시작)
                                if (mainLoopConsecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                                    console.error(`[FATAL] Main loop failed ${mainLoopConsecutiveFailures} times consecutively. Exiting for Railway restart.`);
                                    process.stderr.write(`[CRITICAL] Main loop repeated failures (${mainLoopConsecutiveFailures}x) - exiting\n`);
                                    process.stderr.write(`[CRASH_REASON] main_loop_consecutive_failures count=${mainLoopConsecutiveFailures}\n`, () => {});
                                    // 메모리 정리 시도
                                    try {
                                        const { cleanupExpiredCache } = await import('./gameCache.js');
                                        cleanupExpiredCache();
                                        if (global.gc) {
                                            global.gc();
                                        }
                                    } catch (cleanupError: any) {
                                        // 무시
                                    }
                                    // Railway가 재시작하도록 프로세스 종료
                                    setTimeout(() => {
                                        process.exit(1);
                                    }, 1000);
                                    return;
                                }
                                
                                // 메모리 부족 에러인 경우에만 프로세스 종료 (Railway가 재시작)
                                if (e?.code === 'ENOMEM' || e?.message?.includes('out of memory')) {
                                    console.error('[FATAL] Out of memory error detected.');
                                    // 메모리 정리 시도
                                    try {
                                        const { cleanupExpiredCache } = await import('./gameCache.js');
                                        cleanupExpiredCache();
                                        if (global.gc) {
                                            global.gc();
                                        }
                                        console.log('[FATAL] Attempted memory cleanup after ENOMEM');
                                    } catch (cleanupError: any) {
                                        console.error('[FATAL] Failed to cleanup memory:', cleanupError);
                                    }
                                    
                                    // Railway 환경에서만 프로세스 종료 (재시작을 위해)
                                    if (process.env.RAILWAY_ENVIRONMENT) {
                                        console.error('[FATAL] Exiting for Railway restart after memory cleanup.');
                                        process.stderr.write(`[CRASH_REASON] out_of_memory_enomem\n`, () => {});
                                        setTimeout(() => {
                                            process.exit(1);
                                        }, 1000);
                                        return;
                                    }
                                }
                                
                                // 다른 모든 에러는 치명적이지 않음 - 서버는 계속 실행
                            } finally {
                                isProcessingMainLoop = false;
                                
                                // 에러 발생 시 지연 시간을 백오프로 증가 (연속 실패 시 더 긴 대기)
                                const baseDelay = 15000; // 기본 15초
                                const backoffMultiplier = Math.min(mainLoopConsecutiveFailures, 5); // 최대 5배
                                let nextDelay = baseDelay * backoffMultiplier;
                                // Railway: 성공 시에도 최소 2초 대기하여 DB/이벤트 루프 부하 완화 (연속 타임아웃 방지)
                                if (nextDelay === 0 && isRailwayOrProd) {
                                    nextDelay = 2000;
                                } else if (nextDelay === 0) {
                                    nextDelay = 1000;
                                }
                                
                                // 절대 실패하지 않도록 보호
                                try {
                                    scheduleMainLoop(nextDelay);
                                } catch (scheduleError: any) {
                                    console.error('[FATAL] Failed to schedule next main loop:', scheduleError);
                                    // 최후의 수단: 5초 후 다시 시도
                                    setTimeout(() => {
                                        try {
                                            scheduleMainLoop(1000);
                                        } catch (retryError: any) {
                                            console.error('[FATAL] Failed to retry schedule main loop:', retryError);
                                            // 계속 재시도
                                            setTimeout(() => scheduleMainLoop(1000), 5000);
                                        }
                                    }, 5000);
                                }
                            }
                    } catch (outerError: any) {
                        // 메인 루프 전체가 실패한 경우
                        console.error('[FATAL] Critical error in main loop wrapper:', outerError);
                        isProcessingMainLoop = false;
                        // 5초 후 재시도
                        setTimeout(() => {
                            try {
                                scheduleMainLoop(1000);
                            } catch (retryError: any) {
                                console.error('[FATAL] Failed to retry main loop after critical error:', retryError);
                                // 계속 재시도
                                setTimeout(() => scheduleMainLoop(1000), 5000);
                            }
                        }, 5000);
                    }
                })().catch((asyncError: any) => {
                    // async 함수 자체가 실패한 경우
                    console.error('[FATAL] Async wrapper failed in main loop:', asyncError);
                    isProcessingMainLoop = false;
                    // 5초 후 재시도
                    setTimeout(() => {
                        try {
                            scheduleMainLoop(1000);
                        } catch (retryError: any) {
                            console.error('[FATAL] Failed to retry main loop after async error:', retryError);
                            // 계속 재시도
                            setTimeout(() => scheduleMainLoop(1000), 5000);
                        }
                    }, 5000);
                });
            }, delay);
        } catch (scheduleError: any) {
            // setTimeout 자체가 실패한 경우 (거의 불가능하지만)
            console.error('[FATAL] Failed to schedule main loop:', scheduleError);
            // 5초 후 재시도
            setTimeout(() => {
                try {
                    scheduleMainLoop(1000);
                } catch (retryError: any) {
                    console.error('[FATAL] Failed to retry schedule after setTimeout error:', retryError);
                    // 계속 재시도
                    setTimeout(() => scheduleMainLoop(1000), 5000);
                }
            }, 5000);
        }
    };

    // --- Main Game Loop ---
    // 메인 게임 루프는 DB 초기화 완료 후에만 시작 (Prisma "Engine is not yet connected" 무한 오류 방지)
    console.log('[Server] Main game loop will start after database is ready...');
    
    const startMainLoopWhenReady = () => {
        console.log('[Server] Starting main game loop (DB ready)...');
        try {
            scheduleMainLoop(10000);
            console.log('[Server] Main game loop scheduled successfully');
        } catch (error: any) {
            console.error('[Server] CRITICAL: Failed to schedule main loop:', error);
            setTimeout(() => startMainLoopWhenReady(), 5000);
        }
    };

    // DB 초기화가 끝난 뒤에만 메인 루프 시작 (초기화 실패 시에도 5초 후 재시도로 루프 예약). testMode일 때는 스킵.
    if (dbInitPromise) {
        dbInitPromise.then(() => {
            setTimeout(startMainLoopWhenReady, 2000); // 엔진 안정화 2초 후 시작
        }).catch(() => {
            // DB 초기화 실패 시에도 scheduleMainLoop는 dbInitialized 체크로 스킵 후 재예약하므로 루프는 나중에 시작됨
            setTimeout(startMainLoopWhenReady, 5000);
        });
    }
    
    // --- API Endpoints ---
    // Health check endpoint는 server 생성 직후에 정의됨 (위 참조)

    // 도전의 탑 랭킹 API (반드시 /api/ranking/:type 보다 먼저 등록해 'tower'가 :type에 잡히지 않도록 함)
    app.get('/api/ranking/tower', async (req, res) => {
        try {
            const allUsers = await db.getAllUsers({ includeEquipment: false, includeInventory: false, skipCache: true });
            // 월간 도전의 탑 랭킹은 월간 최고 층수가 10층 이상인 유저만 집계한다.
            const eligibleUsers = allUsers
                .map(user => {
                    const towerFloor = (user as any).towerFloor ?? 0;
                    const monthlyTowerFloor = (user as any).monthlyTowerFloor ?? 0;
                    return {
                        id: user.id,
                        nickname: user.nickname,
                        avatarId: user.avatarId,
                        borderId: user.borderId,
                        towerFloor,
                        monthlyTowerFloor,
                        lastTowerClearTime: (user as any).lastTowerClearTime ?? Infinity,
                    };
                })
                .filter(user => user.monthlyTowerFloor >= 10);

            const sortedUsers = eligibleUsers.sort((a, b) => {
                if (a.monthlyTowerFloor !== b.monthlyTowerFloor) return b.monthlyTowerFloor - a.monthlyTowerFloor;
                return a.lastTowerClearTime - b.lastTowerClearTime;
            });

            const rankings = sortedUsers.map((user, index) => ({
                ...user,
                rank: index + 1,
            }));

            res.json({ type: 'tower', rankings, total: rankings.length, cached: false });
        } catch (error: any) {
            console.error('[API/Ranking/Tower] Error:', error);
            res.status(200).json({ type: 'tower', rankings: [], total: 0, cached: false, error: 'Failed to fetch tower rankings' });
        }
    });

    // 랭킹 API 엔드포인트
    app.get('/api/ranking/:type', async (req, res) => {
        try {
            const { type } = req.params;
            const { limit, offset, season } = req.query;
            const limitNum = limit ? parseInt(limit as string, 10) : undefined;
            const offsetNum = offset ? parseInt(offset as string, 10) : 0;
            const isSeason = season === 'true' || season === '1';

            // 타임아웃 설정 (30초)
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Ranking cache build timeout')), 30000);
            });

            const { buildRankingCache } = await import('./rankingCache.js');
            let cache: any;
            try {
                cache = await Promise.race([
                    buildRankingCache(),
                    timeoutPromise
                ]) as any;
                
                // cache가 null이거나 undefined인 경우 빈 캐시로 초기화
                if (!cache) {
                    console.warn('[API/Ranking] Cache is null or undefined, using empty cache');
                    cache = {
                        strategic: [],
                        playful: [],
                        championship: [],
                        combat: [],
                        manner: [],
                        strategicSeason: [],
                        playfulSeason: [],
                        timestamp: Date.now()
                    };
                }
            } catch (timeoutError: any) {
                console.error('[API/Ranking] Cache build timeout or error:', timeoutError?.message || timeoutError);
                // 타임아웃 시 빈 응답 반환 (502 에러 방지)
                return res.status(200).json({
                    type,
                    rankings: [],
                    total: 0,
                    cached: false,
                    error: 'Ranking cache build timeout'
                });
            }

            let rankings: any[] = [];
            // 시즌별 티어 랭킹 요청인 경우
            if (isSeason) {
                switch (type) {
                    case 'strategic':
                        rankings = Array.isArray(cache?.strategicSeason) ? cache.strategicSeason : [];
                        break;
                    case 'playful':
                        rankings = Array.isArray(cache?.playfulSeason) ? cache.playfulSeason : [];
                        break;
                    default:
                        // 시즌 랭킹은 strategic/playful만 지원
                        return res.status(400).json({ error: 'Season ranking only available for strategic/playful' });
                }
            } else {
                // 누적 랭킹 (기본)
                switch (type) {
                    case 'strategic':
                        rankings = Array.isArray(cache?.strategic) ? cache.strategic : [];
                        break;
                    case 'playful':
                        rankings = Array.isArray(cache?.playful) ? cache.playful : [];
                        break;
                    case 'championship':
                        rankings = Array.isArray(cache?.championship) ? cache.championship : [];
                        break;
                    case 'combat':
                        rankings = Array.isArray(cache?.combat) ? cache.combat : [];
                        break;
                    case 'manner':
                        rankings = Array.isArray(cache?.manner) ? cache.manner : [];
                        break;
                    default:
                        return res.status(400).json({ error: 'Invalid ranking type' });
                }
            }

            // 페이지네이션 적용
            if (limitNum && Array.isArray(rankings)) {
                rankings = rankings.slice(offsetNum, offsetNum + limitNum);
            }

            const cacheKey = isSeason ? `${type}Season` : type;
            const cacheValue = cache?.[cacheKey as keyof typeof cache];
            const total = Array.isArray(cacheValue) ? cacheValue.length : (Array.isArray(rankings) ? rankings.length : 0);
            const cached = cache?.timestamp && (Date.now() - (cache.timestamp || 0) < 60000); // 1분 이내면 캐시된 데이터
            
            res.json({
                type,
                rankings,
                total,
                cached: cached || false
            });
        } catch (error: any) {
            console.error('[API/Ranking] Error:', error);
            console.error('[API/Ranking] Error stack:', error?.stack);
            // 에러 발생 시 빈 배열 반환 (500 에러 방지)
            const { type } = req.params;
            return res.status(200).json({
                type,
                rankings: [],
                total: 0,
                cached: false,
                error: error?.message || 'Unknown error'
            });
        }
    });

    app.post('/api/auth/register', async (req, res) => {
        try {
            // 데이터베이스 연결 상태 확인
            const dbConnected = await db.isDatabaseConnected();
            if (!dbConnected) {
                console.error('[/api/auth/register] Database not connected');
                return res.status(503).json({ 
                    message: '데이터베이스 연결이 되지 않았습니다. 잠시 후 다시 시도해주세요.' 
                });
            }
            
            const { username, password, email } = req.body ?? {};
            const trimmedUsername = username && typeof username === 'string' ? username.trim() : '';
            const trimmedPassword = password && typeof password === 'string' ? password.trim() : '';
            const trimmedEmailRaw = email && typeof email === 'string' ? email.trim() : '';
            
            if (!trimmedUsername) {
                return res.status(400).json({ message: '아이디를 입력해주세요.' });
            }
            if (!trimmedPassword) {
                return res.status(400).json({ message: '비밀번호를 입력해주세요.' });
            }
            if (!trimmedEmailRaw) {
                return res.status(400).json({ message: '이메일을 입력해주세요.' });
            }
            
            if (trimmedUsername.length < 2 || trimmedPassword.length < 4) {
                return res.status(400).json({ message: '아이디는 2자 이상, 비밀번호는 4자 이상이어야 합니다.' });
            }
            if (containsProfanity(trimmedUsername)) {
                return res.status(400).json({ message: '아이디에 부적절한 단어가 포함되어 있습니다.' });
            }
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(trimmedEmailRaw)) {
                return res.status(400).json({ message: '올바른 이메일 주소를 입력해주세요.' });
            }
            const trimmedEmail = trimmedEmailRaw.toLowerCase();
    
            // UserCredential 테이블에서 username 중복 확인
            const existingByUsername = await db.getUserCredentials(trimmedUsername);
            if (existingByUsername) {
                return res.status(409).json({ message: '이미 사용 중인 아이디입니다.' });
            }
            
            // User 테이블에서 username 필드로 직접 확인 (Prisma에서 username은 unique)
            // Railway 최적화: equipment/inventory 없이 사용자 목록만 로드
            try {
                const { listUsers } = await import('./prisma/userService.js');
                const allUsers = await listUsers({ includeEquipment: false, includeInventory: false });
                const existingUserByUsername = allUsers.find(u => u.username === trimmedUsername);
                if (existingUserByUsername) {
                    return res.status(409).json({ message: '이미 사용 중인 아이디입니다.' });
                }
            } catch (checkError: any) {
                // 체크 실패해도 계속 진행 (Prisma UNIQUE 제약조건이 나중에 잡아줄 것)
                console.warn('[/api/auth/register] Failed to check username in User table:', checkError?.message);
            }
    
            const existingByEmail = await db.getUserByEmail(trimmedEmail);
            if (existingByEmail) {
                return res.status(409).json({ message: '이미 사용 중인 이메일입니다.' });
            }

            // 회원탈퇴 이메일 확인 (1주일 제한)
            {
                const kvRepository = await import('./repositories/kvRepository.js');
                const withdrawnEmails = await kvRepository.getKV<Record<string, number>>('withdrawnEmails') || {};
                const withdrawnEmailExpiry = withdrawnEmails[trimmedEmail];
                if (withdrawnEmailExpiry && withdrawnEmailExpiry > Date.now()) {
                    const daysLeft = Math.ceil((withdrawnEmailExpiry - Date.now()) / (24 * 60 * 60 * 1000));
                    return res.status(403).json({ 
                        message: `회원탈퇴한 이메일은 ${daysLeft}일 후에 다시 가입할 수 있습니다.` 
                    });
                }
                if (withdrawnEmailExpiry && withdrawnEmailExpiry <= Date.now()) {
                    delete withdrawnEmails[trimmedEmail];
                    await kvRepository.setKV('withdrawnEmails', withdrawnEmails);
                }
            }
    
            // 임시 닉네임 생성 (나중에 변경 가능)
            const tempNickname = `user_${randomUUID().slice(0, 8)}`;
            console.log('[/api/auth/register] Creating default user...');
            let newUser = createDefaultUser(`user-${randomUUID()}`, trimmedUsername, tempNickname, false);
            (newUser as { email?: string | null }).email = trimmedEmail;
            (newUser as { onboardingTutorialPendingFirstHome?: boolean }).onboardingTutorialPendingFirstHome = true;
            delete (newUser as { onboardingTutorialPhase?: number }).onboardingTutorialPhase;

            console.log('[/api/auth/register] Resetting and generating quests...');
            newUser = await resetAndGenerateQuests(newUser);
    
            console.log('[/api/auth/register] Creating user in database...');
            try {
                await db.createUser(newUser);
                console.log('[/api/auth/register] User created successfully:', newUser.id);
            } catch (createUserError: any) {
                console.error('[/api/auth/register] Failed to create user:', createUserError);
                console.error('[/api/auth/register] Create user error details:', {
                    message: createUserError?.message,
                    code: createUserError?.code,
                    stack: createUserError?.stack
                });
                
                // Prisma UNIQUE 제약조건 위반 에러 처리 (P2002)
                if (createUserError?.code === 'P2002') {
                    const target = createUserError?.meta?.target;
                    if (Array.isArray(target) && target.includes('username')) {
                        return res.status(409).json({ message: '이미 사용 중인 아이디입니다.' });
                    }
                    if (Array.isArray(target) && target.includes('nickname')) {
                        return res.status(409).json({ message: '이미 사용 중인 닉네임입니다.' });
                    }
                    if (Array.isArray(target) && target.includes('email')) {
                        return res.status(409).json({ message: '이미 사용 중인 이메일입니다.' });
                    }
                    return res.status(409).json({ message: '이미 사용 중인 정보가 있습니다.' });
                }
                
                throw createUserError;
            }
            
            // 비밀번호 해싱
            console.log('[/api/auth/register] Hashing password...');
            const passwordHash = await hashPassword(trimmedPassword);
            console.log('[/api/auth/register] Creating user credentials...');
            try {
                await db.createUserCredentials(trimmedUsername, passwordHash, newUser.id);
                console.log('[/api/auth/register] User credentials created successfully');
            } catch (createCredsError: any) {
                console.error('[/api/auth/register] Failed to create user credentials:', createCredsError);
                console.error('[/api/auth/register] Create credentials error details:', {
                    message: createCredsError?.message,
                    code: createCredsError?.code,
                    stack: createCredsError?.stack
                });
                // 사용자는 생성되었지만 인증 정보 생성 실패 - 사용자 삭제 시도
                try {
                    await db.deleteUser(newUser.id);
                    console.log('[/api/auth/register] Rolled back: deleted user after credentials creation failure');
                } catch (rollbackError: any) {
                    console.error('[/api/auth/register] Failed to rollback user creation:', rollbackError);
                }
                throw createCredsError;
            }
    
            res.status(201).json({ user: newUser });
        } catch (e: any) {
            console.error('[/api/auth/register] Registration error:', e);
            console.error('[/api/auth/register] Error message:', e?.message);
            console.error('[/api/auth/register] Error stack:', e?.stack);
            console.error('[/api/auth/register] Error code:', e?.code);
            console.error('[/api/auth/register] Error details:', {
                name: e?.name,
                message: e?.message,
                code: e?.code,
                cause: e?.cause
            });
            
            // 개발 환경에서는 더 자세한 에러 정보 제공
            const errorMessage = process.env.NODE_ENV === 'development' 
                ? `서버 등록 중 오류가 발생했습니다: ${e?.message || 'Unknown error'}`
                : '서버 등록 중 오류가 발생했습니다.';
            
            res.status(500).json({ 
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? {
                    name: e?.name,
                    message: e?.message,
                    code: e?.code
                } : undefined
            });
        }
    });

    app.post('/api/auth/login', (req, res, next) => {
        (async () => {
        let responseSent = false;
        console.log('[/api/auth/login] Received request');
        console.log('[/api/auth/login] Request body type:', typeof req.body, req.body ? '(present)' : '(missing)');
        
        // 데이터베이스 연결 상태 확인
        try {
            const dbConnected = await db.isDatabaseConnected();
            if (!dbConnected) {
                console.error('[/api/auth/login] Database not connected');
                console.error('[/api/auth/login] DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');
                if (!responseSent && !res.headersSent) {
                    responseSent = true;
                    return res.status(503).json({ 
                        message: '데이터베이스 연결이 되지 않았습니다. 잠시 후 다시 시도해주세요.',
                        error: process.env.NODE_ENV === 'development' ? 'Database connection check failed' : undefined
                    });
                }
                return;
            }
        } catch (dbCheckError: any) {
            console.error('[/api/auth/login] Database connection check failed:', dbCheckError);
            console.error('[/api/auth/login] Error details:', {
                message: dbCheckError?.message,
                code: dbCheckError?.code,
                stack: dbCheckError?.stack?.split('\n').slice(0, 3).join('\n')
            });
            if (!responseSent && !res.headersSent) {
                responseSent = true;
                return res.status(503).json({ 
                    message: '데이터베이스 연결 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                    error: process.env.NODE_ENV === 'development' ? dbCheckError?.message : undefined
                });
            }
            return;
        }
        
        // 요청 타임아웃 (8초 - 프록시 502 방지, Railway 등)
        const requestTimeout = setTimeout(() => {
            if (!responseSent && !res.headersSent) {
                responseSent = true;
                console.error('[/api/auth/login] Request timeout after 8 seconds');
                try {
                    res.status(504).json({ message: '로그인 요청이 시간 초과되었습니다. 다시 시도해주세요.' });
                } catch (err) {
                    console.error('[/api/auth/login] Failed to send timeout response:', err);
                    if (!res.headersSent) {
                        res.status(504).end();
                    }
                }
            }
        }, 8000);
        
        // 요청이 종료되면 타임아웃 정리
        req.on('close', () => {
            clearTimeout(requestTimeout);
        });
        
        const sendResponse = (status: number, data: any) => {
            clearTimeout(requestTimeout);
            if (!responseSent) {
                try {
                    responseSent = true;
                    res.status(status).json(data);
                } catch (err) {
                    console.error('[/api/auth/login] Failed to send response:', err);
                    if (!res.headersSent) {
                        try {
                            res.status(status).end(JSON.stringify(data));
                        } catch (e2) {
                            console.error('[/api/auth/login] Failed to send fallback response:', e2);
                        }
                    }
                }
            }
        };
        
        try {
            // Request body validation
            if (!req.body || typeof req.body !== 'object') {
                console.error('[/api/auth/login] Invalid request body:', req.body);
                console.error('[/api/auth/login] Request headers:', req.headers['content-type']);
                sendResponse(400, { message: '잘못된 요청 형식입니다.' });
                return;
            }
            
            const { username, password } = req.body;
            if (!username || !password) {
                console.error('[/api/auth/login] Missing username or password:', { username: !!username, password: !!password });
                sendResponse(400, { message: '아이디와 비밀번호를 모두 입력해주세요.' });
                return;
            }
            
            console.log('[/api/auth/login] Attempting to get user credentials for:', username);
            // 데이터베이스 조회에 타임아웃 추가 (2초 - Railway 환경 최적화)
            let credentials: { username: string; passwordHash: string; userId: string } | null = null;
            try {
                const credentialsTimeout = new Promise<null>((_, reject) => 
                    setTimeout(() => reject(new Error('getUserCredentials timeout')), 2000)
                );
                credentials = await Promise.race([
                    db.getUserCredentials(username),
                    credentialsTimeout
                ]);
                
                if (credentials) {
                    console.log('[/api/auth/login] Credentials found for username:', username);
                } else {
                    console.log('[/api/auth/login] No credentials found for username. Attempting to get user by nickname:', username);
                    const nicknameTimeout = new Promise<null>((_, reject) => 
                        setTimeout(() => reject(new Error('getUserByNickname timeout')), 2000)
                    );
                    const userByNickname = await Promise.race([
                        db.getUserByNickname(username),
                        nicknameTimeout
                    ]) as any;
                    
                    if (userByNickname) {
                        console.log('[/api/auth/login] User found by nickname. Getting credentials by userId:', userByNickname.id);
                        const userIdTimeout = new Promise<null>((_, reject) => 
                            setTimeout(() => reject(new Error('getUserCredentialsByUserId timeout')), 2000)
                        );
                        credentials = await Promise.race([
                            db.getUserCredentialsByUserId(userByNickname.id),
                            userIdTimeout
                        ]);
                        
                        if (credentials) {
                            console.log('[/api/auth/login] Credentials found by userId for nickname:', username);
                        } else {
                            console.log('[/api/auth/login] No credentials found by userId for nickname:', username);
                        }
                    } else {
                        console.log('[/api/auth/login] No user found by nickname:', username);
                    }
                }
            } catch (dbError: any) {
                console.error('[/api/auth/login] Database query failed or timed out:', dbError?.message);
                // 데이터베이스 조회 실패 시 인증 실패로 처리
                sendResponse(500, { message: '데이터베이스 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
                return;
            }

            if (!credentials || !credentials.passwordHash) {
                console.log('[/api/auth/login] No credentials found for username:', username);
                sendResponse(401, { message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
                return;
            }
            
            // 비밀번호 검증 (bcrypt 권장 · 구형 pbkdf2/평문은 로그인 시 bcrypt로 이관)
            let isValidPassword = false;

            if (credentials.passwordHash) {
                if (
                    credentials.passwordHash.startsWith('$2a$') ||
                    credentials.passwordHash.startsWith('$2b$') ||
                    credentials.passwordHash.startsWith('$2y$')
                ) {
                    isValidPassword = await verifyPassword(password, credentials.passwordHash);
                } else if (credentials.passwordHash.length < 20) {
                    // 구형 평문 저장분 → 성공 시 bcrypt로 교체
                    if (password === credentials.passwordHash) {
                        const { hashPassword } = await import('./utils/passwordUtils.js');
                        const newHash = await hashPassword(password);
                        await db.updateUserCredentialPassword(credentials.userId, { passwordHash: newHash });
                        isValidPassword = true;
                    } else {
                        isValidPassword = false;
                    }
                } else {
                    // pbkdf2 `hash:salt` 또는 salt 없는 128자 hex(구 시드) 등
                    if (credentials.passwordHash.length === 128 && /^[0-9a-f]+$/i.test(credentials.passwordHash)) {
                        // salt가 DB에 없던 초기 시드: 검증 불가 → 알려진 기본 비밀번호로만 이관 (로그인 시 bcrypt로 교체)
                        if (password === '1217') {
                            const { hashPassword } = await import('./utils/passwordUtils.js');
                            const newHash = await hashPassword(password);
                            await db.updateUserCredentialPassword(credentials.userId, { passwordHash: newHash });
                            isValidPassword = true;
                        } else {
                            isValidPassword = false;
                        }
                    } else {
                        isValidPassword = await verifyPassword(password, credentials.passwordHash);
                    }
                }
            }
            
            if (!isValidPassword) {
                console.log('[/api/auth/login] Authentication failed for username:', username);
                sendResponse(401, { message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
                return;
            }
            console.log('[/api/auth/login] Authentication successful for username:', username, '. Getting user details.');
            // 사용자 조회에 타임아웃 추가 (5초 - Railway 환경 최적화)
            // equipment/inventory는 제외하여 빠르게 조회
            // 재시도 로직 추가 (데이터베이스 연결이 불안정할 수 있음)
            let user: types.User | null = null;
            let getUserAttempts = 0;
            const maxGetUserAttempts = 2; // 재시도 횟수 감소 (2회로 제한)
            let getUserError: any = null;
            
            while (getUserAttempts < maxGetUserAttempts) {
                try {
                    getUserAttempts++;
                    if (getUserAttempts > 1) {
                        console.log(`[/api/auth/login] Retrying getUser (attempt ${getUserAttempts}/${maxGetUserAttempts})...`);
                        // 재시도 전 짧은 대기 (지수 백오프)
                        await new Promise(resolve => setTimeout(resolve, 500 * getUserAttempts));
                    }
                    
                    const getUserTimeout = new Promise<null>((_, reject) => 
                        setTimeout(() => reject(new Error('getUser timeout')), 5000)
                    );
                    const fetchedUser = await Promise.race([
                        db.getUser(credentials.userId, { includeEquipment: false, includeInventory: false }),
                        getUserTimeout
                    ]) as types.User | null;
                    
                    if (!fetchedUser) {
                        console.log('[/api/auth/login] User not found for userId:', credentials.userId);
                        sendResponse(404, { message: '사용자를 찾을 수 없습니다.' });
                        return;
                    }
                    user = fetchedUser;
                    console.log('[/api/auth/login] User details retrieved for userId:', credentials.userId);
                    getUserError = null; // 성공 시 에러 초기화
                    break; // 성공 시 루프 종료
                } catch (err: any) {
                    getUserError = err;
                    console.warn(`[/api/auth/login] getUser attempt ${getUserAttempts} failed:`, err?.message);
                    if (getUserAttempts >= maxGetUserAttempts) {
                        // 마지막 시도 실패
                        console.error('[/api/auth/login] getUser failed after all retries:', getUserError?.message);
                        sendResponse(500, { message: '사용자 정보 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
                        return;
                    }
                    // 다음 시도 계속
                }
            }
            
            if (getUserError || !user) {
                console.error('[/api/auth/login] getUser failed after retries:', getUserError?.message);
                sendResponse(500, { message: '사용자 정보 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
                return;
            }
            
            // TypeScript가 user가 null이 아님을 인식하도록 타입 단언
            // (위의 체크에서 이미 null이 아님을 확인했으므로 안전함)
            let userForLogin: types.User = user;
            const loginNow = Date.now();
            if (userForLogin.connectionBanUntil && userForLogin.connectionBanUntil > loginNow) {
                const remainingMs = userForLogin.connectionBanUntil - loginNow;
                const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 1000 / 60));
                sendResponse(403, {
                    message: '접속이 제한된 계정입니다.',
                    banInfo: {
                        sanctionType: 'connection',
                        reason: userForLogin.connectionBanReason || '관리자 제재',
                        expiresAt: userForLogin.connectionBanUntil,
                        remainingMinutes,
                        history: (userForLogin.sanctionHistory || []).filter((x) => x.sanctionType === 'connection').slice(0, 5),
                    },
                });
                return;
            }

            const ipAllow = await ensureClientIpAllowsSession(volatileState, req, res, userForLogin.id, !!userForLogin.isAdmin);
            if (!ipAllow.ok) {
                sendResponse(403, { message: ipAllow.message });
                return;
            }

            const defaultBaseStats = createDefaultBaseStats();
            if (!userForLogin.baseStats) {
                userForLogin.baseStats = defaultBaseStats;
                await db.updateUser(userForLogin);
            } else {
                // Check if baseStats needs to be reset
                const coreStats = Object.values(types.CoreStat || {});
                if (coreStats.length > 0 && userForLogin && (
                    Object.keys(userForLogin.baseStats).length !== Object.keys(defaultBaseStats).length ||
                    !coreStats.every(stat => userForLogin && (userForLogin.baseStats as Record<types.CoreStat, number>)[stat] === 100)
                )) {
                    userForLogin.baseStats = defaultBaseStats;
                    await db.updateUser(userForLogin);
                }
            }
            
            const userBeforeUpdate = JSON.stringify(userForLogin);

            if (!userForLogin.ownedBorders?.includes('simple_black')) {
                if (!userForLogin.ownedBorders) userForLogin.ownedBorders = ['default'];
                userForLogin.ownedBorders.push('simple_black');
            }

            const hadInventoryBefore = Array.isArray(userForLogin.inventory) && userForLogin.inventory.length > 0;
            const hadEquipmentBefore = userForLogin.equipment && Object.keys(userForLogin.equipment).length > 0;

            // 무거운 작업들에 타임아웃 추가 (각 3초 - Railway 환경 최적화)
            let updatedUser = userForLogin;
            try {
                const questTimeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('resetAndGenerateQuests timeout')), 3000)
                );
                updatedUser = await Promise.race([
                    resetAndGenerateQuests(user),
                    questTimeout
                ]) as typeof user;
            } catch (questError: any) {
                console.warn('[/api/auth/login] resetAndGenerateQuests failed or timed out:', questError?.message);
                // 퀘스트 재설정 실패해도 로그인은 계속 진행
            }

            try {
                const leagueTimeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('processWeeklyLeagueUpdates timeout')), 3000)
                );
                updatedUser = await Promise.race([
                    processWeeklyLeagueUpdates(updatedUser),
                    leagueTimeout
                ]) as typeof updatedUser;
            } catch (leagueError: any) {
                console.warn('[/api/auth/login] processWeeklyLeagueUpdates failed or timed out:', leagueError?.message);
                // 리그 업데이트 실패해도 로그인은 계속 진행
            }

            try {
                const actionPointTimeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('regenerateActionPoints timeout')), 3000)
                );
                updatedUser = await Promise.race([
                    regenerateActionPoints(updatedUser),
                    actionPointTimeout
                ]) as typeof updatedUser;
            } catch (actionPointError: any) {
                console.warn('[/api/auth/login] regenerateActionPoints failed or timed out:', actionPointError?.message);
                // 액션 포인트 재생성 실패해도 로그인은 계속 진행
            }

            const hasInventoryNow = Array.isArray(updatedUser.inventory) && updatedUser.inventory.length > 0;
            const hasEquipmentNow = updatedUser.equipment && Object.keys(updatedUser.equipment).length > 0;

            if (hadInventoryBefore && !hasInventoryNow) {
                console.error(`[/api/auth/login] CRITICAL: Inventory vanished during login pipeline for user ${userForLogin.id}. Restoring previous inventory snapshot.`);
                updatedUser.inventory = JSON.parse(JSON.stringify(userForLogin.inventory));
            }
            if (hadEquipmentBefore && !hasEquipmentNow) {
                console.error(`[/api/auth/login] CRITICAL: Equipment vanished during login pipeline for user ${userForLogin.id}. Restoring previous equipment snapshot.`);
                updatedUser.equipment = JSON.parse(JSON.stringify(userForLogin.equipment));
            }

            const userLevelSum = updatedUser.strategyLevel + updatedUser.playfulLevel;
            let itemsUnequipped = false;
            const validEquipped: types.Equipment = {};
            
            // equipment와 inventory가 모두 존재하는지 확인
            // 관리자 계정의 경우 장비 데이터 손실을 방지하기 위해 특별 처리
            if (updatedUser.equipment && typeof updatedUser.equipment === 'object' && Object.keys(updatedUser.equipment).length > 0) {
                if (!updatedUser.inventory || !Array.isArray(updatedUser.inventory) || updatedUser.inventory.length === 0) {
                    // 관리자 계정은 절대 장비를 삭제하지 않음 (데이터 손실 방지)
                    if (updatedUser.isAdmin) {
                        console.error(`[/api/auth/login] CRITICAL: Admin user ${updatedUser.id} has equipment but empty inventory! Preserving equipment. DO NOT DELETE.`);
                        console.error(`[/api/auth/login] Admin equipment:`, JSON.stringify(updatedUser.equipment));
                        // 관리자 계정의 경우 장비를 절대 삭제하지 않음
                        // equipment는 그대로 유지하고 경고만 출력
                        // itemsUnequipped는 false로 유지하여 equipment가 유지되도록 함
                    } else {
                        console.warn(`[/api/auth/login] User ${updatedUser.id} has equipment but empty inventory! This may indicate data loss. Preserving equipment for recovery.`);
                        // 일반 사용자도 장비를 보존 (데이터 손실 방지)
                        // equipment는 유지하고 나중에 복원 가능하도록 함
                        // itemsUnequipped는 false로 유지
                    }
                    // 장비를 삭제하지 않고 유지 (데이터 손실 방지)
                    // itemsUnequipped는 true로 설정하지 않음
                } else {
                    for(const slot in updatedUser.equipment) {
                        const itemId = updatedUser.equipment[slot as types.EquipmentSlot];
                        const item = updatedUser.inventory.find(i => i.id === itemId);
                        if (item) {
                            const requiredLevel = GRADE_LEVEL_REQUIREMENTS[item.grade];
                            if (userLevelSum >= requiredLevel) {
                                validEquipped[slot as types.EquipmentSlot] = itemId;
                            } else {
                                const invItem = updatedUser.inventory.find(i => i.id === itemId);
                                if(invItem) invItem.isEquipped = false;
                                itemsUnequipped = true;
                            }
                        } else {
                            // inventory에 아이템이 없지만, equipment는 유지 (데이터 손실 방지)
                            // 로그인 시에는 제거하지 않고 유지하여 나중에 복원 가능하도록 함
                            console.warn(`[/api/auth/login] User ${updatedUser.id} has equipment ${itemId} in slot ${slot} but item not found in inventory. Keeping equipment for data preservation.`);
                            validEquipped[slot as types.EquipmentSlot] = itemId;
                            // 데이터 손실을 방지하기 위해 equipment는 유지
                        }
                    }
                    if (itemsUnequipped && Object.keys(validEquipped).length < Object.keys(updatedUser.equipment).length) {
                        updatedUser.equipment = validEquipped;
                    }
                }
            }

            const allGameModesList = [...SPECIAL_GAME_MODES, ...PLAYFUL_GAME_MODES].map(m => m.mode);
            let statsMigrated = false;
            if (!updatedUser.stats) {
                updatedUser.stats = {};
            }
            for (const mode of allGameModesList) {
                if (!updatedUser.stats[mode]) {
                    updatedUser.stats[mode] = { wins: 0, losses: 0, rankingScore: 1200 };
                    statsMigrated = true;
                }
            }

            // --- Equipment Presets Migration Logic ---
            let presetsMigrated = false;
            if (!updatedUser.equipmentPresets || updatedUser.equipmentPresets.length === 0) { // Check for empty array too
                updatedUser.equipmentPresets = [
                    { name: '프리셋 1', equipment: updatedUser.equipment || {} }, // Initialize with current equipment
                    { name: '프리셋 2', equipment: {} },
                    { name: '프리셋 3', equipment: {} },
                    { name: '프리셋 4', equipment: {} },
                    { name: '프리셋 5', equipment: {} },
                ];
                presetsMigrated = true;
            }
            // --- End Equipment Presets Migration Logic ---

            // equipment와 inventory의 isEquipped 플래그 동기화 (전투력 계산을 위해 필수)
            if (updatedUser.equipment && typeof updatedUser.equipment === 'object' && Object.keys(updatedUser.equipment).length > 0) {
                if (updatedUser.inventory && Array.isArray(updatedUser.inventory)) {
                    // 먼저 모든 장비 아이템의 isEquipped를 false로 설정
                    updatedUser.inventory.forEach(item => {
                        if (item.type === 'equipment') {
                            item.isEquipped = false;
                        }
                    });
                    
                    // equipment에 있는 아이템 ID들을 inventory에서 찾아서 isEquipped = true로 설정
                    for (const [slot, itemId] of Object.entries(updatedUser.equipment)) {
                        const item = updatedUser.inventory.find(i => i.id === itemId);
                        if (item && item.type === 'equipment') {
                            item.isEquipped = true;
                        }
                    }
                }
            }

            // 로그인 시 최근 접속 시각 갱신 (길드원 목록 등에서 사용)
            updatedUser.lastLoginAt = Date.now();

            // 사용자 업데이트에 타임아웃 추가 (3초 - Railway 환경 최적화)
            if (userBeforeUpdate !== JSON.stringify(updatedUser) || statsMigrated || itemsUnequipped || presetsMigrated) {
                try {
                    const updateTimeout = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('updateUser timeout')), 3000)
                    );
                    await Promise.race([
                        db.updateUser(updatedUser),
                        updateTimeout
                    ]);
                    userForLogin = updatedUser;
                } catch (updateError: any) {
                    console.warn('[/api/auth/login] updateUser failed or timed out:', updateError?.message);
                    // 사용자 업데이트 실패해도 로그인은 계속 진행 (기존 userForLogin 사용)
                }
            }

            if (volatileState.userConnections[userForLogin.id]) {
                console.log(`[Auth] Concurrent login for ${userForLogin.nickname}. Terminating old session and establishing new one.`);
            }
            
            // 최적화: 사용자가 참여한 게임만 찾기 (전체 게임 목록 조회 대신)
            // volatileState에서 먼저 확인하고, 없으면 캐시 또는 DB에서 조회
            // 게임 조회에 타임아웃 추가 (2초 - Railway 환경 최적화)
            let activeGame: types.LiveGameSession | null = null;
            try {
                const gameTimeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('getActiveGame timeout')), 2000)
                );
                
                const gamePromise = (async () => {
                    const userStatus = volatileState.userStatuses[userForLogin.id];
                    if (userStatus?.gameId) {
                        // 캐시에서 먼저 확인
                        const { getCachedGame } = await import('./gameCache.js');
                        let game = await getCachedGame(userStatus.gameId);
                        
                        // 캐시에 없으면 DB에서 직접 조회
                        if (!game) {
                            const { getLiveGame } = await import('./db.js');
                            game = await getLiveGame(userStatus.gameId);
                        }
                        return game;
                    } else {
                        // volatileState에 gameId가 없을 수 있으므로, 서버 메모리 캐시에서 먼저 전체 활성 게임을 확인
                        // (재접속 시점 레이스/상태 유실로 userStatus가 online인 경우도 PVP 자동 복귀 보장)
                        try {
                            const { getAllCachedGames } = await import('./gameCache.js');
                            const cachedMatch = getAllCachedGames().find(
                                (g) => g && (g.player1?.id === userForLogin.id || g.player2?.id === userForLogin.id)
                            );
                            if (cachedMatch) return cachedMatch;
                        } catch {
                            // 캐시 조회 실패 시 DB fallback
                        }

                        // DB fallback: 사용자 ID로 활성 게임 검색
                        const { getLiveGameByPlayerId } = await import('./prisma/gameService.js');
                        return await getLiveGameByPlayerId(userForLogin.id);
                    }
                })();
                
                activeGame = await Promise.race([gamePromise, gameTimeout]) as types.LiveGameSession | null;
            } catch (gameError: any) {
                console.warn('[/api/auth/login] Failed to get active game for user:', gameError?.message);
                // 게임 조회 실패는 치명적이지 않으므로 계속 진행
            }
    
            // 게임 상태 업데이트에 타임아웃 추가 (2초 - Railway 환경 최적화)
            try {
                const gameStateTimeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('gameStateUpdate timeout')), 2000)
                );
                
                const gameStatePromise = (async () => {
                    if (activeGame) {
                        // 90초 내에 재접속한 경우 경기 재개
                        if (activeGame.disconnectionState?.disconnectedPlayerId === userForLogin.id) {
                            // 90초 내에 재접속했는지 확인
                            const now = Date.now();
                            const timeSinceDisconnect = now - activeGame.disconnectionState.timerStartedAt;
                            if (timeSinceDisconnect <= 90000) {
                                // 재접속 성공: disconnectionState 제거하고 경기 재개
                                activeGame.disconnectionState = null;
                                const otherPlayerId = activeGame.player1.id === userForLogin.id ? activeGame.player2.id : activeGame.player1.id;
                                if (activeGame.canRequestNoContest?.[otherPlayerId]) {
                                    delete activeGame.canRequestNoContest[otherPlayerId];
                                }
                                await db.saveGame(activeGame);
                                
                                // 게임 업데이트 브로드캐스트
                                const { broadcastToGameParticipants } = await import('./socket.js');
                                broadcastToGameParticipants(activeGame.id, { type: 'GAME_UPDATE', payload: { [activeGame.id]: activeGame } }, activeGame);
                            }
                        }
                        // 재접속한 유저를 게임 상태로 설정 (자동으로 게임으로 리다이렉트)
                        volatileState.userStatuses[userForLogin.id] = { status: types.UserStatus.InGame, mode: activeGame.mode, gameId: activeGame.id };
                    } else {
                        volatileState.userStatuses[userForLogin.id] = { status: types.UserStatus.Online };
                    }
                })();
                
                await Promise.race([gameStatePromise, gameStateTimeout]);
            } catch (gameStateError: any) {
                console.warn('[/api/auth/login] Failed to update game state:', gameStateError?.message);
                // 게임 상태 업데이트 실패해도 기본 상태로 설정
                volatileState.userStatuses[userForLogin.id] = { status: types.UserStatus.Online };
            }
            
            // 최종 응답 전송: 반드시 실행되도록 보장
            try {
                // JSON 직렬화 시도 (순환 참조 등으로 실패할 수 있음)
                let sanitizedUser: any;
                try {
                    sanitizedUser = JSON.parse(JSON.stringify(userForLogin));
                } catch (jsonError: any) {
                    console.warn('[/api/auth/login] JSON serialization failed, using user object directly:', jsonError?.message);
                    // JSON 직렬화 실패 시 원본 사용 (중요한 필드만 포함)
                    sanitizedUser = {
                        id: userForLogin.id,
                        nickname: userForLogin.nickname,
                        username: userForLogin.username,
                        isAdmin: userForLogin.isAdmin,
                        stats: userForLogin.stats,
                        baseStats: userForLogin.baseStats,
                        inventory: userForLogin.inventory,
                        equipment: userForLogin.equipment,
                        equipmentPresets: userForLogin.equipmentPresets,
                        strategyLevel: userForLogin.strategyLevel,
                        playfulLevel: userForLogin.playfulLevel,
                        gold: userForLogin.gold,
                        ownedBorders: userForLogin.ownedBorders,
                        mail: userForLogin.mail,
                        actionPoints: userForLogin.actionPoints,
                        quests: userForLogin.quests,
                        league: userForLogin.league,
                        tournamentScore: userForLogin.tournamentScore,
                        weeklyCompetitors: userForLogin.weeklyCompetitors
                    };
                }
                const pendingMutualMsg = volatileState.pendingMutualDisconnectByUser?.[userForLogin.id];
                if (pendingMutualMsg) delete volatileState.pendingMutualDisconnectByUser![userForLogin.id];
                // 다른 기기에서 로그인 시 기존 연결된 클라이언트(다른 PC/탭)에 자동 로그아웃 알림
                try {
                    sendToUser(userForLogin.id, {
                        type: 'OTHER_DEVICE_LOGIN',
                        payload: { message: '다른 기기에서 로그인되어 로그아웃되었습니다.' }
                    });
                } catch (notifyErr: any) {
                    console.warn('[/api/auth/login] Notify other devices failed:', notifyErr?.message);
                }
                // 진행 중인 경기가 있으면 응답에 포함해 새 기기에서 즉시 이어하기 가능하도록
                let sanitizedActiveGame: types.LiveGameSession | null = null;
                if (activeGame) {
                    try {
                        sanitizedActiveGame = JSON.parse(JSON.stringify(activeGame)) as types.LiveGameSession;
                    } catch {
                        // 직렬화 실패 시 제외
                    }
                }
                sendResponse(200, {
                    user: sanitizedUser,
                    mutualDisconnectMessage: pendingMutualMsg ?? null,
                    activeGame: sanitizedActiveGame
                });
            } catch (finalError: any) {
                console.error('[/api/auth/login] Failed to send success response:', finalError?.message);
                // 최종 응답 전송 실패 시에도 응답 보장
                if (!responseSent && !res.headersSent) {
                    try {
                        responseSent = true;
                        // 최소한의 사용자 정보만 포함하여 응답
                        res.status(200).json({ 
                            user: {
                                id: userForLogin.id,
                                nickname: userForLogin.nickname,
                                username: userForLogin.username,
                                isAdmin: userForLogin.isAdmin
                            }
                        });
                    } catch (lastResortError: any) {
                        console.error('[/api/auth/login] CRITICAL: Failed to send any response:', lastResortError?.message);
                        // 마지막 수단: Express 에러 핸들러에 전달
                        if (!res.headersSent) {
                            try {
                                res.status(200).end('{"user":{"id":"' + userForLogin.id + '","nickname":"' + (userForLogin.nickname || '') + '"}}');
                            } catch (absoluteLastError) {
                                // 모든 시도 실패 - 연결이 이미 끊어진 것으로 간주
                                console.error('[/api/auth/login] ABSOLUTE LAST RESORT FAILED');
                            }
                        }
                    }
                }
            }
        } catch (e: any) {
            clearTimeout(requestTimeout);
            
            // 상세한 에러 정보 수집
            const errorInfo = {
                timestamp: new Date().toISOString(),
                endpoint: '/api/auth/login',
                error: e,
                errorName: e?.name,
                errorMessage: e?.message,
                errorCode: e?.code,
                errorStack: e?.stack,
                username: req.body?.username || 'N/A',
                requestId: req.headers['x-request-id'] || 'N/A',
                pid: process.pid,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                responseSent: responseSent,
                headersSent: res.headersSent
            };
            
            // 상세한 에러 로깅
            console.error('[/api/auth/login] ========== LOGIN ERROR ==========');
            console.error('[/api/auth/login] Timestamp:', errorInfo.timestamp);
            console.error('[/api/auth/login] PID:', errorInfo.pid);
            console.error('[/api/auth/login] Username:', errorInfo.username);
            console.error('[/api/auth/login] Error name:', errorInfo.errorName);
            console.error('[/api/auth/login] Error message:', errorInfo.errorMessage);
            console.error('[/api/auth/login] Error code:', errorInfo.errorCode);
            console.error('[/api/auth/login] Error stack:', errorInfo.errorStack);
            console.error('[/api/auth/login] Memory:', JSON.stringify(errorInfo.memory));
            console.error('[/api/auth/login] Response sent:', errorInfo.responseSent);
            console.error('[/api/auth/login] Headers sent:', errorInfo.headersSent);
            console.error('[/api/auth/login] Full error info:', JSON.stringify(errorInfo, null, 2));
            console.error('[/api/auth/login] =================================');
            
            // stderr로도 직접 출력 (Railway 로그에 확실히 기록)
            try {
                process.stderr.write(`\n[LOGIN ERROR] at ${errorInfo.timestamp}\n`);
                process.stderr.write(`Username: ${errorInfo.username}\n`);
                process.stderr.write(`Error: ${errorInfo.errorName} - ${errorInfo.errorMessage}\n`);
                process.stderr.write(`Code: ${errorInfo.errorCode || 'N/A'}\n`);
                if (errorInfo.errorStack) {
                    process.stderr.write(`Stack: ${errorInfo.errorStack.substring(0, 500)}\n`);
                }
                process.stderr.write(`Memory: ${JSON.stringify(errorInfo.memory)}\n\n`);
            } catch (stderrError) {
                // stderr 쓰기 실패는 무시
            }
            
            // 데이터베이스 연결 오류인 경우 더 명확한 메시지
            const isDbError = e?.code?.startsWith('P') || 
                            e?.message?.includes('database') || 
                            e?.message?.includes('connection') || 
                            e?.message?.includes('timeout') ||
                            e?.code === 'ECONNREFUSED';
            
            // 응답이 아직 전송되지 않았으면 반드시 전송
            if (!responseSent && !res.headersSent) {
                try {
                    const errorMessage = isDbError 
                        ? '데이터베이스 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
                        : '서버 로그인 처리 중 오류가 발생했습니다.';
                    
                    responseSent = true;
                    res.status(500).json({ 
                        message: errorMessage,
                        error: process.env.NODE_ENV === 'development' ? e?.message : undefined,
                        errorCode: process.env.NODE_ENV === 'development' ? e?.code : undefined
                    });
                } catch (sendError: any) {
                    console.error('[/api/auth/login] Failed to send error response:', sendError?.message);
                    // 마지막 시도: Express 에러 핸들러에 전달
                    if (!res.headersSent) {
                        try {
                            res.status(500).end('Internal Server Error');
                        } catch (lastError) {
                            // 모든 시도 실패 - 연결이 이미 끊어진 것으로 간주
                            console.error('[/api/auth/login] CRITICAL: All response attempts failed');
                        }
                    }
                }
            } else {
                console.error('[/api/auth/login] Response already sent, cannot send error response');
            }
        } finally {
            clearTimeout(requestTimeout);
        }
        })().catch((err: any) => {
            if (!res.headersSent) {
                try {
                    res.status(500).json({ message: '로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
                } catch (_) {
                    try { res.status(500).end(); } catch (_2) {}
                }
            }
            next(err);
        });
    });

    // 카카오 로그인 URL 생성
    app.get('/api/auth/kakao/url', (req, res) => {
        try {
            const url = getKakaoAuthUrl();
            res.json({ url });
        } catch (e: any) {
            console.error('[/api/auth/kakao/url] Error:', e);
            res.status(500).json({ message: '카카오 로그인 URL 생성에 실패했습니다.' });
        }
    });

    // 카카오 로그인 콜백 처리
    app.post('/api/auth/kakao/callback', async (req, res) => {
        try {
            const { code } = req.body;
            if (!code) {
                return res.status(400).json({ message: '인증 코드가 필요합니다.' });
            }

            // 카카오 액세스 토큰 받기
            const accessToken = await getKakaoAccessToken(code);
            
            // 카카오 사용자 정보 가져오기
            const kakaoUserInfo = await getKakaoUserInfo(accessToken);
            
            // 기존 사용자 확인 (카카오 ID로)
            let credentials = await db.getUserCredentialsByKakaoId(kakaoUserInfo.id);
            let user: types.User | null = null;

            if (credentials) {
                // 기존 사용자 로그인
                user = await db.getUser(credentials.userId);
                if (!user) {
                    return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
                }
            } else {
                // 신규 사용자 회원가입
                // 임시 닉네임 생성 (나중에 변경 가능)
                const tempNickname = `user_${randomUUID().slice(0, 8)}`;
                const username = `kakao_${kakaoUserInfo.id}`;

                user = createDefaultUser(`user-${randomUUID()}`, username, tempNickname, false);
                // if (kakaoUserInfo.email) {
                //     (user as any).email = kakaoUserInfo.email; // User 타입에 email 속성이 없으므로 주석 처리
                // }

                user = await resetAndGenerateQuests(user);
                await db.createUser(user);
                
                // 카카오 ID로 인증 정보 생성 (비밀번호 없음)
                await db.createUserCredentials(username, null, user.id, kakaoUserInfo.id);
                
                // 카카오 이메일이 있으면 자동 인증 처리
                if (kakaoUserInfo.email) {
                    await db.verifyUserEmail(user.id);
                }
            }

            // 로그인 시 최근 접속 시각 갱신 (길드원 목록 등에서 사용)
            user.lastLoginAt = Date.now();
            await db.updateUser(user).catch(err => console.warn('[Kakao] Failed to update lastLoginAt:', err?.message));

            const kakaoIp = await ensureClientIpAllowsSession(volatileState, req, res, user.id, !!user.isAdmin);
            if (!kakaoIp.ok) {
                return res.status(403).json({ message: kakaoIp.message });
            }

            // 로그인 처리
            volatileState.userConnections[user.id] = Date.now();
            volatileState.userStatuses[user.id] = { status: types.UserStatus.Online };

            res.json({ user });
        } catch (e: any) {
            console.error('[/api/auth/kakao/callback] Error:', e);
            res.status(500).json({ message: '카카오 로그인 처리 중 오류가 발생했습니다.', error: process.env.NODE_ENV === 'development' ? e?.message : undefined });
        }
    });

    // 구글 로그인 URL 생성
    app.get('/api/auth/google/url', (req, res) => {
        try {
            const url = getGoogleAuthUrl();
            res.json({ url });
        } catch (e: any) {
            console.error('[/api/auth/google/url] Error:', e);
            res.status(500).json({ message: '구글 로그인 URL 생성에 실패했습니다.' });
        }
    });

    // 구글 로그인 콜백 처리
    app.post('/api/auth/google/callback', async (req, res) => {
        try {
            const { code } = req.body;
            if (!code) {
                return res.status(400).json({ message: '인증 코드가 필요합니다.' });
            }

            // 구글 액세스 토큰 받기
            const accessToken = await getGoogleAccessToken(code);

            // 구글 사용자 정보 가져오기
            const googleUserInfo = await getGoogleUserInfo(accessToken);

            // 기존 사용자 확인 (구글 ID로)
            let credentials = await db.getUserCredentialsByGoogleId(googleUserInfo.id);
            let user: types.User | null = null;

            if (credentials) {
                // 기존 사용자 로그인
                user = await db.getUser(credentials.userId);
                if (!user) {
                    return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
                }
            } else {
                // 신규 사용자 회원가입
                const tempNickname = `user_${randomUUID().slice(0, 8)}`;
                const username = `google_${googleUserInfo.id}`;

                user = createDefaultUser(`user-${randomUUID()}`, username, tempNickname, false);

                user = await resetAndGenerateQuests(user);
                await db.createUser(user);

                // 구글 ID로 인증 정보 생성 (비밀번호 없음)
                await db.createUserCredentials(username, null, user.id, null, googleUserInfo.id);

                // 구글 이메일이 있으면 자동 인증 처리
                if (googleUserInfo.email) {
                    await db.verifyUserEmail(user.id);
                }
            }

            // 로그인 시 최근 접속 시각 갱신
            user.lastLoginAt = Date.now();
            await db.updateUser(user).catch(err => console.warn('[Google] Failed to update lastLoginAt:', err?.message));

            const googleIp = await ensureClientIpAllowsSession(volatileState, req, res, user.id, !!user.isAdmin);
            if (!googleIp.ok) {
                return res.status(403).json({ message: googleIp.message });
            }

            // 로그인 처리
            volatileState.userConnections[user.id] = Date.now();
            volatileState.userStatuses[user.id] = { status: types.UserStatus.Online };

            res.json({ user });
        } catch (e: any) {
            console.error('[/api/auth/google/callback] Error:', e);
            res.status(500).json({ message: '구글 로그인 처리 중 오류가 발생했습니다.', error: process.env.NODE_ENV === 'development' ? e?.message : undefined });
        }
    });

    // 이메일 인증 코드 전송
    app.post('/api/auth/email/send-verification', async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ message: '이메일을 입력해주세요.' });
            }

            // 사용자 확인 (DB 쿼리로 최적화)
            const user = await db.getUserByEmail(email.toLowerCase());
            if (!user) {
                return res.status(404).json({ message: '해당 이메일로 가입된 사용자를 찾을 수 없습니다.' });
            }

            // 인증 코드 전송
            const { token } = await sendEmailVerification(user.id, email);
            res.json({ message: '인증 코드가 이메일로 전송되었습니다.', token });
        } catch (e: any) {
            console.error('[/api/auth/email/send-verification] Error:', e);
            res.status(500).json({ message: '인증 코드 전송에 실패했습니다.', error: process.env.NODE_ENV === 'development' ? e?.message : undefined });
        }
    });

    // 이메일 인증 코드 검증
    app.post('/api/auth/email/verify', async (req, res) => {
        try {
            const { userId, code } = req.body;
            if (!userId || !code) {
                return res.status(400).json({ message: '사용자 ID와 인증 코드를 입력해주세요.' });
            }

            const isValid = await verifyEmailCode(userId, code);
            if (!isValid) {
                return res.status(400).json({ message: '인증 코드가 올바르지 않거나 만료되었습니다.' });
            }

            res.json({ message: '이메일 인증이 완료되었습니다.' });
        } catch (e: any) {
            console.error('[/api/auth/email/verify] Error:', e);
            res.status(500).json({ message: '이메일 인증 처리 중 오류가 발생했습니다.', error: process.env.NODE_ENV === 'development' ? e?.message : undefined });
        }
    });

    // 닉네임 중복/유효성 확인
    app.get('/api/auth/check-nickname', async (req, res) => {
        try {
            const rawNickname = typeof req.query.nickname === 'string' ? req.query.nickname : '';
            const nickname = rawNickname.trim();
            const userId = typeof req.query.userId === 'string' ? req.query.userId : '';

            if (!nickname) {
                return res.status(400).json({ available: false, message: '닉네임을 입력해주세요.' });
            }

            if (nickname.length < NICKNAME_MIN_LENGTH || nickname.length > NICKNAME_MAX_LENGTH) {
                return res.status(400).json({
                    available: false,
                    message: `닉네임은 ${NICKNAME_MIN_LENGTH}자 이상 ${NICKNAME_MAX_LENGTH}자 이하여야 합니다.`,
                });
            }

            if (containsProfanity(nickname)) {
                return res.status(400).json({ available: false, message: '닉네임에 부적절한 단어가 포함되어 있습니다.' });
            }

            const viewer = userId ? await db.getUser(userId) : null;
            if (!viewer?.isAdmin && nicknameContainsReservedStaffTerms(nickname) && !viewer?.staffNicknameDisplayEligibility) {
                return res.status(400).json({ available: false, message: RESERVED_STAFF_NICKNAME_USER_MESSAGE });
            }

            const existingUser = await db.getUserByNickname(nickname);
            if (existingUser && existingUser.id !== userId) {
                return res.status(409).json({ available: false, message: '이미 사용 중인 닉네임입니다.' });
            }

            return res.json({ available: true, message: '사용 가능한 닉네임입니다.' });
        } catch (e: any) {
            console.error('[/api/auth/check-nickname] Error:', e);
            return res.status(500).json({
                available: false,
                message: '닉네임 확인 중 오류가 발생했습니다.',
                error: process.env.NODE_ENV === 'development' ? e?.message : undefined,
            });
        }
    });

    // 닉네임 설정
    app.post('/api/auth/set-nickname', async (req, res) => {
        try {
            const { nickname, userId, avatarId: bodyAvatarId } = req.body;
            
            if (!nickname) {
                return res.status(400).json({ message: '닉네임을 입력해주세요.' });
            }
            
            if (!userId) {
                return res.status(401).json({ message: '로그인이 필요합니다.' });
            }
            
            if (nickname.trim().length < NICKNAME_MIN_LENGTH || nickname.trim().length > NICKNAME_MAX_LENGTH) {
                return res.status(400).json({ message: `닉네임은 ${NICKNAME_MIN_LENGTH}자 이상 ${NICKNAME_MAX_LENGTH}자 이하여야 합니다.` });
            }
            
            if (containsProfanity(nickname)) {
                return res.status(400).json({ message: '닉네임에 부적절한 단어가 포함되어 있습니다.' });
            }

            const user = await db.getUser(userId);
            if (!user) {
                return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
            }

            if (!user.isAdmin && nicknameContainsReservedStaffTerms(nickname)) {
                return res.status(400).json({ message: RESERVED_STAFF_NICKNAME_USER_MESSAGE });
            }

            // 닉네임 중복 확인 (DB 쿼리로 최적화)
            const existingUser = await db.getUserByNickname(nickname.trim());
            if (existingUser && existingUser.id !== userId) {
                return res.status(409).json({ message: '이미 사용 중인 닉네임입니다.' });
            }
            
            const hadTemporaryNickname = !user.nickname || String(user.nickname).startsWith('user_');

            // 닉네임 업데이트
            user.nickname = nickname.trim();
            if (!user.isAdmin) {
                user.staffNicknameDisplayEligibility = false;
            }
            if (!user.isAdmin && hadTemporaryNickname) {
                // 최초 가입 닉네임 확정 직후 홈 진입 시 튜토리얼을 바로 시작한다.
                (user as types.User & { onboardingTutorialPendingFirstHome?: boolean }).onboardingTutorialPendingFirstHome = true;
            }

            if (bodyAvatarId != null && String(bodyAvatarId).trim() !== '') {
                const aid = String(bodyAvatarId).trim();
                if (!AVATAR_POOL.some((a) => a.id === aid)) {
                    return res.status(400).json({ message: '잘못된 아바타입니다.' });
                }
                user.avatarId = aid;
            }

            await db.updateUser(user);

            // 저장 직후 DB/캐시 기준으로 다시 읽어 응답·브로드캐스트 일치 (클라이언트 홈 이동 조건과 동기화)
            const updatedUser = (await db.getUser(userId)) ?? user;

            // 모든 클라이언트에 닉네임·아바타 변경 브로드캐스트 (대기실·프로필 등에서 즉시 반영)
            broadcastUserUpdate(updatedUser, ['nickname', 'avatarId', 'staffNicknameDisplayEligibility']);

            res.json({ user: updatedUser });
        } catch (e: any) {
            console.error('[/api/auth/set-nickname] Error:', e);
            res.status(500).json({ message: '닉네임 설정 중 오류가 발생했습니다.', error: process.env.NODE_ENV === 'development' ? e?.message : undefined });
        }
    });

    // 유저 경량 정보 (목록 표시용) - 온디맨드 로딩, ids 쿼리: id1,id2,id3
    app.get('/api/users/brief', async (req, res) => {
        try {
            const idsParam = req.query.ids;
            if (!idsParam || typeof idsParam !== 'string') {
                return res.status(400).json({ error: 'ids query parameter is required' });
            }
            const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
            if (ids.length === 0) {
                return res.json([]);
            }
            const brief = await db.getUsersBrief(ids);
            res.json(brief);
        } catch (error: any) {
            console.error('[/api/users/brief] Error:', error);
            res.status(500).json({ error: 'Failed to fetch user brief data' });
        }
    });

    // 유저 프로필 정보 가져오기 (공개 정보만)
    app.get('/api/user/:userId', async (req, res) => {
        try {
            const { userId } = req.params;
            if (!userId) {
                return res.status(400).json({ error: 'User ID is required' });
            }
            
            // 공개 정보 반환: 장비 슬롯 + 장착 중인 아이템만 포함 (타인 프로필에서 장비/능력치 표시용)
            const user = await db.getUser(userId, { includeEquipment: true, includeInventory: true });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            const equipIds = new Set(Object.values(user.equipment || {}).filter(Boolean));
            const equippedItems = Array.isArray(user.inventory) ? user.inventory.filter((item: any) => item && equipIds.has(item.id)) : [];

            const publicUser: Record<string, unknown> = {
                id: user.id,
                username: user.username,
                nickname: user.nickname,
                avatarId: user.avatarId,
                borderId: user.borderId,
                strategyLevel: user.strategyLevel,
                strategyXp: user.strategyXp,
                playfulLevel: user.playfulLevel,
                playfulXp: user.playfulXp,
                gold: user.gold,
                diamonds: user.diamonds,
                stats: user.stats,
                mannerScore: user.mannerScore,
                tournamentScore: user.tournamentScore,
                cumulativeTournamentScore: user.cumulativeTournamentScore,
                mbti: user.mbti,
                isMbtiPublic: user.isMbtiPublic,
                cumulativeRankingScore: user.cumulativeRankingScore,
                dailyRankings: user.dailyRankings,
                towerFloor: (user as any).towerFloor,
                monthlyTowerFloor: (user as any).monthlyTowerFloor,
                isAdmin: user.isAdmin,
                equipment: user.equipment || {},
                inventory: equippedItems,
                baseStats: user.baseStats || {},
                spentStatPoints: user.spentStatPoints || {},
                guildId: user.guildId ?? undefined,
            };

            if (user.guildId) {
                try {
                    const guildRepo = await import('./prisma/guildRepository.js');
                    const guild = await guildRepo.getGuildById(user.guildId);
                    if (guild) {
                        const icon = guild.emblem?.startsWith('/images/guild/icon')
                            ? guild.emblem.replace('/images/guild/icon', '/images/guild/profile/icon')
                            : (guild.emblem || '/images/guild/profile/icon1.png');
                        publicUser.guildName = guild.name;
                        publicUser.guildLevel = guild.level;
                        publicUser.guildIcon = icon;
                    }
                } catch (err: any) {
                    console.warn('[/api/user/:userId] Failed to load guild for user:', userId, err?.message);
                }
            }

            res.json(publicUser);
        } catch (error: any) {
            console.error('[/api/user/:userId] Error:', error);
            res.status(500).json({ error: 'Failed to fetch user data' });
        }
    });

    /** 새로고침(F5) 후 AI/PVP 대국 이어하기: 참가 중인 게임을 조회하여 클라이언트에 전달 */
    app.post('/api/game/rejoin', async (req, res) => {
        try {
            const { userId, gameId } = req.body;
            if (!userId || !gameId) {
                return res.status(400).json({ error: 'userId와 gameId가 필요합니다.' });
            }
            const { getCachedUser } = await import('./gameCache.js');
            const user = await getCachedUser(userId);
            if (!user) {
                return res.status(401).json({ error: '유효하지 않은 사용자입니다.' });
            }
            const { getCachedGame } = await import('./gameCache.js');
            let game = await getCachedGame(gameId);
            if (!game) {
                game = await db.getLiveGame(gameId);
            }
            if (!game) {
                return res.status(404).json({ error: '게임을 찾을 수 없습니다.' });
            }
            const isParticipant = game.player1?.id === userId || game.player2?.id === userId;
            if (!isParticipant) {
                return res.status(403).json({ error: '해당 게임의 참가자가 아닙니다.' });
            }
            // 진행 중이거나 종료/계가 중인 게임만 재입장 허용 (미사일/히든/스캔 아이템 사용 중 상태 포함)
            const rejoinableStatuses = [
                'pending', 'playing', 'scoring', 'ended', 'no_contest',
                'hidden_placing', 'scanning', 'missile_selecting', 'missile_animating', 'scanning_animating',
                'hidden_reveal_animating', 'hidden_final_reveal',
            ];
            if (!rejoinableStatuses.includes(game.gameStatus || '')) {
                return res.status(400).json({ error: '이어하기할 수 없는 게임 상태입니다.' });
            }
            // PVP: 새로고침으로 끊긴 플레이어가 90초 내 재접속 시 disconnectionState 해제하여 경기 재개
            if (game.disconnectionState?.disconnectedPlayerId === userId) {
                const now = Date.now();
                const timerStartedAt = game.disconnectionState?.timerStartedAt ?? now;
                const timeSinceDisconnect = now - timerStartedAt;
                if (timeSinceDisconnect <= 90000) {
                    game.disconnectionState = null;
                    const otherPlayerId = game.player1?.id === userId ? game.player2?.id : game.player1?.id;
                    if (otherPlayerId && game.canRequestNoContest?.[otherPlayerId]) {
                        delete game.canRequestNoContest[otherPlayerId];
                    }
                    await db.saveGame(game);
                    const { broadcastToGameParticipants } = await import('./socket.js');
                    broadcastToGameParticipants(game.id, { type: 'GAME_UPDATE', payload: { [game.id]: game } }, game);
                }
            }
            // 서버 상태 복원: 재접속한 유저를 in-game으로 설정 (새로고침 후 라우팅/activeGame 일치)
            const rejoinIp = await ensureClientIpAllowsSession(volatileState, req, res, userId, !!user.isAdmin);
            if (!rejoinIp.ok) {
                return res.status(403).json({ error: rejoinIp.message });
            }
            volatileState.userConnections[userId] = Date.now();
            volatileState.userStatuses[userId] = { status: types.UserStatus.InGame, mode: game.mode, gameId: game.id };
            // AI 대국: KataServer가 game_id 헤더로 세션을 캐시하는 경우, 끊김·F5 후 재입장 시 이전 국면이 남아
            // 다음 AI 수가 어긋할 수 있음 → settings.kataSessionResumeSeq를 올려 game_id 태그를 갱신한다.
            const kataResumeBumpStatuses = new Set([
                'pending',
                'playing',
                'hidden_placing',
                'scanning',
                'missile_selecting',
                'missile_animating',
                'scanning_animating',
                'hidden_reveal_animating',
                'hidden_final_reveal',
                'scoring',
            ]);
            if (game.isAiGame && kataResumeBumpStatuses.has(game.gameStatus || '')) {
                const s = game.settings as any;
                const nextSeq = (Number(s?.kataSessionResumeSeq) || 0) + 1;
                if (!game.settings) (game as any).settings = {};
                (game.settings as any).kataSessionResumeSeq = nextSeq;
                await db.saveGame(game);
                try {
                    const { updateGameCache } = await import('./gameCache.js');
                    updateGameCache(game);
                } catch {
                    // ignore
                }
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[/api/game/rejoin] kataSessionResumeSeq=${nextSeq} for AI game ${game.id} (user ${userId})`);
                }
            }
            // 전체 게임 객체 반환 (boardState, moveHistory 포함 - 클라이언트 복원용)
            const sanitized = JSON.parse(JSON.stringify(game)) as types.LiveGameSession;
            return res.status(200).json({ game: sanitized });
        } catch (error: any) {
            console.error('[/api/game/rejoin] Error:', error?.message || error);
            return res.status(500).json({ error: '재입장 처리 중 오류가 발생했습니다.' });
        }
    });

    app.post('/api/state', async (req, res) => {
        // 프로덕션에서 성능 향상을 위해 로깅 최소화
        const isDev = process.env.NODE_ENV === 'development';
        if (isDev) console.log('[/api/state] Received request');
        try {
            const { userId } = req.body;
            if (isDev) console.log(`[API/State] Received request for userId: ${userId}`);

            if (!userId) {
                if (isDev) console.log('[API/State] No userId provided, returning 401.');
                return res.status(401).json({ message: '인증 정보가 없습니다.' });
            }

            if (isDev) console.log('[/api/state] Getting user from cache/DB');
            // 캐시를 우선 사용하여 DB 쿼리 최소화 (Railway 네트워크 지연 대응)
            const { getCachedUser } = await import('./gameCache.js');
            let user = await getCachedUser(userId);
            if (isDev) console.log('[/api/state] User retrieved from cache/DB');
            if (!user) {
                if (isDev) console.log(`[API/State] User ${userId} not found, cleaning up connection and returning 401.`);
                releaseIpBindingForUser(volatileState, userId);
                delete volatileState.userConnections[userId]; // Clean up just in case
                return res.status(401).json({ message: '세션이 만료되었습니다. 다시 로그인해주세요.' });
            }
            if (isDev) console.log(`[API/State] User ${user.nickname} found.`);

            if (isDev) console.log('[/api/state] Starting migration logic');
            // --- Inventory Slots Migration Logic ---
            let inventorySlotsUpdated = false;
            if (!user.inventorySlotsMigrated) {
                if (isDev) console.log(`[API/State] User ${user.nickname}: Running inventory slots migration.`);
                let currentEquipmentSlots = 30;
                let currentConsumableSlots = 30;
                let currentMaterialSlots = 30;

                if (typeof user.inventorySlots === 'number') {
                    // Old format: number of slots for equipment
                    currentEquipmentSlots = Math.max(30, user.inventorySlots);
                } else if (typeof user.inventorySlots === 'object' && user.inventorySlots !== null) {
                    // New format, but might be partially initialized or have values less than 30
                    currentEquipmentSlots = Math.max(30, user.inventorySlots.equipment || 0);
                    currentConsumableSlots = Math.max(30, user.inventorySlots.consumable || 0);
                    currentMaterialSlots = Math.max(30, user.inventorySlots.material || 0);
                }

                // Apply updates if any slot count is less than 30 or if it was in the old number format
                if (typeof user.inventorySlots === 'number' ||
                    (typeof user.inventorySlots === 'object' && user.inventorySlots !== null &&
                        (user.inventorySlots.equipment < 30 ||
                        user.inventorySlots.consumable < 30 ||
                        user.inventorySlots.material < 30))) {

                    user.inventorySlots = {
                        equipment: currentEquipmentSlots,
                        consumable: currentConsumableSlots,
                        material: currentMaterialSlots,
                    };
                    inventorySlotsUpdated = true;
                }
                
                if (inventorySlotsUpdated) {
                    user.inventorySlotsMigrated = true;
                }
            }
            if (isDev) console.log('[/api/state] Finished migration logic');

            const stateIp = await ensureClientIpAllowsSession(volatileState, req, res, userId, !!user.isAdmin);
            if (!stateIp.ok) {
                return res.status(403).json({ message: stateIp.message });
            }

            // Re-establish connection if user is valid but not in volatile memory (e.g., after server restart)
            let didReconnect = false;
            if (!volatileState.userConnections[userId]) {
                didReconnect = true;
                if (isDev) console.log(`[API/State] User ${user.nickname}: Re-establishing connection.`);
                volatileState.userConnections[userId] = Date.now();
                // If user status is not present (e.g., server restart), set to online.
                // If it IS present (e.g., they just refreshed), do NOT change it, preserving their 'waiting' status.
                if (!volatileState.userStatuses[userId]) {
                    volatileState.userStatuses[userId] = { status: types.UserStatus.Online };
                }
            }

            volatileState.userConnections[userId] = Date.now();
            
            const userBeforeUpdate = JSON.stringify(user);
            if (isDev) console.log(`[API/State] User ${user.nickname}: Processing quests, league updates, AP regen, and weekly competitors.`);
            let updatedUser = await resetAndGenerateQuests(user);
            updatedUser = await processWeeklyLeagueUpdates(updatedUser);
            updatedUser = await regenerateActionPoints(updatedUser);
            // updateWeeklyCompetitorsIfNeeded는 내부에서 필요한 유저만 DB에서 조회하도록 최적화됨
            updatedUser = await updateWeeklyCompetitorsIfNeeded(updatedUser);
            
            // --- Stats Migration Logic ---
            const allGameModesList = [...SPECIAL_GAME_MODES, ...PLAYFUL_GAME_MODES].map(m => m.mode);
            let statsMigrated = false;
            if (!updatedUser.stats) {
                updatedUser.stats = {};
            }
            for (const mode of allGameModesList) {
                if (!updatedUser.stats[mode]) {
                    updatedUser.stats[mode] = { wins: 0, losses: 0, rankingScore: 1200 };
                    statsMigrated = true;
                }
            }
            if (isDev) console.log(`[API/State] User ${user.nickname}: Stats migration complete (migrated: ${statsMigrated}).`);
            // --- End Migration Logic ---

            // --- Equipment Presets Migration Logic ---
            let presetsMigrated = false;
            if (!updatedUser.equipmentPresets || updatedUser.equipmentPresets.length === 0) { // Check for empty array too
                updatedUser.equipmentPresets = [
                    { name: '프리셋 1', equipment: updatedUser.equipment || {} }, // Initialize with current equipment
                    { name: '프리셋 2', equipment: {} },
                    { name: '프리셋 3', equipment: {} },
                    { name: '프리셋 4', equipment: {} },
                    { name: '프리셋 5', equipment: {} },
                ];
                presetsMigrated = true;
            }
            // --- End Equipment Presets Migration Logic ---

            // 접속 시 최근 접속 시각 갱신 (길드원 목록 등에서 사용)
            if (didReconnect) {
                updatedUser.lastLoginAt = Date.now();
            }

            // equipment와 inventory의 isEquipped 플래그 동기화 (전투력 계산을 위해 필수)
            if (updatedUser.equipment && typeof updatedUser.equipment === 'object' && Object.keys(updatedUser.equipment).length > 0) {
                if (updatedUser.inventory && Array.isArray(updatedUser.inventory)) {
                    // 먼저 모든 장비 아이템의 isEquipped를 false로 설정
                    updatedUser.inventory.forEach(item => {
                        if (item.type === 'equipment') {
                            item.isEquipped = false;
                        }
                    });
                    
                    // equipment에 있는 아이템 ID들을 inventory에서 찾아서 isEquipped = true로 설정
                    for (const [slot, itemId] of Object.entries(updatedUser.equipment)) {
                        const item = updatedUser.inventory.find(i => i.id === itemId);
                        if (item && item.type === 'equipment') {
                            item.isEquipped = true;
                        }
                    }
                }
            }

            if (userBeforeUpdate !== JSON.stringify(updatedUser) || statsMigrated || inventorySlotsUpdated || presetsMigrated) {
                if (isDev) console.log(`[API/State] User ${user.nickname}: Updating user in DB.`);
                await db.updateUser(updatedUser);
                user = updatedUser; // updatedUser를 반환하기 위해 user에 할당
            }
            
            if (isDev) console.log('[/api/state] Getting all DB data');
            if (isDev) console.log(`[API/State] User ${user.nickname}: Getting all DB data.`);
            const dbState = await db.getAllData();
            if (isDev) console.log('[/api/state] All DB data retrieved');
    
            // Add ended games that users are still in to the appropriate category
            if (isDev) console.log(`[API/State] User ${user.nickname}: Processing ended games.`);
            for (const status of Object.values(volatileState.userStatuses)) {
                let gameId: string | undefined;
                if ('gameId' in status && status.gameId) {
                    gameId = status.gameId;
                } else if ('spectatingGameId' in status && status.spectatingGameId) {
                    gameId = status.spectatingGameId;
                }
                if (gameId) {
                    // 모든 카테고리에서 확인
                    const isInLiveGames = dbState.liveGames[gameId];
                    const isInSinglePlayerGames = dbState.singlePlayerGames[gameId];
                    const isInTowerGames = dbState.towerGames[gameId];
                    
                    if (!isInLiveGames && !isInSinglePlayerGames && !isInTowerGames) {
                        // 캐시에서 게임을 가져오기 (DB 조회 최소화)
                        const { getCachedGame } = await import('./gameCache.js');
                        const endedGame = await getCachedGame(gameId);
                        if (endedGame) {
                            // 게임 카테고리에 따라 올바른 객체에 추가
                            const category = endedGame.gameCategory || (endedGame.isSinglePlayer ? 'singleplayer' : 'normal');
                            if (category === 'singleplayer') {
                                dbState.singlePlayerGames[endedGame.id] = endedGame;
                            } else if (category === 'tower') {
                                dbState.towerGames[endedGame.id] = endedGame;
                            } else {
                                dbState.liveGames[endedGame.id] = endedGame;
                            }
                        }
                    }
                }
            }
            
            // 현재 사용자의 전체 데이터를 포함 (다른 사용자는 최적화된 공개 정보만)
            if (dbState.users[userId]) {
                dbState.users[userId] = updatedUser; // 전체 사용자 데이터
            }

            // Combine persisted state with in-memory volatile state
            if (isDev) console.log(`[API/State] User ${user.nickname}: Combining states and sending response.`);
            const fullState = {
                ...dbState,
                userConnections: volatileState.userConnections,
                userStatuses: volatileState.userStatuses,
                negotiations: volatileState.negotiations,
                waitingRoomChats: volatileState.waitingRoomChats,
                gameChats: volatileState.gameChats,
                userLastChatMessage: volatileState.userLastChatMessage,
            } as Omit<types.AppState, 'userCredentials'>;
            
            res.status(200).json(fullState);
        } catch (e) {
            console.error('Get state error:', e);
            res.status(500).json({ message: '서버 오류가 발생했습니다.' });
        }
    });

    // NOTE: KataGo 분석 API는 별도 `KataGo` 서비스(`server/katagoServer.ts`)에서만 제공합니다.
    // 백엔드는 게임 종료 후 계가(스코어링) 시점에만 KataGo 서비스로 HTTP 요청합니다.

    app.post('/api/action', async (req, res) => {
        const startTime = Date.now();
        // 요청 타임아웃 설정 (25초)
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                console.error(`[/api/action] Request timeout after 25s:`, { userId: req.body?.userId, type: req.body?.type });
                res.status(504).json({ error: 'Request timeout' });
            }
        }, 25000);

        /** 타임아웃으로 이미 응답한 뒤 이중 json() 호출 방지 */
        const respondAction = (status: number, body: object) => {
            clearTimeout(timeout);
            if (res.headersSent) return;
            res.status(status).json(body);
        };
        
        try {
            const { userId, type, payload } = req.body;
            
            // PLACE_STONE 액션에 대한 상세 로깅 (특히 triggerAutoScoring 플래그)
            if (type === 'PLACE_STONE' && payload?.triggerAutoScoring) {
                console.log(`[/api/action] PLACE_STONE with triggerAutoScoring received:`, {
                    userId,
                    gameId: payload?.gameId,
                    x: payload?.x,
                    y: payload?.y,
                    totalTurns: payload?.totalTurns,
                    triggerAutoScoring: payload?.triggerAutoScoring
                });
            }

            {
                const { ensurePrismaConnected } = await import('./prismaClient.js');
                if (!(await ensurePrismaConnected())) {
                    respondAction(503, {
                        message:
                            '데이터베이스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
                    });
                    return;
                }
            }

            // Allow registration without auth
            if (req.body.type === 'REGISTER') {
                 const result = await handleAction(volatileState, req.body);
                 if (result.error) {
                     respondAction(400, { message: result.error });
                     return;
                 }
                 respondAction(200, { success: true, ...result.clientResponse });
                 return;
            }

            if (!userId) {
                respondAction(401, { message: '인증 정보가 없습니다.' });
                return;
            }

            const getUserStartTime = Date.now();
            // 캐시를 우선 사용하여 DB 쿼리 최소화 (Railway 네트워크 지연 대응)
            const { getCachedUser } = await import('./gameCache.js');
            const user = await getCachedUser(userId);
            const getUserDuration = Date.now() - getUserStartTime;
            
            if (!user) {
                releaseIpBindingForUser(volatileState, userId);
                delete volatileState.userConnections[userId];
                respondAction(401, { message: '유효하지 않은 사용자입니다.' });
                return;
            }

            // --- Inventory Slots Migration Logic (한 번만 실행) ---
            // 마이그레이션이 필요한 경우에만 실행하고, DB 업데이트는 비동기로 처리하여 응답 지연 최소화
            if (!user.inventorySlotsMigrated) {
                let currentEquipmentSlots = 30;
                let currentConsumableSlots = 30;
                let currentMaterialSlots = 30;

                if (typeof user.inventorySlots === 'number') {
                    currentEquipmentSlots = Math.max(30, user.inventorySlots);
                } else if (typeof user.inventorySlots === 'object' && user.inventorySlots !== null) {
                    currentEquipmentSlots = Math.max(30, user.inventorySlots.equipment || 0);
                    currentConsumableSlots = Math.max(30, user.inventorySlots.consumable || 0);
                    currentMaterialSlots = Math.max(30, user.inventorySlots.material || 0);
                }

                if (typeof user.inventorySlots === 'number' || (typeof user.inventorySlots === 'object' && user.inventorySlots !== null && (user.inventorySlots.equipment < 30 || user.inventorySlots.consumable < 30 || user.inventorySlots.material < 30))) {
                    user.inventorySlots = {
                        equipment: currentEquipmentSlots,
                        consumable: currentConsumableSlots,
                        material: currentMaterialSlots,
                    };
                    user.inventorySlotsMigrated = true;
                    // DB 업데이트는 비동기로 처리하여 응답 지연 최소화
                    db.updateUser(user).catch(err => {
                        console.error(`[API] Failed to migrate inventory slots for user ${userId}:`, err);
                    });
                }
            }
            // --- End Migration Logic ---

            const actionIp = await ensureClientIpAllowsSession(volatileState, req, res, userId, !!user.isAdmin);
            if (!actionIp.ok) {
                respondAction(403, { message: actionIp.message });
                return;
            }

            // Re-establish connection if needed
            if (!volatileState.userConnections[userId]) {
                console.log(`[Auth] Re-establishing connection on action for user: ${user.nickname} (${userId})`);
                volatileState.userConnections[userId] = Date.now();
                volatileState.userStatuses[userId] = { status: types.UserStatus.Online };
                user.lastLoginAt = Date.now();
                db.updateUser(user).catch(err => console.warn(`[API] Failed to update lastLoginAt for user ${userId}:`, err?.message));
            }
            
            volatileState.userConnections[userId] = Date.now();

            // 프로덕션에서는 상세 로깅 제거 (성능 향상)
            if (process.env.NODE_ENV === 'development') {
                console.log(`[/api/action] Calling handleAction for type: ${req.body.type}`);
            }
            
            const handleActionStartTime = Date.now();
            // 이미 가져온 user를 전달하여 중복 DB 쿼리 방지
            const result = await handleAction(volatileState, req.body, user);
            const handleActionDuration = Date.now() - handleActionStartTime;
            
            if (result.error) {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`[/api/action] Returning 400 error for ${req.body.type}: ${result.error}`);
                }
                respondAction(400, { message: result.error });
                return;
            }
            
            const totalDuration = Date.now() - startTime;
            // 응답 시간이 1초 이상인 경우에만 로깅 (성능 모니터링)
            if (totalDuration > 1000) {
                console.log(`[/api/action] SLOW: ${type} took ${totalDuration}ms (getUser: ${getUserDuration}ms, handleAction: ${handleActionDuration}ms)`);
            }
            
            // 성공 응답 즉시 반환 (불필요한 로깅 제거)
            respondAction(200, { success: true, ...result.clientResponse });
        } catch (e: any) {
            clearTimeout(timeout);
            const { prismaErrorImpliesEngineNotConnected } = await import('./prismaClient.js');
            if (prismaErrorImpliesEngineNotConnected(e)) {
                console.warn(`[API] Action ${req.body?.type}: Prisma engine not ready (503)`);
                if (!res.headersSent) {
                    return res.status(503).json({
                        message:
                            '데이터베이스에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
                    });
                }
                return;
            }
            console.error(`[API] Action error for ${req.body?.type}:`, e);
            console.error(`[API] Error stack:`, e.stack);
            console.error(`[API] Error details:`, {
                message: e.message,
                name: e.name,
                code: e.code,
                userId: req.body?.userId,
                payload: req.body?.payload
            });
            if (!res.headersSent) {
                res.status(500).json({ 
                    message: '요청 처리 중 오류가 발생했습니다.',
                    error: process.env.NODE_ENV === 'development' ? e.message : undefined
                });
            }
        }
    });

    // 긴급 봇 점수 복구 엔드포인트 (점수가 0인 봇만 복구)
    // KataGo 상태 확인 엔드포인트 (관리자 전용)
    // NOTE: Railway 멀티서비스 구조에서는 KataGo를 별도 서비스로 운영하므로
    // 여기서는 "외부 KataGo 서비스"의 헬스체크 결과를 보여줍니다.
    app.get('/api/admin/katago-status', async (req, res) => {
        try {
            const raw = process.env.KATAGO_API_URL?.trim() || '';
            const KATAGO_API_URL = raw ? (raw.match(/^https?:\/\//) ? raw : `https://${raw}`) : '';
            const USE_HTTP_API = !!KATAGO_API_URL;

            const buildUrl = (pathName: string) => {
                try {
                    if (!KATAGO_API_URL) return null;
                    const u = new URL(KATAGO_API_URL);
                    u.pathname = pathName;
                    u.search = '';
                    return u.toString();
                } catch {
                    return null;
                }
            };

            const healthUrl = buildUrl('/api/health');
            const statusUrl = buildUrl('/api/katago/status');

            let health: { ok: boolean; status?: number; error?: string } | null = null;
            if (healthUrl) {
                try {
                    const r = await fetch(healthUrl, { method: 'GET' });
                    health = { ok: r.ok, status: r.status };
                } catch (e: any) {
                    health = { ok: false, error: e?.message || String(e) };
                }
            }

            // 외부 KataGo 서비스가 "실제 분석 가능" 상태인지 status도 확인
            let status: { ok: boolean; status?: number; body?: any; error?: string } | null = null;
            if (statusUrl) {
                try {
                    const r = await fetch(statusUrl, { method: 'GET' });
                    const bodyText = await r.text();
                    let body: any = null;
                    try { body = bodyText ? JSON.parse(bodyText) : null; } catch { body = bodyText; }
                    status = { ok: r.ok, status: r.status, body };
                } catch (e: any) {
                    status = { ok: false, error: e?.message || String(e) };
                }
            }

            // UI 호환을 위해 기존 필드 유지
            const config: Record<string, string | number | boolean> = {
                USE_HTTP_API,
                KATAGO_API_URL: KATAGO_API_URL || 'not set',
                KATAGO_HEALTH_URL: healthUrl || 'not set',
                KATAGO_STATUS_URL: statusUrl || 'not set',
                NODE_ENV: process.env.NODE_ENV || 'not set',
                RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || 'not set',
                MODE: 'external_service',
            };

            const statusSaysRunning =
                !!status?.ok &&
                (status.body?.status === 'running' || status.body?.processRunning === true);
            const running = USE_HTTP_API && !!health?.ok && statusSaysRunning;
            res.json({
                status: running ? 'running' : 'stopped',
                processRunning: running,
                isStarting: false,
                pendingQueries: 0,
                config,
                log: {
                    health,
                    status,
                },
            });
        } catch (error: any) {
            console.error('[Admin] Error getting KataGo status:', error);
            res.status(500).json({ error: error.message });
        }
    });

    const requireAdminByUserId = async (userIdRaw: unknown): Promise<types.User | null> => {
        const userId = String(userIdRaw || '').trim();
        if (!userId) return null;
        const adminUser = await db.getUser(userId, { includeEquipment: false, includeInventory: false });
        if (!adminUser || !adminUser.isAdmin) return null;
        return adminUser;
    };

    app.get('/api/admin/reward-config', async (req, res) => {
        try {
            const adminUser = await requireAdminByUserId(req.query.userId);
            if (!adminUser) {
                return res.status(403).json({ error: 'Forbidden: Admin access required' });
            }
            const stored = await db.getKV<unknown>('rewardConfig');
            const rewardConfig = normalizeRewardConfig(stored ?? DEFAULT_REWARD_CONFIG);
            res.json({ rewardConfig });
        } catch (error: any) {
            console.error('[Admin] Error getting reward config:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/reward-config', async (req, res) => {
        try {
            const adminUser = await requireAdminByUserId(req.query.userId);
            if (!adminUser) {
                return res.status(403).json({ error: 'Forbidden: Admin access required' });
            }
            const stored = await db.getKV<unknown>('rewardConfig');
            const rewardConfig = normalizeRewardConfig(stored ?? DEFAULT_REWARD_CONFIG);
            res.json({ rewardConfig });
        } catch (error: any) {
            console.error('[Admin] Error getting reward config (alias):', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/admin/reward-config', async (req, res) => {
        try {
            const adminUser = await requireAdminByUserId(req.body?.userId);
            if (!adminUser) {
                return res.status(403).json({ error: 'Forbidden: Admin access required' });
            }
            const beforeStored = await db.getKV<unknown>('rewardConfig');
            const before = normalizeRewardConfig(beforeStored ?? DEFAULT_REWARD_CONFIG);
            const rewardConfig = normalizeRewardConfig(req.body?.rewardConfig ?? DEFAULT_REWARD_CONFIG);
            await db.setKV('rewardConfig', rewardConfig);
            const changed = JSON.stringify(before) !== JSON.stringify(rewardConfig);
            if (changed) {
                const logs = (await db.getKV<types.AdminLog[]>('adminLogs')) || [];
                logs.unshift({
                    id: `log-${randomUUID()}`,
                    timestamp: Date.now(),
                    adminId: adminUser.id,
                    adminNickname: adminUser.nickname,
                    targetUserId: 'reward-config',
                    targetNickname: 'reward-config',
                    action: 'update_reward_config',
                    backupData: { before, after: rewardConfig },
                });
                if (logs.length > 200) logs.length = 200;
                await db.setKV('adminLogs', logs);
            }
            res.json({ success: true, rewardConfig });
        } catch (error: any) {
            console.error('[Admin] Error saving reward config:', error);
            res.status(500).json({ error: error.message });
        }
    });
    
    // 관리자용 사용자 검색 (/api/action 과 동일하게 요청에 userId 포함 — sessionId 쿠키는 앱에서 쓰지 않음)
    // NOTE: '/admin/users' alias is kept for deployments with API prefix rewrites.
    const handleAdminUsersSearch: express.RequestHandler = async (req, res) => {
        try {
            const userId = String(req.query.userId || '').trim();
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized', message: 'userId가 필요합니다.' });
            }

            const adminUser = await db.getUser(userId, { includeEquipment: false, includeInventory: false });
            if (!adminUser || !adminUser.isAdmin) {
                return res.status(403).json({ error: 'Forbidden: Admin access required' });
            }

            const searchQuery = String(req.query.query || '').trim();
            const limitParam = Number(req.query.limit);
            const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 50;
            const offsetParam = Number(req.query.offset);
            const offset = Number.isFinite(offsetParam) ? Math.max(0, Math.floor(offsetParam)) : 0;

            const { users, total } = await db.searchUsersForAdmin(searchQuery, limit, offset);
            const usersWithStatus = users.map((u) => {
                const statusInfo = volatileState.userStatuses[u.id];
                const isConnected = Boolean(volatileState.userConnections[u.id]);
                return {
                    ...u,
                    status: statusInfo?.status ?? (isConnected ? types.UserStatus.Online : undefined),
                    mode: statusInfo?.mode,
                    gameId: statusInfo?.gameId,
                    spectatingGameId: statusInfo?.spectatingGameId,
                    isConnected,
                };
            });

            res.json({
                users: usersWithStatus,
                count: usersWithStatus.length,
                total,
            });
        } catch (error: any) {
            console.error('[Admin] Error getting users list:', error);
            res.status(500).json({ error: error.message });
        }
    };
    app.get('/api/admin/users', handleAdminUsersSearch);
    app.get('/admin/users', handleAdminUsersSearch);

    /** 관리자: 단일 유저 전체(인벤·장비 포함) 조회 */
    const handleAdminUserDetail: express.RequestHandler = async (req, res) => {
        try {
            const adminId = String(req.query.userId || '').trim();
            if (!adminId) {
                return res.status(401).json({ error: 'Unauthorized', message: 'userId가 필요합니다.' });
            }
            const adminUser = await db.getUser(adminId, { includeEquipment: false, includeInventory: false });
            if (!adminUser || !adminUser.isAdmin) {
                return res.status(403).json({ error: 'Forbidden: Admin access required' });
            }
            const targetUserId = String(req.params.targetUserId || '').trim();
            if (!targetUserId) {
                return res.status(400).json({ error: 'targetUserId required' });
            }
            const user = await db.getUser(targetUserId, { includeEquipment: true, includeInventory: true });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json({ user });
        } catch (error: any) {
            console.error('[Admin] Error getting user detail:', error);
            res.status(500).json({ error: error.message });
        }
    };
    app.get('/api/admin/user/:targetUserId', handleAdminUserDetail);
    app.get('/admin/user/:targetUserId', handleAdminUserDetail);
    
    // KataGo 시작 엔드포인트 (관리자 전용)
    // NOTE: KataGo는 별도 서비스로 운영하므로 백엔드에서 로컬 프로세스를 시작하지 않습니다.
    app.post('/api/admin/katago-start', async (_req, res) => {
        return res.status(400).json({
            error: 'KataGo is running as a separate service. Start it from the Railway KataGo service.',
            message: 'KataGo는 별도 서비스로 운영됩니다. Railway의 KataGo 서비스에서 관리하세요.',
        });
    });
    
    app.post('/api/admin/recover-bot-scores', async (req, res) => {
        try {
            console.log('[Admin] ========== 봇 점수 복구 시작 ==========');
            
            const { updateBotLeagueScores } = await import('./scheduledTasks.js');
            const { listUsers } = await import('./prisma/userService.js');
            
            const allUsers = await listUsers({ includeEquipment: false, includeInventory: false });
            for (const user of allUsers) {
                if (user.weeklyCompetitors && user.weeklyCompetitors.length > 0) {
                    const updatedUser = await updateBotLeagueScores(user, true);
                    await db.updateUser(updatedUser);
                }
            }
            
            console.log(`[Admin] ========== 봇 점수 복구 완료 ==========`);
            res.status(200).json({ success: true, message: '봇 점수 복구 완료. 점수가 0이었던 모든 봇의 점수가 복구되었습니다.' });
        } catch (error: any) {
            console.error('[Admin] 봇 점수 복구 오류:', error);
            console.error('[Admin] 오류 스택:', error.stack);
            res.status(500).json({ error: error.message });
        }
    });

    /**
     * 긴급: adminLogs KV에 남은 reset/update 백업으로 인벤·장비 복구 (로컬 DB 불필요)
     * Railway Variables: EMERGENCY_RESTORE_INVENTORY_SECRET (16자 이상)
     *
     * curl -sS -X POST "$API/api/admin/emergency-restore-inventory-from-logs" \
     *   -H "Content-Type: application/json" \
     *   -H "Authorization: Bearer $EMERGENCY_RESTORE_INVENTORY_SECRET" \
     *   -d '{"nicknames":["푸른별빛","진승엽","천재이안"],"strategy":"richest","force":true}'
     */
    app.post('/api/admin/emergency-restore-inventory-from-logs', async (req, res) => {
        try {
            const secret = process.env.EMERGENCY_RESTORE_INVENTORY_SECRET || '';
            if (secret.length < 16) {
                return res.status(503).json({
                    error: 'Not configured',
                    message:
                        'EMERGENCY_RESTORE_INVENTORY_SECRET(16자 이상)를 Railway API 서비스 환경변수에 설정하세요.',
                });
            }
            const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
            const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
            const altHeader = req.headers['x-emergency-restore-secret'];
            const alt = typeof altHeader === 'string' ? altHeader : '';
            const token = bearer || alt;
            const ba = Buffer.from(token, 'utf8');
            const bb = Buffer.from(secret, 'utf8');
            if (ba.length !== bb.length || !timingSafeEqual(ba, bb)) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const body = req.body || {};
            const nicknames = Array.isArray(body.nicknames)
                ? body.nicknames
                    .filter((x: unknown) => typeof x === 'string' && String(x).trim())
                    .map((x: string) => String(x).trim())
                : [];
            if (nicknames.length === 0) {
                return res.status(400).json({ error: 'nicknames (non-empty string array) required' });
            }
            const strategy = body.strategy === 'latest' ? 'latest' : 'richest';
            const dryRun = Boolean(body.dryRun);
            const force = Boolean(body.force);

            const { loadAdminLogsForRestore, restoreInventoryFromAdminLogsForNicknames } = await import(
                './services/restoreInventoryFromAdminLogsService.js'
            );
            const loaded = await loadAdminLogsForRestore();
            if (!loaded.ok) {
                return res.status(503).json({ error: 'admin_logs_unavailable', detail: loaded.error });
            }

            console.warn('[Admin] emergency-restore-inventory-from-logs', {
                nicknames,
                strategy,
                dryRun,
                force,
            });
            const results = await restoreInventoryFromAdminLogsForNicknames(loaded.logs, {
                nicknames,
                strategy,
                dryRun,
                force,
            });
            res.json({ success: true, results });
        } catch (error: any) {
            console.error('[Admin] emergency-restore-inventory-from-logs', error);
            res.status(500).json({ error: error?.message || 'Internal error' });
        }
    });
    
    app.post('/api/admin/fix-bot-yesterday-scores', async (req, res) => {
        try {
            console.log('[Admin] ========== 어제 점수 수정 시작 ==========');
            
            const { fixBotYesterdayScores } = await import('./scheduledTasks.js');
            await fixBotYesterdayScores();
            
            console.log(`[Admin] ========== 어제 점수 수정 완료 ==========`);
            res.status(200).json({ success: true, message: '어제 점수 수정 완료. 어제 점수가 0이었던 모든 봇의 어제 점수가 수정되었습니다.' });
        } catch (error: any) {
            console.error('[Admin] 어제 점수 수정 오류:', error);
            console.error('[Admin] 오류 스택:', error.stack);
            res.status(500).json({ error: error.message });
        }
    });
    
    // 긴급 봇 점수 업데이트 엔드포인트 (누락된 날짜 보완)
    // 주의: 인증 없이 실행되므로 보안에 주의하세요
    app.post('/api/admin/update-bot-scores-now', async (req, res) => {
        try {
            console.log('[Admin] ========== 봇 점수 즉시 업데이트 시작 (누락된 날짜 보완) ==========');
            const { updateBotLeagueScores } = await import('./scheduledTasks.js');
            const { listUsers } = await import('./prisma/userService.js');
            const allUsers = await listUsers({ includeEquipment: false, includeInventory: false });
            let updatedCount = 0;
            let totalBotsUpdated = 0;
            
            for (const user of allUsers) {
                if (!user.weeklyCompetitors || user.weeklyCompetitors.length === 0) {
                    continue;
                }
                
                const userBeforeUpdate = JSON.stringify(user.weeklyCompetitorsBotScores || {});
                // 누락된 날짜 자동 보완 (마지막 업데이트 다음 날부터 오늘까지)
                const updatedUser = await updateBotLeagueScores(user, false);
                const userAfterUpdate = JSON.stringify(updatedUser.weeklyCompetitorsBotScores || {});
                
                if (userBeforeUpdate !== userAfterUpdate) {
                    await db.updateUser(updatedUser);
                    updatedCount++;
                    
                    // 업데이트된 봇 수 계산
                    const botCount = (user.weeklyCompetitors || []).filter((c: types.WeeklyCompetitor) => c.id.startsWith('bot-')).length;
                    totalBotsUpdated += botCount;
                }
            }
            
            console.log(`[Admin] ========== 봇 점수 즉시 업데이트 완료 ==========`);
            console.log(`[Admin] 업데이트된 유저: ${updatedCount}명, 총 봇 수: ${totalBotsUpdated}개`);
            res.status(200).json({ success: true, message: `봇 점수 업데이트 완료. ${updatedCount}명의 유저, ${totalBotsUpdated}개의 봇 업데이트됨.` });
        } catch (error: any) {
            console.error('[Admin] 봇 점수 업데이트 오류:', error);
            console.error('[Admin] 오류 스택:', error.stack);
            res.status(500).json({ error: error.message });
        }
    });

    // SPA fallback: serve index.html for all non-API routes (only if frontend serving is enabled)
    // Note: enableFrontendServing is already declared above
    if (enableFrontendServing) {
        // Serve index.html for root path and all non-API routes
        app.get('*', async (req, res, next) => {
            // Skip API and WebSocket routes
            if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
                return res.status(404).json({ message: 'Not found' });
            }
            
            // 정적 파일 요청인 경우 404를 조용히 처리 (로깅 최소화)
            if (req.path.startsWith('/assets/') || 
                req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/i)) {
                // express.static이 이미 처리했지만 파일이 없는 경우
                // 개발 환경에서만 로깅 (프로덕션에서는 로그 스팸 방지)
                if (process.env.NODE_ENV === 'development') {
                    console.warn(`[Static] File not found: ${req.path}`);
                }
                return res.status(404).json({ message: 'Static file not found' });
            }
            
            // Serve index.html for SPA routing (including root path)
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const distPath = path.join(__dirname, '..', 'dist');
            const indexPath = path.join(distPath, 'index.html');
            
            // index.html 존재 여부 확인
            const fs = await import('fs');
            if (!fs.existsSync(indexPath)) {
                console.error(`[SPA] index.html not found at ${indexPath}`);
                return res.status(500).json({ message: 'Frontend not found. Please rebuild the application.' });
            }
            
            res.sendFile(indexPath, (err) => {
                if (err) {
                    console.error('[SPA] Error serving index.html:', err);
                    if (!res.headersSent) {
                        res.status(500).json({ message: 'Frontend not found' });
                    }
                }
            });
        });
    } else {
        // If frontend serving is disabled, return JSON for root, 404 for others
        app.get('/', (req, res) => {
            res.json({
                service: 'backend',
                status: 'running',
                endpoints: {
                    health: '/api/health',
                    api: '/api/*'
                }
            });
        });
        
        app.get('*', (req, res) => {
            if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
                return res.status(404).json({ message: 'API endpoint not found' });
            } else {
                res.status(404).json({ message: 'Not found. Frontend is served by a separate service.' });
            }
        });
    }

    // Express 전역 에러 핸들러 (모든 라우트 정의 후에 추가)
    // 처리되지 않은 에러를 잡아서 500 응답 반환
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (!res.headersSent) {
            applyCorsHeaders(req, res, PRODUCTION_ALLOWED_ORIGINS);
        }
        const errorInfo = {
            timestamp: new Date().toISOString(),
            type: 'expressErrorHandler',
            error: err,
            errorName: err?.name,
            errorMessage: err?.message,
            errorCode: err?.code,
            errorStack: err?.stack,
            requestPath: req.path,
            requestMethod: req.method,
            requestQuery: req.query,
            requestBody: req.body ? (typeof req.body === 'object' ? JSON.stringify(req.body).substring(0, 500) : String(req.body).substring(0, 500)) : undefined,
            requestHeaders: req.headers,
            pid: process.pid,
            uptime: process.uptime(),
            memory: process.memoryUsage()
        };
        
        // 상세한 에러 로깅
        console.error('[Express Error Handler] ========== EXPRESS ERROR ==========');
        console.error('[Express Error Handler] Timestamp:', errorInfo.timestamp);
        console.error('[Express Error Handler] PID:', errorInfo.pid);
        console.error('[Express Error Handler] Request path:', errorInfo.requestPath);
        console.error('[Express Error Handler] Request method:', errorInfo.requestMethod);
        console.error('[Express Error Handler] Error name:', errorInfo.errorName);
        console.error('[Express Error Handler] Error message:', errorInfo.errorMessage);
        console.error('[Express Error Handler] Error code:', errorInfo.errorCode);
        console.error('[Express Error Handler] Error stack:', errorInfo.errorStack);
        console.error('[Express Error Handler] Full error info:', JSON.stringify(errorInfo, null, 2));
        console.error('[Express Error Handler] ====================================');
        
        // stderr로도 직접 출력 (Railway 로그에 확실히 기록)
        process.stderr.write(`\n[EXPRESS ERROR] at ${errorInfo.timestamp}\n`);
        process.stderr.write(`Path: ${errorInfo.requestPath} ${errorInfo.requestMethod}\n`);
        process.stderr.write(`Error: ${errorInfo.errorName} - ${errorInfo.errorMessage}\n`);
        process.stderr.write(`Code: ${errorInfo.errorCode || 'N/A'}\n`);
        if (errorInfo.errorStack) {
            process.stderr.write(`Stack: ${errorInfo.errorStack}\n`);
        }
        process.stderr.write(`Memory: ${JSON.stringify(errorInfo.memory)}\n\n`);
        
        // 응답이 이미 전송된 경우 next() 호출
        if (res.headersSent) {
            return next(err);
        }
        
        // 데이터베이스 연결 오류인 경우
        const isDbError = err?.code?.startsWith('P') || 
                         err?.message?.includes('database') || 
                         err?.message?.includes('connection') || 
                         err?.message?.includes('timeout') ||
                         err?.code === 'ECONNREFUSED';
        
        const statusCode = err?.statusCode || err?.status || 500;
        const errorMessage = isDbError 
            ? '데이터베이스 연결 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
            : (err?.message || '서버 오류가 발생했습니다.');
        
        res.status(statusCode).json({
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? err?.message : undefined,
            errorCode: process.env.NODE_ENV === 'development' ? err?.code : undefined
        });
    });

    // 404 핸들러 (모든 라우트와 에러 핸들러 이후)
    app.use((req: express.Request, res: express.Response) => {
        applyCorsHeaders(req, res, PRODUCTION_ALLOWED_ORIGINS);
        // API 요청인 경우 JSON 응답
        if (req.path.startsWith('/api/')) {
            res.status(404).json({ message: 'API endpoint not found' });
        } else {
            // 정적 파일 요청은 위의 SPA 핸들러에서 처리됨
            res.status(404).json({ message: 'Not found' });
        }
    });

    return app;
}

// 전역 에러 핸들러 추가 (처리되지 않은 Promise rejection 및 예외 처리)
// 전역 에러 핸들러: 프로세스가 절대 크래시되지 않도록 보장
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    // stderr로 강제 출력 (Railway 로그에 확실히 기록되도록)
    const errorInfo = {
        timestamp: new Date().toISOString(),
        type: 'unhandledRejection',
        reason: reason,
        reasonType: typeof reason,
        reasonMessage: reason?.message || String(reason),
        reasonCode: reason?.code,
        reasonStack: reason instanceof Error ? reason.stack : undefined,
        promise: promise?.toString(),
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        railwayEnv: process.env.RAILWAY_ENVIRONMENT || 'not set'
    };
    
    // console.error와 stderr.write 모두 사용하여 확실히 로그 출력
    console.error('[Server] ========== UNHANDLED REJECTION ==========');
    console.error('[Server] Timestamp:', errorInfo.timestamp);
    console.error('[Server] PID:', errorInfo.pid);
    console.error('[Server] Uptime:', errorInfo.uptime, 'seconds');
    console.error('[Server] Memory:', JSON.stringify(errorInfo.memory));
    console.error('[Server] Reason:', reason);
    console.error('[Server] Reason type:', errorInfo.reasonType);
    console.error('[Server] Reason message:', errorInfo.reasonMessage);
    console.error('[Server] Reason code:', errorInfo.reasonCode);
    if (reason instanceof Error) {
        console.error('[Server] Error stack:', reason.stack);
    }
    console.error('[Server] Full error info:', JSON.stringify(errorInfo, null, 2));
    console.error('[Server] =========================================');
    
    // stderr로도 직접 출력 (Railway 로그에 확실히 기록)
    process.stderr.write(`\n[CRITICAL] UNHANDLED REJECTION at ${errorInfo.timestamp}\n`);
    process.stderr.write(`Reason: ${errorInfo.reasonMessage}\n`);
    if (reason instanceof Error && reason.stack) {
        process.stderr.write(`Stack: ${reason.stack}\n`);
    }
    const memMB = {
        rss: Math.round(errorInfo.memory.rss / 1024 / 1024),
        heapUsed: Math.round(errorInfo.memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(errorInfo.memory.heapTotal / 1024 / 1024),
        external: Math.round(errorInfo.memory.external / 1024 / 1024)
    };
    process.stderr.write(`Memory: RSS=${memMB.rss}MB, Heap=${memMB.heapUsed}/${memMB.heapTotal}MB, External=${memMB.external}MB\n`);
    process.stderr.write(`PID: ${errorInfo.pid}, Uptime: ${errorInfo.uptime}s\n\n`);
    
    // 메모리 부족 에러인 경우 프로세스 종료 (Railway가 재시작)
    if (reason && typeof reason === 'object' && 'code' in reason && reason.code === 'ENOMEM') {
        console.error('[Server] Out of memory error detected. Exiting for Railway restart.');
        process.stderr.write('[CRITICAL] Out of memory - exiting\n');
        process.stderr.write('[CRASH_REASON] unhandled_rejection_enomem\n', () => {});
        // 메모리 정리 시도
        try {
            if (global.gc) {
                global.gc();
                console.log('[Server] Manual garbage collection triggered before exit');
            }
        } catch (gcError) {
            console.error('[Server] Failed to trigger GC:', gcError);
        }
        process.exit(1);
    }
    
    // 메모리 사용량이 매우 높은 경우 경고
    if (memMB.rss > 400) {
        console.error(`[Server] WARNING: High memory usage detected (${memMB.rss}MB RSS) during unhandled rejection`);
        process.stderr.write(`[WARNING] High memory usage: ${memMB.rss}MB RSS\n`);
    }
    
    // 데이터베이스 연결 에러는 치명적이지 않음 (서버는 계속 실행)
    const isDbError = reason?.code?.startsWith('P') || 
                     reason?.message?.includes('database') || 
                     reason?.message?.includes('connection');
    
    if (isDbError) {
        console.warn('[Server] Database error in unhandled rejection (non-fatal):', reason?.message);
        return; // 서버는 계속 실행
    }
    
    // Railway 환경에서는 프로세스를 종료하지 않고 로그만 남김
    // 메모리 부족 에러는 이미 위에서 처리됨
    if (process.env.RAILWAY_ENVIRONMENT) {
        // Railway에서는 자동 재시작되므로, 메모리 부족이 아닌 경우에는 계속 실행
        console.warn('[Server] Unhandled rejection in Railway environment (non-fatal). Server will continue.');
        // 프로세스를 종료하지 않음 - 서버는 계속 실행되어야 함
    } else {
        // 로컬 환경에서도 치명적이지 않은 에러는 계속 실행
        console.warn('[Server] Unhandled rejection (non-fatal). Server will continue.');
    }
});

process.on('uncaughtException', (error: Error) => {
    // stderr로 강제 출력 (Railway 로그에 확실히 기록되도록)
    const errorInfo = {
        timestamp: new Date().toISOString(),
        type: 'uncaughtException',
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any)?.code,
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        railwayEnv: process.env.RAILWAY_ENVIRONMENT || 'not set'
    };
    
    // console.error와 stderr.write 모두 사용하여 확실히 로그 출력
    console.error('[Server] ========== UNCAUGHT EXCEPTION ==========');
    console.error('[Server] Timestamp:', errorInfo.timestamp);
    console.error('[Server] PID:', errorInfo.pid);
    console.error('[Server] Uptime:', errorInfo.uptime, 'seconds');
    console.error('[Server] Memory:', JSON.stringify(errorInfo.memory));
    console.error('[Server] Error name:', errorInfo.name);
    console.error('[Server] Error message:', errorInfo.message);
    console.error('[Server] Error code:', errorInfo.code);
    console.error('[Server] Stack trace:', errorInfo.stack);
    console.error('[Server] Full error info:', JSON.stringify(errorInfo, null, 2));
    console.error('[Server] =========================================');
    
    // stderr로도 직접 출력 (Railway 로그에 확실히 기록)
    process.stderr.write(`\n[CRITICAL] UNCAUGHT EXCEPTION at ${errorInfo.timestamp}\n`);
    process.stderr.write(`Name: ${errorInfo.name}\n`);
    process.stderr.write(`Message: ${errorInfo.message}\n`);
    process.stderr.write(`Code: ${errorInfo.code || 'N/A'}\n`);
    if (errorInfo.stack) {
        process.stderr.write(`Stack: ${errorInfo.stack}\n`);
    }
    const memMB = {
        rss: Math.round(errorInfo.memory.rss / 1024 / 1024),
        heapUsed: Math.round(errorInfo.memory.heapUsed / 1024 / 1024),
        heapTotal: Math.round(errorInfo.memory.heapTotal / 1024 / 1024),
        external: Math.round(errorInfo.memory.external / 1024 / 1024)
    };
    process.stderr.write(`Memory: RSS=${memMB.rss}MB, Heap=${memMB.heapUsed}/${memMB.heapTotal}MB, External=${memMB.external}MB\n`);
    process.stderr.write(`PID: ${errorInfo.pid}, Uptime: ${errorInfo.uptime}s\n\n`);
    
    // 메모리 부족 에러인 경우 프로세스 종료 (Railway가 재시작)
    if ((error as any)?.code === 'ENOMEM' || error.message?.includes('out of memory')) {
        console.error('[Server] Out of memory error detected. Exiting for Railway restart.');
        process.stderr.write('[CRITICAL] Out of memory - exiting\n');
        process.stderr.write('[CRASH_REASON] uncaught_exception_enomem\n', () => {});
        // 메모리 정리 시도
        try {
            if (global.gc) {
                global.gc();
                console.log('[Server] Manual garbage collection triggered before exit');
            }
        } catch (gcError) {
            console.error('[Server] Failed to trigger GC:', gcError);
        }
        process.exit(1);
    }
    
    // 메모리 사용량이 매우 높은 경우 경고
    if (memMB.rss > 400) {
        console.error(`[Server] WARNING: High memory usage detected (${memMB.rss}MB RSS) during uncaught exception`);
        process.stderr.write(`[WARNING] High memory usage: ${memMB.rss}MB RSS\n`);
    }
    
    // 데이터베이스 연결 에러는 치명적이지 않음
    const isDbError = (error as any)?.code?.startsWith('P') || 
                     error.message?.includes('database') || 
                     error.message?.includes('connection');
    
    if (isDbError) {
        console.warn('[Server] Database error in uncaught exception (non-fatal). Server will continue.');
        return; // 서버는 계속 실행
    }
    
    // 치명적인 에러 타입 체크
    const isFatalError = 
        error.name === 'TypeError' && error.message?.includes('Cannot read property') ||
        error.name === 'ReferenceError' ||
        error.name === 'SyntaxError' ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('EADDRINUSE') ||
        error.message?.includes('EACCES') ||
        (error as any)?.code === 'EADDRINUSE' ||
        (error as any)?.code === 'EACCES';
    
    // 치명적인 에러는 프로세스를 종료하여 Railway가 재시작하도록 함
    if (isFatalError) {
        console.error('[Server] Fatal error detected. Exiting for Railway restart.');
        process.stderr.write('[CRITICAL] Fatal error - exiting for restart\n');
        process.stderr.write(`[CRASH_REASON] uncaught_exception_fatal name=${error.name} message=${error.message?.substring(0, 80)}\n`, () => {});
        // 메모리 정리 시도
        try {
            if (global.gc) {
                global.gc();
            }
        } catch (gcError) {
            // 무시
        }
        // Railway가 재시작하도록 프로세스 종료
        process.exit(1);
    }
    
    // 연속 에러 추적 (같은 에러가 5번 연속 발생하면 종료)
    const errorKey = `${error.name}:${error.message?.substring(0, 100)}`;
    (global as any).uncaughtExceptionCount = (global as any).uncaughtExceptionCount || {};
    (global as any).uncaughtExceptionCount[errorKey] = ((global as any).uncaughtExceptionCount[errorKey] || 0) + 1;
    
    if ((global as any).uncaughtExceptionCount[errorKey] >= 5) {
        console.error(`[Server] Same error occurred 5 times consecutively. Exiting for Railway restart.`);
        process.stderr.write(`[CRITICAL] Repeated error (5x) - exiting for restart\n`);
        process.stderr.write(`[CRASH_REASON] uncaught_exception_repeated_5x key=${errorKey}\n`, () => {});
        process.exit(1);
    }
    
    // 1분 후 카운터 리셋
    setTimeout(() => {
        if ((global as any).uncaughtExceptionCount) {
            (global as any).uncaughtExceptionCount[errorKey] = 0;
        }
    }, 60000);
    
    // Railway 환경에서는 치명적이지 않은 에러는 로깅만 하고 계속 실행
    if (process.env.RAILWAY_ENVIRONMENT) {
        console.error('[Server] Railway environment detected. Attempting to continue despite error...');
        // 프로세스를 종료하지 않음 - 서버는 계속 실행되어야 함
    } else {
        // 로컬 환경에서도 치명적이지 않은 에러는 계속 실행
        console.error('[Server] Attempting to continue despite error...');
    }
});

// 프로세스 종료 감지 및 로깅
process.on('exit', (code) => {
    console.error(`[Server] Process exiting with code: ${code}`);
    console.error(`[Server] Exit time: ${new Date().toISOString()}`);
});

// SIGTERM/SIGINT는 createApp() 내부에서 등록됨 (graceful shutdown). 여기서 중복 등록하면 그쪽이 덮어씌워지므로 핸들러 제거하지 않음.

// beforeExit 핸들러 제거 - 이 핸들러는 프로세스 종료를 방해할 수 있음
// Railway는 정상적인 종료 시그널(SIGTERM)을 보내므로 beforeExit 핸들러가 필요 없음

// 메모리 사용량 모니터링 (주기적으로 로그) - 프로덕션에서는 간격 증가
if (process.env.RAILWAY_ENVIRONMENT) {
    const memCheckInterval = process.env.NODE_ENV === 'production' ? 300000 : 60000; // 프로덕션: 5분, 개발: 1분
    setInterval(() => {
        const memUsage = process.memoryUsage();
        const memUsageMB = {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
        };
        // 프로덕션에서는 메모리 사용량이 높을 때만 로깅
        if (process.env.NODE_ENV === 'production') {
            if (memUsageMB.rss > 300) {
                console.log(`[Server] Memory usage: RSS=${memUsageMB.rss}MB, Heap=${memUsageMB.heapUsed}/${memUsageMB.heapTotal}MB`);
            }
        } else {
            console.log(`[Server] Memory usage: RSS=${memUsageMB.rss}MB, Heap=${memUsageMB.heapUsed}/${memUsageMB.heapTotal}MB`);
        }
        // Railway: 주기 로그로 "살아있음" 확인 가능. 이 로그가 갑자기 끊기면 OOM 등 외부 kill 가능성
        if (process.env.RAILWAY_ENVIRONMENT && memUsageMB.rss > 200) {
            process.stderr.write(`[Server] heartbeat uptime=${Math.round(process.uptime())}s rss=${memUsageMB.rss}MB\n`);
        }
        
        // 메모리 사용량이 너무 높으면 경고
        if (memUsageMB.rss > 500) {
            console.warn(`[Server] WARNING: High memory usage detected: ${memUsageMB.rss}MB`);
        }
    }, memCheckInterval);
}
// 메모리 사용량 모니터링은 메인 루프에서도 처리됨 (중복 방지)

/** Starts the server: creates refs, then createApp (which runs DB init and listen when not in testMode). */
async function startServer(): Promise<void> {
    const serverRef: ServerRef = { serverInstance: null, isServerReady: false };
    const dbInitializedRef: DbInitializedRef = { value: false };
    createApp(serverRef, dbInitializedRef);
}

// Start server with error handling (skip when running under Vitest so tests can import createApp without starting listen)
// 서버가 반드시 리스닝을 시작하도록 보장
// 실패해도 재시도
if (!process.env.VITEST) {
(async () => {
    let retryCount = 0;
    const maxRetries = 5;
    
    while (retryCount < maxRetries) {
        try {
            await startServer();
            console.log('[Server] Server started successfully');
            break; // 성공하면 루프 종료
        } catch (error: any) {
            retryCount++;
            console.error(`[Server] Fatal error during startup (attempt ${retryCount}/${maxRetries}):`, error);
            console.error('[Server] Stack trace:', error?.stack);
            console.error('[Server] Error message:', error?.message);
            console.error('[Server] Error code:', error?.code);
            
            // Railway 환경에서는 프로세스를 종료하지 않고 재시도
            if (process.env.RAILWAY_ENVIRONMENT) {
                if (retryCount < maxRetries) {
                    const retryDelay = Math.min(10000 * retryCount, 30000); // 최대 30초
                    console.error(`[Server] Railway environment detected. Will retry in ${retryDelay}ms (${retryCount}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue; // 재시도
                } else {
                    console.error('[Server] Max retries reached. Server will continue running despite startup errors.');
                    // 프로세스를 종료하지 않음 - 서버는 계속 실행되어야 함
                    break;
                }
            } else {
                // 로컬 환경에서는 재시도 후 종료
                if (retryCount < maxRetries) {
                    const retryDelay = Math.min(10000 * retryCount, 30000); // 최대 30초
                    console.error(`[Server] Will retry in ${retryDelay}ms (${retryCount}/${maxRetries})...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                    continue; // 재시도
                } else {
                    console.error('[Server] Max retries reached. Exiting...');
                    process.exit(1);
                }
            }
        }
    }
    
    // 서버가 시작되지 않았어도 프로세스는 계속 실행
    // Railway 환경에서는 헬스체크가 실패하면 자동 재시작됨
    console.log('[Server] Startup wrapper completed. Process will continue running.');
})();
}

// Keep-alive는 startServer 내부의 server.listen 콜백에서 이미 처리됨
// 여기서는 추가 keep-alive가 필요 없음