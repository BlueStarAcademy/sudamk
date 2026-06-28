import type { Match, TournamentState } from '../types/index.js';

/** `round_in_progress`인데 `currentSimulatingMatch`가 비어 있을 때 표시·재생할 유저 실대국 매치 */
export function findActiveChampionshipUserMatch(
    tournament: TournamentState | null | undefined,
    userId?: string,
): Match | null {
    if (!tournament || tournament.status !== 'round_in_progress') return null;
    for (const round of tournament.rounds ?? []) {
        for (const match of round.matches ?? []) {
            if (!match?.isUserMatch || match.isFinished) continue;
            if (!match.championshipRealGame?.moves?.length) continue;
            if (userId && !match.players?.some((p) => p?.id === userId)) continue;
            return match;
        }
    }
    return null;
}

/** 서버/저장 스냅샷에 시뮬 포인터가 빠진 경우 클라이언트 재생·보드 표시 복구 */
export function repairTournamentSimulatingPointer(
    tournament: TournamentState,
    userId?: string,
): TournamentState {
    if (tournament.status !== 'round_in_progress' || tournament.currentSimulatingMatch) {
        return tournament;
    }
    const active = findActiveChampionshipUserMatch(tournament, userId);
    if (!active) return tournament;
    for (let roundIndex = 0; roundIndex < tournament.rounds.length; roundIndex++) {
        const round = tournament.rounds[roundIndex];
        if (!round?.matches) continue;
        for (let matchIndex = 0; matchIndex < round.matches.length; matchIndex++) {
            const match = round.matches[matchIndex];
            if (match?.id === active.id) {
                return { ...tournament, currentSimulatingMatch: { roundIndex, matchIndex } };
            }
        }
    }
    return tournament;
}

/**
 * START_TOURNAMENT_MATCH 직전: 멈춘 round_in_progress를 풀고, 이미 기보가 붙은 동일 경기면 동기화만 한다.
 */
export function prepareTournamentStateForMatchStart(
    tournament: TournamentState,
    userId: string,
    nextUserMatchId: string,
): { tournament: TournamentState; shouldSyncOnly: boolean } {
    const { tournament: recovered } = recoverStuckChampionshipRoundInProgress(tournament, userId);
    let state = recovered;

    if (
        state.status === 'round_in_progress' &&
        state.championshipMatchGeneratingMatchId === nextUserMatchId
    ) {
        return { tournament: state, shouldSyncOnly: true };
    }

    if (state.status !== 'round_in_progress') {
        return { tournament: state, shouldSyncOnly: false };
    }

    const sim = state.currentSimulatingMatch;
    const active = sim ? state.rounds[sim.roundIndex]?.matches[sim.matchIndex] : null;
    if (
        active &&
        active.id === nextUserMatchId &&
        !active.isFinished &&
        (active.championshipRealGame?.moves?.length ?? 0) > 0
    ) {
        return { tournament: state, shouldSyncOnly: true };
    }

    return {
        tournament: {
            ...state,
            currentSimulatingMatch: null,
            status: 'bracket_ready',
            timeElapsed: 0,
            nextRoundStartTime: null,
        },
        shouldSyncOnly: false,
    };
}

/**
 * `round_in_progress`인데 기보 생성·COMPLETE 처리가 끊긴 스냅샷을 bracket_ready/complete 등으로 복구한다.
 */
export function recoverStuckChampionshipRoundInProgress(
    tournament: TournamentState,
    userId?: string,
): { tournament: TournamentState; recovered: boolean } {
    if (tournament.status !== 'round_in_progress') {
        return { tournament, recovered: false };
    }

    const next: TournamentState = { ...tournament };
    let recovered = false;

    const sim = next.currentSimulatingMatch;
    if (sim) {
        const match = next.rounds[sim.roundIndex]?.matches[sim.matchIndex];
        if (match?.isFinished) {
            next.currentSimulatingMatch = null;
            recovered = true;
        } else if (match && !match.championshipRealGame?.moves?.length) {
            if (next.championshipMatchGeneratingMatchId === match.id) {
                return { tournament: next, recovered: false };
            }
            next.currentSimulatingMatch = null;
            next.status = 'bracket_ready';
            next.timeElapsed = 0;
            next.nextRoundStartTime = null;
            return { tournament: next, recovered: true };
        }
    }

    const userMatches = next.rounds.flatMap((r) => r.matches).filter((m) => m?.isUserMatch);
    const scopedUserMatches = userId
        ? userMatches.filter((m) => m.players?.some((p) => p?.id === userId))
        : userMatches;
    const matchesForProgress = scopedUserMatches.length > 0 ? scopedUserMatches : userMatches;

    if (matchesForProgress.length > 0 && matchesForProgress.every((m) => m.isFinished)) {
        next.currentSimulatingMatch = null;
        next.timeElapsed = 0;
        next.nextRoundStartTime = null;
        if (next.status !== 'eliminated') {
            next.status = 'complete';
        }
        return { tournament: next, recovered: true };
    }

    const hasActiveRealMatch = !!findActiveChampionshipUserMatch(next, userId);
    if (!hasActiveRealMatch) {
        const hasUnfinishedUserMatch = matchesForProgress.some((m) => !m.isFinished);
        if (hasUnfinishedUserMatch && !next.championshipMatchGeneratingMatchId) {
            next.currentSimulatingMatch = null;
            next.status = 'bracket_ready';
            next.timeElapsed = 0;
            next.nextRoundStartTime = null;
            recovered = true;
        }
    }

    return { tournament: next, recovered };
}

