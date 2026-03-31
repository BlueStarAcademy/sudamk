/**
 * 백업 Postgres(예: Supabase PITR로 만든 ~14시간 전 시점 DB)에서 인벤/장비를 현재 DB로 복사
 *
 * 이 레포는 “14시간 전 자동 스냅샷”을 저장하지 않습니다. 반드시 호스팅에서 해당 시점 DB를
 * 복원한 인스턴스의 URL을 BACKUP_DATABASE_URL 로 넣어야 합니다.
 * (Supabase Pro: Point in Time Recovery → 복원 DB 생성 후 connection string)
 *
 * 사용법:
 *   BACKUP_DATABASE_URL=... npx tsx --tsconfig server/tsconfig.json server/restoreUserFromSupabaseBackup.ts 닉1 닉2
 *   BACKUP_DATABASE_URL=... npx tsx --tsconfig server/tsconfig.json server/restoreUserFromSupabaseBackup.ts --all --confirm-restore-all-users
 */

import prisma from './prismaClient.js';
import { PrismaClient } from '../generated/prisma/client.ts';

// 백업 데이터베이스 URL (Supabase 백업에서 가져온 URL)
// 예: postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?schema=public
const BACKUP_DATABASE_URL = process.env.BACKUP_DATABASE_URL || '';

// 백업 Prisma 클라이언트 생성
let backupPrisma: PrismaClient | null = null;

const createBackupPrismaClient = () => {
    if (!BACKUP_DATABASE_URL) {
        throw new Error('BACKUP_DATABASE_URL 환경변수가 설정되지 않았습니다.');
    }
    
    return new PrismaClient({
        datasources: {
            db: {
                url: BACKUP_DATABASE_URL
            }
        }
    });
};

interface BackupUserData {
    id: string;
    nickname: string;
    status: any;
    equipment?: Array<{ slot: string; inventoryId: string | null }>;
    inventory?: Array<{
        id: string;
        templateId: string;
        quantity: number;
        slot: string | null;
        enhancementLvl: number;
        stars: number;
        rarity: string | null;
        metadata: any;
        isEquipped: boolean;
    }>;
}

