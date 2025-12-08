/**
 * 모든 유저의 챔피언십, 싱글플레이, 도전의 탑 관련 데이터를 완전히 초기화하는 스크립트
 * - 던전 진행 상태 초기화
 * - 토너먼트 상태 초기화
 * - 일일 랭킹 데이터 초기화
 * - 챔피언십 점수 초기화
 * - 싱글플레이 진행 상태 초기화
 * - 도전의 탑 진행 상태 초기화
 * - Prisma와 KV store 모두 업데이트
 * 
 * 실행 방법:
 * npx tsx --tsconfig server/tsconfig.json server/scripts/resetAllChampionshipData.ts
 */

import prisma from '../prismaClient.js';
import * as db from '../db.js';
import * as types from '../../types/index.js';

const resetAllChampionshipData = async () => {
    console.log('='.repeat(60));
    console.log('챔피언십, 싱글플레이, 도전의 탑 데이터 초기화 시작...');
    console.log('='.repeat(60));
    
    try {
        // 1. Prisma에서 모든 사용자 가져오기
        console.log('[1/3] Prisma에서 모든 사용자 가져오는 중...');
        const allPrismaUsers = await prisma.user.findMany({
            select: {
                id: true,
                nickname: true,
                tournamentScore: true,
                towerFloor: true,
                lastTowerClearTime: true,
                monthlyTowerFloor: true,
                status: true
            }
        });
        console.log(`  ✓ ${allPrismaUsers.length}명의 사용자 발견`);
        
        let prismaUsersUpdated = 0;
        let kvUsersUpdated = 0;
        let dungeonProgressReset = 0;
        let tournamentStateReset = 0;
        let dailyRankingsReset = 0;
        let scoreReset = 0;
        let singlePlayerReset = 0;
        let towerReset = 0;
        
        // 2. 각 사용자의 챔피언십 데이터 초기화
        console.log('[2/3] 각 사용자의 챔피언십 데이터 초기화 중...');
        for (const prismaUser of allPrismaUsers) {
            let prismaNeedsUpdate = false;
            let kvNeedsUpdate = false;
            
            // Prisma 업데이트 데이터
            const prismaUpdateData: any = {};
            
            // Prisma: tournamentScore 초기화
            if (prismaUser.tournamentScore !== 0) {
                prismaUpdateData.tournamentScore = 0;
                prismaNeedsUpdate = true;
                scoreReset++;
            }
            
            // Prisma: 도전의 탑 초기화
            if (prismaUser.towerFloor !== 0) {
                prismaUpdateData.towerFloor = 0;
                prismaNeedsUpdate = true;
                towerReset++;
            }
            if (prismaUser.lastTowerClearTime !== null) {
                prismaUpdateData.lastTowerClearTime = null;
                prismaNeedsUpdate = true;
                towerReset++;
            }
            if (prismaUser.monthlyTowerFloor !== 0) {
                prismaUpdateData.monthlyTowerFloor = 0;
                prismaNeedsUpdate = true;
                towerReset++;
            }
            
            // KV store 사용자 데이터 가져오기
            let kvUser: types.User | null = null;
            try {
                kvUser = await db.getUser(prismaUser.id);
            } catch (error) {
                // KV store에 없으면 건너뛰기
            }
            
            if (kvUser) {
                const updatedKvUser = JSON.parse(JSON.stringify(kvUser));
                
                // 1. 던전 진행 상태 초기화
                if (updatedKvUser.dungeonProgress) {
                    updatedKvUser.dungeonProgress = {
                        neighborhood: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                        national: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                        world: { currentStage: 0, unlockedStages: [1], stageResults: {}, dailyStageAttempts: {} },
                    };
                    kvNeedsUpdate = true;
                    dungeonProgressReset++;
                }
                
                // 2. 토너먼트 상태 초기화
                if (updatedKvUser.lastNeighborhoodTournament) {
                    updatedKvUser.lastNeighborhoodTournament = null;
                    kvNeedsUpdate = true;
                    tournamentStateReset++;
                }
                if (updatedKvUser.lastNationalTournament) {
                    updatedKvUser.lastNationalTournament = null;
                    kvNeedsUpdate = true;
                    tournamentStateReset++;
                }
                if (updatedKvUser.lastWorldTournament) {
                    updatedKvUser.lastWorldTournament = null;
                    kvNeedsUpdate = true;
                    tournamentStateReset++;
                }
                
                // 3. 플레이 날짜 초기화
                if (updatedKvUser.lastNeighborhoodPlayedDate) {
                    updatedKvUser.lastNeighborhoodPlayedDate = null;
                    kvNeedsUpdate = true;
                }
                if (updatedKvUser.lastNationalPlayedDate) {
                    updatedKvUser.lastNationalPlayedDate = null;
                    kvNeedsUpdate = true;
                }
                if (updatedKvUser.lastWorldPlayedDate) {
                    updatedKvUser.lastWorldPlayedDate = null;
                    kvNeedsUpdate = true;
                }
                
                // 4. 일일 승리 횟수 초기화
                if (updatedKvUser.dailyNeighborhoodWins) {
                    updatedKvUser.dailyNeighborhoodWins = 0;
                    kvNeedsUpdate = true;
                }
                if (updatedKvUser.dailyNationalWins) {
                    updatedKvUser.dailyNationalWins = 0;
                    kvNeedsUpdate = true;
                }
                if (updatedKvUser.dailyWorldWins) {
                    updatedKvUser.dailyWorldWins = 0;
                    kvNeedsUpdate = true;
                }
                
                // 5. 일일 랭킹 데이터 초기화 (championship 부분만)
                if (updatedKvUser.dailyRankings) {
                    if (updatedKvUser.dailyRankings.championship) {
                        updatedKvUser.dailyRankings.championship = undefined;
                        kvNeedsUpdate = true;
                        dailyRankingsReset++;
                    }
                }
                
                // 6. 챔피언십 점수 초기화
                if (updatedKvUser.dailyDungeonScore !== undefined && updatedKvUser.dailyDungeonScore !== 0) {
                    updatedKvUser.dailyDungeonScore = 0;
                    kvNeedsUpdate = true;
                    scoreReset++;
                }
                if (updatedKvUser.cumulativeTournamentScore !== undefined && updatedKvUser.cumulativeTournamentScore !== 0) {
                    updatedKvUser.cumulativeTournamentScore = 0;
                    kvNeedsUpdate = true;
                    scoreReset++;
                }
                if (updatedKvUser.yesterdayTournamentScore !== undefined && updatedKvUser.yesterdayTournamentScore !== 0) {
                    updatedKvUser.yesterdayTournamentScore = 0;
                    kvNeedsUpdate = true;
                    scoreReset++;
                }
                
                // 7. 보상 수령 상태 초기화
                if (updatedKvUser.neighborhoodRewardClaimed) {
                    updatedKvUser.neighborhoodRewardClaimed = false;
                    kvNeedsUpdate = true;
                }
                if (updatedKvUser.nationalRewardClaimed) {
                    updatedKvUser.nationalRewardClaimed = false;
                    kvNeedsUpdate = true;
                }
                if (updatedKvUser.worldRewardClaimed) {
                    updatedKvUser.worldRewardClaimed = false;
                    kvNeedsUpdate = true;
                }
                
                // 8. 싱글플레이 진행 상태 초기화
                if (updatedKvUser.singlePlayerProgress !== undefined && updatedKvUser.singlePlayerProgress !== 0) {
                    updatedKvUser.singlePlayerProgress = 0;
                    kvNeedsUpdate = true;
                    singlePlayerReset++;
                }
                if (updatedKvUser.clearedSinglePlayerStages && updatedKvUser.clearedSinglePlayerStages.length > 0) {
                    updatedKvUser.clearedSinglePlayerStages = [];
                    kvNeedsUpdate = true;
                    singlePlayerReset++;
                }
                if (updatedKvUser.singlePlayerMissions && Object.keys(updatedKvUser.singlePlayerMissions).length > 0) {
                    updatedKvUser.singlePlayerMissions = {};
                    kvNeedsUpdate = true;
                    singlePlayerReset++;
                }
                
                // 9. 도전의 탑 진행 상태 초기화 (KV store)
                if (updatedKvUser.towerFloor !== undefined && updatedKvUser.towerFloor !== 0) {
                    updatedKvUser.towerFloor = 0;
                    kvNeedsUpdate = true;
                    towerReset++;
                }
                if (updatedKvUser.lastTowerClearTime !== undefined && updatedKvUser.lastTowerClearTime !== null) {
                    updatedKvUser.lastTowerClearTime = null;
                    kvNeedsUpdate = true;
                    towerReset++;
                }
                if (updatedKvUser.monthlyTowerFloor !== undefined && updatedKvUser.monthlyTowerFloor !== 0) {
                    updatedKvUser.monthlyTowerFloor = 0;
                    kvNeedsUpdate = true;
                    towerReset++;
                }
                
                // KV store 업데이트
                if (kvNeedsUpdate) {
                    await db.updateUser(updatedKvUser);
                    kvUsersUpdated++;
                }
            }
            
            // Prisma 업데이트
            if (prismaNeedsUpdate) {
                await prisma.user.update({
                    where: { id: prismaUser.id },
                    data: prismaUpdateData
                });
                prismaUsersUpdated++;
            }
        }
        
        // 3. status JSON 필드에서도 챔피언십 데이터 제거
        console.log('[3/3] Prisma status JSON 필드에서 챔피언십 데이터 제거 중...');
        let statusUsersUpdated = 0;
        for (const prismaUser of allPrismaUsers) {
            if (prismaUser.status && typeof prismaUser.status === 'object') {
                const status = prismaUser.status as any;
                let statusNeedsUpdate = false;
                const updatedStatus = { ...status };
                
                // status JSON에서 챔피언십, 싱글플레이, 도전의 탑 관련 필드 제거
                const fieldsToRemove = [
                    'dungeonProgress',
                    'lastNeighborhoodTournament',
                    'lastNationalTournament',
                    'lastWorldTournament',
                    'lastNeighborhoodPlayedDate',
                    'lastNationalPlayedDate',
                    'lastWorldPlayedDate',
                    'dailyNeighborhoodWins',
                    'dailyNationalWins',
                    'dailyWorldWins',
                    'neighborhoodRewardClaimed',
                    'nationalRewardClaimed',
                    'worldRewardClaimed',
                    'dailyDungeonScore',
                    'cumulativeTournamentScore',
                    'yesterdayTournamentScore',
                    'singlePlayerProgress',
                    'clearedSinglePlayerStages',
                    'singlePlayerMissions',
                    'towerFloor',
                    'lastTowerClearTime',
                    'monthlyTowerFloor'
                ];
                
                for (const field of fieldsToRemove) {
                    if (updatedStatus[field] !== undefined) {
                        delete updatedStatus[field];
                        statusNeedsUpdate = true;
                    }
                }
                
                // dailyRankings.championship 제거
                if (updatedStatus.dailyRankings && updatedStatus.dailyRankings.championship) {
                    delete updatedStatus.dailyRankings.championship;
                    statusNeedsUpdate = true;
                }
                
                if (statusNeedsUpdate) {
                    await prisma.user.update({
                        where: { id: prismaUser.id },
                        data: { status: updatedStatus }
                    });
                    statusUsersUpdated++;
                }
            }
        }
        console.log(`  ✓ ${statusUsersUpdated}명의 사용자 status JSON 정리됨`);
        
        console.log('\n' + '='.repeat(60));
        console.log('✓ 챔피언십, 싱글플레이, 도전의 탑 데이터 초기화 완료!');
        console.log('='.repeat(60));
        console.log(`  - Prisma 사용자 업데이트: ${prismaUsersUpdated}명`);
        console.log(`  - KV store 사용자 업데이트: ${kvUsersUpdated}명`);
        console.log(`  - Status JSON 업데이트: ${statusUsersUpdated}명`);
        console.log(`  - 던전 진행 상태 초기화: ${dungeonProgressReset}명`);
        console.log(`  - 토너먼트 상태 초기화: ${tournamentStateReset}개`);
        console.log(`  - 일일 랭킹 초기화: ${dailyRankingsReset}명`);
        console.log(`  - 점수 초기화: ${scoreReset}개`);
        console.log(`  - 싱글플레이 초기화: ${singlePlayerReset}명`);
        console.log(`  - 도전의 탑 초기화: ${towerReset}개`);
        console.log('='.repeat(60));
        
    } catch (error: any) {
        console.error('\n❌ 오류 발생:', error);
        console.error('스택 트레이스:', error.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
};

// 스크립트 실행
resetAllChampionshipData().catch((error) => {
    console.error('예상치 못한 오류:', error);
    process.exit(1);
});
