// 랭킹 데이터 캐싱 시스템
import * as db from './db.js';
import { prismaErrorImpliesEngineNotConnected } from './prismaClient.js';
import { ensurePrismaEngineReady } from './prisma/gameService.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/index.js';
import { RANKED_ELO_BASE_SCORE } from '../shared/constants/rules.js';
import { readStrategicRankedBlock, readPairRankedBlock } from '../shared/utils/unifiedRankedStatsMigration.js';
import { pickChampionshipVersusSeasonRankingStats } from '../shared/utils/championshipVersusElo.js';
import { getAdventureHuntingScore } from '../shared/utils/adventureHuntingScore.js';
import { getAdventureCodexCompletionBreakdown } from '../utils/adventureCodexCompletion.js';
import type { User } from '../types/index.js';

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
    /** 탐험 랭킹: 몬스터 이해도(도감 완성도) % */
    monsterUnderstandingPercent?: number;
    /** 챔피언십 랭킹: 초반/중반/종반·종합 능력치 */
    openingAbility?: number;
    midgameAbility?: number;
    endgameAbility?: number;
    totalAbility?: number;
}

function buildUserLevelMap(users: Array<{ id?: string; userLevel?: number } | null | undefined>): Map<string, number> {
    const map = new Map<string, number>();
    for (const user of users) {
        if (!user?.id) continue;
        map.set(user.id, Math.max(1, Math.floor(Number(user.userLevel) || 1)));
    }
    return map;
}

function mergeUserLevelsIntoRankings(rankings: RankingEntry[], levelMap: Map<string, number>): RankingEntry[] {
    return rankings.map((entry) => ({
        ...entry,
        userLevel:
            entry.userLevel != null && Number.isFinite(Number(entry.userLevel))
                ? Math.max(1, Math.floor(Number(entry.userLevel)))
                : (levelMap.get(entry.id) ?? 1),
    }));
}

function rankingListsMissingUserLevel(cache: RankingCache): boolean {
    return (
        cache.combat.some((entry) => entry.userLevel == null) ||
        cache.manner.some((entry) => entry.userLevel == null)
    );
}

/** 탐험 랭킹에 몬스터 이해도 %가 없는 구버전 캐시 → 재빌드 */
function adventureRankingsMissingUnderstanding(cache: RankingCache): boolean {
    const adventure = Array.isArray(cache.adventure) ? cache.adventure : [];
    if (adventure.length === 0) return false;
    return adventure.some(
        (entry) =>
            entry.monsterUnderstandingPercent == null ||
            !Number.isFinite(Number(entry.monsterUnderstandingPercent)),
    );
}

/** 챔피언십 랭킹에 능력치 필드가 없는 구버전 캐시 → 재빌드 */
function championshipRankingsMissingAbility(cache: RankingCache): boolean {
    const championship = Array.isArray(cache.championship) ? cache.championship : [];
    if (championship.length === 0) return false;
    return championship.some(
        (entry) =>
            entry.openingAbility == null ||
            entry.midgameAbility == null ||
            entry.endgameAbility == null ||
            entry.totalAbility == null ||
            !Number.isFinite(Number(entry.openingAbility)) ||
            !Number.isFinite(Number(entry.midgameAbility)) ||
            !Number.isFinite(Number(entry.endgameAbility)) ||
            !Number.isFinite(Number(entry.totalAbility)),
    );
}

interface RankingCache {
    strategic: RankingEntry[];
    pair: RankingEntry[];
    championship: RankingEntry[];
    combat: RankingEntry[];
    manner: RankingEntry[];
    adventure: RankingEntry[];
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
    
