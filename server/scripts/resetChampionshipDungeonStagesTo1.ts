/**
 * 모든 유저의 챔피언십 던전 단계만 1단계로 초기화 (3위 미달 시 다음 단계 열림 버그 정리용)
 * - 동네바둑리그, 전국바둑대회, 월드챔피언십 각각 currentStage: 0, unlockedStages: [1], stageResults: {}
 * - 진행 중인 토너먼트 상태 제거 (last*Tournament null)
 * - 점수/탑/싱글플레이는 건드리지 않음
 *
 * 실행: npx tsx --tsconfig server/tsconfig.json server/scripts/resetChampionshipDungeonStagesTo1.ts
 */

import * as db from '../db.js';
import * as types from '../../types/index.js';

const STAGE_ONE = {
    currentStage: 0,
    unlockedStages: [1],
    stageResults: {},
    dailyStageAttempts: {},
};

async function main() {
    console.log('='.repeat(60));
    console.log('챔피언십 던전 단계만 1단계로 초기화 (모든 경기장)');
    console.log('='.repeat(60));

    const allUsers = await db.getAllUsers({ includeEquipment: false, includeInventory: false });
    console.log(`총 ${allUsers.length}명의 사용자 처리 중...`);

    let updated = 0;
    for (const user of allUsers) {
        if (!user?.id) continue;
        const copy = JSON.parse(JSON.stringify(user)) as types.User;
        let changed = false;

        copy.dungeonProgress = {
            neighborhood: { ...STAGE_ONE },
            national: { ...STAGE_ONE },
            world: { ...STAGE_ONE },
        };
        changed = true;

        if (copy.lastNeighborhoodTournament != null) {
            (copy as any).lastNeighborhoodTournament = null;
            changed = true;
        }
        if (copy.lastNationalTournament != null) {
            (copy as any).lastNationalTournament = null;
            changed = true;
        }
        if (copy.lastWorldTournament != null) {
            (copy as any).lastWorldTournament = null;
            changed = true;
        }

        if (changed) {
            await db.updateUser(copy);
            updated++;
            if (updated <= 5 || updated % 50 === 0) {
                console.log(`  업데이트: ${copy.nickname || copy.id} (${updated}/${allUsers.length})`);
            }
        }
    }

    console.log('='.repeat(60));
    console.log(`완료: ${updated}명 던전 단계 1단계로 초기화`);
    console.log('='.repeat(60));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
