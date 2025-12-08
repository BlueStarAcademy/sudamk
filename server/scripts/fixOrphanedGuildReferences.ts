/**
 * 삭제된 길드에 대한 고아 참조 정리 스크립트
 * 
 * 실행 방법:
 * npx tsx --tsconfig server/tsconfig.json server/scripts/fixOrphanedGuildReferences.ts
 * 
 * 이 스크립트는 이미 삭제된 길드에 대한 사용자 참조를 정리합니다.
 * - 존재하지 않는 길드 ID를 참조하는 사용자의 guildId 제거
 * - KV store와 Prisma 모두에서 정리
 */

import prisma from '../prismaClient.js';
import * as db from '../db.js';
import * as guildRepo from '../prisma/guildRepository.js';

async function fixOrphanedGuildReferences() {
    console.log('='.repeat(60));
    console.log('삭제된 길드 참조 정리 시작...');
    console.log('='.repeat(60));
    
    try {
        // 1. 모든 길드 ID 가져오기 (KV store와 Prisma 모두)
        console.log('[1/6] 모든 길드 ID 수집 중...');
        const kvGuilds = await db.getKV<Record<string, any>>('guilds') || {};
        const kvGuildIds = new Set(Object.keys(kvGuilds));
        
        const dbGuilds = await prisma.guild.findMany({ select: { id: true } });
        const dbGuildIds = new Set(dbGuilds.map(g => g.id));
        
        // 모든 유효한 길드 ID (KV store 또는 Prisma에 존재하는 것)
        const validGuildIds = new Set([...kvGuildIds, ...dbGuildIds]);
        console.log(`  ✓ KV store: ${kvGuildIds.size}개, Prisma: ${dbGuildIds.size}개, 총 유효한 길드: ${validGuildIds.size}개`);
        
        // 2. Prisma에서 길드 정보가 있는 사용자 찾기
        console.log('[2/6] Prisma에서 길드 정보가 있는 사용자 확인 중...');
        const usersWithGuild = await prisma.user.findMany({
            select: {
                id: true,
                nickname: true,
                status: true,
                guild: { select: { id: true } },
                guildMember: { select: { id: true, guildId: true } }
            }
        });
        
        let prismaUsersFixed = 0;
        for (const user of usersWithGuild) {
            let needsUpdate = false;
            const status = user.status && typeof user.status === 'object' ? { ...(user.status as any) } : {};
            const guildIdFromStatus = status.guildId;
            
            // status JSON에서 guildId 확인
            if (guildIdFromStatus && !validGuildIds.has(guildIdFromStatus)) {
                console.log(`  → 사용자 ${user.nickname} (${user.id}): 존재하지 않는 길드 ID ${guildIdFromStatus} 제거`);
                delete status.guildId;
                needsUpdate = true;
            }
            
            // guildMember 관계 확인
            if (user.guildMember) {
                const memberGuildId = user.guildMember.guildId;
                if (!validGuildIds.has(memberGuildId)) {
                    console.log(`  → 사용자 ${user.nickname} (${user.id}): 존재하지 않는 길드 멤버 관계 제거 (Guild: ${memberGuildId})`);
                    needsUpdate = true;
                }
            }
            
            // guild 관계 확인 (leader)
            if (user.guild) {
                const leaderGuildId = user.guild.id;
                if (!validGuildIds.has(leaderGuildId)) {
                    console.log(`  → 사용자 ${user.nickname} (${user.id}): 존재하지 않는 길드 리더 관계 제거 (Guild: ${leaderGuildId})`);
                    needsUpdate = true;
                }
            }
            
            if (needsUpdate) {
                const updateData: any = {};
                
                if (status.guildId === undefined && guildIdFromStatus) {
                    updateData.status = status;
                }
                
                if (user.guildMember && !validGuildIds.has(user.guildMember.guildId)) {
                    updateData.guildMember = { delete: true };
                }
                
                await prisma.user.update({
                    where: { id: user.id },
                    data: updateData
                });
                prismaUsersFixed++;
            }
        }
        console.log(`  ✓ ${prismaUsersFixed}명의 사용자 Prisma 데이터 정리됨`);
        
        // 3. KV store의 모든 사용자 확인
        console.log('[3/6] KV store의 모든 사용자 확인 중...');
        let kvUsersFixed = 0;
        for (const user of usersWithGuild) {
            try {
                const kvUser = await db.getUser(user.id);
                if (kvUser) {
                    let needsKvUpdate = false;
                    
                    // KV store 사용자의 guildId 확인
                    if (kvUser.guildId && !validGuildIds.has(kvUser.guildId)) {
                        console.log(`  → KV 사용자 ${kvUser.nickname || user.id}: 존재하지 않는 길드 ID ${kvUser.guildId} 제거`);
                        kvUser.guildId = undefined;
                        needsKvUpdate = true;
                    }
                    
                    // KV store 사용자의 status JSON에서 guildId 확인
                    if (kvUser.status && typeof kvUser.status === 'object') {
                        const kvStatus = { ...(kvUser.status as any) };
                        if (kvStatus.guildId && !validGuildIds.has(kvStatus.guildId)) {
                            console.log(`  → KV 사용자 ${kvUser.nickname || user.id}: status에서 존재하지 않는 길드 ID ${kvStatus.guildId} 제거`);
                            delete kvStatus.guildId;
                            kvUser.status = kvStatus;
                            needsKvUpdate = true;
                        }
                        if (kvStatus.guildApplications) {
                            // guildApplications 배열에서 존재하지 않는 길드 ID 제거
                            const validApplications = (kvStatus.guildApplications || []).filter((app: any) => {
                                if (typeof app === 'string') {
                                    return validGuildIds.has(app);
                                }
                                if (app && app.guildId) {
                                    return validGuildIds.has(app.guildId);
                                }
                                return false;
                            });
                            if (validApplications.length !== (kvStatus.guildApplications || []).length) {
                                kvStatus.guildApplications = validApplications;
                                kvUser.status = kvStatus;
                                needsKvUpdate = true;
                            }
                        }
                    }
                    
                    if (needsKvUpdate) {
                        await db.updateUser(kvUser);
                        kvUsersFixed++;
                    }
                }
            } catch (error: any) {
                console.warn(`  ⚠ KV store 사용자 ${user.id} 확인 실패: ${error.message}`);
            }
        }
        console.log(`  ✓ ${kvUsersFixed}명의 사용자 KV store 데이터 정리됨`);
        
        // 4. 모든 사용자 재확인 (status JSON에서만 guildId가 있는 경우)
        console.log('[4/6] 모든 사용자의 status JSON 확인 중...');
        const allUsers = await prisma.user.findMany({
            select: { id: true, nickname: true, status: true }
        });
        
        let statusUsersFixed = 0;
        for (const user of allUsers) {
            if (user.status && typeof user.status === 'object') {
                const status = user.status as any;
                if (status.guildId && !validGuildIds.has(status.guildId)) {
                    console.log(`  → 사용자 ${user.nickname} (${user.id}): status에서 존재하지 않는 길드 ID ${status.guildId} 제거`);
                    const updatedStatus = { ...status };
                    delete updatedStatus.guildId;
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { status: updatedStatus }
                    });
                    statusUsersFixed++;
                }
            }
        }
        console.log(`  ✓ ${statusUsersFixed}명의 사용자 status JSON 정리됨`);
        
        // 5. GuildMember 테이블에서 존재하지 않는 길드 참조 정리
        console.log('[5/6] GuildMember 테이블에서 존재하지 않는 길드 참조 정리 중...');
        const allGuildMembers = await prisma.guildMember.findMany({
            select: { id: true, guildId: true, userId: true }
        });
        
        let orphanedMembersDeleted = 0;
        for (const member of allGuildMembers) {
            if (!validGuildIds.has(member.guildId)) {
                console.log(`  → GuildMember ${member.id}: 존재하지 않는 길드 ${member.guildId} 참조 삭제`);
                try {
                    await guildRepo.removeGuildMember(member.guildId, member.userId);
                    orphanedMembersDeleted++;
                } catch (error: any) {
                    console.warn(`    ⚠ 삭제 실패: ${error.message}`);
                }
            }
        }
        console.log(`  ✓ ${orphanedMembersDeleted}개의 고아 GuildMember 레코드 삭제됨`);
        
        // 6. 최종 확인
        console.log('[6/6] 최종 확인 중...');
        const remainingIssues = await prisma.user.findMany({
            where: {
                OR: [
                    { status: { path: ['guildId'], not: null } }
                ]
            },
            select: { id: true, nickname: true, status: true }
        });
        
        const remainingGuildIds = new Set<string>();
        for (const user of remainingIssues) {
            if (user.status && typeof user.status === 'object') {
                const status = user.status as any;
                if (status.guildId) {
                    remainingGuildIds.add(status.guildId);
                }
            }
        }
        
        const invalidRemainingGuildIds = Array.from(remainingGuildIds).filter(id => !validGuildIds.has(id));
        
        if (invalidRemainingGuildIds.length > 0) {
            console.warn(`  ⚠ 여전히 존재하지 않는 길드 ID를 참조하는 사용자가 있습니다:`);
            for (const guildId of invalidRemainingGuildIds) {
                console.warn(`    - 길드 ID: ${guildId}`);
            }
        } else {
            console.log('  ✓ 모든 고아 참조가 정리되었습니다.');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✓ 삭제된 길드 참조 정리가 완료되었습니다!');
        console.log(`  - Prisma 사용자 정리: ${prismaUsersFixed}명`);
        console.log(`  - KV store 사용자 정리: ${kvUsersFixed}명`);
        console.log(`  - Status JSON 정리: ${statusUsersFixed}명`);
        console.log(`  - 고아 GuildMember 삭제: ${orphanedMembersDeleted}개`);
        console.log('='.repeat(60));
        
    } catch (error: any) {
        console.error('\n❌ 오류 발생:', error);
        console.error('스택 트레이스:', error.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// 스크립트 실행
fixOrphanedGuildReferences().catch((error) => {
    console.error('예상치 못한 오류:', error);
    process.exit(1);
});

