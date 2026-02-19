/**
 * runscripts — 모든 실행 스크립트 중앙 등록 및 실행
 *
 * 사용법:
 *   npm run runscripts              # 전체 목록 출력
 *   npm run runscripts -- <이름>    # 해당 스크립트 실행
 *   npx tsx runscripts.ts           # 목록
 *   npx tsx runscripts.ts optimize-db  # 실행
 *
 * 새 스크립트 추가 시 이 파일의 SCRIPT_REGISTRY에 항목을 추가하세요.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TSX = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const TSCONFIG = join(__dirname, 'server', 'tsconfig.json');

type ScriptEntry = {
  path: string;        // 스크립트 파일 경로
  extraArgs?: string[]; // 추가 인자 (예: --dry-run)
  useNode?: boolean;   // true면 node, 아니면 tsx
  desc: string;
};

export const SCRIPT_REGISTRY: Record<string, ScriptEntry> = {
  // === DB / 마이그레이션 ===
  migrate: {
    path: join(__dirname, 'server', 'migrateFromOldDb.ts'),
    desc: '구 DB에서 신 DB로 마이그레이션',
  },
  'migrate:to-railway': {
    path: join(__dirname, 'scripts', 'migrate-to-railway.ts'),
    desc: 'Supabase → Railway 데이터 마이그레이션',
  },
  'prisma:migrate:resolve': {
    path: join(__dirname, 'scripts', 'resolve-failed-migration.ts'),
    desc: '실패한 Prisma 마이그레이션 해결',
  },
  'prisma:migrate:apply-sql': {
    path: join(__dirname, 'scripts', 'apply-migration-sql.ts'),
    desc: 'SQL 마이그레이션 직접 적용',
  },

  // === 장비/유저 복구 ===
  'restore-equipment': {
    path: join(__dirname, 'server', 'restoreEquipment.ts'),
    desc: '장비 복구',
  },
  'force-restore-equipment': {
    path: join(__dirname, 'server', 'forceRestoreEquipment.ts'),
    desc: '장비 강제 복구',
  },
  'sync-equipment': {
    path: join(__dirname, 'server', 'syncEquipmentInventory.ts'),
    desc: '장비/인벤토리 동기화',
  },
  'emergency-restore-all': {
    path: join(__dirname, 'server', 'emergencyRestoreAll.ts'),
    desc: '긴급 전체 복구',
  },

  // === DB 유지보수 ===
  'optimize-db': {
    path: join(__dirname, 'server', 'scripts', 'optimizeDatabase.ts'),
    desc: 'DB 최적화 (오래된 게임/메일 등 정리)',
  },
  'cleanup-orphaned-games': {
    path: join(__dirname, 'server', 'scripts', 'cleanupOrphanedActiveGames.ts'),
    desc: '종료처리 실패 / AI게임 미종료 정리',
  },
  'test-db-performance': {
    path: join(__dirname, 'server', 'scripts', 'testDbPerformance.ts'),
    desc: 'DB 성능 테스트',
  },
  'analyze-db-queries': {
    path: join(__dirname, 'server', 'scripts', 'analyzeDbQueries.ts'),
    desc: 'DB 쿼리 분석',
  },

  // === 길드 ===
  'reset-all-guilds': {
    path: join(__dirname, 'server', 'scripts', 'resetAllGuilds.ts'),
    desc: '모든 길드 리셋',
  },
  'fix-orphaned-guild-refs': {
    path: join(__dirname, 'server', 'scripts', 'fixOrphanedGuildReferences.ts'),
    desc: '고아 길드 참조 수정',
  },
  'clean-admin-guild': {
    path: join(__dirname, 'server', 'scripts', 'cleanAdminGuild.ts'),
    desc: '관리자 길드 정리',
  },
  'check-admin-guild': {
    path: join(__dirname, 'server', 'scripts', 'checkAdminGuild.ts'),
    desc: '관리자 길드 점검',
  },
  'cancel-all-guild-war-matching': {
    path: join(__dirname, 'server', 'scripts', 'cancelAllGuildWarMatching.ts'),
    desc: '길드전 매칭 전체 취소',
  },
  'remove-admin-guild': {
    path: join(__dirname, 'server', 'scripts', 'removeAdminGuild.ts'),
    desc: '관리자 길드 제거',
  },
  'fix-user-guild': {
    path: join(__dirname, 'server', 'scripts', 'fixUserGuild.ts'),
    desc: '유저 길드 참조 수정',
  },
  'delete-duplicate-guilds': {
    path: join(__dirname, 'server', 'scripts', 'deleteDuplicateGuilds.ts'),
    desc: '중복 길드 삭제',
  },

  // === 챔피언십/토너먼트 ===
  'reset-championship-data': {
    path: join(__dirname, 'server', 'scripts', 'resetAllChampionshipData.ts'),
    desc: '챔피언십 데이터 전체 리셋',
  },
  'reset-championship-scores': {
    path: join(__dirname, 'server', 'scripts', 'resetAllChampionshipScores.ts'),
    desc: '챔피언십 점수 리셋',
  },
  'reset-weekly-championship-scores': {
    path: join(__dirname, 'server', 'scripts', 'resetWeeklyChampionshipScores.ts'),
    desc: '주간 챔피언십 점수 리셋',
  },
  'regenerate-weekly-competitors': {
    path: join(__dirname, 'server', 'scripts', 'regenerateWeeklyCompetitors.ts'),
    desc: '주간 경쟁자 재생성',
  },
  'emergency-reset-championship': {
    path: join(__dirname, 'server', 'scripts', 'emergencyResetChampionship.ts'),
    desc: '챔피언십 긴급 리셋',
  },
  'add-bot-scores-now': {
    path: join(__dirname, 'server', 'scripts', 'addBotScoresNow.ts'),
    desc: '봇 점수 즉시 추가',
  },

  // === 이미지 ===
  'optimize-images': {
    path: join(__dirname, 'scripts', 'optimizeImages.js'),
    useNode: true,
    desc: '이미지 최적화',
  },
  'compress-images': {
    path: join(__dirname, 'scripts', 'compress-images.ts'),
    desc: '이미지 압축',
  },
  'compress-images:dry': {
    path: join(__dirname, 'scripts', 'compress-images.ts'),
    extraArgs: ['--dry-run'],
    desc: '이미지 압축 (실행 없이 시뮬레이션)',
  },
  'cleanup-png-files': {
    path: join(__dirname, 'scripts', 'cleanup-png-files.ts'),
    desc: 'PNG 파일 정리',
  },
};

function printUsage() {
  console.log('\n📋 runscripts — 실행 가능한 스크립트 목록\n');
  const maxLen = Math.max(...Object.keys(SCRIPT_REGISTRY).map((k) => k.length));
  for (const [name, { desc }] of Object.entries(SCRIPT_REGISTRY)) {
    console.log(`  ${name.padEnd(maxLen + 2)} ${desc}`);
  }
  console.log('\n사용법: npm run runscripts -- <스크립트이름>\n');
}

function runScript(name: string): Promise<number> {
  const entry = SCRIPT_REGISTRY[name];
  if (!entry) {
    console.error(`\n❌ 알 수 없는 스크립트: ${name}\n`);
    printUsage();
    return Promise.resolve(1);
  }

  const extraArgs = entry.extraArgs ?? [];
  let prog: string;
  let args: string[];

  if (entry.useNode) {
    prog = 'node';
    args = [entry.path, ...extraArgs];
  } else {
    prog = TSX;
    args = ['tsx', '--tsconfig', TSCONFIG, entry.path, ...extraArgs];
  }

  return new Promise((resolve) => {
    const child = spawn(prog, args, {
      stdio: 'inherit',
      shell: true,
      cwd: __dirname,
    });
    child.on('close', (code) => resolve(code ?? 1));
  });
}

async function main() {
  const name = process.argv[2];
  if (!name || name === '--list' || name === '-l' || name === '--help' || name === '-h') {
    printUsage();
    process.exit(0);
  }

  const code = await runScript(name);
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
