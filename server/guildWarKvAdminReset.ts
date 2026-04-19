import * as db from './db.js';
import * as types from '../shared/types/index.js';
import { guildWarIsChronologicallyActive } from './guildWarActiveUtils.js';

export type ResetInProgressGuildWarsKvOptions = {
    /**
     * false(기본): 시계상 아직 끝나지 않은 전쟁만 KV에서 제거(자동 매칭 제외와 동일 기준).
     * true: status가 active인 전쟁은 종료 시각과 관계없이 모두 제거(좀비 active 정리).
     */
    removeAllStatusActive?: boolean;
    /** true이면 Prisma GuildWar도 cancelled로 맞춤(해당 id가 있을 때만, 실패는 로그만). */
    syncPrisma?: boolean;
};

export type ResetInProgressGuildWarsKvResult = {
    removedFromKv: number;
    remainingInKv: number;
    clearedGuildIds: string[];
    queueEntriesRemoved: number;
    prismaCancelled: number;
};

function warShouldRemoveFromKv(w: any, now: number, removeAllStatusActive: boolean): boolean {
    if (!w || w.status !== 'active') return false;
    if (removeAllStatusActive) return true;
    return guildWarIsChronologicallyActive(w, now);
}

/**
 * KV `activeGuildWars`에서 진행 중 전쟁을 제거하고, 관련 길드의 guildWarMatching·pending·매칭 큐 항목을 정리한다.
 * 운영/로컬 복구용 — 실행 전 백업 권장.
 */
export async function resetInProgressGuildWarsKv(
    options?: ResetInProgressGuildWarsKvOptions,
): Promise<ResetInProgressGuildWarsKvResult> {
    const now = Date.now();
    const removeAll = Boolean(options?.removeAllStatusActive);
    const syncPrisma = options?.syncPrisma !== false;

    const allWars = (await db.getKV<any[]>('activeGuildWars')) || [];
    const toRemove = allWars.filter((w) => warShouldRemoveFromKv(w, now, removeAll));
    const remaining = allWars.filter((w) => !warShouldRemoveFromKv(w, now, removeAll));

    const clearedGuildIds = new Set<string>();
    for (const w of toRemove) {
        if (w.guild1Id) clearedGuildIds.add(String(w.guild1Id));
        if (w.guild2Id) clearedGuildIds.add(String(w.guild2Id));
    }

    const guilds = (await db.getKV<Record<string, types.Guild>>('guilds')) || {};
    let guildsMutated = false;
    for (const gid of clearedGuildIds) {
        const g = guilds[gid] as any;
        if (!g) continue;
        if (g.guildWarMatching !== undefined || g.guildWarPendingParticipantIds !== undefined) {
            delete g.guildWarMatching;
            delete g.guildWarPendingParticipantIds;
            guildsMutated = true;
        }
    }

    const queue = (await db.getKV<string[]>('guildWarMatchingQueue')) || [];
    const beforeQ = queue.length;
    const newQueue = queue.filter((id) => !clearedGuildIds.has(id));

    await db.setKV('activeGuildWars', remaining);
    if (guildsMutated) {
        await db.setKV('guilds', guilds);
    }
    if (newQueue.length !== beforeQ) {
        await db.setKV('guildWarMatchingQueue', newQueue);
    }

    let prismaCancelled = 0;
    if (syncPrisma && toRemove.length > 0) {
        const { updateGuildWar } = await import('./prisma/guildRepository.js');
        for (const w of toRemove) {
            const id = w?.id;
            if (typeof id !== 'string' || id.length < 8) continue;
            try {
                await updateGuildWar(id, {
                    status: 'cancelled',
                    endTime: now,
                    result: { adminVoided: true, voidedAt: now },
                });
                prismaCancelled++;
            } catch (e: any) {
                console.warn(`[resetInProgressGuildWarsKv] Prisma skip war ${id}:`, e?.message || e);
            }
        }
    }

    return {
        removedFromKv: toRemove.length,
        remainingInKv: remaining.length,
        clearedGuildIds: [...clearedGuildIds],
        queueEntriesRemoved: beforeQ - newQueue.length,
        prismaCancelled,
    };
}
