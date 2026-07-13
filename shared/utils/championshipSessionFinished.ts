import type { TournamentState } from '../types/index.js';

/**
 * 브라켓이 실제로 비어 있지 않고 모든 매치가 끝났는지.
 * `[].every(...)` 공집합 함정(빈 rounds/matches → true)을 피한다.
 */
export function areAllChampionshipMatchesFinished(tournament: TournamentState): boolean {
    const rounds = Array.isArray(tournament.rounds) ? tournament.rounds : [];
    if (rounds.length === 0) return false;
    return rounds.every(
        (r) =>
            Array.isArray(r.matches) &&
            r.matches.length > 0 &&
            r.matches.every((m) => m.isFinished),
    );
}

/**
 * 챔피언십 던전 세션이 UI상 '오늘의 경기 종료' / 보상받기 가능한지.
 * bracket_ready·round_complete·빈 bracket 등에서 오판하지 않는다.
 */
export function isChampionshipSessionFinished(tournament: TournamentState): boolean {
    if (tournament.status === 'complete' || tournament.status === 'eliminated') {
        return true;
    }
    if (
        tournament.status === 'bracket_ready' ||
        tournament.status === 'round_in_progress' ||
        tournament.status === 'round_complete'
    ) {
        return false;
    }
    const rounds = Array.isArray(tournament.rounds) ? tournament.rounds : [];
    const hasUserMatches = rounds.some(
        (r) => Array.isArray(r.matches) && r.matches.some((m) => m.isUserMatch),
    );
    if (!hasUserMatches) return false;
    return areAllChampionshipMatchesFinished(tournament);
}
