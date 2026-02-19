/**
 * 종료처리 실패 / AI게임 종료처리 없이 남아있는 게임 정리 스크립트
 *
 * isEnded: false로 남아있는 모든 게임을 DB에서 삭제합니다.
 * - 종료처리 실패로 DB에 남은 게임
 * - AI 게임이 정상 종료되지 않고 남아있는 게임
 *
 * ⚠️ 실행 전 반드시 진행 중인 게임이 없는지 확인하세요.
 *
 * 실행 방법:
 * npx tsx --tsconfig server/tsconfig.json server/scripts/cleanupOrphanedActiveGames.ts
 * npm run cleanup-orphaned-games
 */

import prisma from '../prismaClient.js';

async function main() {
  console.log('[cleanupOrphanedActiveGames] Fetching all games with isEnded: false...');

  const activeGames = await prisma.liveGame.findMany({
    where: { isEnded: false },
    select: { id: true, status: true, category: true, data: true, updatedAt: true },
  });

  console.log(`[cleanupOrphanedActiveGames] Found ${activeGames.length} orphaned/active games.`);

  if (activeGames.length === 0) {
    console.log('[cleanupOrphanedActiveGames] Nothing to delete. Done.');
    return;
  }

  let aiCount = 0;
  let endedStatusCount = 0;

  for (const row of activeGames) {
    try {
      const data = row.data as Record<string, unknown>;
      if (data?.isAiGame) aiCount++;
      if (data?.gameStatus === 'ended' || data?.gameStatus === 'no_contest') endedStatusCount++;
    } catch {
      // ignore parse errors
    }
  }

  console.log(
    `[cleanupOrphanedActiveGames] Breakdown: ~${aiCount} AI games, ~${endedStatusCount} with ended status (failed sync). Deleting all...`
  );

  const result = await prisma.liveGame.deleteMany({
    where: { isEnded: false },
  });

  console.log(`[cleanupOrphanedActiveGames] Deleted ${result.count} games. Done.`);
}

main()
  .catch((e) => {
    console.error('[cleanupOrphanedActiveGames] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
