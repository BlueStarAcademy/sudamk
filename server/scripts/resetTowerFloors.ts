/**
 * 모든 유저의 도전의 탑 진행 상태를 초기화합니다.
 *
 * 초기화 대상:
 * - towerFloor: 0 (1층 미클리어 상태)
 * - lastTowerClearTime: undefined
 * - monthlyTowerFloor: 0
 *
 * 실행:
 * npx tsx --tsconfig server/tsconfig.json server/scripts/resetTowerFloors.ts
 */

import * as db from '../db.js';

const resetTowerFloors = async () => {
  console.log('[TowerReset] 도전의 탑 층수 초기화 시작...');

  const allUsers = await db.getAllUsers({ includeEquipment: false, includeInventory: false });
  console.log(`[TowerReset] 유저 ${allUsers.length}명 조회됨`);

  let updated = 0;

  for (const user of allUsers) {
    const u = user as any;
    const changed =
      (u.towerFloor ?? 0) !== 0 ||
      u.lastTowerClearTime != null ||
      (u.monthlyTowerFloor ?? 0) !== 0;

    if (!changed) continue;

    const nextUser = { ...u };
    nextUser.towerFloor = 0;
    nextUser.lastTowerClearTime = undefined;
    nextUser.monthlyTowerFloor = 0;

    await db.updateUser(nextUser);
    updated++;
  }

  console.log('[TowerReset] ========================================');
  console.log(`[TowerReset] 수정된 유저: ${updated}명 / 전체 ${allUsers.length}명`);
  console.log('[TowerReset] 도전의 탑 층수 초기화 완료');
  console.log('[TowerReset] ========================================');
};

resetTowerFloors()
  .then(() => {
    console.log('[TowerReset] 스크립트 정상 종료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[TowerReset] 스크립트 실패:', error);
    process.exit(1);
  });