    // 캐시가 유효하면 반환 (구버전 필드 누락 캐시는 재빌드)
    if (rankingCache && (now - rankingCache.timestamp) < CACHE_TTL) {
        if (rankingListsMissingUserLevel(rankingCache)) {
            console.log('[RankingCache] Rebuilding cache: combat/manner entries missing userLevel');
            rankingCache = null;
        } else if (adventureRankingsMissingUnderstanding(rankingCache)) {
            console.log('[RankingCache] Rebuilding cache: adventure entries missing monsterUnderstandingPercent');
            rankingCache = null;
        } else if (championshipRankingsMissingAbility(rankingCache)) {
            console.log('[RankingCache] Rebuilding cache: championship entries missing ability stats');
            rankingCache = null;
        } else {
            return rankingCache;
        }
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
                    adventure: [],
                    strategicSeason: [],
                    pairSeason: [],
                    timestamp: now
                };
                rankingCache = emptyCache;
                return emptyCache;
            }
            
            // 바둑능력·챔피언십 능력치용: 장비/인벤토리 포함 사용자 1회 조회
            const equippedUsersBundlePromise = db
                .getAllUsers({ includeEquipment: true, includeInventory: true, skipCache: true })
                .then(async (usersWithEquipment) => {
                    const users = usersWithEquipment || [];
                    const [combatRankings, championshipRankings] = await Promise.all([
                        calculateCombatRankings(users),
                        calculateChampionshipRankings(users),
                    ]);
                    return { combatRankings, championshipRankings, users };
                })
                .catch((error) => {
                    console.error('[RankingCache] Error calculating equipped-user rankings:', error);
                    return { combatRankings: [] as RankingEntry[], championshipRankings: [] as RankingEntry[], users: [] as any[] };
                });
            
            // 병렬로 여러 랭킹 계산
            const [
                strategicRankings,
                pairRankings,
                mannerRankings,
                equippedUsersBundle,
                adventureRankings,
                strategicSeasonRankings,
                pairSeasonRankings,
            ] = await Promise.all([
                Promise.resolve(calculateStrategicUnifiedRanking(allUsers)).catch((err) => {
                    console.error('[RankingCache] Error calculating strategic rankings:', err);
                    return [];
                }),
                Promise.resolve(calculatePairRanking(allUsers)).catch((err) => {
                    console.error('[RankingCache] Error calculating pair rankings:', err);
                    return [];
                }),
                Promise.resolve(calculateMannerRankings(allUsers)).catch((err) => {
                    console.error('[RankingCache] Error calculating manner rankings:', err);
                    return [];
                }),
                equippedUsersBundlePromise,
                Promise.resolve(calculateAdventureRankings(allUsers)).catch((err) => {
                    console.error('[RankingCache] Error calculating adventure rankings:', err);
                    return [];
                }),
                Promise.resolve(calculateStrategicSeasonRanking(allUsers)).catch((err) => {
                    console.error('[RankingCache] Error calculating strategic season rankings:', err);
                    return [];
                }),
                Promise.resolve(calculatePairSeasonRanking(allUsers)).catch((err) => {
                    console.error('[RankingCache] Error calculating pair season rankings:', err);
                    return [];
                })
            ]);

            const combatRankings = equippedUsersBundle?.combatRankings || [];
            let championshipRankings = equippedUsersBundle?.championshipRankings || [];
            if (championshipRankings.length === 0) {
                // 장비 조회 실패 시 ELO만이라도 채움
                try {
                    championshipRankings = await calculateChampionshipRankings(allUsers);
                } catch (err) {
                    console.error('[RankingCache] Error calculating championship rankings fallback:', err);
                    championshipRankings = [];
                }
            }
            const userLevelMap = buildUserLevelMap(allUsers);
            for (const user of equippedUsersBundle?.users || []) {
                if (!user?.id) continue;
                userLevelMap.set(user.id, Math.max(1, Math.floor(Number(user.userLevel) || 1)));
            }

            rankingCache = {
                strategic: mergeUserLevelsIntoRankings(strategicRankings || [], userLevelMap),
                pair: mergeUserLevelsIntoRankings(pairRankings || [], userLevelMap),
                championship: mergeUserLevelsIntoRankings(championshipRankings || [], userLevelMap),
                combat: mergeUserLevelsIntoRankings(combatRankings, userLevelMap),
                manner: mergeUserLevelsIntoRankings(mannerRankings || [], userLevelMap),
                adventure: mergeUserLevelsIntoRankings(adventureRankings || [], userLevelMap),
                strategicSeason: mergeUserLevelsIntoRankings(strategicSeasonRankings || [], userLevelMap),
                pairSeason: mergeUserLevelsIntoRankings(pairSeasonRankings || [], userLevelMap),
                timestamp: now,
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
                adventure: [],
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

// 챔피언십 랭킹: 시즌 ELO + 전적 + 챔피언십 능력치(초/중/종·종합), 상위 100명
async function calculateChampionshipRankings(allUsers: any[]): Promise<RankingEntry[]> {
    const rankings: RankingEntry[] = [];
    const { calculateTotalStats } = await import('./statService.js');
    const { championshipKataAbilityScore } = await import('../shared/constants/championshipRealMatch.js');

    for (const user of allUsers) {
        if (!user || !user.id) continue;
        const row = pickChampionshipVersusSeasonRankingStats(user as User);
        if (!row) continue;

        const totalGames = row.seasonWins + row.seasonLosses;
        let openingAbility = 0;
        let midgameAbility = 0;
        let endgameAbility = 0;
        let totalAbility = 0;
        try {
            const stats = calculateTotalStats(user as User, 'championshipVenue');
            openingAbility = championshipKataAbilityScore('opening', stats);
            midgameAbility = championshipKataAbilityScore('midgame', stats);
            endgameAbility = championshipKataAbilityScore('endgame', stats);
            totalAbility = Object.values(stats).reduce((acc: number, v: number) => acc + (Number(v) || 0), 0);
            totalAbility = Math.round(totalAbility);
        } catch (err: any) {
            console.warn(
                '[RankingCache] championship ability stats failed for',
                user.id,
                err?.message || err,
            );
        }

        rankings.push({
            id: user.id,
            nickname: user.nickname || user.username,
            avatarId: user.avatarId,
            borderId: user.borderId,
            rank: 0,
            score: row.rating,
            totalGames,
            wins: row.seasonWins,
            losses: row.seasonLosses,
            league: user.league,
            userLevel: Math.max(1, Math.floor(Number(user.userLevel) || 1)),
            openingAbility,
            midgameAbility,
            endgameAbility,
            totalAbility,
        });
    }

    rankings.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const awr = a.totalGames > 0 ? a.wins / a.totalGames : 0;
        const bwr = b.totalGames > 0 ? b.wins / b.totalGames : 0;
        if (bwr !== awr) return bwr - awr;
        return a.losses - b.losses;
    });
    return rankings.slice(0, 100).map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/** 모험 사냥 점수(처치 몬스터 레벨 합) — 동점 시 `huntingScoreReachedAt` 이른 순 */
