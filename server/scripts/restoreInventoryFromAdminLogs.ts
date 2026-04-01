/**
 * 관리자 로그( KV key: adminLogs )에 남은 전체 유저 백업으로 인벤·장비 복구
 *
 * 사용법 (운영 DB DATABASE_URL):
 *   npx tsx --tsconfig server/tsconfig.json server/scripts/restoreInventoryFromAdminLogs.ts [--dry-run] [--strategy richest|latest] [--force] <닉네임> ...
 */

import prisma from "../prismaClient.js";
import {
  loadAdminLogsForRestore,
  restoreInventoryFromAdminLogsForNicknames,
} from "../services/restoreInventoryFromAdminLogsService.js";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  let strategy: "richest" | "latest" = "richest";
  const si = args.indexOf("--strategy");
  if (si !== -1) {
    const v = args[si + 1];
    if (v === "latest" || v === "richest") strategy = v;
  }
  const nicknames = args.filter((a, i) => {
    if (a === "--dry-run" || a === "--strategy" || a === "--force") return false;
    if (i > 0 && args[i - 1] === "--strategy" && (a === "latest" || a === "richest")) return false;
    return true;
  });

  if (nicknames.length === 0) {
    console.log(
      "사용법: npx tsx --tsconfig server/tsconfig.json server/scripts/restoreInventoryFromAdminLogs.ts [--dry-run] [--force] [--strategy richest|latest] <닉네임> ..."
    );
    process.exit(1);
  }

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, rej) => setTimeout(() => rej(new Error("DB probe timeout (15s)")), 15_000)),
    ]);
  } catch (e: any) {
    console.error("\n[restoreInventoryFromAdminLogs] 데이터베이스 연결 실패 — 복구는 수행되지 않았습니다.\n");
    console.error("  상세:", e?.message || e);
    console.error(
      "\n  Railway API 서비스에 배포 후 아래 엔드포인트로 호출하거나:\n" +
        "  POST /api/admin/emergency-restore-inventory-from-logs\n" +
        "  (환경변수 EMERGENCY_RESTORE_INVENTORY_SECRET + JSON body)\n"
    );
    process.exit(1);
  }

  const loaded = await loadAdminLogsForRestore();
  if (!loaded.ok) {
    console.error(`[restoreInventoryFromAdminLogs] adminLogs 로드 실패: ${loaded.error}`);
    process.exit(1);
  }

  const results = await restoreInventoryFromAdminLogsForNicknames(loaded.logs, {
    nicknames,
    strategy,
    dryRun,
    force,
  });

  for (const r of results) {
    if (r.ok) {
      console.log(
        r.dryRun
          ? `[${r.nickname}] dry-run OK action=${r.chosenAction} at=${r.chosenAt} would be inv ${r.beforeInv}->${r.afterInv}`
          : `[${r.nickname}] OK action=${r.chosenAction} at=${r.chosenAt} inv ${r.beforeInv}->${r.afterInv} eq ${r.beforeEq}->${r.afterEq}`
      );
    } else {
      console.error(`[${r.nickname}] FAIL: ${r.reason}`);
    }
  }
  console.log("\n[끝]");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().catch(() => {}));
