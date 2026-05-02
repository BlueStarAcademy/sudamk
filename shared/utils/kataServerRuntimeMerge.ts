import type { PairPetKataPhase } from '../constants/pairArena.js';
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

function mergePairPetSlice(base: PairPetKataRuntimeSlice, patch: KataServerRuntimeOverrides['pairPet']): PairPetKataRuntimeSlice {
    if (!patch) return {
        abilityKataLadder: base.abilityKataLadder.map((r) => ({ ...r })),
        phaseWeights: {
            opening: { ...base.phaseWeights.opening },
            midgame: { ...base.phaseWeights.midgame },
            endgame: { ...base.phaseWeights.endgame },
        },
        phasePly9: {
            opening: { ...base.phasePly9.opening },
            midgame: { ...base.phasePly9.midgame },
            endgame: { ...base.phasePly9.endgame },
        },
        phasePly13: {
            opening: { ...base.phasePly13.opening },
            midgame: { ...base.phasePly13.midgame },
            endgame: { ...base.phasePly13.endgame },
        },
        phasePly19: {
            opening: { ...base.phasePly19.opening },
            midgame: { ...base.phasePly19.midgame },
            endgame: { ...base.phasePly19.endgame },
        },
    };
    const phases: PairPetKataPhase[] = ['opening', 'midgame', 'endgame'];
    const abilityKataLadder =
        Array.isArray(patch.abilityKataLadder) && patch.abilityKataLadder.length > 0
            ? patch.abilityKataLadder.map((r) => ({
                  minAbilityScore: Math.max(0, Math.round(Number(r.minAbilityScore))),
                  kataLevelOffset: clampKataLevel(Number(r.kataLevelOffset)),
              }))
            : base.abilityKataLadder.map((r) => ({ ...r }));

    const phaseWeights = { ...base.phaseWeights };
    if (patch.phaseWeights) {
        for (const p of phases) {
            const pw = patch.phaseWeights[p];
            if (!pw) continue;
            phaseWeights[p] = { ...phaseWeights[p], ...pw };
        }
    }

    const mergePly = (
        b: PairPetKataRuntimeSlice['phasePly9'],
        o?: Partial<Record<PairPetKataPhase, { from?: number; to?: number | null }>>,
    ) => {
        const out = { ...b };
        if (!o) return out;
        for (const p of phases) {
            const row = o[p];
            if (!row) continue;
            const to =
                row.to === undefined ? b[p].to : row.to === null ? null : Math.round(Number(row.to));
            out[p] = {
                from: Math.max(1, Math.round(Number(row.from ?? b[p].from))),
                to,
            };
        }
        return out;
    };

    return {
        abilityKataLadder,
        phaseWeights,
        phasePly9: mergePly(base.phasePly9, patch.phasePly9),
        phasePly13: mergePly(base.phasePly13, patch.phasePly13),
        phasePly19: mergePly(base.phasePly19, patch.phasePly19),
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
        const pp = patch.pairPet;
        const basePp = a.pairPet || {};
        out.pairPet = {
            ...basePp,
            ...pp,
            phaseWeights: pp.phaseWeights ? { ...basePp.phaseWeights, ...pp.phaseWeights } : basePp.phaseWeights,
            phasePly9: pp.phasePly9 ? { ...basePp.phasePly9, ...pp.phasePly9 } : basePp.phasePly9,
            phasePly13: pp.phasePly13 ? { ...basePp.phasePly13, ...pp.phasePly13 } : basePp.phasePly13,
            phasePly19: pp.phasePly19 ? { ...basePp.phasePly19, ...pp.phasePly19 } : basePp.phasePly19,
        };
    }
    return out;
}
