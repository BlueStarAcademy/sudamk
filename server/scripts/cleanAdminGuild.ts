/**
 * 관리자 계정의 길드 정보 클리닝 스크립트
 * 
 * 실행 방법:
 * npx tsx --tsconfig server/tsconfig.json server/scripts/cleanAdminGuild.ts
 * 
 * 주의: 이 스크립트는 관리자 계정의 길드 관련 정보만 삭제합니다.
 */

import prisma from '../prismaClient.js';
import * as db from '../db.js';
import * as guildRepo from '../prisma/guildRepository.js';

async function cleanAdminGuild() {
    console.log('='.repeat(60));
    console.log('관리자 계정 길드 정보 클리닝 시작...');
    console.log('='.repeat(60));
    
    try {
        // 1. 관리자 계정 찾기
        console.log('[1/6] 관리자 계정 찾는 중...');
        const adminUsers = await prisma.user.findMany({
            where: { isAdmin: true },
            select: { 
                id: true, 
                nickname: true,
                username: true,
                status: true,
                guild: { select: { id: true, name: true } },
                guildMember: { select: { id: true, guildId: true } }
            }
        });
        
        if (adminUsers.length === 0) {
            console.log('  ✓ 관리자 계정을 찾을 수 없습니다.');
            return;
        }
        
        console.log(`  ✓ ${adminUsers.length}명의 관리자 계정 발견`);
        for (const admin of adminUsers) {
            console.log(`    - ${admin.nickname} (${admin.username || 'N/A'}) - ID: ${admin.id}`);
        }
        
        // 2. 관리자가 리더인 길드 삭제
        console.log('\n[2/6] 관리자가 리더인 길드 삭제 중...');
        let guildsDeleted = 0;
        for (const admin of adminUsers) {
            if (admin.guild) {
                try {
                    // Prisma에서 길드 삭제
                    await guildRepo.deleteGuild(admin.guild.id);
                    console.log(`  ✓ 길드 삭제됨: ${admin.guild.name} (ID: ${admin.guild.id})`);
                    guildsDeleted++;
                } catch (error: any) {
                    console.error(`  ✗ 길드 삭제 실패: ${admin.guild.id} - ${error.message}`);
                }
            }
        }
        console.log(`  ✓ ${guildsDeleted}개의 길드 삭제됨`);
        
        // 3. 관리자의 GuildMember 관계 삭제
        console.log('\n[3/6] 관리자의 GuildMember 관계 삭제 중...');
        let membersDeleted = 0;
        for (const admin of adminUsers) {
            if (admin.guildMember) {
                try {
                    await guildRepo.removeGuildMember(admin.guildMember.guildId, admin.id);
                    console.log(`  ✓ GuildMember 삭제됨: ${admin.id} (Guild: ${admin.guildMember.guildId})`);
                    membersDeleted++;
                } catch (error: any) {
                    console.error(`  ✗ GuildMember 삭제 실패: ${admin.id} - ${error.message}`);
                }
            }
        }
        console.log(`  ✓ ${membersDeleted}개의 GuildMember 관계 삭제됨`);
        
        // 4. 관리자 계정의 status JSON에서 길드 정보 제거
        console.log('\n[4/6] 관리자 계정의 status JSON에서 길드 정보 제거 중...');
        let statusUpdated = 0;
        for (const admin of adminUsers) {
            let needsUpdate = false;
            const status = admin.status && typeof admin.status === 'object' ? { ...(admin.status as any) } : {};
            
            // status JSON에서 guildId 제거
            if (status.guildId) {
                delete status.guildId;
                needsUpdate = true;
            }
            
            // status JSON에서 guildApplications 제거
            if (status.guildApplications) {
                delete status.guildApplications;
                needsUpdate = true;
            }
            
            if (needsUpdate) {
                await prisma.user.update({
                    where: { id: admin.id },
                    data: { status: status }
                });
                console.log(`  ✓ ${admin.nickname}의 status JSON 업데이트됨`);
                statusUpdated++;
            }
        }
        console.log(`  ✓ ${statusUpdated}명의 관리자 계정 status 업데이트됨`);
        
        // 5. Prisma 관계 명시적으로 정리
        console.log('\n[5/6] Prisma 관계 명시적으로 정리 중...');
        let relationsCleaned = 0;
        for (const admin of adminUsers) {
            const updateData: any = {};
            
            // GuildMember 관계가 있는 경우 삭제
            const currentUser = await prisma.user.findUnique({
                where: { id: admin.id },
                select: { guildMember: { select: { id: true } } }
            });
            
            if (currentUser?.guildMember) {
                updateData.guildMember = { delete: true };
            }
            
            if (Object.keys(updateData).length > 0) {
                await prisma.user.update({
                    where: { id: admin.id },
                    data: updateData
                });
                console.log(`  ✓ ${admin.nickname}의 Prisma 관계 정리됨`);
                relationsCleaned++;
            }
        }
        console.log(`  ✓ ${relationsCleaned}명의 관리자 계정 관계 정리됨`);
        
        // 6. KV store에서 관리자 관련 길드 정보 확인 및 정리
        console.log('\n[6/6] KV store에서 관리자 관련 길드 정보 확인 중...');
        const guilds = (await db.getKV<Record<string, any>>('guilds')) || {};
        let kvCleaned = false;
        
        for (const admin of adminUsers) {
            // 관리자가 리더인 길드가 KV store에 있는지 확인
            for (const [guildId, guild] of Object.entries(guilds)) {
                if (guild.leaderId === admin.id) {
                    delete guilds[guildId];
                    kvCleaned = true;
                    console.log(`  ✓ KV store에서 길드 제거됨: ${guildId}`);
                }
            }
            
            // 관리자가 멤버인 길드에서 관리자 제거
            for (const [guildId, guild] of Object.entries(guilds)) {
                if (guild.members && Array.isArray(guild.members)) {
                    const memberIndex = guild.members.findIndex((m: any) => 
                        (typeof m === 'string' ? m === admin.id : m.userId === admin.id)
                    );
                    if (memberIndex !== -1) {
                        guild.members.splice(memberIndex, 1);
                        kvCleaned = true;
                        console.log(`  ✓ KV store에서 ${admin.nickname}을 길드 멤버에서 제거: ${guildId}`);
                    }
                }
            }
        }
        
        if (kvCleaned) {
            await db.setKV('guilds', guilds);
            console.log('  ✓ KV store 업데이트됨');
        } else {
            console.log('  ✓ KV store에 관리자 관련 길드 정보 없음');
        }
        
        console.log('\n' + '='.repeat(60));
        console.log('✓ 관리자 계정의 길드 정보가 성공적으로 클리닝되었습니다!');
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
cleanAdminGuild().catch((error) => {
    console.error('예상치 못한 오류:', error);
    process.exit(1);
});

