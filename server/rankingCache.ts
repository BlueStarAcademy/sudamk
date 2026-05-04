// 랭킹 데이터 캐싱 시스템
import * as db from './db.js';
import { prismaErrorImpliesEngineNotConnected } from './prismaClient.js';
import { ensurePrismaEngineReady } from './prisma/gameService.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/index.js';
import { readStrategicRankedBlock, readPairRankedBlock } from '../shared/utils/unifiedRankedStatsMigration.js';

interface RankingEntry {
    id: string;
    nickname: string;
    avatarId: string;
    borderId: string;
    rank: number;
    score: number;
    totalGames: number;
    wins: number;
    losses: number;
    league?: string;
    /** 통합 유저 레벨(랭킹 UI 표시용) */
    userLevel?: number;
}

interface RankingCache {
    strategic: RankingEntry[];
    pair: RankingEntry[];
    championship: RankingEntry[];
    combat: RankingEntry[];
    manner: RankingEntry[];
    strategicSeason: RankingEntry[]; // 시즌별 티어 랭킹
    pairSeason: RankingEntry[]; // 페어 시즌 랭킹
    timestamp: number;
}

let rankingCache: RankingCache | null = null;
const CACHE_TTL = 15 * 60 * 1000; // 15분 캐시 (메모리·DB 부하 감소)

// 동시 빌드 방지: 빌드 중인 경우 기존 Promise를 기다림
let buildingPromise: Promise<RankingCache> | null = null;

