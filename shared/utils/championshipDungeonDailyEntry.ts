import type { TournamentType, User } from '../types/index.js';
import { getStartOfDayKST, isSameDayKST } from './timeUtils.js';
import { isChampionshipDungeonTournamentFromToday } from './championshipDungeonDailyReset.js';

export const CHAMPIONSHIP_DUNGEON_DAILY_ENTRY_MAX = 1;

export type ChampionshipDungeonDailyEntryRecord = {
    dateStartOfDayKST: number;
    /** 오늘 소비한 입장 횟수 (기본 1회 + 광고 보너스 1회 = 최대 2) */
    entriesUsed: number;
    /** 오늘 광고 시청으로 추가 입장권을 받았는지 */
    adBonusGranted: boolean;
};

export type ChampionshipDungeonDailyEntryState = {
    remaining: number;
    max: number;
    entriesUsed: number;
    adBonusGranted: boolean;
    canWatchAd: boolean;
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

function normalizeRecord(
    raw: ChampionshipDungeonDailyEntryRecord | undefined,
    now: number,
): ChampionshipDungeonDailyEntryRecord | null {
    if (!raw || typeof raw.dateStartOfDayKST !== 'number') return null;
    if (!isSameDayKST(raw.dateStartOfDayKST, now)) return null;
    const entriesUsed = Math.max(0, Math.min(2, Number(raw.entriesUsed) || 0));
    return {
        dateStartOfDayKST: raw.dateStartOfDayKST,
        entriesUsed,
        adBonusGranted: Boolean(raw.adBonusGranted),
    };
}

/** 레거시 유저: 신규 필드 없을 때 오늘 입장 소비 여부 추정 */
function inferLegacyEntriesUsedToday(user: User, type: TournamentType, now: number): number {
    const snap = user.dungeonConditionSnapshot?.[type];
    if (snap && isSameDayKST(snap.dateStartOfDayKST, now)) {
        return 1;
    }

    const playedRaw = (user as Record<string, unknown>)[playedDateKey(type)] as number | undefined;
    if (typeof playedRaw === 'number' && playedRaw > 0 && isSameDayKST(playedRaw, now)) {
        return 1;
    }

    const tournament = (user as Record<string, unknown>)[tournamentStateKey(type)] as
        | { status?: string; currentStageAttempt?: number; lastPlayedDate?: number }
        | null
        | undefined;
    const snapDay = user.dungeonConditionSnapshot?.[type]?.dateStartOfDayKST;
    if (
        tournament?.currentStageAttempt &&
        tournament.currentStageAttempt >= 1 &&
        isChampionshipDungeonTournamentFromToday(tournament as any, snapDay, now)
    ) {
        return 1;
    }

    return 0;
}

function resolveRecord(user: User, type: TournamentType, now: number): ChampionshipDungeonDailyEntryRecord {
    const today = getStartOfDayKST(now);
    const stored = normalizeRecord(user.championshipDungeonDailyEntry?.[type], now);
    if (stored) return stored;

    const legacyUsed = inferLegacyEntriesUsedToday(user, type, now);
    return {
        dateStartOfDayKST: today,
        entriesUsed: legacyUsed,
        adBonusGranted: false,
    };
}

function maxEntriesForRecord(record: ChampionshipDungeonDailyEntryRecord): number {
    return 1 + (record.adBonusGranted ? 1 : 0);
}

export function getChampionshipDungeonDailyEntryState(
    user: User,
    type: TournamentType,
    now: number = Date.now(),
): ChampionshipDungeonDailyEntryState {
    const record = resolveRecord(user, type, now);
    const maxTotal = maxEntriesForRecord(record);
    const remaining = Math.max(0, maxTotal - record.entriesUsed);
    const canWatchAd = remaining === 0 && !record.adBonusGranted && record.entriesUsed >= 1;

    return {
        remaining: Math.min(CHAMPIONSHIP_DUNGEON_DAILY_ENTRY_MAX, remaining),
        max: CHAMPIONSHIP_DUNGEON_DAILY_ENTRY_MAX,
        entriesUsed: record.entriesUsed,
        adBonusGranted: record.adBonusGranted,
        canWatchAd,
    };
}

function writeRecord(user: User, type: TournamentType, record: ChampionshipDungeonDailyEntryRecord): void {
    if (!user.championshipDungeonDailyEntry) {
        user.championshipDungeonDailyEntry = {};
    }
    user.championshipDungeonDailyEntry[type] = record;
}

/** 새 던전 입장 시 호출 (재개·이어하기는 호출하지 않음) */
export function consumeChampionshipDungeonEntry(
    user: User,
    type: TournamentType,
    now: number = Date.now(),
): ChampionshipDungeonDailyEntryRecord {
    const record = resolveRecord(user, type, now);
    const maxTotal = maxEntriesForRecord(record);
    if (record.entriesUsed >= maxTotal) {
        throw new Error('CHAMPIONSHIP_DUNGEON_NO_ENTRIES');
    }
    const next: ChampionshipDungeonDailyEntryRecord = {
        ...record,
        dateStartOfDayKST: getStartOfDayKST(now),
        entriesUsed: record.entriesUsed + 1,
    };
    writeRecord(user, type, next);
    return next;
}

/** 광고 시청(또는 광고 제거 유저 즉시) 후 추가 입장권 부여 */
export function grantChampionshipDungeonAdBonusEntry(
    user: User,
    type: TournamentType,
    now: number = Date.now(),
): { ok: true; record: ChampionshipDungeonDailyEntryRecord } | { ok: false; error: string } {
    const record = resolveRecord(user, type, now);
    const state = getChampionshipDungeonDailyEntryState(user, type, now);
    if (!state.canWatchAd) {
        return { ok: false, error: '추가 입장을 받을 수 없습니다.' };
    }
    const next: ChampionshipDungeonDailyEntryRecord = {
        dateStartOfDayKST: getStartOfDayKST(now),
        entriesUsed: record.entriesUsed,
        adBonusGranted: true,
    };
    writeRecord(user, type, next);
    return { ok: true, record: next };
}

export function clearChampionshipDungeonDailyEntryRecords(user: User): void {
    user.championshipDungeonDailyEntry = undefined;
}
