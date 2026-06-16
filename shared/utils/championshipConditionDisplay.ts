import type { TournamentState, TournamentType, User } from '../types/index.js';

export function isValidChampionshipCondition(c: unknown): c is number {
    return typeof c === 'number' && c >= 1 && c <= 100;
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
