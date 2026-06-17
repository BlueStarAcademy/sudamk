import type { ChampionshipVersusVenueKind, TournamentState, TournamentType, User } from '../types/index.js';

export function isValidChampionshipCondition(c: unknown): c is number {
    return typeof c === 'number' && c >= 1 && c <= 100;
}

/** 컨디션 회복(+) 버튼 표시 — 사용 가능 여부(`canUseConditionPotion`)와 분리 */
export function shouldShowChampionshipConditionRecoveryButton(params: {
    condition: number;
    tournamentStatus?: string | null;
}): boolean {
    const { condition, tournamentStatus } = params;
    if (tournamentStatus === 'complete' || tournamentStatus === 'eliminated') {
        return false;
    }
    return isValidChampionshipCondition(condition) && condition < 100;
}

type ConditionSnapshotEntry = { condition: number; dateStartOfDayKST: number };

/** 같은 입장일 스냅샷은 낮은 값(낡은 WS·SAVE)으로 되돌리지 않는다 — 회복제 직후 UI 회귀 방지 */
function mergeConditionSnapshotEntry(
    baseEntry: ConditionSnapshotEntry | undefined,
    patchEntry: ConditionSnapshotEntry | undefined,
): ConditionSnapshotEntry | undefined {
    if (!patchEntry) return baseEntry;
    if (!baseEntry) return patchEntry;
    if (
        baseEntry.dateStartOfDayKST === patchEntry.dateStartOfDayKST &&
        isValidChampionshipCondition(baseEntry.condition) &&
        isValidChampionshipCondition(patchEntry.condition) &&
        patchEntry.condition < baseEntry.condition
    ) {
        return baseEntry;
    }
    return patchEntry;
}

export function mergeDungeonConditionSnapshotRecords(
    base: User['dungeonConditionSnapshot'] | undefined,
    patch: User['dungeonConditionSnapshot'] | undefined,
): User['dungeonConditionSnapshot'] {
    if (!patch) return base;
    if (!base) return { ...patch };
    const merged = { ...base };
    for (const type of ['neighborhood', 'national', 'world'] as const) {
        const next = mergeConditionSnapshotEntry(base[type], patch[type]);
        if (next) merged[type] = next;
        else delete merged[type];
    }
    return merged;
}

export function mergeChampionshipVersusConditionSnapshotRecords(
    base: User['championshipVersusConditionSnapshot'] | undefined,
    patch: User['championshipVersusConditionSnapshot'] | undefined,
): User['championshipVersusConditionSnapshot'] {
    if (!patch) return base;
    if (!base) return { ...patch };
    const merged = { ...base };
    for (const venue of ['pvp', 'pet', 'petpair'] as const) {
        const next = mergeConditionSnapshotEntry(base[venue], patch[venue]);
        if (next) merged[venue] = next;
        else delete merged[venue];
    }
    return merged;
}

/** 토너먼트 표시·시뮬 소스에 당일 던전 스냅샷 컨디션을 반영한다. */
export function applyUserConditionSnapshotToTournament(
    tournament: TournamentState,
    user: User | null | undefined,
): TournamentState {
    if (!user?.id || !tournament?.type || !tournament.players?.length) return tournament;
    const snap = user.dungeonConditionSnapshot?.[tournament.type];
    if (!isValidChampionshipCondition(snap?.condition)) return tournament;
    return {
        ...tournament,
        players: tournament.players.map((p) =>
            p.id === user.id ? { ...p, condition: snap.condition } : p,
        ),
    };
}

/**
 * 챔피언십 UI·회복제 모달용 컨디션 표시.
 * 현재 유저는 당일 `dungeonConditionSnapshot`이 `players[].condition`보다 우선한다.
 * (회복제 직후 로컬 시뮬/WS가 낡은 player.condition을 실어 UI가 되돌아가는 버그 방지)
 */
export function resolveChampionshipDisplayCondition(params: {
    playerCondition: number | undefined | null;
    snapshotCondition: number | undefined | null;
    isCurrentUser: boolean;
}): number {
    const { playerCondition, snapshotCondition, isCurrentUser } = params;

    if (isCurrentUser && isValidChampionshipCondition(snapshotCondition)) {
        return snapshotCondition;
    }

    if (isValidChampionshipCondition(playerCondition)) {
        return playerCondition;
    }

    if (isValidChampionshipCondition(snapshotCondition)) {
        return snapshotCondition;
    }

    if (playerCondition !== undefined && playerCondition !== null) {
        return playerCondition;
    }

    return 1000;
}

/** SAVE 등 클라이언트 토너먼트 스냅샷 저장 전 유저 컨디션을 서버 스냅샷과 맞춘다. */
export function syncTournamentUserPlayerConditionFromSnapshot(
    tournament: TournamentState,
    user: User,
    tournamentType: TournamentType,
): void {
    const snap = user.dungeonConditionSnapshot?.[tournamentType];
    if (!isValidChampionshipCondition(snap?.condition)) return;
    const player = tournament.players?.find((p) => p.id === user.id);
    if (player) player.condition = snap.condition;
}

/** USER_UPDATE 병합 후 토너먼트 플레이어 컨디션을 당일 스냅샷과 맞춘다. */
export function syncDungeonConditionSnapshotToTournamentPlayers(user: User): void {
    if (!user.id) return;

    const entries: Array<{ type: TournamentType; key: keyof User }> = [
        { type: 'neighborhood', key: 'lastNeighborhoodTournament' },
        { type: 'national', key: 'lastNationalTournament' },
        { type: 'world', key: 'lastWorldTournament' },
    ];

    for (const { type, key } of entries) {
        const snap = user.dungeonConditionSnapshot?.[type];
        if (!isValidChampionshipCondition(snap?.condition)) continue;

        const tournament = user[key] as TournamentState | null | undefined;
        if (!tournament?.players?.length) continue;

        const player = tournament.players.find((p) => p.id === user.id);
        if (player) {
            player.condition = snap.condition;
        }
    }
}
