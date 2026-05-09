import {
    DEFAULT_PAIR_PET_ABILITY_KATA_LADDER,
    PAIR_PET_KATA_PHASE_PLY_9,
    PAIR_PET_KATA_PHASE_PLY_11,
    PAIR_PET_KATA_PHASE_PLY_13,
    PAIR_PET_KATA_PHASE_PLY_19,
    PAIR_PET_KATA_PHASE_WEIGHTS,
} from '../constants/pairArena.js';
import type { KataServerRuntimeOverrides, KataServerRuntimeSnapshot, PairPetKataRuntimeSlice } from '../types/kataServerRuntime.js';
import { buildDefaultKataServerRuntimeSnapshot } from './kataServerRuntimeDefaults.js';

const KATA_LEVEL_MIN = -31;
const KATA_LEVEL_MAX = 9;

function clampKataLevel(n: number): number {
    if (!Number.isFinite(n)) return KATA_LEVEL_MIN;
    return Math.max(KATA_LEVEL_MIN, Math.min(KATA_LEVEL_MAX, Math.round(n)));
}

function clampDisplayLevel(n: number): number {
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(999, Math.round(n)));
}

function mergeNumberRecord(
    base: Record<string, number>,
    patch: Record<string, number | undefined> | undefined,
    normalize: (n: number) => number,
): Record<string, number> {
    if (!patch) return { ...base };
    const out = { ...base };
    for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) continue;
        out[k] = normalize(v);
    }
    return out;
}

function clonePairPetPhasePlyTable(table: PairPetKataRuntimeSlice['phasePly9']): PairPetKataRuntimeSlice['phasePly9'] {
    return {
        opening: { ...table.opening },
        midgame: { ...table.midgame },
        endgame: { ...table.endgame },
    };
}

function cloneCodePairPetPhaseWeights(): PairPetKataRuntimeSlice['phaseWeights'] {
    return {
        opening: { ...PAIR_PET_KATA_PHASE_WEIGHTS.opening },
        midgame: { ...PAIR_PET_KATA_PHASE_WEIGHTS.midgame },
        endgame: { ...PAIR_PET_KATA_PHASE_WEIGHTS.endgame },
    };
}

function cloneCodePairPetPlyTables(): Pick<
    PairPetKataRuntimeSlice,
    'phasePly9' | 'phasePly11' | 'phasePly13' | 'phasePly19'
> {
    return {
        phasePly9: clonePairPetPhasePlyTable(PAIR_PET_KATA_PHASE_PLY_9),
        phasePly11: clonePairPetPhasePlyTable(PAIR_PET_KATA_PHASE_PLY_11),
        phasePly13: clonePairPetPhasePlyTable(PAIR_PET_KATA_PHASE_PLY_13),
        phasePly19: clonePairPetPhasePlyTable(PAIR_PET_KATA_PHASE_PLY_19),
    };
}

/** 펫 KATA: 가중치·착수 구간은 코드 상수만. KV는 `abilityKataLadder`만 병합. */
function mergePairPetSlice(base: PairPetKataRuntimeSlice, patch: KataServerRuntimeOverrides['pairPet']): PairPetKataRuntimeSlice {
    const abilityKataLadder =
        patch && Array.isArray(patch.abilityKataLadder) && patch.abilityKataLadder.length > 0
            ? patch.abilityKataLadder.map((r) => ({
                  minAbilityScore: Math.max(0, Math.round(Number(r.minAbilityScore))),
                  kataLevelOffset: clampKataLevel(Number(r.kataLevelOffset)),
              }))
            : base.abilityKataLadder.map((r) => ({ ...r }));

    return {
        abilityKataLadder: abilityKataLadder.length > 0 ? abilityKataLadder : [...DEFAULT_PAIR_PET_ABILITY_KATA_LADDER].map((r) => ({ ...r })),
        phaseWeights: cloneCodePairPetPhaseWeights(),
        ...cloneCodePairPetPlyTables(),
    };
}

export function mergeKataServerRuntimeSnapshot(
    overrides: KataServerRuntimeOverrides | null | undefined,
): KataServerRuntimeSnapshot {
    const def = buildDefaultKataServerRuntimeSnapshot();
    if (!overrides || typeof overrides !== 'object') return def;
    return {
        strategicLobbyKataByStep: mergeNumberRecord(def.strategicLobbyKataByStep, overrides.strategicLobbyKataByStep, clampKataLevel),
        strategicLobbyDisplayByStep: mergeNumberRecord(
            def.strategicLobbyDisplayByStep,
            overrides.strategicLobbyDisplayByStep,
            clampDisplayLevel,
        ),
        adventureKataByMonsterLevel: mergeNumberRecord(
            def.adventureKataByMonsterLevel,
            overrides.adventureKataByMonsterLevel,
            clampKataLevel,
        ),
        towerKataByFloor: mergeNumberRecord(def.towerKataByFloor, overrides.towerKataByFloor, clampKataLevel),
        guildWarKataByBoardId: mergeNumberRecord(def.guildWarKataByBoardId, overrides.guildWarKataByBoardId, clampKataLevel),
        pairPet: mergePairPetSlice(def.pairPet, overrides.pairPet),
    };
}

/** KV에 저장할 오버라이드를 기존과 병합 (얕은 병합: 각 상위 키는 통째로 교체하지 않고 하위만 merge) */
export function deepMergeKataOverrides(
    prev: KataServerRuntimeOverrides | null | undefined,
    patch: KataServerRuntimeOverrides,
): KataServerRuntimeOverrides {
    const a = prev && typeof prev === 'object' ? prev : {};
    const out: KataServerRuntimeOverrides = { ...a, ...patch };
    if (patch.strategicLobbyKataByStep) {
        out.strategicLobbyKataByStep = { ...a.strategicLobbyKataByStep, ...patch.strategicLobbyKataByStep };
    }
    if (patch.strategicLobbyDisplayByStep) {
        out.strategicLobbyDisplayByStep = { ...a.strategicLobbyDisplayByStep, ...patch.strategicLobbyDisplayByStep };
    }
    if (patch.adventureKataByMonsterLevel) {
        out.adventureKataByMonsterLevel = { ...a.adventureKataByMonsterLevel, ...patch.adventureKataByMonsterLevel };
    }
    if (patch.towerKataByFloor) {
        out.towerKataByFloor = { ...a.towerKataByFloor, ...patch.towerKataByFloor };
    }
    if (patch.guildWarKataByBoardId) {
        out.guildWarKataByBoardId = { ...a.guildWarKataByBoardId, ...patch.guildWarKataByBoardId };
    }
    if (patch.pairPet) {
        const basePp = a.pairPet || {};
        const pp = patch.pairPet;
        out.pairPet = { ...basePp };
        if (Array.isArray(pp.abilityKataLadder) && pp.abilityKataLadder.length > 0) {
            out.pairPet.abilityKataLadder = pp.abilityKataLadder.map((r) => ({
                minAbilityScore: Math.max(0, Math.round(Number(r.minAbilityScore))),
                kataLevelOffset: clampKataLevel(Number(r.kataLevelOffset)),
            }));
        }
    }
    return out;
}
