import type { KataServerRuntimeSnapshot } from '../types/kataServerRuntime.js';

export function strategicKataLevelFromSnapshot(snap: KataServerRuntimeSnapshot, step: number): number {
    const s = Math.max(1, Math.min(10, Math.round(step)));
    return snap.strategicLobbyKataByStep[String(s)] ?? -31;
}

export function strategicDisplayLevelFromSnapshot(snap: KataServerRuntimeSnapshot, step: number): number {
    const s = Math.max(1, Math.min(10, Math.round(step)));
    return snap.strategicLobbyDisplayByStep[String(s)] ?? s;
}

export function adventureKataLevelFromSnapshot(snap: KataServerRuntimeSnapshot, monsterLevel: number): number {
    const lv = Math.max(1, Math.min(50, Math.floor(monsterLevel)));
    return snap.adventureKataByMonsterLevel[String(lv)] ?? -31;
}

export function towerKataLevelFromSnapshot(snap: KataServerRuntimeSnapshot, floor: number): number {
    const f = Math.max(1, Math.min(100, Math.floor(floor)));
    return snap.towerKataByFloor[String(f)] ?? -30;
}

export function guildWarKataLevelFromSnapshot(snap: KataServerRuntimeSnapshot, boardId: string): number {
    const v = snap.guildWarKataByBoardId[boardId];
    return typeof v === 'number' ? v : -10;
}

/** settings.kataServerLevel 등으로부터 전략 로비 단계(1~10) 역추적 */
export function profileStepFromKataLevelWithSnapshot(kataLevel: number, snap: KataServerRuntimeSnapshot): number | undefined {
    const ks = Math.round(Number(kataLevel));
    if (!Number.isFinite(ks)) return undefined;
    for (let step = 1; step <= 10; step++) {
        if (snap.strategicLobbyKataByStep[String(step)] === ks) return step;
    }
    if (ks >= 1 && ks <= 10) return ks;
    return undefined;
}
