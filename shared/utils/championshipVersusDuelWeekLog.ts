import type { ChampionshipVersusDuelWeekLogEntry, ChampionshipVersusVenueKind, User } from '../types/entities.js';
import { getStartOfDayKST } from './timeUtils.js';

/** KST 달력 기준 오늘 포함 7일치(오늘 + 이전 6일 자정 구간) */
export const CHAMPIONSHIP_VERSUS_DUEL_LOG_RETENTION_KST_DAYS = 7;

export function getVersusDuelLogKSTWindowStartMs(nowMs: number = Date.now()): number {
    return getStartOfDayKST(nowMs) - (CHAMPIONSHIP_VERSUS_DUEL_LOG_RETENTION_KST_DAYS - 1) * 86400000;
}

export function pruneChampionshipVersusDuelWeekLog(
    entries: ChampionshipVersusDuelWeekLogEntry[] | undefined,
    nowMs: number,
): ChampionshipVersusDuelWeekLogEntry[] {
    const minT = getVersusDuelLogKSTWindowStartMs(nowMs);
    const base = Array.isArray(entries)
        ? entries.filter((e) => e && typeof e.occurredAt === 'number' && Number.isFinite(e.occurredAt) && e.occurredAt >= minT)
        : [];
    base.sort((a, b) => b.occurredAt - a.occurredAt);
    return base;
}

function newVersusDuelLogId(nowMs: number): string {
    const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    return `${nowMs}-${Math.random().toString(36).slice(2, 11)}`;
}

export function appendChampionshipVersusDuelWeekLogForUser(
    user: User,
    entry: Omit<ChampionshipVersusDuelWeekLogEntry, 'id'>,
    nowMs: number = Date.now(),
): void {
    const id = newVersusDuelLogId(nowMs);
    const full: ChampionshipVersusDuelWeekLogEntry = { ...entry, id };
    const prev = pruneChampionshipVersusDuelWeekLog(user.championshipVersusDuelWeekLog, nowMs);
    user.championshipVersusDuelWeekLog = [full, ...prev].slice(0, 200);
}

export function formatVersusDuelLogAgeLabelKo(nowMs: number, occurredAt: number): string {
    const d0 = getStartOfDayKST(nowMs);
    const d1 = getStartOfDayKST(occurredAt);
    const days = Math.round((d0 - d1) / 86400000);
    if (days <= 0) return '오늘';
    return `${days}일 전`;
}

export function championshipVersusDuelVenueModeLabelKo(venue: ChampionshipVersusVenueKind): string {
    if (venue === 'pvp') return 'PVP 챔피언십';
    if (venue === 'pet') return '펫 챔피언십';
    return '페어 챔피언십';
}