/** 같은 슬롯의 진행 중 매치인지 (실대국 기보 유실 복구 판별용) */
export function isSameActiveSimulatingMatchSlot(prev: TournamentState, resolved: TournamentState): boolean {
    const a = prev.currentSimulatingMatch;
    const b = resolved.currentSimulatingMatch;
    if (!a || !b) return false;
    if (
        prev.status !== 'round_in_progress' ||
        resolved.status !== 'round_in_progress' ||
        a.roundIndex !== b.roundIndex ||
        a.matchIndex !== b.matchIndex
    ) {
        return false;
    }
    const prevMatch = prev.rounds[a.roundIndex]?.matches[a.matchIndex];
    const resolvedMatch = resolved.rounds[b.roundIndex]?.matches[b.matchIndex];
    const prevId = prevMatch?.id;
    const resolvedId = resolvedMatch?.id;
    if (prevId != null && resolvedId != null && prevId !== resolvedId) {
        return false;
    }
    return true;
}

/**
 * 서버/WS 스냅샷에 `championshipRealGame.moves`가 빠지거나 줄어든 경우,
 * 클라이언트에 남아 있는 완전한 기보를 유지한다. (실대국 → 50초 시뮬 추락 방지)
 */
export function mergeResolvedRoundsPreserveChampionshipPlayback(
    prev: TournamentState,
    resolved: TournamentState,
): TournamentState['rounds'] {
    if (!isSameActiveSimulatingMatchSlot(prev, resolved)) {
        return resolved.rounds;
    }
    const sim = prev.currentSimulatingMatch!;
    const { roundIndex: ri, matchIndex: mi } = sim;
    const prevMatch = prev.rounds[ri]?.matches[mi];
    const resolvedMatch = resolved.rounds[ri]?.matches[mi];
    const prevGame = prevMatch?.championshipRealGame;
    const resolvedGame = resolvedMatch?.championshipRealGame;

    if (resolvedMatch?.isFinished && resolvedGame?.winnerId) {
        return resolved.rounds;
    }

    if (prevGame?.moves?.length && (!resolvedGame?.moves?.length || resolvedGame.moves.length < prevGame.moves.length)) {
        return resolved.rounds.map((round, rIdx) =>
            rIdx !== ri
                ? round
                : {
                      ...round,
                      matches: round.matches.map((m: Match, mIdx) =>
                          mIdx !== mi || !m ? m : { ...m, championshipRealGame: prevGame },
                      ),
                  },
        );
    }

    if (
        !prevGame?.moves?.length ||
        !resolvedGame?.moves?.length ||
        prevGame.moves.length !== resolvedGame.moves.length
    ) {
        return resolved.rounds;
    }

    const prevPly = prevGame.currentPly || 0;
    const resPly = resolvedGame.currentPly || 0;
    const prevT = prev.timeElapsed || 0;
    const resT = resolved.timeElapsed || 0;
    if (!(prevPly > resPly || (prevT > resT && prevPly >= resPly))) {
        return resolved.rounds;
    }

    return resolved.rounds.map((round, rIdx) => ({
        ...round,
        matches: round.matches.map((match: Match, mIdx) => {
            if (rIdx !== ri || mIdx !== mi || !match) return match;
            return {
                ...match,
                championshipRealGame: {
                    ...resolvedGame,
                    boardState: prevGame.boardState,
                    currentPly: prevGame.currentPly,
                    lastMove: prevGame.lastMove,
                    status: prevGame.status,
                    timeMetrics: prevGame.timeMetrics ?? resolvedGame.timeMetrics,
                    scoringAnalysis: prevGame.scoringAnalysis ?? resolvedGame.scoringAnalysis,
                },
            };
        }),
    }));
}

/**
 * applyUserUpdate 병합: 패치가 진행 중인 동일 슬롯에서 기보를 잃었으면 베이스 기보를 복구한다.
 */
export function mergeChampionshipTournamentPreserveLostRealGame(
    base: TournamentState | null | undefined,
    patch: TournamentState | null | undefined,
): TournamentState | null {
    if (patch === undefined) return base ?? null;
    if (patch === null) return null;
    if (!base) return patch;
    if (!isSameActiveSimulatingMatchSlot(base, patch)) {
        return patch;
    }
    const sim = patch.currentSimulatingMatch!;
    const { roundIndex: ri, matchIndex: mi } = sim;
    const baseMatch = base.rounds[ri]?.matches[mi];
    const patchMatch = patch.rounds[ri]?.matches[mi];
    const baseGame = baseMatch?.championshipRealGame;
    const patchGame = patchMatch?.championshipRealGame;
    if (baseGame?.moves?.length && (!patchGame?.moves?.length || patchGame.moves.length < baseGame.moves.length)) {
        return {
            ...patch,
            rounds: patch.rounds.map((round, rIdx) =>
                rIdx !== ri
                    ? round
                    : {
                          ...round,
                          matches: round.matches.map((m: Match, mIdx) =>
                              mIdx !== mi || !m ? m : { ...m, championshipRealGame: baseGame },
                          ),
                      },
            ),
        };
    }
    return patch;
}
