import * as db from './db.js';
import {
    mergeArenaEntranceAvailability,
    type ArenaEntranceKey,
    ARENA_ENTRANCE_CLOSED_MESSAGE,
} from '../constants/arenaEntrance.js';

export async function getMergedArenaEntranceAvailability(): Promise<Record<ArenaEntranceKey, boolean>> {
    const raw = await db.getKV<Partial<Record<string, boolean>>>('arenaEntranceAvailability');
    return mergeArenaEntranceAvailability(raw);
}

/** 관리자는 항상 통과 */
export async function requireArenaEntranceOpen(
    userIsAdmin: boolean | undefined,
    key: ArenaEntranceKey,
): Promise<{ ok: true } | { ok: false; error: string }> {
    if (userIsAdmin) return { ok: true };
    const m = await getMergedArenaEntranceAvailability();
    if (!m[key]) {
        return { ok: false, error: ARENA_ENTRANCE_CLOSED_MESSAGE[key] };
    }
    return { ok: true };
}