const restoreUserFromBackup = async (nickname: string) => {
    console.log(`\n[복구 시작] 사용자: ${nickname}`);
    console.log('='.repeat(60));
    
    try {
        // 백업 데이터베이스 연결
        if (!backupPrisma) {
            backupPrisma = createBackupPrismaClient();
        }
        
        // 현재 데이터베이스에서 사용자 찾기
        const currentUser = await prisma.user.findUnique({
            where: { nickname },
            include: {
                equipment: true,
                inventory: true
            }
        });
        
        if (!currentUser) {
            console.error(`[오류] 현재 데이터베이스에서 사용자를 찾을 수 없습니다: ${nickname}`);
            return;
        }
        
        console.log(`[현재 사용자] ID: ${currentUser.id}, 닉네임: ${currentUser.nickname}`);
        console.log(`[현재 장비] ${currentUser.equipment?.length || 0}개 슬롯`);
        console.log(`[현재 인벤토리] ${currentUser.inventory?.length || 0}개 아이템`);
        
        // 백업 데이터베이스에서 사용자 찾기
        const backupUser = await backupPrisma.user.findUnique({
            where: { nickname },
            include: {
                equipment: {
                    include: {
                        inventory: true
                    }
                },
                inventory: true
            }
        });
        
        if (!backupUser) {
            console.error(`[오류] 백업 데이터베이스에서 사용자를 찾을 수 없습니다: ${nickname}`);
            console.log(`[팁] 백업 데이터베이스 URL을 확인하거나 다른 백업 날짜를 시도해보세요.`);
            return;
        }
        
        console.log(`\n[백업 데이터 발견]`);
        console.log(`[백업 장비] ${backupUser.equipment?.length || 0}개 슬롯`);
        console.log(`[백업 인벤토리] ${backupUser.inventory?.length || 0}개 아이템`);
        
        if ((!backupUser.equipment || backupUser.equipment.length === 0) &&
            (!backupUser.inventory || backupUser.inventory.length === 0)) {
            console.warn(`[경고] 백업에 인벤/장비가 비어 있습니다. 현재 DB에서 해당 유저 인벤·장비를 비운 뒤 동기화합니다.`);
        }
        
        // 복구 시작
        console.log(`\n[복구 진행 중...]`);
        
        // 1. 기존 장비 삭제
        if (currentUser.equipment && currentUser.equipment.length > 0) {
            await prisma.userEquipment.deleteMany({
                where: { userId: currentUser.id }
            });
            console.log(`[완료] 기존 장비 삭제: ${currentUser.equipment.length}개`);
        }
        
        // 2. 기존 인벤토리 삭제
        if (currentUser.inventory && currentUser.inventory.length > 0) {
            await prisma.userInventory.deleteMany({
                where: { userId: currentUser.id }
            });
            console.log(`[완료] 기존 인벤토리 삭제: ${currentUser.inventory.length}개`);
        }
        
        // 3. 백업 인벤토리 복구
        if (backupUser.inventory && backupUser.inventory.length > 0) {
            const inventoryData = backupUser.inventory.map((inv: any) => ({
                id: inv.id,
                userId: currentUser.id,
                templateId: inv.templateId,
                quantity: inv.quantity,
                slot: inv.slot,
                enhancementLvl: inv.enhancementLvl,
                stars: inv.stars,
                rarity: inv.rarity,
                metadata: inv.metadata,
                isEquipped: inv.isEquipped
            }));
            
            await prisma.userInventory.createMany({
                data: inventoryData
            });
            console.log(`[완료] 인벤토리 복구: ${inventoryData.length}개 아이템`);
        }
        
        // 4. 백업 장비 복구
        if (backupUser.equipment && backupUser.equipment.length > 0) {
            for (const eq of backupUser.equipment) {
                // inventoryId가 존재하는지 확인
                if (eq.inventoryId) {
                    const inventoryExists = await prisma.userInventory.findUnique({
                        where: { id: eq.inventoryId }
                    });
                    
                    if (!inventoryExists) {
                        console.warn(`[경고] 장비 슬롯 ${eq.slot}의 인벤토리 아이템 ${eq.inventoryId}를 찾을 수 없습니다. 건너뜁니다.`);
                        continue;
                    }
                }
                
                await prisma.userEquipment.create({
                    data: {
                        userId: currentUser.id,
                        slot: eq.slot,
                        inventoryId: eq.inventoryId
                    }
                });
            }
            console.log(`[완료] 장비 복구: ${backupUser.equipment.length}개 슬롯`);
        }
        
        // 5. 프리셋 복구 (status.store.equipmentPresets에서)
        if (backupUser.status && typeof backupUser.status === 'object') {
            const backupStatus = backupUser.status as any;
            const backupPresets = backupStatus.store?.equipmentPresets;
            
            if (backupPresets && Array.isArray(backupPresets) && backupPresets.length > 0) {
                // 현재 사용자의 status 업데이트
                const currentStatus = (currentUser.status as any) || {};
                currentStatus.store = currentStatus.store || {};
                currentStatus.store.equipmentPresets = backupPresets;
                
                await prisma.user.update({
                    where: { id: currentUser.id },
                    data: {
                        status: currentStatus
                    }
                });
                console.log(`[완료] 프리셋 복구: ${backupPresets.length}개`);
            }
        }
        
        console.log(`\n[복구 완료]`);
        console.log('='.repeat(60));
        
        // 복구 결과 확인
        const restoredUser = await prisma.user.findUnique({
            where: { id: currentUser.id },
            include: {
                equipment: true,
                inventory: true
            }
        });
        
        if (restoredUser) {
            console.log(`[최종 확인]`);
            console.log(`[장비] ${restoredUser.equipment?.length || 0}개 슬롯`);
            console.log(`[인벤토리] ${restoredUser.inventory?.length || 0}개 아이템`);
        }

        // status.serializedUser의 inventory/equipment가 있으면 deserialize 시 관계형 테이블보다 우선되어
        // 복구 직후에도 잘못된 가방이 보일 수 있음 → 키 제거로 UserInventory/UserEquipment를 소스로 강제
        const rowAfter = await prisma.user.findUnique({
            where: { id: currentUser.id },
            select: { status: true }
        });
        if (rowAfter?.status && typeof rowAfter.status === 'object') {
            const st = JSON.parse(JSON.stringify(rowAfter.status)) as Record<string, unknown>;
            const su = st.serializedUser as Record<string, unknown> | undefined;
            if (su && typeof su === 'object') {
                delete su.inventory;
                delete su.equipment;
                st.serializedUser = su;
                await prisma.user.update({
                    where: { id: currentUser.id },
                    data: { status: st as object }
                });
                console.log(`[완료] status.serializedUser에서 inventory/equipment 제거 (관계형 테이블 기준 로드)`);
            }
        }
        
    } catch (error: any) {
        console.error(`[오류] 복구 중 오류 발생:`, error);
        console.error(`[스택]`, error.stack);
        throw error;
    }
};

