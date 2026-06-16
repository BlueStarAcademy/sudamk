import type { ChampionshipVersusVenueKind, TournamentType, User } from '../types/index.js';
import { CONDITION_POTION_SHOP_GOLD_BY_TYPE } from '../constants/conditionPotionShop.js';
import { getStartOfDayKST } from './timeUtils.js';

type PotionType = 'small' | 'medium' | 'large';

const POTION_META: Record<PotionType, { name: string; minRecovery: number; maxRecovery: number }> = {
    small: { name: '컨디션회복제(소)', minRecovery: 5, maxRecovery: 15 },
    medium: { name: '컨디션회복제(중)', minRecovery: 15, maxRecovery: 25 },
    large: { name: '컨디션회복제(대)', minRecovery: 25, maxRecovery: 35 },
};

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

function resolveBaseCondition(user: User, tournamentType: TournamentType): number | null {
    const snap = user.dungeonConditionSnapshot?.[tournamentType]?.condition;
    if (typeof snap === 'number' && snap >= 1 && snap <= 100) return snap;
    const ts = user[tournamentStateKey(tournamentType)] as { players?: { id: string; condition?: number }[] } | null;
    const playerCond = ts?.players?.find((p) => p.id === user.id)?.condition;
    if (typeof playerCond === 'number' && playerCond >= 1 && playerCond <= 100) return playerCond;
    return null;
}

/** HTTP 응답 전 경기장·모달 UI 즉시 반영용(서버 확정값은 응답으로 교체) */
export function buildOptimisticUseConditionPotionUserPatch(
    user: User | null | undefined,
    payload: {
        potionType?: string;
        tournamentType?: TournamentType;
        versusVenue?: ChampionshipVersusVenueKind;
    },
): Partial<User> | null {
    if (!user?.id) return null;
    const potionType = payload.potionType;
    if (potionType !== 'small' && potionType !== 'medium' && potionType !== 'large') return null;

    const meta = POTION_META[potionType];
    const inventory = [...(user.inventory || [])];
    const itemIndex = inventory.findIndex((item) => item.name === meta.name && item.type === 'consumable');
    if (itemIndex === -1) return null;

    const row = inventory[itemIndex]!;
    if (row.quantity && row.quantity > 1) {
        inventory[itemIndex] = { ...row, quantity: row.quantity - 1 };
    } else {
        inventory.splice(itemIndex, 1);
    }

    const price = CONDITION_POTION_SHOP_GOLD_BY_TYPE[potionType];
    if (!user.isAdmin && (user.gold ?? 0) < price) return null;

    const recovery = Math.floor((meta.minRecovery + meta.maxRecovery) / 2);
    const todayStart = getStartOfDayKST(Date.now());
    const patch: Partial<User> = {
        inventory,
        gold: user.isAdmin ? user.gold : (user.gold ?? 0) - price,
    };

    if (payload.versusVenue === 'pvp' || payload.versusVenue === 'pet' || payload.versusVenue === 'petpair') {
        const venue = payload.versusVenue;
        const snapCond = user.championshipVersusConditionSnapshot?.[venue]?.condition;
        const base =
            typeof snapCond === 'number' && snapCond >= 1 && snapCond <= 100 ? snapCond : null;
        if (base == null || base >= 100) return null;
        const newCondition = Math.min(100, base + recovery);
        patch.championshipVersusConditionSnapshot = {
            ...(user.championshipVersusConditionSnapshot ?? {}),
            [venue]: { condition: newCondition, dateStartOfDayKST: todayStart },
        };
        return patch;
    }

    if (!payload.tournamentType) return null;
    const base = resolveBaseCondition(user, payload.tournamentType);
    if (base == null || base >= 100) return null;

    const newCondition = Math.min(100, base + recovery);
    patch.dungeonConditionSnapshot = {
        ...(user.dungeonConditionSnapshot ?? {}),
        [payload.tournamentType]: { condition: newCondition, dateStartOfDayKST: todayStart },
    };

    const stateKey = tournamentStateKey(payload.tournamentType);
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

    return patch;
}
