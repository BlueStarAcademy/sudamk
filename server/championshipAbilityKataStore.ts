import * as db from './db.js';
import {
    CHAMPIONSHIP_ABILITY_KATA_LADDER,
    normalizeChampionshipAbilityKataLadder,
    type ChampionshipAbilityKataLadderRow,
} from '../shared/constants/championshipRealMatch.js';

const KV_KEY = 'championshipAbilityKataLadder';

type KvShape = { rows?: ChampionshipAbilityKataLadderRow[] };

let cached: readonly ChampionshipAbilityKataLadderRow[] = CHAMPIONSHIP_ABILITY_KATA_LADDER;

export function getChampionshipAbilityKataLadder(): readonly ChampionshipAbilityKataLadderRow[] {
    return cached;
}

export async function hydrateChampionshipAbilityKataLadderFromKV(): Promise<readonly ChampionshipAbilityKataLadderRow[]> {
    try {
        const raw = await db.getKV<KvShape | null>(KV_KEY);
        const list = raw?.rows;
        if (Array.isArray(list) && list.length > 0) {
            cached = normalizeChampionshipAbilityKataLadder(list);
        } else {
            cached = CHAMPIONSHIP_ABILITY_KATA_LADDER;
        }
    } catch (e) {
        console.warn('[championshipAbilityKataStore] hydrate failed, using defaults:', e);
        cached = CHAMPIONSHIP_ABILITY_KATA_LADDER;
    }
    return cached;
}

export async function saveChampionshipAbilityKataLadder(
    rows: readonly { minAbilityScore: unknown; kataLevel: unknown }[],
): Promise<readonly ChampionshipAbilityKataLadderRow[]> {
    const normalized = normalizeChampionshipAbilityKataLadder(rows);
    await db.setKV(KV_KEY, { rows: normalized });
    cached = normalized;
    return cached;
}

export async function resetChampionshipAbilityKataLadder(): Promise<readonly ChampionshipAbilityKataLadderRow[]> {
    await db.setKV(KV_KEY, { rows: [] });
    cached = CHAMPIONSHIP_ABILITY_KATA_LADDER;
    return cached;
}
