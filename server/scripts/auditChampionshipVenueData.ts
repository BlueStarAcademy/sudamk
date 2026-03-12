/**
 * 경기장(챔피언십) 데이터 적재 현황 확인 및 불필요 데이터 정리
 * - lastNeighborhoodTournament, lastNationalTournament, lastWorldTournament JSON이 보상 수령 후에도 남아 있으면 DB 부담
 * - --report: 현황만 출력 (기본)
 * - --clear: 보상 이미 수령한 경우(complete/eliminated + *RewardClaimed) 해당 경기장 상태를 null로 정리
 *
 * 실행 예:
 *   npx tsx --tsconfig server/tsconfig.json server/scripts/auditChampionshipVenueData.ts
 *   npx tsx --tsconfig server/tsconfig.json server/scripts/auditChampionshipVenueData.ts --clear
 */

import * as db from '../db.js';

type VenueKey = 'neighborhood' | 'national' | 'world';

const STATE_KEYS: { type: VenueKey; stateKey: string; claimedKey: string }[] = [
    { type: 'neighborhood', stateKey: 'lastNeighborhoodTournament', claimedKey: 'neighborhoodRewardClaimed' },
    { type: 'national', stateKey: 'lastNationalTournament', claimedKey: 'nationalRewardClaimed' },
    { type: 'world', stateKey: 'lastWorldTournament', claimedKey: 'worldRewardClaimed' },
];

function sizeBytes(obj: unknown): number {
    if (obj == null) return 0;
    try {
        return Buffer.byteLength(JSON.stringify(obj), 'utf8');
    } catch {
        return 0;
    }
}

function isFinished(state: unknown): boolean {
    if (!state || typeof state !== 'object') return false;
    const s = state as { status?: string };
    return s.status === 'complete' || s.status === 'eliminated';
}

async function main() {
    const doClear = process.argv.includes('--clear');
    console.log('='.repeat(60));
    console.log('경기장(챔피언십) 데이터 적재 현황');
    console.log(doClear ? '모드: 현황 + 보상 수령 완료분 정리(--clear)' : '모드: 현황만 출력 (정리 시 --clear 추가)');
    console.log('='.repeat(60));

    const users = await db.getAllUsers({ includeEquipment: false, includeInventory: false, skipCache: true });
    console.log(`총 사용자 수: ${users.length}\n`);

    let totalBytes = 0;
    let userCountWithAny = 0;
    const byVenue: Record<VenueKey, { count: number; bytes: number; staleCount: number }> = {
        neighborhood: { count: 0, bytes: 0, staleCount: 0 },
        national: { count: 0, bytes: 0, staleCount: 0 },
        world: { count: 0, bytes: 0, staleCount: 0 },
    };

    const toClear: { userId: string; nickname: string; venue: VenueKey }[] = [];

    for (const user of users) {
        if (!user?.id) continue;
        let hasAny = false;
        for (const { type, stateKey, claimedKey } of STATE_KEYS) {
            const state = (user as any)[stateKey];
            if (state == null) continue;
            const bytes = sizeBytes(state);
            if (bytes === 0) continue;
            hasAny = true;
            byVenue[type].count += 1;
            byVenue[type].bytes += bytes;
            totalBytes += bytes;
            const claimed = !!(user as any)[claimedKey];
            if (isFinished(state) && claimed) {
                byVenue[type].staleCount += 1;
                toClear.push({ userId: user.id, nickname: user.nickname || user.id, venue: type });
            }
        }
        if (hasAny) userCountWithAny += 1;
    }

    console.log('--- 경기장별 현황 ---');
    for (const type of ['neighborhood', 'national', 'world'] as VenueKey[]) {
        const v = byVenue[type];
        const name = type === 'neighborhood' ? '동네바둑리그' : type === 'national' ? '전국바둑대회' : '월드챔피언십';
        console.log(`  ${name}: ${v.count}명 보유, 약 ${(v.bytes / 1024).toFixed(1)} KB, 그중 보상 수령 완료(정리 대상): ${v.staleCount}명`);
    }
    console.log(`\n경기장 데이터가 1개 이상 있는 사용자: ${userCountWithAny}명`);
    console.log(`전체 경기장 JSON 합계: 약 ${(totalBytes / 1024).toFixed(1)} KB\n`);

    if (toClear.length === 0) {
        console.log('정리할 데이터(보상 수령 완료 + 완료/탈락 상태) 없음.');
        return;
    }

    console.log(`정리 대상: ${toClear.length}건 (유저·경기장별)`);
    if (!doClear) {
        console.log('실제 정리하려면: npx tsx --tsconfig server/tsconfig.json server/scripts/auditChampionshipVenueData.ts --clear');
        return;
    }

    const keyMap = {
        neighborhood: 'lastNeighborhoodTournament',
        national: 'lastNationalTournament',
        world: 'lastWorldTournament',
    };
    let cleared = 0;
    const byUser = new Map<string, { user: any; keys: Set<string> }>();
    for (const { userId, venue } of toClear) {
        if (!byUser.has(userId)) {
            const user = users.find(u => u.id === userId);
            if (!user) continue;
            byUser.set(userId, { user: JSON.parse(JSON.stringify(user)), keys: new Set() });
        }
        byUser.get(userId)!.keys.add(keyMap[venue]);
    }
    for (const [, { user, keys }] of byUser) {
        for (const key of keys) {
            (user as any)[key] = null;
            cleared++;
        }
        await db.updateUser(user);
    }
    console.log(`정리 완료: ${byUser.size}명, ${cleared}개 경기장 필드 null로 저장`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
