/**
 * One-off: 자정 일괄 리셋으로 부풀려진 주간/월간 「출석하기」 진행도를 보정한다.
 * - 미수령: progress를 0으로 (오늘 실제 접속 시 +1 재인정)
 * - 수령 완료: 보상 회수 없이 유지
 *
 * Dry-run: npx tsx --tsconfig server/tsconfig.json server/scripts/repairInflatedAttendanceQuests.ts
 * Apply:   npx tsx --tsconfig server/tsconfig.json server/scripts/repairInflatedAttendanceQuests.ts --apply
 */
import * as db from '../db.js';
import type { Quest, User } from '../../types/index.js';
import { isSameDayKST } from '../../shared/utils/timeUtils.js';

const APPLY = process.argv.includes('--apply');

function pickAttendance(quests: Quest[] | undefined): Quest | null {
    if (!Array.isArray(quests)) return null;
    return quests.find((q) => q.title === '출석하기') ?? null;
}

function repairPeriod(
    label: 'weekly' | 'monthly',
    quest: Quest,
    user: User,
    now: number,
): { changed: boolean; detail: string } {
    if (quest.isClaimed) {
        return { changed: false, detail: `${label}:claimed keep ${quest.progress}/${quest.target}` };
    }
    if ((quest.progress ?? 0) <= 0) {
        return { changed: false, detail: `${label}:already 0` };
    }
    // 오늘 실제 접속 흔적(lastLoginAt)이 있으면 1, 없으면 0으로 시작
    const attendedToday = user.lastLoginAt != null && isSameDayKST(user.lastLoginAt, now);
    const next = attendedToday ? 1 : 0;
    const prev = quest.progress;
    if (prev === next) return { changed: false, detail: `${label}:keep ${prev}` };
    quest.progress = next;
    return { changed: true, detail: `${label}:${prev}→${next}` };
}

async function main() {
    const now = Date.now();
    const users = await db.getAllUsers({ includeEquipment: false, includeInventory: false, skipCache: true });
    let touched = 0;
    let changedQuests = 0;

    for (const user of users) {
        const weekly = pickAttendance(user.quests?.weekly?.quests);
        const monthly = pickAttendance(user.quests?.monthly?.quests);
        const daily = pickAttendance(user.quests?.daily?.quests);
        if (!weekly && !monthly) continue;

        const parts: string[] = [];
        let dirty = false;

        if (weekly) {
            const r = repairPeriod('weekly', weekly, user, now);
            parts.push(r.detail);
            if (r.changed) {
                dirty = true;
                changedQuests += 1;
            }
        }
        if (monthly) {
            const r = repairPeriod('monthly', monthly, user, now);
            parts.push(r.detail);
            if (r.changed) {
                dirty = true;
                changedQuests += 1;
            }
        }

        // 일일: 오늘 실제 접속이면 1, 아니면 0 (자정 배치가 올려 둔 출석 제거)
        if (daily && !daily.isClaimed) {
            const attendedToday = user.lastLoginAt != null && isSameDayKST(user.lastLoginAt, now);
            const desired = attendedToday ? 1 : 0;
            if ((daily.progress ?? 0) !== desired) {
                parts.push(`daily:${daily.progress}→${desired}`);
                daily.progress = desired;
                dirty = true;
                changedQuests += 1;
            }
        }

        if (!dirty) continue;
        touched += 1;
        console.log(`  ${APPLY ? 'FIX' : 'WOULD'} ${user.nickname}: ${parts.join(', ')}`);
        if (APPLY) {
            await db.updateUser(user);
            db.invalidateUserCache(user.id);
        }
    }

    console.log(
        `[repairInflatedAttendanceQuests] usersTouched=${touched} questsChanged=${changedQuests} mode=${APPLY ? 'APPLY' : 'DRY_RUN'}`,
    );
    if (!APPLY && touched > 0) {
        console.log('[repairInflatedAttendanceQuests] Re-run with --apply to commit.');
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error('[repairInflatedAttendanceQuests] failed:', e);
        process.exit(1);
    });
