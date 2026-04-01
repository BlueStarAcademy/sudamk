import type { AdminLog } from "../../types/entities.ts";
import type { User } from "../../types/index.js";
import * as db from "../db.js";
import prisma from "../prismaClient.js";
import { getKV } from "../repositories/kvRepository.js";
import { syncInventoryEquipmentToDatabase } from "../prisma/userService.js";

const ACTIONS_WITH_FULL_USER = new Set<AdminLog["action"]>([
  "reset_stats",
  "reset_full",
  "update_user_details",
]);

function isPartialUserBackup(bd: unknown): bd is Partial<User> {
  if (!bd || typeof bd !== "object" || Array.isArray(bd)) return false;
  const o = bd as Record<string, unknown>;
  if (Array.isArray(o.inventory)) return true;
  if (o.equipment && typeof o.equipment === "object" && !Array.isArray(o.equipment)) return true;
  return false;
}

function inventoryLen(u: Partial<User>): number {
  return Array.isArray(u.inventory) ? u.inventory.length : 0;
}

export type RestoreInventoryFromLogsResult =
  | {
      nickname: string;
      ok: true;
      dryRun: boolean;
      chosenAction: string;
      chosenAt: string;
      beforeInv: number;
      beforeEq: number;
      afterInv: number;
      afterEq: number;
    }
  | { nickname: string; ok: false; reason: string };

export type LoadAdminLogsResult =
  | { ok: true; logs: AdminLog[] }
  | { ok: false; error: "no_admin_logs_key" | "admin_logs_empty_or_invalid" };

export async function loadAdminLogsForRestore(): Promise<LoadAdminLogsResult> {
  const logsRaw = await getKV<AdminLog[]>("adminLogs");
  if (Array.isArray(logsRaw) && logsRaw.length > 0) {
    return { ok: true, logs: logsRaw };
  }
  const row = await prisma.keyValue.findUnique({ where: { key: "adminLogs" } });
  if (!row) return { ok: false, error: "no_admin_logs_key" };
  return { ok: false, error: "admin_logs_empty_or_invalid" };
}

export async function restoreInventoryFromAdminLogsForNicknames(
  logs: AdminLog[],
  options: {
    nicknames: string[];
    strategy: "richest" | "latest";
    dryRun: boolean;
    force: boolean;
  }
): Promise<RestoreInventoryFromLogsResult[]> {
  const { nicknames, strategy, dryRun, force } = options;
  const sorted = [...logs].sort((a, b) => a.timestamp - b.timestamp);
  const results: RestoreInventoryFromLogsResult[] = [];

  for (const nickname of nicknames) {
    const current = await db.getUserByNickname(nickname);
    if (!current) {
      results.push({ nickname, ok: false, reason: "user_not_found" });
      continue;
    }

    const currentInv = inventoryLen(current);
    const currentEq = current.equipment ? Object.keys(current.equipment).length : 0;

    const candidates = sorted.filter(
      (log) =>
        log.targetNickname === nickname &&
        ACTIONS_WITH_FULL_USER.has(log.action) &&
        isPartialUserBackup(log.backupData)
    );

    if (!candidates.length) {
      results.push({
        nickname,
        ok: false,
        reason: "no_eligible_admin_log",
      });
      continue;
    }

    let chosen: AdminLog;
    if (strategy === "latest") {
      chosen = candidates[candidates.length - 1]!;
    } else {
      chosen = candidates.reduce((best, log) => {
        const b = log.backupData as Partial<User>;
        const bestU = best.backupData as Partial<User>;
        return inventoryLen(b) > inventoryLen(bestU) ? log : best;
      }, candidates[0]!);
    }

    const snap = chosen.backupData as Partial<User>;
    const snapInv = inventoryLen(snap);
    const snapEq = snap.equipment ? Object.keys(snap.equipment).length : 0;

    if (!Array.isArray(snap.inventory) || snap.inventory.length === 0) {
      results.push({ nickname, ok: false, reason: "snapshot_inventory_empty" });
      continue;
    }

    if (!force && snapInv <= currentInv && strategy === "richest") {
      results.push({
        nickname,
        ok: false,
        reason: `richest_skip_snapshot_not_larger_than_current (${snapInv}<=${currentInv})`,
      });
      continue;
    }

    if (dryRun) {
      results.push({
        nickname,
        ok: true,
        dryRun: true,
        chosenAction: chosen.action,
        chosenAt: new Date(chosen.timestamp).toISOString(),
        beforeInv: currentInv,
        beforeEq: currentEq,
        afterInv: snapInv,
        afterEq: snapEq,
      });
      continue;
    }

    const merged: User = {
      ...current,
      inventory: JSON.parse(JSON.stringify(snap.inventory)) as User["inventory"],
      equipment: JSON.parse(JSON.stringify(snap.equipment || {})) as User["equipment"],
    };

    await db.updateUser(merged);
    await syncInventoryEquipmentToDatabase(merged);
    db.invalidateUserCache(current.id);

    const after = await db.getUser(current.id, { includeEquipment: true, includeInventory: true });
    const afterInv = after?.inventory?.length ?? 0;
    const afterEq = after?.equipment ? Object.keys(after.equipment).length : 0;

    results.push({
      nickname,
      ok: true,
      dryRun: false,
      chosenAction: chosen.action,
      chosenAt: new Date(chosen.timestamp).toISOString(),
      beforeInv: currentInv,
      beforeEq: currentEq,
      afterInv,
      afterEq,
    });
  }

  return results;
}
