import prisma from '../prismaClient.js';

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function compactStatus(status: unknown): { next: JsonRecord | null; changed: boolean } {
  const src = asRecord(status);
  if (!src) return { next: null, changed: false };

  const next: JsonRecord = JSON.parse(JSON.stringify(src));
  let changed = false;

  const removeIfExists = (key: string) => {
    if (key in next) {
      delete next[key];
      changed = true;
    }
  };

  // Remove large duplicated payloads that are also present in serializedUser.
  removeIfExists('inventoryRaw');
  removeIfExists('equipmentRaw');
  removeIfExists('mailRaw');
  removeIfExists('questsRaw');

  // Duplicated with store.inventorySlotsMigrated.
  removeIfExists('inventorySlotsMigrated');

  // If rejectedGameModes was stringified, convert to JSON value.
  if (typeof next.rejectedGameModes === 'string') {
    try {
      next.rejectedGameModes = JSON.parse(next.rejectedGameModes as string);
      changed = true;
    } catch {
      // keep as-is if malformed
    }
  }

  return { next, changed };
}

async function run() {
  const dryRun =
    process.env.DRY_RUN === '1' ||
    process.env.DRY_RUN === 'true';
  const backupOnly =
    process.env.BACKUP_ONLY === '1' ||
    process.env.BACKUP_ONLY === 'true';

  const users = await prisma.user.findMany({
    select: { id: true, status: true },
  });

  let scanned = 0;
  let updated = 0;

  const backups: Array<{ id: string; status: unknown }> = [];

  for (const row of users) {
    scanned += 1;
    const { next, changed } = compactStatus(row.status);
    if (!changed || !next) continue;

    backups.push({ id: row.id, status: row.status });

    if (dryRun || backupOnly) continue;

    await prisma.user.update({
      where: { id: row.id },
      data: { status: next },
    });
    updated += 1;
  }

  if (backups.length > 0) {
    const fs = await import('fs/promises');
    const path = await import('path');
    const fileName = `user-status-backup-${Date.now()}.json`;
    const filePath = path.join(process.cwd(), 'server', 'scripts', fileName);
    await fs.writeFile(filePath, JSON.stringify(backups, null, 2), 'utf8');
    console.log(`[compactUserStatusJson] backup written: ${filePath}`);
  }

  if (dryRun) {
    console.log(`[compactUserStatusJson] DRY_RUN scanned=${scanned}, would_update=${backups.length}`);
    return;
  }

  if (backupOnly) {
    console.log(`[compactUserStatusJson] BACKUP_ONLY scanned=${scanned}, backup_count=${backups.length}`);
    return;
  }

  console.log(`[compactUserStatusJson] scanned=${scanned}, updated=${updated}`);
}

run()
  .catch((err) => {
    console.error('[compactUserStatusJson] failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

