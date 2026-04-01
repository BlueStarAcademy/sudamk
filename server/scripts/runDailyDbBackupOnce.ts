/**
 * 수동 1회: pg_dump 일일 백업 (KST 날짜 파일명). 서버 스케줄과 동일 로직.
 * DAILY_DB_BACKUP_ENABLED=true 및 DATABASE_URL 필요.
 */
import { runDailyPgDumpBackup } from '../services/dailyDatabaseBackupService.js';

const now = Date.now();
const res = await runDailyPgDumpBackup(now);
if (res.ok) {
    console.log('[runDailyDbBackupOnce] OK:', res.file);
    process.exit(0);
}
console.error('[runDailyDbBackupOnce]', res.error);
process.exit(1);
