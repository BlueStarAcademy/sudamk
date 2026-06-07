import type { LiveGameSession, VolatileState } from '../types/index.js';
import { UserStatus } from '../types/enums.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/gameModes.js';
import * as db from './db.js';
import { getCachedGame, getStaleCachedGame } from './gameCache.js';
import { isPvpHumanGameRecordEligible } from '../utils/strategicPvpGameRecord.js';
import { broadcast } from './socket.js';

/** 대국실 이탈·GC 후에도 기보 저장이 가능하도록 종료 PVP 세션을 메모리에 보관 */
export const ENDED_PVP_GAME_RECORD_SNAPSHOT_TTL_MS = 4 * 60 * 60 * 1000;

const RECORD_SNAPSHOT_STATUSES = new Set(['ended', 'no_contest', 'rematch_pending', 'scoring']);

function ensureSnapshotMap(volatileState: VolatileState): Map<string, { game: LiveGameSession; savedAt: number }> {
    if (!volatileState.endedPvpGameRecordSnapshots) {
        volatileState.endedPvpGameRecordSnapshots = new Map();
    }
    return volatileState.endedPvpGameRecordSnapshots;
}

function pruneExpiredSnapshots(volatileState: VolatileState, now = Date.now()): void {
    const map = volatileState.endedPvpGameRecordSnapshots;
    if (!map) return;
    for (const [id, entry] of map.entries()) {
        if (now - entry.savedAt > ENDED_PVP_GAME_RECORD_SNAPSHOT_TTL_MS) {
            map.delete(id);
        }
    }
}

/** 종료·계가 중 PVP 대국 — DB 삭제 전·후 기보 저장용 */
export function stashEndedPvpGameRecordSnapshot(
    volatileState: VolatileState,
    game: LiveGameSession,
): void {
    if (!isPvpHumanGameRecordEligible(game)) return;
    if (!RECORD_SNAPSHOT_STATUSES.has(game.gameStatus)) return;
    const now = Date.now();
    pruneExpiredSnapshots(volatileState, now);
    const map = ensureSnapshotMap(volatileState);
    map.set(game.id, { game: structuredClone(game), savedAt: now });
}

/**
 * DB → 종료 스냅샷 → (만료 포함) 게임 캐시 순으로 세션 복원.
 * SAVE_GAME_RECORD·LEAVE_GAME_ROOM(대국실 이탈) 공통.
 */
export async function resolveGameSessionForRecordSave(
    volatileState: VolatileState,
    gameId: string,
): Promise<LiveGameSession | null> {
    let game = await db.getLiveGame(gameId);
    if (game) return game;

    pruneExpiredSnapshots(volatileState);
    const snap = volatileState.endedPvpGameRecordSnapshots?.get(gameId);
    if (snap?.game) return snap.game;

    game = await getCachedGame(gameId);
    if (game) return game;

    return getStaleCachedGame(gameId);
}

export const resolveGameSessionForLeave = resolveGameSessionForRecordSave;

function inferWaitingLobbyFromGame(game: LiveGameSession): 'strategic' | 'playful' | undefined {
    if (SPECIAL_GAME_MODES.some((m) => m.mode === game.mode)) return 'strategic';
    if (PLAYFUL_GAME_MODES.some((m) => m.mode === game.mode)) return 'playful';
    return undefined;
}

/** GC·DB 삭제 후 LEAVE: 클라이언트 대기실 복귀용 상태만 정리 */
export function applyLeaveWhenGameSessionMissing(
    volatileState: VolatileState,
    userId: string,
    gameId: string,
): Record<string, never> {
    const snap = volatileState.endedPvpGameRecordSnapshots?.get(gameId)?.game;
    const wl = snap ? inferWaitingLobbyFromGame(snap) : undefined;
    const prev = volatileState.userStatuses[userId];

    if (wl) {
        volatileState.userStatuses[userId] = {
            status: UserStatus.Waiting,
            waitingLobby: wl,
            arenaChannel: wl,
        };
    } else if (prev) {
        prev.status = UserStatus.Online;
        delete prev.gameId;
        delete prev.spectatingGameId;
        delete prev.mode;
        delete prev.waitingLobby;
        delete prev.arenaChannel;
    } else {
        volatileState.userStatuses[userId] = { status: UserStatus.Online };
    }

    broadcast({ type: 'USER_STATUS_UPDATE', payload: volatileState.userStatuses });
    return {};
}
