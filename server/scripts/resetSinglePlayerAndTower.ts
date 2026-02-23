/**
 * 모든 유저의 싱글플레이 단계와 도전의 탑 클리어 층을 초기화하는 스크립트.
 * 기존 데이터로 인한 싱글플레이 실행 오류 등을 해결하기 위해 실행합니다.
 *
 * 초기화 대상:
 * - singlePlayerProgress: 0
 * - clearedSinglePlayerStages: []
 * - singlePlayerMissions: {}
 * - towerFloor: 0
 * - lastTowerClearTime: null
 * - monthlyTowerFloor: 0
 *
 * 실행: npx tsx server/scripts/resetSinglePlayerAndTower.ts
 * 또는: npm run script:reset-single-tower
 */

import * as db from '../db.js';

const resetSinglePlayerAndTower = async () => {
  console.log('[Reset] 싱글플레이 + 도전의 탑 초기화 시작...');

  const allUsers = await db.getAllUsers({ includeEquipment: false, includeInventory: false });
  console.log(`[Reset] 유저 ${allUsers.length}명 조회됨`);

  let updated = 0;
  for (const user of allUsers) {
    const u = user as any;
    const changed =
      (u.singlePlayerProgress ?? 0) !== 0 ||
      (u.clearedSinglePlayerStages?.length ?? 0) > 0 ||
      (u.singlePlayerMissions && Object.keys(u.singlePlayerMissions).length > 0) ||
      (u.towerFloor ?? 0) !== 0 ||
      (u.lastTowerClearTime != null) ||
      (u.monthlyTowerFloor ?? 0) !== 0;

    if (!changed) continue;

    const updatedUser = { ...u };
    updatedUser.singlePlayerProgress = 0;
    updatedUser.clearedSinglePlayerStages = [];
    updatedUser.singlePlayerMissions = {};
    updatedUser.towerFloor = 0;
    updatedUser.lastTowerClearTime = undefined;
    updatedUser.monthlyTowerFloor = 0;

    await db.updateUser(updatedUser);
    updated++;
    console.log(`[Reset] ${u.nickname} (${u.id}) - 싱글플레이/탑 초기화 완료`);
  }

  console.log('[Reset] ========================================');
  console.log('[Reset] 초기화 완료');
  console.log('[Reset] ========================================');
  console.log(`[Reset] 수정된 유저: ${updated}명 / 전체 ${allUsers.length}명`);
  console.log('[Reset] ========================================');
};

resetSinglePlayerAndTower()
  .then(() => {
    console.log('[Reset] 스크립트 정상 종료');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Reset] 스크립트 실패:', err);
    process.exit(1);
  });