function calculateAdventureRankings(allUsers: any[]): RankingEntry[] {
    const rows: Array<{ entry: RankingEntry; reachedAt: number }> = [];

    for (const user of allUsers) {
        if (!user || !user.id) continue;
        const hunt = getAdventureHuntingScore(user.adventureProfile);
        if (hunt.score <= 0) continue;

        let understandingPercent = 0;
        try {
            understandingPercent = getAdventureCodexCompletionBreakdown(user.adventureProfile).overallPercent;
        } catch (err) {
            console.warn('[RankingCache] adventure understanding percent failed for', user.id, err);
        }
        rows.push({
            reachedAt: hunt.reachedAt,
            entry: {
                id: user.id,
                nickname: user.nickname || user.username,
                avatarId: user.avatarId,
                borderId: user.borderId,
                rank: 0,
                score: hunt.score,
                totalGames: 0,
                wins: 0,
                losses: 0,
                league: user.league,
                userLevel: Math.max(1, Math.floor(Number(user.userLevel) || 1)),
                monsterUnderstandingPercent: Math.min(100, Math.max(0, Number(understandingPercent) || 0)),
            },
        });
    }

    rows.sort((a, b) => {
        if (b.entry.score !== a.entry.score) return b.entry.score - a.entry.score;
        return a.reachedAt - b.reachedAt;
    });

    return rows.map((row, index) => ({ ...row.entry, rank: index + 1 }));
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
            league: user.league,
            userLevel: Math.max(1, Math.floor(Number(user.userLevel) || 1)),
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
                    league: user.league,
                    userLevel: Math.max(1, Math.floor(Number(user.userLevel) || 1)),
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
            userLevel: Math.max(1, Math.floor(Number(user.userLevel) || 1)),
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

        const blk = readStrategicRankedBlock(user.stats);
        const totalGames = blk.wins + blk.losses;
        if (totalGames < 10) continue;

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
        const blk = readPairRankedBlock(user.stats);
        const wins = blk.wins;
        const losses = blk.losses;
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
        const blk = readPairRankedBlock(user.stats);
        const wins = blk.wins;
        const losses = blk.losses;
        const totalGames = wins + losses;
        if (totalGames < 5) continue;
        const dr = user.dailyRankings?.pair;
        const score =
            dr && typeof dr.score === 'number' && Number.isFinite(dr.score)
                ? RANKED_ELO_BASE_SCORE + dr.score
                : blk.rankingScore;
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
    adventure?: { rank: number; score: number; totalPlayers: number };
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
        manner: findRank(cache.manner, userId),
        adventure: findRank(cache.adventure, userId),
    };
}

