/**
 * KST 기준 일일 PostgreSQL 전체 덤프 (pg_dump) + 오래된 파일 정리
 *
 * Railway Node 이미지에 pg_dump가 없으면 실패합니다. Postgres 클라이언트 설치 또는
 * 별도 백업용 Dockerfile / 서비스가 필요할 수 있습니다.
 *
 * 환경변수:
 *   DAILY_DB_BACKUP_ENABLED=true
 *   DAILY_DB_BACKUP_DIR=./data/db-backups  (Railway에서는 Volume 마운트 경로 권장)
 *   DAILY_DB_BACKUP_RETENTION_DAYS=2       (기본 2: 오늘·어제 덤프 유지, 그 이전 삭제)
 *   DAILY_DB_BACKUP_FILENAME_PREFIX=sudamr-db
 *   PG_DUMP_PATH=pg_dump                  (또는 절대 경로)
 */

import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import { getKSTFullYear, getKSTMonth, getKSTDate_UTC } from "../../shared/utils/timeUtils.js";

const execFileAsync = promisify(execFile);

export function getKstYmd(now: number): string {
  const y = getKSTFullYear(now);
  const m = String(getKSTMonth(now) + 1).padStart(2, "0");
  const d = String(getKSTDate_UTC(now)).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function ymdAddCalendarDays(ymd: string, deltaDays: number): string {
  const [y, mo, d] = ymd.split("-").map(Number);
  const t = Date.UTC(y, mo - 1, d + deltaDays);
  const dt = new Date(t);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

async function pruneOldBackups(dir: string, prefix: string, now: number): Promise<void> {
  const retention = Math.max(1, parseInt(process.env.DAILY_DB_BACKUP_RETENTION_DAYS || "2", 10));
  const todayYmd = getKstYmd(now);
  const minKeepYmd = ymdAddCalendarDays(todayYmd, -(retention - 1));
  const re = new RegExp(`^${escapeRegExp(prefix)}-(\\d{4}-\\d{2}-\\d{2})\\.dump$`);
  let entries: string[] = [];
  try {
    entries = await fs.promises.readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const m = name.match(re);
    if (!m) continue;
    const fileYmd = m[1]!;
    if (fileYmd < minKeepYmd) {
      const full = path.join(dir, name);
      try {
        await fs.promises.unlink(full);
        console.log(`[DailyDbBackup] Pruned old backup: ${name}`);
      } catch (e: any) {
        console.warn(`[DailyDbBackup] Failed to delete ${name}:`, e?.message);
      }
    }
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type DailyBackupResult = { ok: true; file: string } | { ok: false; error: string };

export async function runDailyPgDumpBackup(now: number): Promise<DailyBackupResult> {
  if (process.env.DAILY_DB_BACKUP_ENABLED !== "true") {
    return { ok: false, error: "disabled" };
  }

  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl || (!dbUrl.startsWith("postgres://") && !dbUrl.startsWith("postgresql://"))) {
    return { ok: false, error: "DATABASE_URL is not a postgres connection string" };
  }

  const dir = process.env.DAILY_DB_BACKUP_DIR || path.join(process.cwd(), "data", "db-backups");
  const prefix = (process.env.DAILY_DB_BACKUP_FILENAME_PREFIX || "sudamr-db").replace(/[^a-zA-Z0-9._-]/g, "_");
  const pgDumpPath = process.env.PG_DUMP_PATH || "pg_dump";
  const ymd = getKstYmd(now);
  const outFile = path.join(dir, `${prefix}-${ymd}.dump`);

  await fs.promises.mkdir(dir, { recursive: true });

  const extraArgs = (process.env.DAILY_DB_BACKUP_PG_DUMP_EXTRA || "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const args = [dbUrl, "-F", "c", "-f", outFile, "--no-owner", "--no-acl", ...extraArgs];

  try {
    await execFileAsync(pgDumpPath, args, {
      maxBuffer: 512 * 1024 * 1024,
      env: process.env,
      windowsHide: true,
    });
  } catch (e: any) {
    const msg = e?.stderr?.toString?.() || e?.message || String(e);
    return { ok: false, error: `pg_dump failed: ${msg}` };
  }

  await pruneOldBackups(dir, prefix, now);
  return { ok: true, file: outFile };
}
