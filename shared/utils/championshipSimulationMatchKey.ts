import type { TournamentState } from '../types/index.js';

/** 챔피언십 PVE 던전(동네/전국/월드 단계) — 실대국(kata) 중계 전용 */
export function isChampionshipDungeonPve(tournament: TournamentState | null | undefined): boolean {
    const stage = tournament?.currentStageAttempt;
    return typeof stage === 'number' && stage >= 1 && stage <= 10;
}

function getEffectiveSimulationSeed(tournament: TournamentState): string {
    if (tournament.simulationSeed) return tournament.simulationSeed;
    const sim = tournament.currentSimulatingMatch;
    if (!sim) return '';
    const match = tournament.rounds[sim.roundIndex]?.matches[sim.matchIndex];
    return `fallback:${tournament.type}:${sim.roundIndex}:${sim.matchIndex}:${match?.id ?? 'm'}`;
}

/**
 * 시뮬 훅 매치 식별자.
 * PVE 던전은 기보 유무와 관계없이 `real:` 키를 고정해, 기보 도착 시 키 변경→중계 이중 재생을 막는다.
 */
export function getChampionshipSimulationMatchKey(
    tournament: TournamentState | null | undefined,
): string | null {
    if (!tournament?.currentSimulatingMatch) return null;
    const sim = tournament.currentSimulatingMatch;
    const match = tournament.rounds[sim.roundIndex]?.matches[sim.matchIndex];
    const realGame = match?.championshipRealGame;
    const dungeonPve = isChampionshipDungeonPve(tournament);
    if (realGame?.moves?.length || dungeonPve) {
        return `real:${tournament.type}:${sim.roundIndex}:${sim.matchIndex}:${match?.id ?? 'm'}`;
    }
    return `${sim.roundIndex}-${sim.matchIndex}-${getEffectiveSimulationSeed(tournament)}`;
}

/** 서버 실대국 스냅샷이 막 반영된 순간(prev엔 기보 없음, resolved에 기보 있음) */
export function isChampionshipRealGameFirstArrival(
    prev: TournamentState,
    resolved: TournamentState,
): boolean {
    const prevSim = prev.currentSimulatingMatch;
    const resSim = resolved.currentSimulatingMatch;
    if (!prevSim || !resSim || prevSim.roundIndex !== resSim.roundIndex || prevSim.matchIndex !== resSim.matchIndex) {
        return false;
    }
    if (!isChampionshipDungeonPve(resolved)) return false;
    const prevMatch = prev.rounds[prevSim.roundIndex]?.matches[prevSim.matchIndex];
    const resMatch = resolved.rounds[resSim.roundIndex]?.matches[resSim.matchIndex];
    const prevMoves = prevMatch?.championshipRealGame?.moves?.length ?? 0;
    const resMoves = resMatch?.championshipRealGame?.moves?.length ?? 0;
    return resMoves > 0 && prevMoves === 0;
}
