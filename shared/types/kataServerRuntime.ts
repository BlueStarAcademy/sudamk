import type { PairPetAbilityKataLadderRow, PairPetCoreStatsSix, PairPetKataPhase } from '../constants/pairArena.js';

export type { PairPetAbilityKataLadderRow } from '../constants/pairArena.js';

export type PairPetKataPhasePlyRange = { from: number; to: number | null };

export type PairPetKataRuntimeSlice = {
    abilityKataLadder: PairPetAbilityKataLadderRow[];
    phaseWeights: Record<PairPetKataPhase, PairPetCoreStatsSix>;
    phasePly9: Record<PairPetKataPhase, PairPetKataPhasePlyRange>;
    phasePly13: Record<PairPetKataPhase, PairPetKataPhasePlyRange>;
    phasePly19: Record<PairPetKataPhase, PairPetKataPhasePlyRange>;
};

/**
 * KataServer `/move`에 쓰이는 런타임 스냅샷(기본값 + KV 오버라이드 병합 결과).
 * JSON 직렬화를 위해 단계·층·몬스터 레벨 등의 키는 문자열.
 */
export type KataServerRuntimeSnapshot = {
    strategicLobbyKataByStep: Record<string, number>;
    strategicLobbyDisplayByStep: Record<string, number>;
    adventureKataByMonsterLevel: Record<string, number>;
    towerKataByFloor: Record<string, number>;
    guildWarKataByBoardId: Record<string, number>;
    pairPet: PairPetKataRuntimeSlice;
};

/** KV `kataServerRuntimeOverrides`에 저장되는 부분 덮어쓰기 */
export type KataServerRuntimeOverrides = {
    strategicLobbyKataByStep?: Record<string, number | undefined>;
    strategicLobbyDisplayByStep?: Record<string, number | undefined>;
    adventureKataByMonsterLevel?: Record<string, number | undefined>;
    towerKataByFloor?: Record<string, number | undefined>;
    guildWarKataByBoardId?: Record<string, number | undefined>;
    pairPet?: Partial<{
        abilityKataLadder: PairPetAbilityKataLadderRow[];
        phaseWeights: Partial<Record<PairPetKataPhase, Partial<PairPetCoreStatsSix>>>;
        phasePly9: Partial<Record<PairPetKataPhase, Partial<PairPetKataPhasePlyRange>>>;
        phasePly13: Partial<Record<PairPetKataPhase, Partial<PairPetKataPhasePlyRange>>>;
        phasePly19: Partial<Record<PairPetKataPhase, Partial<PairPetKataPhasePlyRange>>>;
    }>;
};
