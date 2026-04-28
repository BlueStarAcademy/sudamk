import type { LiveGameSession, SinglePlayerStageInfo, User, VolatileState } from '../shared/types/index.js';
import { DEFAULT_SINGLE_PLAYER_STAGES } from '../shared/constants/singlePlayerConstants.js';
import * as db from './db.js';

/** 관리자 순열 저장 직전 payload: i번째 칸에 있던 스테이지 id → 저장 후 i번째 슬롯의 정식 id(DEFAULT[i].id) */
export function buildSinglePlayerStageIdRemapFromPermutationPayload(
    raw: Array<{ id?: unknown }>
): Record<string, string> {
    const out: Record<string, string> = {};
    const def = DEFAULT_SINGLE_PLAYER_STAGES;
    for (let i = 0; i < def.length; i++) {
        const oldId = typeof raw[i]?.id === 'string' ? (raw[i] as { id: string }).id : '';
        if (!oldId) continue;
        out[oldId] = def[i]!.id;
    }
    return out;
}

/** 싱글은 순차 진행이므로, 어떤 스테이지를 클리어했다면 그 이전(이전 순서 기준) 스테이지도 클리어한 것으로 본다. */
function addImplicitClearsUnderPrevOrder(
    prevOrder: Pick<SinglePlayerStageInfo, 'id'>[],
    implied: Set<string>
): void {
    const prevIndex = new Map(prevOrder.map((s, i) => [s.id, i]));
    for (const id of [...implied]) {
        const idx = prevIndex.get(id);
        if (idx === undefined) continue;
        for (let j = 0; j <= idx; j++) implied.add(prevOrder[j]!.id);
    }
}

export function remapUserSinglePlayerProgressFields(
    user: User,
    prevOrder: Pick<SinglePlayerStageInfo, 'id'>[],
    remap: Record<string, string>,
    newOrder: Pick<SinglePlayerStageInfo, 'id'>[]
): void {
    const implied = new Set<string>();
    const explicit = user.clearedSinglePlayerStages ?? [];
    for (const id of explicit) {
        if (typeof id === 'string' && id) implied.add(id);
    }
    const prog = Math.max(0, Math.floor(Number(user.singlePlayerProgress ?? 0)));
    for (let i = 0; i < prog && i < prevOrder.length; i++) {
        implied.add(prevOrder[i]!.id);
    }
    addImplicitClearsUnderPrevOrder(prevOrder, implied);

    const canonicalIds = new Set(newOrder.map((s) => s.id));
    const migrated = new Set<string>();
    for (const id of implied) {
        const next = remap[id] ?? id;
        if (canonicalIds.has(next)) migrated.add(next);
    }

    const clearedOrdered = newOrder.map((s) => s.id).filter((id) => migrated.has(id));
    user.clearedSinglePlayerStages = clearedOrdered;

    let prefix = 0;
    for (let i = 0; i < newOrder.length; i++) {
        if (!migrated.has(newOrder[i]!.id)) break;
        prefix++;
    }
    user.singlePlayerProgress = prefix;
}

export async function migrateUsersAfterSinglePlayerStageReorder(
    prevOrder: SinglePlayerStageInfo[],
    remap: Record<string, string>,
    newOrder: SinglePlayerStageInfo[]
): Promise<void> {
    const changed = Object.keys(remap).some((k) => remap[k] !== k);
    if (!changed) return;

    const users = await db.getAllUsers({ includeEquipment: false, includeInventory: false, skipCache: true });
    let n = 0;
    const sameStringArray = (a: string[] | undefined, b: string[] | undefined): boolean => {
        const aa = Array.isArray(a) ? a : [];
        const bb = Array.isArray(b) ? b : [];
        if (aa.length !== bb.length) return false;
        for (let i = 0; i < aa.length; i++) {
            if (aa[i] !== bb[i]) return false;
        }
        return true;
    };
    for (const user of users) {
        const next: User = { ...user };
        const prevCleared = Array.isArray(user.clearedSinglePlayerStages)
            ? [...user.clearedSinglePlayerStages]
            : [];
        const prevProgress = Number.isFinite(Number(user.singlePlayerProgress))
            ? Math.max(0, Math.floor(Number(user.singlePlayerProgress)))
            : 0;
        remapUserSinglePlayerProgressFields(next, prevOrder, remap, newOrder);
        const nextCleared = Array.isArray(next.clearedSinglePlayerStages)
            ? next.clearedSinglePlayerStages
            : [];
        const nextProgress = Number.isFinite(Number(next.singlePlayerProgress))
            ? Math.max(0, Math.floor(Number(next.singlePlayerProgress)))
            : 0;
        if (!sameStringArray(nextCleared, prevCleared) || nextProgress !== prevProgress) {
            await db.updateUser(next);
        }
        n++;
        if (n % 250 === 0) {
            console.log(`[singlePlayerStageIdMigration] users ${n}/${users.length}`);
        }
    }
    console.log(`[singlePlayerStageIdMigration] users done (${n})`);
}

export async function migrateActiveSinglePlayerLiveGames(remap: Record<string, string>): Promise<void> {
    const changed = Object.keys(remap).some((k) => remap[k] !== k);
    if (!changed) return;

    const games = await db.getAllActiveGames();
    for (const g of games) {
        if (!g.isSinglePlayer && g.gameCategory !== 'singleplayer') continue;
        const sid = g.stageId;
        if (!sid || typeof sid !== 'string') continue;
        const nextId = remap[sid];
        if (!nextId || nextId === sid) continue;
        g.stageId = nextId;
        await db.saveGame(g);
    }
}

export function patchVolatileSinglePlayerStageIds(volatileState: VolatileState | undefined, remap: Record<string, string>): void {
    const changed = Object.keys(remap).some((k) => remap[k] !== k);
    if (!changed || !volatileState?.gameCache?.size) return;

    for (const [, cached] of volatileState.gameCache) {
        const g = cached.game as LiveGameSession;
        if (!g?.isSinglePlayer && g.gameCategory !== 'singleplayer') continue;
        const sid = g.stageId;
        if (!sid || typeof sid !== 'string') continue;
        const nextId = remap[sid];
        if (nextId && nextId !== sid) g.stageId = nextId;
    }
}
