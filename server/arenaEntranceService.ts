import * as db from './db.js';
import {
    mergeArenaEntranceAvailability,
    type ArenaEntranceKey,
    ARENA_ENTRANCE_CLOSED_MESSAGE,
} from '../constants/arenaEntrance.js';
import type { User } from '../types/index.js';
import { calculateTotalStats } from './statService.js';
import {
    applyUserProgressionArenaLocks,
    getBadukAbilitySnapshotFromStats,
    USER_PROGRESSION_ARENA_BLOCK_MESSAGE,
} from '../shared/utils/contentProgressionGates.js';

export async function getMergedArenaEntranceAvailability(): Promise<Record<ArenaEntranceKey, boolean>> {
    const raw = await db.getKV<Partial<Record<string, boolean>>>('arenaEntranceAvailability');
    return mergeArenaEntranceAvailability(raw);
}

/** 관리자는 항상 통과. `user`가 있으면 레벨·바둑능력 조건을 추가로 검사한다. */
export async function requireArenaEntranceOpen(
    userIsAdmin: boolean | undefined,
    key: ArenaEntranceKey,
    user?: User | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (userIsAdmin) return { ok: true };
    const m = await getMergedArenaEntranceAvailability();
    if (!m[key]) {
        return { ok: false, error: ARENA_ENTRANCE_CLOSED_MESSAGE[key] };
    }
    if (user && !user.isAdmin) {
        const snap = getBadukAbilitySnapshotFromStats(user, calculateTotalStats(user));
        const gated = applyUserProgressionArenaLocks(m, snap);
        if (!gated[key]) {
            return {
                ok: false,
                error: USER_PROGRESSION_ARENA_BLOCK_MESSAGE[key] ?? ARENA_ENTRANCE_CLOSED_MESSAGE[key],
            };
        }
    }
    return { ok: true };
}