// 랭킹 데이터를 계산하고 캐시에 저장
export async function buildRankingCache(): Promise<RankingCache> {
    const now = Date.now();
    
    // 캐시가 유효하면 반환
    if (rankingCache && (now - rankingCache.timestamp) < CACHE_TTL) {
        return rankingCache;
    }
    
    // 이미 빌드 중이면 기존 Promise를 기다림 (동시 빌드 방지)
    if (buildingPromise) {
        console.log('[RankingCache] Cache build in progress, waiting for existing build...');
        try {
            // 기존 빌드에 타임아웃 추가 (60초)
            const timeoutPromise = new Promise<RankingCache>((_, reject) => {
                setTimeout(() => reject(new Error('Ranking cache build timeout (waiting for existing build)')), 60000);
            });
            return await Promise.race([buildingPromise, timeoutPromise]);
        } catch (error) {
            console.error('[RankingCache] Error waiting for existing build:', error);
            // 기존 빌드가 실패하면 새로 시작
            buildingPromise = null;
        }
    }
    
    console.log('[RankingCache] Building ranking cache...');
    const startTime = Date.now();
    
    // 메모리 사용량 확인
    const memUsageBefore = process.memoryUsage();
    const memUsageMBBefore = {
        rss: Math.round(memUsageBefore.rss / 1024 / 1024),
        heapUsed: Math.round(memUsageBefore.heapUsed / 1024 / 1024)
    };
    console.log(`[RankingCache] Memory before build: RSS=${memUsageMBBefore.rss}MB, Heap=${memUsageMBBefore.heapUsed}MB`);
    
    // 메모리 사용량이 너무 높으면 기존 캐시 반환 (32GB: 8GB, 512MB: 400MB)
    const skipThresholdMB = parseInt(process.env.RAILWAY_REPLICA_MEMORY_LIMIT_MB || '0', 10) > 4000 ? 8000 : 400;
    if (memUsageMBBefore.rss > skipThresholdMB) {
        console.warn(`[RankingCache] High memory usage (${memUsageMBBefore.rss}MB), returning stale cache`);
        if (rankingCache) {
            return rankingCache;
        }
    }
    
    // 빌드 시작: Promise를 저장하여 동시 호출 방지
    buildingPromise = (async () => {
        try {
            // 전체 빌드에 타임아웃 추가 (120초)
            const overallTimeout = new Promise<RankingCache>((_, reject) => {
                setTimeout(() => reject(new Error('Ranking cache build overall timeout')), 120000);
            });
            
            const buildPromise = (async () => {
                // Prisma 엔진이 준비될 때까지 대기 (Windows 등에서 "Engine is not yet connected" 방지)
                await ensurePrismaEngineReady();
                // inventory/equipment 없이 사용자 목록 가져오기 (더 빠름)
                // 타임아웃 추가 (30초)
                const usersTimeout = new Promise<any[]>((_, reject) => {
                    setTimeout(() => reject(new Error('getAllUsers timeout')), 30000);
                });
                const allUsers = await Promise.race([
                    db.getAllUsers({ includeEquipment: false, includeInventory: false }),
                    usersTimeout
                ]);
            
            if (!allUsers || allUsers.length === 0) {
                console.warn('[RankingCache] No users found, returning empty cache');
                const emptyCache = {
                    strategic: [],
                    pair: [],
                    championship: [],
                    combat: [],
                    manner: [],
                    strategicSeason: [],
                    pairSeason: [],
                    timestamp: now
                };
                rankingCache = emptyCache;
                return emptyCache;
            }
            
            // 바둑능력(combat) 랭킹용: 장비/인벤토리 포함 사용자 1회 조회 (N번 getUser 호출 제거)
            const combatUsersPromise = db.getAllUsers({ includeEquipment: true, includeInventory: true, skipCache: true })
                .then((usersWithEquipment) => calculateCombatRankings(usersWithEquipment || []))
                .catch((error) => {
                    console.error('[RankingCache] Error calculating combat rankings:', error);
                    return [];
                });
            
            // 병렬로 여러 랭킹 계산
            const [strategicRankings, pairRankings, championshipRankings, mannerRankings, combatRankings, strategicSeasonRankings, pairSeasonRankings] = await Promise.all([
                Promise.resolve(calculateStrategicUnifiedRanking(allUsers)).catch((err) => {
                    console.error('[RankingCache] Error calculating strategic rankings:', err);
                    return [];
                }),
                Promise.resolve(calculatePairRanking(allUsers)).catch((err) => {
                    console.error('[RankingCache] Error calculating pair rankings:', err);
                    return [];
                }),
                Promise.resolve(calculateChampionshipRankings(allUsers)).catch((err) => {
                    console.error('[RankingCache] Error calculating championship rankings:', err);
                    return [];
                }),
                Promise.resolve(calculateMannerRankings(allUsers)).catch((err) => {
                    console.error('[RankingCache] Error calculating manner rankings:', err);
                    return [];
                }),
                combatUsersPromise,
                Promise.resolve(calculateStrategicSeasonRanking(allUsers)).catch((err) => {
                    console.error('[RankingCache] Error calculating strategic season rankings:', err);
                    return [];
                }),
                Promise.resolve(calculatePairSeasonRanking(allUsers)).catch((err) => {
                    console.error('[RankingCache] Error calculating pair season rankings:', err);
                    return [];
                })
            ]);
            
            rankingCache = {
                strategic: strategicRankings || [],
                pair: pairRankings || [],
                championship: championshipRankings || [],
                combat: combatRankings || [],
                manner: mannerRankings || [],
                strategicSeason: strategicSeasonRankings || [],
                pairSeason: pairSeasonRankings || [],
                timestamp: now
            };
            
                const elapsed = Date.now() - startTime;
                const memUsageAfter = process.memoryUsage();
                const memUsageMBAfter = {
                    rss: Math.round(memUsageAfter.rss / 1024 / 1024),
                    heapUsed: Math.round(memUsageAfter.heapUsed / 1024 / 1024)
                };
                console.log(`[RankingCache] Ranking cache built in ${elapsed}ms (${allUsers.length} users)`);
                console.log(`[RankingCache] Memory after build: RSS=${memUsageMBAfter.rss}MB, Heap=${memUsageMBAfter.heapUsed}MB`);
                
                return rankingCache;
            })();
            
            return await Promise.race([buildPromise, overallTimeout]);
        } catch (error: any) {
            const engineNotReady = prismaErrorImpliesEngineNotConnected(error);
            if (engineNotReady) {
                console.warn(
                    '[RankingCache] Prisma engine not ready; returning stale or empty cache (no full dump)'
                );
            } else {
                console.error('[RankingCache] ========== ERROR BUILDING RANKING CACHE ==========');
                console.error('[RankingCache] Error:', error);
                console.error('[RankingCache] Error message:', error?.message);
                console.error('[RankingCache] Error stack:', error?.stack);
                console.error('[RankingCache] Error code:', error?.code);
                const memUsage = process.memoryUsage();
                const memUsageMB = {
                    rss: Math.round(memUsage.rss / 1024 / 1024),
                    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024)
                };
                console.error(`[RankingCache] Memory at error: RSS=${memUsageMB.rss}MB, Heap=${memUsageMB.heapUsed}MB`);
                console.error('[RankingCache] =================================================');
            }
            
            // 메모리 부족 에러인 경우
            if (error?.code === 'ENOMEM' || error?.message?.includes('out of memory')) {
                console.error('[RankingCache] Out of memory error detected!');
                // 메모리 정리 시도
                if (global.gc) {
                    global.gc();
                    console.log('[RankingCache] Manual garbage collection triggered');
                }
            }
            
            // 에러 발생 시 기존 캐시 반환 또는 빈 캐시 반환
            if (rankingCache) {
                console.warn('[RankingCache] Returning stale cache due to error');
                return rankingCache;
            }
            // 캐시가 없으면 빈 캐시 반환
            const errorNow = Date.now();
            const emptyCache = {
                strategic: [],
                pair: [],
                championship: [],
                combat: [],
                manner: [],
                strategicSeason: [],
                pairSeason: [],
                timestamp: errorNow
            };
            rankingCache = emptyCache;
            return emptyCache;
        } finally {
            // 빌드 완료 후 Promise를 null로 리셋하여 다음 빌드 허용
            buildingPromise = null;
        }
    })();
    
    return buildingPromise;
}

