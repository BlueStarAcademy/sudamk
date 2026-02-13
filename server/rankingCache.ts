// 랭킹 데이터 캐싱 시스템
import * as db from './db.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/index.js';

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
}

interface RankingCache {
    strategic: RankingEntry[];
    playful: RankingEntry[];
    championship: RankingEntry[];
    combat: RankingEntry[];
    manner: RankingEntry[];
    strategicSeason: RankingEntry[]; // 시즌별 티어 랭킹
    playfulSeason: RankingEntry[]; // 시즌별 티어 랭킹
    timestamp: number;
}

let rankingCache: RankingCache | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10분 캐시 (5분 -> 10분으로 증가)

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
    
    // 메모리 사용량이 너무 높으면 기존 캐시 반환
    if (memUsageMBBefore.rss > 400) {
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
                    playful: [],
                    championship: [],
                    combat: [],
                    manner: [],
                    strategicSeason: [],
                    playfulSeason: [],
                    timestamp: now
                };
                rankingCache = emptyCache;
                return emptyCache;
            }
            
            // 병렬로 여러 랭킹 계산 (combat은 별도 처리)
            // 각 계산에 개별 에러 핸들링 추가 (하나 실패해도 다른 것들은 성공)
            const [strategicRankings, playfulRankings, championshipRankings, mannerRankings, combatRankings, strategicSeasonRankings, playfulSeasonRankings] = await Promise.all([
                Promise.resolve(calculateRanking(allUsers, SPECIAL_GAME_MODES, 'strategic', 'standard')).catch((err) => {
                    console.error('[RankingCache] Error calculating strategic rankings:', err);
                    return [];
                }),
                Promise.resolve(calculateRanking(allUsers, PLAYFUL_GAME_MODES, 'playful', 'playful')).catch((err) => {
                    console.error('[RankingCache] Error calculating playful rankings:', err);
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
                calculateCombatRankings(allUsers).catch((error) => {
                    // combat ranking 실패 시 빈 배열 반환 (서버 크래시 방지)
                    console.error('[RankingCache] Error calculating combat rankings:', error);
                    return [];
                }),
                Promise.resolve(calculateSeasonRanking(allUsers, SPECIAL_GAME_MODES, 'strategic')).catch((err) => {
                    console.error('[RankingCache] Error calculating strategic season rankings:', err);
                    return [];
                }),
                Promise.resolve(calculateSeasonRanking(allUsers, PLAYFUL_GAME_MODES, 'playful')).catch((err) => {
                    console.error('[RankingCache] Error calculating playful season rankings:', err);
                    return [];
                })
            ]);
            
            rankingCache = {
                strategic: strategicRankings || [],
                playful: playfulRankings || [],
                championship: championshipRankings || [],
                combat: combatRankings || [],
                manner: mannerRankings || [],
                strategicSeason: strategicSeasonRankings || [],
                playfulSeason: playfulSeasonRankings || [],
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
                playful: [],
                championship: [],
                combat: [],
                manner: [],
                strategicSeason: [],
                playfulSeason: [],
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

// 전투력 랭킹 계산 (장비 보너스 포함)
async function calculateCombatRankings(allUsers: any[]): Promise<RankingEntry[]> {
    const rankings: RankingEntry[] = [];
    const { calculateTotalStats } = await import('./statService.js');
    const { getAllUsers } = await import('./db.js');
    const allGameModes = [...SPECIAL_GAME_MODES, ...PLAYFUL_GAME_MODES];
    
    try {
        // 메모리 사용량 확인
        const memUsage = process.memoryUsage();
        const memUsageMB = {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024)
        };
        
        // 메모리 사용량이 너무 높으면 처리 제한
        const maxUsersToProcess = memUsageMB.rss > 350 ? 200 : 500;
        const usersToProcess = allUsers.slice(0, maxUsersToProcess);
        
        // 배치로 처리하여 메모리 사용량 제한 (한 번에 30명씩으로 감소)
        const batchSize = memUsageMB.rss > 350 ? 30 : 50;
        const { getUser } = await import('./db.js');
        
        console.log(`[RankingCache] Processing combat rankings: ${usersToProcess.length} users in batches of ${batchSize} (Memory: ${memUsageMB.rss}MB RSS)`);
        
        // inventory가 필요한 사용자 계산 (배치 처리)
        for (let i = 0; i < usersToProcess.length; i += batchSize) {
            // 메모리 체크 (배치마다)
            const currentMemUsage = process.memoryUsage();
            const currentMemMB = Math.round(currentMemUsage.rss / 1024 / 1024);
            if (currentMemMB > 450) {
                console.warn(`[RankingCache] Memory usage too high (${currentMemMB}MB), stopping combat ranking calculation`);
                break;
            }
            
            const batch = usersToProcess.slice(i, i + batchSize);
            
            // 배치 단위로 병렬 처리 (타임아웃 추가)
            await Promise.allSettled(batch.map(async (user) => {
                if (!user || !user.id) return;
                
                try {
                    // 각 사용자 조회에 타임아웃 추가 (5초)
                    const userTimeout = new Promise<any>((_, reject) => {
                        setTimeout(() => reject(new Error('getUser timeout')), 5000);
                    });
                    
                    const fullUser = await Promise.race([
                        getUser(user.id, { includeEquipment: true, includeInventory: true }),
                        userTimeout
                    ]);
                    
                    if (!fullUser) return;
                    
                    // calculateTotalStats로 6가지 능력치 합계 계산 (장비 보너스 포함)
                    const totalStats = calculateTotalStats(fullUser);
                    const sum = Object.values(totalStats).reduce((acc: number, value: number) => acc + value, 0);
                    
                    rankings.push({
                        id: fullUser.id,
                        nickname: fullUser.nickname || fullUser.username,
                        avatarId: fullUser.avatarId,
                        borderId: fullUser.borderId,
                        rank: 0,
                        score: sum,
                        totalGames: calculateTotalGames(fullUser, allGameModes),
                        wins: 0,
                        losses: 0,
                        league: fullUser.league
                    });
                } catch (error: any) {
                    console.error(`[RankingCache] Error calculating combat ranking for user ${user.id}:`, error?.message || error);
                    // 에러 발생해도 계속 진행
                }
            }));
            
            // 배치 처리 사이에 대기 시간 증가 (메모리 압력 완화)
            if (i + batchSize < usersToProcess.length) {
                await new Promise(resolve => setTimeout(resolve, 50)); // 10ms -> 50ms로 증가
            }
        }
        
        console.log(`[RankingCache] Processed ${rankings.length} users for combat rankings (limited to ${maxUsersToProcess})`);
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

// 특정 타입의 랭킹 계산 (누적 랭킹 점수 사용)
function calculateRanking(
    allUsers: any[],
    gameModes: any[],
    mode: 'strategic' | 'playful',
    scoreKey: 'standard' | 'playful'
): RankingEntry[] {
    const rankings: RankingEntry[] = [];
    
    for (const user of allUsers) {
        if (!user || !user.id) continue;
        
        // cumulativeRankingScore가 있어야 랭킹에 포함
        if (user.cumulativeRankingScore?.[scoreKey] === undefined) continue;
        
        // 한 번만 계산
        const totalGames = calculateTotalGames(user, gameModes);
        // 10판 이상 PVP 필수
        if (totalGames < 10) continue;
        
        let wins = 0;
        let losses = 0;
        for (const gameMode of gameModes) {
            const gameStats = user.stats?.[gameMode.mode];
            if (gameStats) {
                wins += gameStats.wins || 0;
                losses += gameStats.losses || 0;
            }
        }
        
        // cumulativeRankingScore는 이미 1200에서의 차이값 (예: 828점이면 -372점)
        const score = user.cumulativeRankingScore?.[scoreKey] || 0;
        
        rankings.push({
            id: user.id,
            nickname: user.nickname || user.username,
            avatarId: user.avatarId,
            borderId: user.borderId,
            rank: 0, // rank는 나중에 정렬 후 설정됨
            score: score, // 1200에서의 차이값 그대로 사용 (기본점수 제외)
            totalGames,
            wins,
            losses,
            league: user.league
        });
    }
    
    // 정렬 후 rank 설정
    rankings.sort((a, b) => b.score - a.score);
    return rankings.map((entry, index) => ({
        ...entry,
        rank: index + 1 // 정렬 후 rank 설정
    }));
}

// 시즌별 티어 랭킹 점수 계산 (매 시즌 시작일에 1200점 부여, 랭킹전을 통해 얻거나 잃은 점수)
function calculateSeasonRanking(
    allUsers: any[],
    gameModes: any[],
    mode: 'strategic' | 'playful'
): RankingEntry[] {
    const rankings: RankingEntry[] = [];
    
    for (const user of allUsers) {
        if (!user || !user.id) continue;
        
        // 한 번만 계산
        const totalGames = calculateTotalGames(user, gameModes);
        // 10판 이상 PVP 필수
        if (totalGames < 10) continue;
        
        let wins = 0;
        let losses = 0;
        let totalScore = 0;
        let modeCount = 0;
        
        // 해당 모드들의 rankingScore 평균 계산
        for (const gameMode of gameModes) {
            const gameStats = user.stats?.[gameMode.mode];
            if (gameStats) {
                wins += gameStats.wins || 0;
                losses += gameStats.losses || 0;
                // rankingScore는 매 시즌 시작일에 1200점으로 초기화되고 랭킹전을 통해 변동
                if (gameStats.rankingScore !== undefined) {
                    totalScore += gameStats.rankingScore;
                    modeCount++;
                }
            }
        }
        
        // 평균 점수 계산 (모드가 없으면 제외)
        if (modeCount === 0) continue;
        const avgScore = Math.round(totalScore / modeCount);
        
        rankings.push({
            id: user.id,
            nickname: user.nickname || user.username,
            avatarId: user.avatarId,
            borderId: user.borderId,
            rank: 0, // rank는 나중에 정렬 후 설정됨
            score: avgScore, // 시즌별 티어 랭킹 점수 (1200점 기준)
            totalGames,
            wins,
            losses,
            league: user.league
        });
    }
    
    // 정렬 후 rank 설정
    rankings.sort((a, b) => b.score - a.score);
    return rankings.map((entry, index) => ({
        ...entry,
        rank: index + 1 // 정렬 후 rank 설정
    }));
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
    playful?: { rank: number; score: number; totalPlayers: number };
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
        playful: findRank(cache.playful, userId),
        championship: findRank(cache.championship, userId),
        combat: findRank(cache.combat, userId),
        manner: findRank(cache.manner, userId)
    };
}

