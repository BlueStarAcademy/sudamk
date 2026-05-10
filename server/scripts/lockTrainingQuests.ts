/**
 * 바둑학원(싱글플레이) 스테이지 진행도 초기화 + 수련과제·반별 막대 보상 수령 상태 초기화.
 * `isAdmin === true` 인 계정은 변경하지 않습니다.
 *
 * 초기화 대상(비관리자만):
 * - singlePlayerProgress: 0
 * - clearedSinglePlayerStages: []
 * - singlePlayerMissions: {}
 * - singlePlayerClassBarClaims: {}
 *
 * 실행: npm run script:lock-training-quests
 */

import * as db from '../db.js';

const resetAcademyForNonAdmins = async () => {
  console.log('[AcademyReset] 바둑학원 진행도·수련과제 초기화 (관리자 제외)...');

  const allUsers = await db.getAllUsers({
    includeEquipment: false,
    includeInventory: false,
    skipCache: true,
  });
  console.log(`[AcademyReset] 유저 ${allUsers.length}명 조회됨`);

  let skippedAdmin = 0;
  let updated = 0;
  let unchanged = 0;

  for (const user of allUsers) {
    const u = user as { isAdmin?: boolean; id: string; nickname?: string };

    if (u.isAdmin) {
      skippedAdmin++;
      console.log(`[AcademyReset] skip (관리자): ${u.nickname ?? '?'} (${u.id})`);
      continue;
    }

    const clearedLen = (user as { clearedSinglePlayerStages?: string[] }).clearedSinglePlayerStages?.length ?? 0;
    const missions = (user as { singlePlayerMissions?: Record<string, unknown> }).singlePlayerMissions;
    const missionKeys = missions && typeof missions === 'object' ? Object.keys(missions).length : 0;
    const claims = (user as { singlePlayerClassBarClaims?: Record<string, unknown> }).singlePlayerClassBarClaims;
    const claimKeys = claims && typeof claims === 'object' ? Object.keys(claims).length : 0;

    const changed =
      ((user as { singlePlayerProgress?: number }).singlePlayerProgress ?? 0) !== 0 ||
      clearedLen > 0 ||
      missionKeys > 0 ||
      claimKeys > 0;

    if (!changed) {
      unchanged++;
      continue;
    }

    const updatedUser = {
      ...user,
      singlePlayerProgress: 0,
      clearedSinglePlayerStages: [] as string[],
      singlePlayerMissions: {},
      singlePlayerClassBarClaims: {},
    };

    await db.updateUser(updatedUser);
    updated++;
    console.log(`[AcademyReset] 초기화: ${u.nickname ?? '?'} (${u.id})`);
  }

  console.log('[AcademyReset] ========================================');
  console.log('[AcademyReset] 완료');
  console.log('[AcademyReset] ========================================');
  console.log(`[AcademyReset] 초기화된 유저: ${updated}명 / 관리자 스킵: ${skippedAdmin}명 / 변경 없음: ${unchanged}명 / 전체: ${allUsers.length}명`);
  console.log('[AcademyReset] ========================================');
};

resetAcademyForNonAdmins()
  .then(() => {
    console.log('[AcademyReset] 스크립트 정상 종료');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[AcademyReset] 스크립트 실패:', err);
    process.exit(1);
  });