// 챔피언십 랭킹 계산: 동네바둑리그 + 전국바둑대회 + 월드챔피언십 점수 합산(cumulativeTournamentScore) 기준, Top 100
function calculateChampionshipRankings(allUsers: any[]): RankingEntry[] {
    const rankings: RankingEntry[] = [];
    const allGameModes = [...SPECIAL_GAME_MODES, ...PLAYFUL_GAME_MODES];

    for (const user of allUsers) {
        if (!user || !user.id) continue;

        const score = typeof user.cumulativeTournamentScore === 'number' ? user.cumulativeTournamentScore : 0;
        if (score <= 0) continue;

        const totalGames = calculateTotalGames(user, allGameModes);
        let wins = 0;
        let losses = 0;
        for (const mode of allGameModes) {
            const gameStats = user.stats?.[mode.mode];
            if (gameStats) {
                wins += gameStats.wins || 0;
                losses += gameStats.losses || 0;
            }
        }

        rankings.push({
            id: user.id,
            nickname: user.nickname || user.username,
            avatarId: user.avatarId,
            borderId: user.borderId,
            rank: 0,
            score,
            totalGames,
            wins,
            losses,
            league: user.league
        });
    }

    rankings.sort((a, b) => b.score - a.score);
    return rankings.slice(0, 100).map((entry, index) => ({ ...entry, rank: index + 1 }));
}

