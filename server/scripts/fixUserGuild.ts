/**
 * 특정 사용자의 길드 정보 정리 스크립트
 * 
 * 실행 방법:
 * npx tsx --tsconfig server/tsconfig.json server/scripts/fixUserGuild.ts [nickname]
 * 
 * 예시:
 * npx tsx --tsconfig server/tsconfig.json server/scripts/fixUserGuild.ts 노란별
 */

import prisma from '../prismaClient.js';
import * as db from '../db.js';
import * as guildRepo from '../prisma/guildRepository.js';

const nickname = process.argv[2] || '노란별';

async function fixUserGuild() {
    console.log('='.repeat(60));
    console.log(`사용자 "${nickname}"의 길드 정보 정리 시작...`);
    console.log('='.repeat(60));
    
    try {
        // 1. 사용자 찾기
        console.log(`[1/7] 사용자 "${nickname}" 찾는 중...`);
        const user = await prisma.user.findFirst({
            where: { nickname: nickname },
            select: { 
                id: true, 
                nickname: true,
                username: true,
                status: true,
                guild: { select: { id: true, name: true } },
                guildMember: { select: { id: true, guildId: true } }
            }
        });
        
        if (!user) {
            console.error(`  ✗ 사용자 "${nickname}"을 찾을 수 없습니다.`);
            process.exit(1);
        }
        
        console.log(`  ✓ 사용자 발견: ${user.nickname} (ID: ${user.id})`);
        
        // 2. 사용자가 리더인 길드 확인 및 처리
        console.log('\n[2/7] 사용자가 리더인 길드 확인 중...');
        if (user.guild) {
            console.log(`  ⚠ 사용자가 리더인 길드 발견: ${user.guild.name} (ID: ${user.guild.id})`);
            console.log(`  → 이 길드는 유지됩니다. 필요시 수동으로 처리하세요.`);
        } else {
            console.log('  ✓ 사용자가 리더인 길드 없음');
        }
        
        // 3. 사용자의 GuildMember 관계 확인 및 정리
        console.log('\n[3/7] 사용자의 GuildMember 관계 확인 중...');
        let membersDeleted = 0;
        if (user.guildMember) {
            try {
                await guildRepo.removeGuildMember(user.guildMember.guildId, user.id);
                console.log(`  ✓ GuildMember 삭제됨: ${user.id} (Guild: ${user.guildMember.guildId})`);
                membersDeleted++;
            } catch (error: any) {
                console.error(`  ✗ GuildMember 삭제 실패: ${user.id} - ${error.message}`);
            }
        } else {
            console.log('  ✓ GuildMember 관계 없음');
        }
        
        // 추가로 다른 길드에 멤버로 있는지 확인
        const allGuildMembers = await prisma.guildMember.findMany({
            where: { userId: user.id }
        });
        
        if (allGuildMembers.length > 0) {
            console.log(`  ⚠ 추가로 발견된 GuildMember 관계: ${allGuildMembers.length}개`);
            for (const member of allGuildMembers) {
                try {
                    await guildRepo.removeGuildMember(member.guildId, user.id);
                    console.log(`  ✓ GuildMember 삭제됨: ${user.id} (Guild: ${member.guildId})`);
                    membersDeleted++;
                } catch (error: any) {
                    console.error(`  ✗ GuildMember 삭제 실패: ${user.id} (Guild: ${member.guildId}) - ${error.message}`);
                }
            }
        }
        
        console.log(`  ✓ 총 ${membersDeleted}개의 GuildMember 관계 삭제됨`);
        
        // 4. 사용자 계정의 status JSON에서 길드 정보 제거
        console.log('\n[4/7] 사용자 계정의 status JSON에서 길드 정보 제거 중...');
        let statusUpdated = false;
        const status = user.status && typeof user.status === 'object' ? { ...(user.status as any) } : {};
        
        // status JSON에서 guildId 제거
        if (status.guildId) {
            console.log(`  → status.guildId 제거: ${status.guildId}`);
            delete status.guildId;
            statusUpdated = true;
        }
        
        // status JSON에서 guildApplications 제거
        if (status.guildApplications) {
            console.log(`  → status.guildApplications 제거`);
            delete status.guildApplications;
            statusUpdated = true;
        }
        
        if (statusUpdated) {
            await prisma.user.update({
                where: { id: user.id },
                data: { status: status }
            });
            console.log(`  ✓ ${user.nickname}의 status JSON 업데이트됨`);
        } else {
            console.log('  ✓ status JSON에 길드 정보 없음');
        }
        
        // 5. KV store에서 사용자 관련 길드 정보 확인 및 정리
        console.log('\n[5/7] KV store에서 사용자 관련 길드 정보 확인 중...');
        const guilds = (await db.getKV<Record<string, any>>('guilds')) || {};
        let kvCleaned = false;
        
        // 사용자가 리더인 길드가 KV store에 있는지 확인
        for (const [guildId, guild] of Object.entries(guilds)) {
            if (guild.leaderId === user.id) {
                console.log(`  ⚠ KV store에서 사용자가 리더인 길드 발견: ${guildId}`);
                console.log(`  → 이 길드는 유지됩니다. 필요시 수동으로 처리하세요.`);
            }
        }
        
        // 사용자가 멤버인 길드에서 사용자 제거
        for (const [guildId, guild] of Object.entries(guilds)) {
            if (guild.members && Array.isArray(guild.members)) {
                const memberIndex = guild.members.findIndex((m: any) => 
                    (typeof m === 'string' ? m === user.id : m.userId === user.id)
                );
                if (memberIndex !== -1) {
                    guild.members.splice(memberIndex, 1);
                    kvCleaned = true;
                    console.log(`  ✓ KV store에서 ${user.nickname}을 길드 멤버에서 제거: ${guildId}`);
                }
            }
        }
        
        if (kvCleaned) {
            await db.setKV('guilds', guilds);
            console.log('  ✓ KV store 업데이트됨');
        } else {
            console.log('  ✓ KV store에 사용자 관련 길드 정보 없음');
        }
        
        // 6. DB에서 사용자의 guildId 직접 확인 및 제거
        console.log('\n[6/7] DB에서 사용자의 직접적인 길드 관계 확인 중...');
        const fullUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { id: true, nickname: true }
        });
        
        // KV store의 사용자 데이터에서도 확인
        const kvUser = await db.getUser(user.id);
        if (kvUser && kvUser.guildId) {
            console.log(`  → KV store의 사용자 데이터에서 guildId 발견: ${kvUser.guildId}`);
            kvUser.guildId = undefined;
            await db.updateUser(kvUser);
            console.log(`  ✓ KV store의 사용자 데이터에서 guildId 제거됨`);
        } else {
            console.log('  ✓ KV store의 사용자 데이터에 guildId 없음');
        }
        
        // 7. 최종 확인
        console.log('\n[7/7] 최종 확인 중...');
        const finalCheck = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                id: true,
                nickname: true,
                status: true,
                guild: { select: { id: true, name: true } },
                guildMember: { select: { id: true, guildId: true } }
            }
        });
        
        if (finalCheck) {
            const finalStatus = finalCheck.status && typeof finalCheck.status === 'object' ? finalCheck.status as any : {};
            const hasGuildId = finalStatus.guildId !== undefined && finalStatus.guildId !== null;
            const hasGuildMember = finalCheck.guildMember !== null;
            const isLeader = finalCheck.guild !== null;
            
            console.log(`  → status.guildId: ${hasGuildId ? finalStatus.guildId : '없음'}`);
            console.log(`  → GuildMember 관계: ${hasGuildMember ? '있음' : '없음'}`);
            console.log(`  → 길드 리더: ${isLeader ? finalCheck.guild?.name : '아님'}`);
            
            if (!hasGuildId && !hasGuildMember && !isLeader) {
                console.log('  ✓ 모든 길드 정보가 정리되었습니다!');
            } else {
                console.log('  ⚠ 일부 길드 정보가 남아있습니다. 수동으로 확인하세요.');
            }
        }
        
        console.log('\n' + '='.repeat(60));
        console.log(`✓ 사용자 "${nickname}"의 길드 정보 정리가 완료되었습니다!`);
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
fixUserGuild().catch((error) => {
    console.error('예상치 못한 오류:', error);
    process.exit(1);
});
