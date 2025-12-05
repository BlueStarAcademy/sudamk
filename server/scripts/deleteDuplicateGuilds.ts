/**
 * 중복된 길드명을 가진 길드 삭제 스크립트
 * 
 * 실행 방법:
 * npx tsx --tsconfig server/tsconfig.json server/scripts/deleteDuplicateGuilds.ts [길드명]
 * 
 * 길드명을 지정하지 않으면 모든 중복 길드를 찾아서 보여줍니다.
 */

import prisma from '../prismaClient.js';
import * as db from '../db.js';
import * as guildRepo from '../prisma/guildRepository.js';

// Ensure console output is not buffered
process.stdout.setEncoding('utf8');

async function deleteDuplicateGuilds(guildName?: string) {
    console.log('='.repeat(60));
    console.log('중복 길드 삭제 스크립트 시작...');
    console.log('='.repeat(60));

    try {
        // 1. 모든 길드 가져오기
        console.log('[1/7] 모든 길드 조회 중...');
        const allGuilds = await prisma.guild.findMany({
            include: {
                leader: {
                    select: {
                        id: true,
                        nickname: true,
                        username: true
                    }
                },
                members: {
                    select: {
                        id: true,
                        userId: true,
                        guildId: true
                    }
                }
            },
            orderBy: {
                createdAt: 'asc' // 오래된 것부터
            }
        });

        console.log(`  ✓ 총 ${allGuilds.length}개의 길드 발견`);

        // 2. 중복 길드 찾기
        console.log('\n[2/7] 중복 길드 찾는 중...');
        const guildMap = new Map<string, typeof allGuilds>();
        
        for (const guild of allGuilds) {
            const name = guild.name;
            if (!guildMap.has(name)) {
                guildMap.set(name, []);
            }
            guildMap.get(name)!.push(guild);
        }

        // 중복된 길드만 필터링
        const duplicateGuilds: Array<{ name: string; guilds: typeof allGuilds }> = [];
        for (const [name, guilds] of guildMap.entries()) {
            if (guilds.length > 1) {
                duplicateGuilds.push({ name, guilds });
            }
        }

        if (duplicateGuilds.length === 0) {
            console.log('  ✓ 중복된 길드가 없습니다.');
            process.exit(0);
        }

        console.log(`  ✓ ${duplicateGuilds.length}개의 중복 길드명 발견:`);
        duplicateGuilds.forEach(({ name, guilds }) => {
            console.log(`    - "${name}": ${guilds.length}개`);
        });

        // 3. 특정 길드명이 지정된 경우 필터링
        let targetDuplicates: Array<{ name: string; guilds: typeof allGuilds }> = duplicateGuilds;
        if (guildName) {
            targetDuplicates = duplicateGuilds.filter(d => d.name === guildName);
            if (targetDuplicates.length === 0) {
                console.log(`\n  ⚠ "${guildName}" 이름의 중복 길드를 찾을 수 없습니다.`);
                process.exit(0);
            }
        }

        // 4. 각 중복 그룹에서 가장 오래된 것 하나만 남기고 나머지 삭제
        console.log('\n[3/7] 중복 길드 삭제 중...');
        let totalDeleted = 0;

        for (const { name, guilds } of targetDuplicates) {
            console.log(`\n  "${name}" 길드 처리 중... (${guilds.length}개)`);
            
            // 가장 오래된 것(첫 번째)은 유지, 나머지는 삭제
            const toKeep = guilds[0];
            const toDelete = guilds.slice(1);

            console.log(`    ✓ 유지할 길드: ${toKeep.id} (생성일: ${toKeep.createdAt.toISOString()})`);
            console.log(`    ✗ 삭제할 길드: ${toDelete.length}개`);

            for (const guild of toDelete) {
                console.log(`\n    [${guild.id}] 삭제 중...`);

                // 4-1. 길드 멤버들의 GuildMember 관계 삭제
                console.log(`      [4-1] 길드 멤버들의 GuildMember 관계 삭제 중...`);
                let membersDeleted = 0;
                for (const member of guild.members) {
                    try {
                        await guildRepo.removeGuildMember(guild.id, member.userId);
                        membersDeleted++;
                    } catch (error: any) {
                        console.error(`        ✗ GuildMember 삭제 실패: ${member.userId} - ${error.message}`);
                    }
                }
                console.log(`      ✓ ${membersDeleted}개의 GuildMember 관계 삭제됨`);

                // 4-2. 길드 멤버들의 status JSON에서 길드 정보 제거
                console.log(`      [4-2] 길드 멤버들의 status JSON에서 길드 정보 제거 중...`);
                let statusUpdated = 0;
                for (const member of guild.members) {
                    try {
                        const user = await prisma.user.findUnique({
                            where: { id: member.userId },
                            select: { id: true, status: true }
                        });

                        if (user && user.status && typeof user.status === 'object') {
                            const status = { ...(user.status as any) };
                            let needsUpdate = false;

                            if (status.guildId === guild.id) {
                                delete status.guildId;
                                needsUpdate = true;
                            }

                            if (status.guildApplications) {
                                const applications = Array.isArray(status.guildApplications)
                                    ? status.guildApplications.filter((app: any) => app.guildId !== guild.id)
                                    : [];
                                if (applications.length !== status.guildApplications?.length) {
                                    status.guildApplications = applications.length > 0 ? applications : undefined;
                                    needsUpdate = true;
                                }
                            }

                            if (needsUpdate) {
                                await prisma.user.update({
                                    where: { id: user.id },
                                    data: { status: status }
                                });
                                statusUpdated++;
                            }
                        }
                    } catch (error: any) {
                        console.error(`        ✗ 사용자 ${member.userId} status 업데이트 실패: ${error.message}`);
                    }
                }
                console.log(`      ✓ ${statusUpdated}명의 사용자 status 업데이트됨`);

                // 4-3. KV store의 사용자 데이터에서 guildId 제거
                console.log(`      [4-3] KV store의 사용자 데이터에서 guildId 제거 중...`);
                let kvUsersUpdated = 0;
                for (const member of guild.members) {
                    try {
                        const kvUser = await db.getUser(member.userId);
                        if (kvUser && kvUser.guildId === guild.id) {
                            kvUser.guildId = undefined;
                            await db.updateUser(kvUser);
                            kvUsersUpdated++;
                        }
                    } catch (error: any) {
                        console.error(`        ✗ KV store 사용자 ${member.userId} 업데이트 실패: ${error.message}`);
                    }
                }
                console.log(`      ✓ ${kvUsersUpdated}명의 KV store 사용자 데이터 업데이트됨`);

                // 4-4. Prisma에서 길드 삭제
                console.log(`      [4-4] Prisma에서 길드 삭제 중...`);
                try {
                    await guildRepo.deleteGuild(guild.id);
                    console.log(`      ✓ Prisma에서 길드 삭제됨: ${guild.id}`);
                } catch (error: any) {
                    console.error(`      ✗ Prisma 길드 삭제 실패: ${error.message}`);
                }

                // 4-5. KV store에서 길드 삭제
                console.log(`      [4-5] KV store에서 길드 삭제 중...`);
                try {
                    const guilds = (await db.getKV<Record<string, any>>('guilds')) || {};
                    if (guilds[guild.id]) {
                        delete guilds[guild.id];
                        await db.setKV('guilds', guilds);
                        console.log(`      ✓ KV store에서 길드 삭제됨: ${guild.id}`);
                    } else {
                        console.log(`      - KV store에 해당 길드 없음`);
                    }
                } catch (error: any) {
                    console.error(`      ✗ KV store 길드 삭제 실패: ${error.message}`);
                }

                totalDeleted++;
            }
        }

        // 5. 최종 확인
        console.log('\n[5/7] 최종 확인 중...');
        const remainingGuilds = await prisma.guild.findMany({
            select: {
                id: true,
                name: true,
                createdAt: true
            }
        });

        const remainingGuildMap = new Map<string, typeof remainingGuilds>();
        for (const guild of remainingGuilds) {
            if (!remainingGuildMap.has(guild.name)) {
                remainingGuildMap.set(guild.name, []);
            }
            remainingGuildMap.get(guild.name)!.push(guild);
        }

        const stillDuplicated = Array.from(remainingGuildMap.entries())
            .filter(([_, guilds]) => guilds.length > 1);

        if (stillDuplicated.length === 0) {
            console.log('  ✓ 모든 중복 길드가 성공적으로 삭제되었습니다!');
        } else {
            console.log(`  ⚠ ${stillDuplicated.length}개의 중복 길드명이 남아있습니다:`);
            stillDuplicated.forEach(([name, guilds]) => {
                console.log(`    - "${name}": ${guilds.length}개`);
            });
        }

        console.log('\n' + '='.repeat(60));
        console.log(`✓ 중복 길드 삭제 작업이 완료되었습니다!`);
        console.log(`  - 삭제된 길드 수: ${totalDeleted}`);
        console.log('='.repeat(60));

    } catch (error: any) {
        console.error('\n❌ 오류 발생:', error);
        console.error('스택 트레이스:', error.stack);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// 명령줄 인자에서 길드명 가져오기
const guildName = process.argv[2];

console.log('스크립트 시작...');
console.log('길드명:', guildName || '(모든 중복)');

if (guildName) {
    console.log(`\n특정 길드명 "${guildName}"의 중복 길드를 삭제합니다.\n`);
} else {
    console.log('\n모든 중복 길드를 찾아서 삭제합니다.\n');
}

deleteDuplicateGuilds(guildName).catch((error) => {
    console.error('예상치 못한 오류:', error);
    process.exit(1);
});
