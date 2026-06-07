import type { DetailedStatRecordSlice, DetailedStatResetScope } from '../types/detailedStatReset.js';

export function formatDetailedStatWinRate(wins: number, losses: number): number {
    const total = wins + losses;
    return total > 0 ? Math.round((wins / total) * 100) : 0;
}

export function formatDetailedStatRecordLine(record: DetailedStatRecordSlice): string {
    const { wins, losses } = record;
    return `${wins.toLocaleString()}승 ${losses.toLocaleString()}패 (${formatDetailedStatWinRate(wins, losses)}%)`;
}

export function hasDetailedStatRecord(record: DetailedStatRecordSlice): boolean {
    return (record.wins ?? 0) + (record.losses ?? 0) > 0;
}

export function getAvailableDetailedStatResetScopes(
    pvp: DetailedStatRecordSlice,
    ai: DetailedStatRecordSlice,
): DetailedStatResetScope[] {
    const hasPvp = hasDetailedStatRecord(pvp);
    const hasAi = hasDetailedStatRecord(ai);
    const scopes: DetailedStatResetScope[] = [];
    if (hasPvp) scopes.push('pvp');
    if (hasAi) scopes.push('ai');
    if (hasPvp && hasAi) scopes.push('both');
    return scopes;
}

export function defaultDetailedStatResetScope(
    pvp: DetailedStatRecordSlice,
    ai: DetailedStatRecordSlice,
): DetailedStatResetScope {
    return getAvailableDetailedStatResetScopes(pvp, ai)[0] ?? 'both';
}

export const DETAILED_STAT_RESET_SCOPE_LABELS: Record<DetailedStatResetScope, string> = {
    pvp: 'PVP 전적만',
    ai: 'AI 전적만',
    both: 'PVP + AI 전적',
};
