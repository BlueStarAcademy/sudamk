import type { ChampionshipVersusVenueKind, InventoryItem, TournamentType, User } from '../types/index.js';
import {
    type ConditionPotionType,
    getConditionPotionDefinition,
    isConditionPotionType,
    optimisticConditionPotionRecovery,
} from '../constants/conditionPotion.js';
import { findConditionPotionInInventory } from '../utils/conditionPotionInventory.js';
import { getStartOfDayKST } from '../utils/timeUtils.js';
import { isValidChampionshipCondition, resolveChampionshipDisplayCondition } from '../utils/championshipConditionDisplay.js';

export type ConditionPotionUseContext =
    | { kind: 'dungeon'; tournamentType: TournamentType }
    | { kind: 'versus'; venue: ChampionshipVersusVenueKind };

export type ConditionPotionUsePayload = {
    potionType?: string;
    tournamentType?: TournamentType;
    versusVenue?: ChampionshipVersusVenueKind;
};

export type ConditionPotionApplyResult =
    | { ok: true; patch: Partial<User>; recoveryAmount: number; newCondition: number }
    | { ok: false; error: string };

function tournamentStateKey(type: TournamentType): keyof User {
    switch (type) {
        case 'neighborhood':
            return 'lastNeighborhoodTournament';
        case 'national':
            return 'lastNationalTournament';
        case 'world':
            return 'lastWorldTournament';
    }
}

export function parseConditionPotionUseContext(payload: ConditionPotionUsePayload): ConditionPotionUseContext | null {
    if (payload.versusVenue === 'pvp' || payload.versusVenue === 'pet' || payload.versusVenue === 'petpair') {
        return { kind: 'versus', venue: payload.versusVenue };
    }
    if (
        payload.tournamentType === 'neighborhood' ||
        payload.tournamentType === 'national' ||
        payload.tournamentType === 'world'
    ) {
        return { kind: 'dungeon', tournamentType: payload.tournamentType };
    }
    return null;
}

export function resolveDungeonBaseCondition(user: User, tournamentType: TournamentType): number | null {
    const snap = user.dungeonConditionSnapshot?.[tournamentType]?.condition;
    const stateKey = tournamentStateKey(tournamentType);
    const ts = user[stateKey] as { players?: { id: string; condition?: number }[] } | null | undefined;
    const playerCond = ts?.players?.find((p) => p.id === user.id)?.condition;
    const resolved = resolveChampionshipDisplayCondition({
        playerCondition: playerCond,
        snapshotCondition: snap,
        isCurrentUser: true,
    });
    return isValidChampionshipCondition(resolved) ? resolved : null;
}

export function resolveVersusBaseCondition(user: User, venue: ChampionshipVersusVenueKind): number | null {
    const snapCond = user.championshipVersusConditionSnapshot?.[venue]?.condition;
    return typeof snapCond === 'number' && snapCond >= 1 && snapCond <= 100 ? snapCond : null;
}

export function consumeConditionPotionInventory(
    inventory: InventoryItem[],
    potionType: ConditionPotionType,
): InventoryItem[] | null {
    const next = [...inventory];
    const itemIndex = findConditionPotionInInventory(next, potionType);
    if (itemIndex === -1) return null;
    const row = next[itemIndex]!;
    if (row.quantity && row.quantity > 1) {
        next[itemIndex] = { ...row, quantity: row.quantity - 1 };
    } else {
        next.splice(itemIndex, 1);
    }
    return next;
}

export function canAffordConditionPotionUse(user: User, potionType: ConditionPotionType): boolean {
    if (user.isAdmin) return true;
    return (user.gold ?? 0) >= getConditionPotionDefinition(potionType).shopGold;
}

/**
 * 회복제 1회 사용의 순수 효과(인벤·골드·컨디션 스냅샷).
 * 서버·클라 낙관적 UI가 동일 함수를 호출한다.
 */