const parseArgs = (): { nicknames: string[]; restoreAll: boolean } => {
    const raw = process.argv.slice(2);
    const restoreAll = raw.includes('--all');
    const nicknames = raw.filter((a) => a !== '--all' && a !== '--confirm-restore-all-users');
    return { nicknames, restoreAll };
};

// 메인 실행
const main = async () => {
    let { nicknames, restoreAll } = parseArgs();

    if (!BACKUP_DATABASE_URL) {
        console.error('\n[오류] BACKUP_DATABASE_URL 환경변수가 설정되지 않았습니다.');
        console.log('\n“14시간 전”과 같이 과거 시점으로 롤백하려면, 호스팅에서 그 시각으로 복원된 Postgres 인스턴스를 만든 뒤');
        console.log('그 인스턴스의 connection string을 BACKUP_DATABASE_URL로 설정하세요.');
        console.log('\nSupabase 예: Dashboard → Database → Backups / Point in Time Recovery');
        process.exit(1);
    }

    backupPrisma = createBackupPrismaClient();

    if (restoreAll) {
        if (!process.argv.includes('--confirm-restore-all-users')) {
            console.error('[오류] --all 사용 시 반드시 --confirm-restore-all-users 를 함께 넣어야 합니다.');
            await backupPrisma.$disconnect();
            process.exit(1);
        }
        const rows = await backupPrisma.user.findMany({ select: { nickname: true } });
        nicknames = [...new Set(rows.map((r) => r.nickname))].sort();
        console.log(`[--all] 백업 DB 기준 사용자 수: ${nicknames.length}`);
    }

    if (nicknames.length === 0) {
        console.log('사용법: npx tsx --tsconfig server/tsconfig.json server/restoreUserFromSupabaseBackup.ts <닉네임1> [닉네임2 ...]');
        console.log('       npx tsx --tsconfig server/tsconfig.json server/restoreUserFromSupabaseBackup.ts --all --confirm-restore-all-users');
        console.log('\n환경변수: BACKUP_DATABASE_URL=(과거 시점으로 복원된 Postgres URL)');
        await backupPrisma.$disconnect();
        process.exit(1);
    }
    
    console.log('='.repeat(60));
    console.log('백업 Postgres → 현재 DB 인벤/장비 복구');
    console.log('='.repeat(60));
    console.log(`백업 DB: ${BACKUP_DATABASE_URL.replace(/:[^:@]+@/, ':****@')}`);
    console.log(`복구 대상: ${restoreAll ? `전체 (${nicknames.length}명)` : nicknames.join(', ')}`);
    console.log('='.repeat(60));
    
    try {
        for (const nickname of nicknames) {
            await restoreUserFromBackup(nickname);
        }
        
        console.log('\n[모든 복구 완료]');
    } catch (error: any) {
        console.error('\n[치명적 오류]', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await backupPrisma?.$disconnect();
    }
};

main();

