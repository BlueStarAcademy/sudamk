import type { KataServerRuntimeOverrides, KataServerRuntimeSnapshot } from '../shared/types/kataServerRuntime.js';
import { mergeKataServerRuntimeSnapshot, deepMergeKataOverrides } from '../shared/utils/kataServerRuntimeMerge.js';
import * as db from './db.js';

const KV_KEY = 'kataServerRuntimeOverrides';

let cachedSnapshot: KataServerRuntimeSnapshot = mergeKataServerRuntimeSnapshot(null);

export function getKataServerRuntimeSnapshot(): KataServerRuntimeSnapshot {
    return cachedSnapshot;
}

export async function hydrateKataServerRuntimeFromKV(): Promise<KataServerRuntimeSnapshot> {
    try {
        const raw = await db.getKV<KataServerRuntimeOverrides>(KV_KEY);
        cachedSnapshot = mergeKataServerRuntimeSnapshot(raw ?? null);
    } catch (e) {
        console.warn('[kataServerRuntimeStore] hydrate failed, using defaults:', e);
        cachedSnapshot = mergeKataServerRuntimeSnapshot(null);
    }
    return cachedSnapshot;
}

export async function readKataServerRuntimeOverrides(): Promise<KataServerRuntimeOverrides> {
    try {
        return (await db.getKV<KataServerRuntimeOverrides>(KV_KEY)) ?? {};
    } catch {
        return {};
    }
}

export async function saveKataServerRuntimePatch(patch: KataServerRuntimeOverrides): Promise<KataServerRuntimeSnapshot> {
    const prev = await readKataServerRuntimeOverrides();
    const next = deepMergeKataOverrides(prev, patch);
    await db.setKV(KV_KEY, next);
    cachedSnapshot = mergeKataServerRuntimeSnapshot(next);
    return cachedSnapshot;
}

export async function resetKataServerRuntimeOverrides(): Promise<KataServerRuntimeSnapshot> {
    await db.setKV(KV_KEY, {});
    cachedSnapshot = mergeKataServerRuntimeSnapshot(null);
    return cachedSnapshot;
}
