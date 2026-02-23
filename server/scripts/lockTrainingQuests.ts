/**
 * 수련과제를 다시 락(잠금) 상태로 변경.
 * 관리자 계정만 테스트용으로 모든 스테이지 클리어 상태 유지.
 *
 * - 일반 유저: clearedSinglePlayerStages = [], singlePlayerProgress = 0 (수련과제 전부 락)
 * - 관리자 (user-admin-static-id): clearedSinglePlayerStages = 전체 스테이지 ID,
 *              singlePlayerProgress = 최대값 (테스트용 전 스테이지 클리어)
 *
 * 실행: npm run script:lock-training-quests
 */

import * as db from '../db.js';
import { SINGLE_PLAYER_STAGES } from '../../shared/constants/singlePlayerConstants.js';

const ADMIN_USER_ID = 'user-admin-static-id';

const ALL_STAGE_IDS = SINGLE_PLAYER_STAGES.map((s) => s.id);
const MAX_PROGRESS = ALL_STAGE_IDS.length;

const lockTrainingQuests = async () => {
  console.log('[Lock] 수련과제 락 적용 + 관리자만 전 스테이지 클리어 유지...');

  const allUsers = await db.getAllUsers({ includeEquipment: false, includeInventory: false });
  console.log(`[Lock] 유저 ${allUsers.length}명 조회됨`);

  let updated = 0;
  for (const user of allUsers) {
    const u = user as any;
    const isAdmin = u.id === ADMIN_USER_ID;

    const newClearedStages = isAdmin ? [...ALL_STAGE_IDS] : [];
    const newProgress = isAdmin ? MAX_PROGRESS : 0;

    const updatedUser = { ...u };
    updatedUser.clearedSinglePlayerStages = newClearedStages;
    updatedUser.singlePlayerProgress = newProgress;

    await db.updateUser(updatedUser);
    updated++;
    console.log(
      `[Lock] ${u.nickname} (${u.id}) - ${isAdmin ? '관리자: 전 스테이지 클리어 유지' : '수련과제 락'}`
    );
  }

  console.log('[Lock] ========================================');
  console.log('[Lock] 적용 완료');
  console.log('[Lock] ========================================');
  console.log(`[Lock] 수정된 유저: ${updated}명 / 전체 ${allUsers.length}명`);
  console.log('[Lock] ========================================');
};

lockTrainingQuests()
  .then(() => {
    console.log('[Lock] 스크립트 정상 종료');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Lock] 스크립트 실패:', err);
    process.exit(1);
  });
