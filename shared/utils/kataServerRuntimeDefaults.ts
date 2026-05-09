import {
    PAIR_PET_KATA_PHASE_PLY_9,
    PAIR_PET_KATA_PHASE_PLY_11,
    PAIR_PET_KATA_PHASE_PLY_13,
    PAIR_PET_KATA_PHASE_PLY_19,
    PAIR_PET_KATA_PHASE_WEIGHTS,
    DEFAULT_PAIR_PET_ABILITY_KATA_LADDER,
} from '../constants/pairArena.js';
import { KATA_SERVER_LEVEL_BY_PROFILE_STEP, STRATEGIC_AI_DISPLAY_LEVEL_BY_PROFILE_STEP, adventureMonsterLevelToKataServerLevel } from './strategicAiDifficulty.js';
import { getTowerKataServerLevelByFloor } from './towerKataServerLevel.js';
import { GUILD_WAR_BOARD_ORDER, getGuildWarKataServerLevelByBoardId } from '../constants/guildConstants.js';
import type { KataServerRuntimeSnapshot } from '../types/kataServerRuntime.js';

function recordStepsFromKataMap(src: Readonly<Record<number, number>>): Record<string, number> {
    const out: Record<string, number> = {};
    for (let s = 1; s <= 10; s++) {
        out[String(s)] = src[s] ?? -31;
    }
    return out;
}

function recordDisplaySteps(): Record<string, number> {
    const out: Record<string, number> = {};
    for (let s = 1; s <= 10; s++) {
        out[String(s)] = STRATEGIC_AI_DISPLAY_LEVEL_BY_PROFILE_STEP[s] ?? s;
    }
    return out;
}

function adventureDefaults(): Record<string, number> {
    const out: Record<string, number> = {};
    for (let lv = 1; lv <= 50; lv++) {
        out[String(lv)] = adventureMonsterLevelToKataServerLevel(lv);
    }
    return out;
}

function towerDefaults(): Record<string, number> {
    const out: Record<string, number> = {};
    for (let f = 1; f <= 100; f++) {
        out[String(f)] = getTowerKataServerLevelByFloor(f);
    }
    return out;
}

function guildDefaults(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const boardId of GUILD_WAR_BOARD_ORDER) {
        out[boardId] = getGuildWarKataServerLevelByBoardId(boardId);
    }
    return out;
}

export function buildDefaultKataServerRuntimeSnapshot(): KataServerRuntimeSnapshot {
    return {
        strategicLobbyKataByStep: recordStepsFromKataMap(KATA_SERVER_LEVEL_BY_PROFILE_STEP),
        strategicLobbyDisplayByStep: recordDisplaySteps(),
        adventureKataByMonsterLevel: adventureDefaults(),
        towerKataByFloor: towerDefaults(),
        guildWarKataByBoardId: guildDefaults(),
        pairPet: {
            abilityKataLadder: DEFAULT_PAIR_PET_ABILITY_KATA_LADDER.map((r) => ({ ...r })),
            phaseWeights: {
                opening: { ...PAIR_PET_KATA_PHASE_WEIGHTS.opening },
                midgame: { ...PAIR_PET_KATA_PHASE_WEIGHTS.midgame },
                endgame: { ...PAIR_PET_KATA_PHASE_WEIGHTS.endgame },
            },
            phasePly9: {
                opening: { ...PAIR_PET_KATA_PHASE_PLY_9.opening },
                midgame: { ...PAIR_PET_KATA_PHASE_PLY_9.midgame },
                endgame: { ...PAIR_PET_KATA_PHASE_PLY_9.endgame },
            },
            phasePly11: {
                opening: { ...PAIR_PET_KATA_PHASE_PLY_11.opening },
                midgame: { ...PAIR_PET_KATA_PHASE_PLY_11.midgame },
                endgame: { ...PAIR_PET_KATA_PHASE_PLY_11.endgame },
            },
            phasePly13: {
                opening: { ...PAIR_PET_KATA_PHASE_PLY_13.opening },
                midgame: { ...PAIR_PET_KATA_PHASE_PLY_13.midgame },
                endgame: { ...PAIR_PET_KATA_PHASE_PLY_13.endgame },
            },
            phasePly19: {
                opening: { ...PAIR_PET_KATA_PHASE_PLY_19.opening },
                midgame: { ...PAIR_PET_KATA_PHASE_PLY_19.midgame },
                endgame: { ...PAIR_PET_KATA_PHASE_PLY_19.endgame },
            },
        },
    };
}
