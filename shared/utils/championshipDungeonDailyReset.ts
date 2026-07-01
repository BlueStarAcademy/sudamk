import type { TournamentState, TournamentType, User } from '../types/index.js';
import { getStartOfDayKST, isSameDayKST } from './timeUtils.js';
import { clearChampionshipDungeonDailyEntryRecords } from './championshipDungeonDailyEntry.js';

export const CHAMPIONSHIP_DUNGEON_TYPES = ['neighborhood', 'national', 'world'] as const satisfies readonly TournamentType[];

const tournamentStateKey = (type: TournamentType): keyof User => {
    switch (type) {
        case 'neighborhood':
            return 'lastNeighborhoodTournament';
        case 'national':
            return 'lastNationalTournament';
        case 'world':
            return 'lastWorldTournament';
        default:
            return 'lastNeighborhoodTournament';
    }
};

const playedDateKey = (type: TournamentType): keyof User => {
    switch (type) {
        case 'neighborhood':
            return 'lastNeighborhoodPlayedDate';
        case 'national':
            return 'lastNationalPlayedDate';
        case 'world':
            return 'lastWorldPlayedDate';
        default:
            return 'lastNeighborhoodPlayedDate';
    }
};

export const isChampionshipDungeonTournamentState = (
    tournament: TournamentState | null | undefined,
): tournament is TournamentState =>
    !!tournament?.currentStageAttempt && tournament.currentStageAttempt >= 1;

export const resolveChampionshipDungeonRunDayKST = (
    user: User,
    type: TournamentType,
    tournament: TournamentState | null | undefined,
): number | undefined => {
    const snapDay = user.dungeonConditionSnapshot?.[type]?.dateStartOfDayKST;
    if (typeof snapDay === 'number' && snapDay > 0) return snapDay;

    if (tournament?.lastPlayedDate && tournament.lastPlayedDate > 0) {
        return getStartOfDayKST(tournament.lastPlayedDate);
    }

    const playedRaw = (user as Record<string, unknown>)[playedDateKey(type)] as number | undefined;
    if (typeof playedRaw === 'number' && playedRaw > 0) {
        return getStartOfDayKST(playedRaw);
    }

    return undefined;
};

/** 당일(KST)이 아닌 챔피언십 던전 런 — 0시 지나면 무효 */
export const isChampionshipDungeonRunStale = (
    user: User,
    type: TournamentType,
    tournament: TournamentState | null | undefined,
    now: number = Date.now(),
): boolean => {
    if (!isChampionshipDungeonTournamentState(tournament)) return false;
    if (tournament.type !== type) return false;

    const runDay = resolveChampionshipDungeonRunDayKST(user, type, tournament);
    if (!runDay) {
        if (tournament.lastPlayedDate && tournament.lastPlayedDate > 0) {
            return !isSameDayKST(tournament.lastPlayedDate, now);
        }
        return false;
    }

    return !isSameDayKST(runDay, now);
};

export const isChampionshipDungeonTournamentFromToday = (
    tournament: TournamentState | null | undefined,
    snapshotDateStartOfDayKST: number | undefined,
    now: number = Date.now(),
): boolean => {
    if (!isChampionshipDungeonTournamentState(tournament)) return false;
    if (typeof snapshotDateStartOfDayKST === 'number' && snapshotDateStartOfDayKST > 0) {
        return isSameDayKST(snapshotDateStartOfDayKST, now);
    }
    if (tournament.lastPlayedDate && tournament.lastPlayedDate > 0) {
        return isSameDayKST(tournament.lastPlayedDate, now);
    }
    return false;
};

export type ChampionshipDungeonDailyResetResult = {
    modified: boolean;
    clearedTypes: TournamentType[];
};

const clearDungeonConditionSnapshotForType = (user: User, type: TournamentType): boolean => {
    if (!user.dungeonConditionSnapshot?.[type]) return false;
    delete user.dungeonConditionSnapshot[type];
    if (Object.keys(user.dungeonConditionSnapshot).length === 0) {
        user.dungeonConditionSnapshot = undefined;
    }
    return true;
};

/** 진행 중·미수령 완료 등 당일이 아닌 던전 런을 유저 레코드에서 제거 */
export const invalidateStaleChampionshipDungeonRunsForUser = (
    user: User,
    now: number = Date.now(),
): ChampionshipDungeonDailyResetResult => {
    const clearedTypes: TournamentType[] = [];
    let modified = false;

    for (const type of CHAMPIONSHIP_DUNGEON_TYPES) {
        const stateKey = tournamentStateKey(type);
        const tournament = (user as Record<string, unknown>)[stateKey] as TournamentState | null | undefined;

        if (!isChampionshipDungeonTournamentState(tournament)) continue;
        if (!isChampionshipDungeonRunStale(user, type, tournament, now)) continue;

        (user as Record<string, unknown>)[stateKey] = null;
        modified = true;
        clearedTypes.push(type);

        if (clearDungeonConditionSnapshotForType(user, type)) {
            modified = true;
        }

        const playedKey = playedDateKey(type);
        if ((user as Record<string, unknown>)[playedKey] != null) {
            (user as Record<string, unknown>)[playedKey] = undefined;
            modified = true;
        }

        const rewardKey = `${type}RewardClaimed` as keyof User;
        if ((user as Record<string, unknown>)[rewardKey] != null) {
            (user as Record<string, unknown>)[rewardKey] = undefined;
            modified = true;
        }
    }

    return { modified, clearedTypes };
};

/** 매일 0시: 던전 일일 입장·진행 스냅샷 전부 초기화 (last*Tournament null은 호출 측에서 처리 가능) */
export const clearChampionshipDungeonDailyEntryFields = (user: User): void => {
    clearChampionshipDungeonDailyEntryRecords(user);
    user.dungeonConditionSnapshot = undefined;

    if (user.dungeonProgress) {
        for (const type of CHAMPIONSHIP_DUNGEON_TYPES) {
            const progress = user.dungeonProgress[type];
            if (progress) {
                progress.dailyStageAttempts = {};
            }
        }
    }

    for (const type of CHAMPIONSHIP_DUNGEON_TYPES) {
        const playedKey = playedDateKey(type);
        (user as Record<string, unknown>)[playedKey] = undefined;
        const rewardKey = `${type}RewardClaimed` as keyof User;
        (user as Record<string, unknown>)[rewardKey] = undefined;
    }
};

export const clearStaleVolatileChampionshipDungeon = (
    volatileTournaments: Record<string, TournamentState> | undefined,
    userId: string,
    user: User,
    now: number = Date.now(),
): boolean => {
    if (!volatileTournaments?.[userId]) return false;
    const active = volatileTournaments[userId];
    if (!isChampionshipDungeonRunStale(user, active.type, active, now)) return false;
    delete volatileTournaments[userId];
    return true;
};

const CHAMPIONSHIP_SIMULATION_STORAGE_PREFIX = 'tournamentSimulation_';

/** 브라우저 sessionStorage에 남은 던전·시뮬레이션 캐시 제거 (0시 리셋·stale 복원 방지) */
export const clearChampionshipDungeonClientSessionStorage = (userId?: string): void => {
    if (typeof sessionStorage === 'undefined') return;
    for (const type of CHAMPIONSHIP_DUNGEON_TYPES) {
        sessionStorage.removeItem(`pendingDungeon_${type}`);
        if (userId) {
            sessionStorage.removeItem(`${CHAMPIONSHIP_SIMULATION_STORAGE_PREFIX}${userId}_${type}`);
        }
    }
};
