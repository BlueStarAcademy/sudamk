import type { User } from '../types/entities.js';
import type { PairPetMeta, PairPetSpecialization } from '../types/entities.js';
import { GameMode } from '../types/enums.js';
import { PLAYFUL_ACTION_POINT_COST, STRATEGIC_ACTION_POINT_COST } from '../constants/rules.js';
import { PLAYFUL_GAME_MODES, SPECIAL_GAME_MODES } from '../constants/gameModes.js';
import { getEquippedPairPetInventoryRow } from './pairEquippedPet.js';
import { resolvePairPetMetaFromInventoryRow } from './pairPetRoll.js';

/** 페어 방 `lobbyChannel` 기준 — 랭킹전 행동력 할인 종류 구분 */
export type PairPetArenaApLobbyChannel = 'strategic' | 'playful' | 'pair';

export function pairRankedLobbyChannelFromRoom(room: { lobbyChannel?: string }): PairPetArenaApLobbyChannel {
    const ch = room.lobbyChannel ?? 'pair';
    if (ch === 'strategic' || ch === 'playful') return ch;
    return 'pair';
}

export function pairPetArenaApDiscountSteps(spec: PairPetSpecialization | undefined, arena: PairPetArenaApLobbyChannel): number {
    if (!spec) return 0;
    if (arena === 'strategic' && spec.kind === 'strategicArenaApMinusOne') return 1;
    if (arena === 'playful' && spec.kind === 'playfulArenaApMinusOne') return 1;
    if (arena === 'pair' && spec.kind === 'pairArenaApMinusOne') return 1;
    return 0;
}

export function apCostAfterPairPetArenaDiscount(
    baseCost: number,
    arena: PairPetArenaApLobbyChannel,
    specialization?: PairPetSpecialization,
): number {
    return Math.max(0, baseCost - pairPetArenaApDiscountSteps(specialization, arena));
}

export function resolveEquippedPairPetSpecialization(user: Pick<User, 'inventory' | 'equippedPairPetTemplateId' | 'equippedPairPetInventoryItemId'>): PairPetSpecialization | undefined {
    const row = getEquippedPairPetInventoryRow(user);
    if (!row) return undefined;
    return resolvePairPetMetaFromInventoryRow(row).specialization;
}

/** 대기실 협상·일반 PVP: 모드에 따른 기본 행동력 (전략/놀이 구간) */
export function basePvpActionPointCostForMode(mode: GameMode): number {
    if (SPECIAL_GAME_MODES.some((m) => m.mode === mode)) return STRATEGIC_ACTION_POINT_COST;
    if (PLAYFUL_GAME_MODES.some((m) => m.mode === mode)) return PLAYFUL_ACTION_POINT_COST;
    return STRATEGIC_ACTION_POINT_COST;
}

/**
 * 협상 수락 등 `pairGame.lobbyChannel` 없이 모드만 있을 때: 놀이 모드 → 놀이 할인, 그 외 → 전략 할인.
 * (페어 탭 전용 `pairArenaApMinusOne`은 여기서 적용하지 않음 — 페어 랭킹전 `assertAndConsumePairRankedMatchActionPoints` 등에서 처리)
 */
export function effectiveNegotiationApCostForUser(user: Pick<User, 'inventory' | 'equippedPairPetTemplateId' | 'equippedPairPetInventoryItemId'>, mode: GameMode): number {
    const base = basePvpActionPointCostForMode(mode);
    const spec = resolveEquippedPairPetSpecialization(user);
    const arena: PairPetArenaApLobbyChannel = PLAYFUL_GAME_MODES.some((m) => m.mode === mode) ? 'playful' : 'strategic';
    return apCostAfterPairPetArenaDiscount(base, arena, spec);
}

export function effectivePairRankedApCostForUser(
    user: Pick<User, 'inventory' | 'equippedPairPetTemplateId' | 'equippedPairPetInventoryItemId'>,
    baseCost: number,
    room: { lobbyChannel?: string },
): number {
    const arena = pairRankedLobbyChannelFromRoom(room);
    const spec = resolveEquippedPairPetSpecialization(user);
    return apCostAfterPairPetArenaDiscount(baseCost, arena, spec);
}

/** 전략 랭킹전 큐 매칭 시 기본 비용 STRATEGIC + 전략 탭 할인 */
export function effectiveStrategicRankedQueueApCostForUser(
    user: Pick<User, 'inventory' | 'equippedPairPetTemplateId' | 'equippedPairPetInventoryItemId'>,
): number {
    return apCostAfterPairPetArenaDiscount(STRATEGIC_ACTION_POINT_COST, 'strategic', resolveEquippedPairPetSpecialization(user));
}

/** `pairGame.lobbyChannel`가 있으면 우선, 없으면 모드 기반(환불·표시용) */
export function effectivePvpEntryApCostForUser(
    user: Pick<User, 'inventory' | 'equippedPairPetTemplateId' | 'equippedPairPetInventoryItemId'>,
    mode: GameMode,
    pairGameLobbyChannel?: 'pair' | 'strategic' | 'playful',
): number {
    const base = basePvpActionPointCostForMode(mode);
    const spec = resolveEquippedPairPetSpecialization(user);
    if (pairGameLobbyChannel === 'strategic' || pairGameLobbyChannel === 'playful' || pairGameLobbyChannel === 'pair') {
        return apCostAfterPairPetArenaDiscount(base, pairGameLobbyChannel, spec);
    }
    const arena: PairPetArenaApLobbyChannel = PLAYFUL_GAME_MODES.some((m) => m.mode === mode) ? 'playful' : 'strategic';
    return apCostAfterPairPetArenaDiscount(base, arena, spec);
}

export function trainingSoulBonusQuantityFromMeta(meta: Pick<PairPetMeta, 'specialization'> | null | undefined): number {
    return meta?.specialization?.kind === 'trainingSoulQuantityPlusOne' ? 1 : 0;
}