export function buildConditionPotionUserPatch(
    user: User,
    context: ConditionPotionUseContext,
    potionType: ConditionPotionType,
    recoveryAmount: number,
): ConditionPotionApplyResult {
    const def = getConditionPotionDefinition(potionType);
    const inventory = consumeConditionPotionInventory(user.inventory ?? [], potionType);
    if (!inventory) {
        return { ok: false, error: `${def.name}이(가) 없습니다.` };
    }
    if (!canAffordConditionPotionUse(user, potionType)) {
        return { ok: false, error: `골드가 부족합니다. (필요: ${def.shopGold} 골드)` };
    }

    const todayStart = getStartOfDayKST(Date.now());
    const patch: Partial<User> = {
        inventory,
        gold: user.isAdmin ? user.gold : (user.gold ?? 0) - def.shopGold,
    };

    if (context.kind === 'versus') {
        const base = resolveVersusBaseCondition(user, context.venue);
        if (base == null) {
            return { ok: false, error: '컨디션 정보를 찾을 수 없습니다.' };
        }
        if (base >= 100) {
            return { ok: false, error: '컨디션이 이미 최대입니다.' };
        }
        const newCondition = Math.min(100, base + recoveryAmount);
        patch.championshipVersusConditionSnapshot = {
            ...(user.championshipVersusConditionSnapshot ?? {}),
            [context.venue]: { condition: newCondition, dateStartOfDayKST: todayStart },
        };
        return { ok: true, patch, recoveryAmount, newCondition };
    }

    const base = resolveDungeonBaseCondition(user, context.tournamentType);
    if (base == null) {
        return { ok: false, error: '컨디션 정보를 찾을 수 없습니다.' };
    }
    if (base >= 100) {
        return { ok: false, error: '컨디션이 이미 최대입니다.' };
    }

    const newCondition = Math.min(100, base + recoveryAmount);
    patch.dungeonConditionSnapshot = {
        ...(user.dungeonConditionSnapshot ?? {}),
        [context.tournamentType]: { condition: newCondition, dateStartOfDayKST: todayStart },
    };

    const stateKey = tournamentStateKey(context.tournamentType);
    const tournament = user[stateKey] as
        | { players?: { id: string; condition?: number; [k: string]: unknown }[]; [k: string]: unknown }
        | null
        | undefined;
    if (tournament?.players?.length) {
        patch[stateKey] = {
            ...tournament,
            players: tournament.players.map((p) =>
                p.id === user.id ? { ...p, condition: newCondition } : p,
            ),
        } as User[typeof stateKey];
    }

    return { ok: true, patch, recoveryAmount, newCondition };
}

/** 클라이언트 낙관적 패치 */
export function buildOptimisticConditionPotionPatch(
    user: User | null | undefined,
    payload: ConditionPotionUsePayload,
): Partial<User> | null {
    if (!user?.id || !isConditionPotionType(payload.potionType)) return null;
    const context = parseConditionPotionUseContext(payload);
    if (!context) return null;
    const recovery = optimisticConditionPotionRecovery(payload.potionType);
    const result = buildConditionPotionUserPatch(user, context, payload.potionType, recovery);
    return result.ok ? result.patch : null;
}

/** 서버: in-place 적용 (검증은 호출부에서 선행) */
export function applyConditionPotionPatchInPlace(user: User, patch: Partial<User>): void {
    if (patch.inventory !== undefined) user.inventory = patch.inventory;
    if (patch.gold !== undefined) user.gold = patch.gold;
    if (patch.dungeonConditionSnapshot !== undefined) {
        user.dungeonConditionSnapshot = patch.dungeonConditionSnapshot;
    }
    if (patch.championshipVersusConditionSnapshot !== undefined) {
        user.championshipVersusConditionSnapshot = patch.championshipVersusConditionSnapshot;
    }
    for (const key of ['lastNeighborhoodTournament', 'lastNationalTournament', 'lastWorldTournament'] as const) {
        if (patch[key] !== undefined) {
            (user as Record<string, unknown>)[key] = patch[key];
        }
    }
}

export const CONDITION_POTION_USE_BROADCAST_FIELDS = [
    'actionPoints',
    'gold',
    'inventory',
    'dungeonConditionSnapshot',
    'championshipVersusConditionSnapshot',
    'lastNeighborhoodTournament',
    'lastNationalTournament',
    'lastWorldTournament',
] as const;