// 매너 랭킹 계산 (별도 함수로 분리)
function calculateMannerRankings(allUsers: any[]): RankingEntry[] {
    const rankings: RankingEntry[] = [];
    const allGameModes = [...SPECIAL_GAME_MODES, ...PLAYFUL_GAME_MODES];
    
    for (const user of allUsers) {
        if (!user || !user.id || user.mannerScore === undefined) continue;
        
        rankings.push({
            id: user.id,
            nickname: user.nickname || user.username,
            avatarId: user.avatarId,
            borderId: user.borderId,
            rank: 0,
            score: user.mannerScore || 0,
            totalGames: calculateTotalGames(user, allGameModes),
            wins: 0,
            losses: 0,
            league: user.league
        });
    }
    
    // 정렬 후 rank 설정
    rankings.sort((a, b) => b.score - a.score);
    return rankings.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

// 전투력 랭킹 계산 (장비 보너스 포함). usersWithEquipment는 이미 장비/인벤토리가 포함된 사용자 배열.
async function calculateCombatRankings(usersWithEquipment: any[]): Promise<RankingEntry[]> {
    const rankings: RankingEntry[] = [];
    const { calculateTotalStats } = await import('./statService.js');
    const allGameModes = [...SPECIAL_GAME_MODES, ...PLAYFUL_GAME_MODES];
    
    try {
        const memUsage = process.memoryUsage();
        const memUsageMB = Math.round(memUsage.rss / 1024 / 1024);
        const maxUsersToProcess = memUsageMB > 350 ? 200 : 500;
        const usersToProcess = usersWithEquipment.slice(0, maxUsersToProcess);
        
        console.log(`[RankingCache] Processing combat rankings: ${usersToProcess.length} users (Memory: ${memUsageMB}MB RSS)`);
        
        for (const user of usersToProcess) {
            if (!user || !user.id) continue;
            try {
                const totalStats = calculateTotalStats(user);
                const sum = Object.values(totalStats).reduce((acc: number, value: number) => acc + value, 0);
                rankings.push({
                    id: user.id,
                    nickname: user.nickname || user.username,
                    avatarId: user.avatarId,
                    borderId: user.borderId,
                    rank: 0,
                    score: sum,
                    totalGames: calculateTotalGames(user, allGameModes),
                    wins: 0,
                    losses: 0,
                    league: user.league
                });
            } catch (error: any) {
                console.error(`[RankingCache] Error calculating combat ranking for user ${user.id}:`, error?.message || error);
            }
        }
        
        console.log(`[RankingCache] Processed ${rankings.length} users for combat rankings`);
    } catch (error: any) {
        console.error('[RankingCache] ========== ERROR IN COMBAT RANKINGS ==========');
        console.error('[RankingCache] Error:', error);
        console.error('[RankingCache] Error message:', error?.message);
        console.error('[RankingCache] Error stack:', error?.stack);
        console.error('[RankingCache] ==============================================');
        // 에러 발생 시 빈 배열 반환 (서버 크래시 방지)
        return [];
    }
    
    // 정렬 후 rank 설정
    rankings.sort((a, b) => b.score - a.score);
    return rankings.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/** 전략바둑(1인) 통합 레이팅 — `cumulativeRankingScore.standard`(1200 대비 델타) 기준 */
function calculateStrategicUnifiedRanking(allUsers: any[]): RankingEntry[] {
    const rankings: RankingEntry[] = [];

    for (const user of allUsers) {
        if (!user || !user.id) continue;
        if (user.cumulativeRankingScore?.['standard'] === undefined) continue;

        const blk = readStrategicRankedBlock(user.stats);
        const totalGames = blk.wins + blk.losses;
        if (totalGames < 10) continue;

        const score = user.cumulativeRankingScore?.['standard'] || 0;

        rankings.push({
            id: user.id,
            nickname: user.nickname || user.username,
            avatarId: user.avatarId,
            borderId: user.borderId,
            rank: 0,
            score,
            totalGames,
            wins: blk.wins,
            losses: blk.losses,
            league: user.league,
        });
    }

    rankings.sort((a, b) => b.score - a.score);
    return rankings.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/** 전략 통합 시즌 점수(절대 레이팅) — `stats.strategicRanked.rankingScore` */
function calculateStrategicSeasonRanking(allUsers: any[]): RankingEntry[] {
    const rankings: RankingEntry[] = [];

    for (const user of allUsers) {
        if (!user || !user.id) continue;

        const totalGames = calculateTotalGames(user, SPECIAL_GAME_MODES);
        if (totalGames < 10) continue;

        const blk = readStrategicRankedBlock(user.stats);
        rankings.push({
            id: user.id,
            nickname: user.nickname || user.username,
            avatarId: user.avatarId,
            borderId: user.borderId,
            rank: 0,
            score: blk.rankingScore,
            totalGames,
            wins: blk.wins,
            losses: blk.losses,
            league: user.league,
            userLevel: Math.max(1, Math.floor(Number(user.userLevel) || 1)),
        });
    }

    rankings.sort((a, b) => b.score - a.score);
    return rankings.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function calculatePairRanking(allUsers: any[]): RankingEntry[] {
    const rankings: RankingEntry[] = [];
    for (const user of allUsers) {
        if (!user || !user.id) continue;
        const pairStats = user.stats?.[String('pair')];
        const wins = pairStats?.wins || 0;
        const losses = pairStats?.losses || 0;
        const totalGames = wins + losses;
        if (totalGames < 5) continue;
        const score = user.cumulativeRankingScore?.['pair'] ?? 0;
        rankings.push({
            id: user.id,
            nickname: user.nickname || user.username,
            avatarId: user.avatarId,
            borderId: user.borderId,
            rank: 0,
            score,
            totalGames,
            wins,
            losses,
            league: user.league,
            userLevel: Math.max(1, Math.floor(Number(user.userLevel) || 1)),
        });
    }
    rankings.sort((a, b) => b.score - a.score);
    return rankings.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function calculatePairSeasonRanking(allUsers: any[]): RankingEntry[] {
    const rankings: RankingEntry[] = [];
    for (const user of allUsers) {
        if (!user || !user.id) continue;
        const pairStats = user.stats?.[String('pair')];
        const wins = pairStats?.wins || 0;
        const losses = pairStats?.losses || 0;
        const totalGames = wins + losses;
        if (totalGames < 5) continue;
        const score = Number(user.dailyRankings?.pair?.score ?? 1200);
        rankings.push({
            id: user.id,
            nickname: user.nickname || user.username,
            avatarId: user.avatarId,
            borderId: user.borderId,
            rank: 0,
            score,
            totalGames,
            wins,
            losses,
            league: user.league,
            userLevel: Math.max(1, Math.floor(Number(user.userLevel) || 1)),
        });
    }
    rankings.sort((a, b) => b.score - a.score);
    return rankings.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

// 총 게임 수 계산
function calculateTotalGames(user: any, gameModes: any[]): number {
    let totalGames = 0;
    if (user.stats) {
        for (const gameMode of gameModes) {
            const gameStats = user.stats[gameMode.mode];
            if (gameStats) {
                totalGames += (gameStats.wins || 0) + (gameStats.losses || 0);
            }
        }
    }
    return totalGames;
}

// 캐시 무효화 (랭킹이 업데이트될 때 호출)
export function invalidateRankingCache(): void {
    rankingCache = null;
    console.log('[RankingCache] Cache invalidated');
}

// 특정 사용자의 랭킹 정보만 가져오기 (내 랭킹 확인용)
export async function getUserRankings(userId: string): Promise<{
    strategic?: { rank: number; score: number; totalPlayers: number };
    pair?: { rank: number; score: number; totalPlayers: number };
    championship?: { rank: number; score: number; totalPlayers: number };
    combat?: { rank: number; score: number; totalPlayers: number };
    manner?: { rank: number; score: number; totalPlayers: number };
}> {
    const cache = await buildRankingCache();
    
    const findRank = (rankings: RankingEntry[], userId: string) => {
        const entry = rankings.find(r => r.id === userId);
        return entry ? {
            rank: entry.rank,
            score: entry.score,
            totalPlayers: rankings.length
        } : undefined;
    };
    
    return {
        strategic: findRank(cache.strategic, userId),
        pair: findRank(cache.pair, userId),
        championship: findRank(cache.championship, userId),
        combat: findRank(cache.combat, userId),
        manner: findRank(cache.manner, userId)
    };
}

