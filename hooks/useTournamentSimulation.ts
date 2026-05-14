import { useEffect, useRef, useState } from 'react';
import { BoardState, Player, TournamentState, User } from '../types';
import { useAppContext } from './useAppContext';
import { runClientSimulationStep, SeededRandom } from '../utils/tournamentSimulation';
import { processMoveClient } from '../client/goLogicClient';
import { mergeResolvedRoundsPreserveChampionshipPlayback } from '../shared/utils/championshipTournamentPreserve.js';

const TOTAL_GAME_DURATION = 50;
// 챔피언십 실대국 중계 배속별 수당 간격(ms).
//   x0.5: 3초/수, x1: 1.5초/수, x2: 1초/수, x3: 0.5초/수.
// UI에서 사용자가 선택한 배속을 매 틱마다 ref로 읽어 다음 setTimeout에 반영한다.
export type ChampionshipPlaybackSpeed = 0.5 | 1 | 2 | 3;
const REAL_MATCH_INTERVAL_BY_SPEED_MS: Record<string, number> = {
    '0.5': 3000,
    '1': 1500,
    '2': 1000,
    '3': 500,
};
const moveIntervalMsForSpeed = (speed: ChampionshipPlaybackSpeed): number =>
    REAL_MATCH_INTERVAL_BY_SPEED_MS[String(speed)] ?? REAL_MATCH_INTERVAL_BY_SPEED_MS['1']!;
// 모든 수를 둔 뒤 계가 화면(좌→우 스캔)을 충분히 보여주고 결과 카드로 넘어가기 위한 지연.
// CSS 스캔 애니메이션이 2.6s 동안 빔을 부모 너비 끝까지 한 번 쭉 통과시키므로
// 그 이후에도 약 0.4s 더 가려진 상태를 유지해 "스캔이 오른쪽 끝까지 간 뒤 결과가 등장한다"는
// 흐름을 명확히 보여준다.
const REAL_MATCH_SCORING_DELAY_MS = 3000;
/** `index.css`의 `.championship-scoring-veil` / beam 애니메이션 길이와 동기 */
export const CHAMPIONSHIP_SCORING_VEIL_DURATION_MS = 2600;
/** 실대국 계가 연출 후 결과 화면까지 대기(ms) — PVE 토너먼트·PVP 장내 카타 재생과 동일 */
export const CHAMPIONSHIP_REAL_MATCH_SCORING_DELAY_MS = REAL_MATCH_SCORING_DELAY_MS;

type CommentaryPhase = 'early' | 'mid' | 'end';

const createEmptyBoard = (boardSize: number): BoardState =>
    Array.from({ length: boardSize }, () => Array.from({ length: boardSize }, () => Player.None));

const boardAfterMoves = (boardSize: number, moves: Array<{ x: number; y: number; player: Player }>, count: number): BoardState => {
    let board = createEmptyBoard(boardSize);
    let koInfo: { point: { x: number; y: number }; turn: number } | null = null;
    const replayMoves = moves.slice(0, count);
    for (let i = 0; i < replayMoves.length; i++) {
        const move = replayMoves[i]!;
        const result = processMoveClient(board, move, koInfo, i);
        if (!result.isValid) continue;
        board = result.newBoardState;
        koInfo = result.newKoInfo;
    }
    return board;
};

/** 챔피언십 실대국 수 재생 간격(ms) — 배속 버튼과 동일 규칙 */
export function championshipPlaybackMoveIntervalMs(speed: ChampionshipPlaybackSpeed): number {
    return moveIntervalMsForSpeed(speed);
}

/** 챔피언십 기보 `moves`의 앞 `count`수까지 적용한 판면(클라이언트 규칙) */
export function championshipReplayBoardAfterMoves(
    boardSize: number,
    moves: Array<{ x: number; y: number; player: Player }>,
    count: number,
): BoardState {
    return boardAfterMoves(boardSize, moves, count);
}

type PersistedTournamentSimulation = {
    userId: string;
    tournament: TournamentState;
    matchKey: string | null;
    rngState: number | null;
    savedAt: number;
};

/** 서버가 simulationSeed를 비워 두는 경우(실대국 등)에도 매치 단위로 안정적인 RNG/복구 키를 쓴다. */
const getEffectiveSimulationSeed = (tournament: TournamentState): string => {
    if (tournament.simulationSeed) return tournament.simulationSeed;
    const sim = tournament.currentSimulatingMatch;
    if (!sim) return '';
    const match = tournament.rounds[sim.roundIndex]?.matches[sim.matchIndex];
    return `fallback:${tournament.type}:${sim.roundIndex}:${sim.matchIndex}:${match?.id ?? 'm'}`;
};

const getMatchKey = (tournament: TournamentState | null | undefined): string | null => {
    if (!tournament?.currentSimulatingMatch) return null;
    const sim = tournament.currentSimulatingMatch;
    const match = tournament.rounds[sim.roundIndex]?.matches[sim.matchIndex];
    const realGame = match?.championshipRealGame;
    // 실대국: 시드(simulationSeed) 유무로 키가 바뀌면 매치 리셋·재생 타이머가 끊겨 빈 판에 멈출 수 있음 → 라운드·매치·id만으로 고정
    if (realGame?.moves?.length) {
        return `real:${tournament.type}:${sim.roundIndex}:${sim.matchIndex}:${match?.id ?? 'm'}`;
    }
    return `${sim.roundIndex}-${sim.matchIndex}-${getEffectiveSimulationSeed(tournament)}`;
};

/**
 * 실대국/시뮬 진행 중 서버 패치가 올 때 timeElapsed 등은 prev를 유지하면서,
 * 선수 컨디션·기타 서버 필드는 resolved를 반영한다. (prev.players만 유지하면 회복제·스냅샷이 되돌아감)
 */
function mergeResolvedPlayersKeepPrevSimStats(
    prevPlayers: TournamentState['players'] | undefined,
    resolvedPlayers: TournamentState['players'] | undefined,
): TournamentState['players'] {
    if (!Array.isArray(prevPlayers) || !Array.isArray(resolvedPlayers)) {
        return resolvedPlayers || prevPlayers || [];
    }
    const prevById = new Map(prevPlayers.map((p) => [p.id, p]));
    return resolvedPlayers.map((rp) => {
        const prevP = prevById.get(rp.id);
        if (!prevP) return rp;
        return {
            ...rp,
            stats: prevP.stats,
            originalStats: prevP.originalStats,
        };
    });
}

const getStorageKey = (userId: string, type: TournamentState['type']) => `tournamentSimulation_${userId}_${type}`;

// 좋은 수(bestMove) 이벤트 멘트 풀 — {nickname} 토큰을 선수 이름으로 치환해 사용한다.
const BEST_MOVE_COMMENTARY_TEMPLATES: readonly string[] = [
    '{nickname}의 좋은 수가 나왔습니다.',
    '{nickname}의 신의 한 수가 나왔습니다!',
    '{nickname}의 멋진 묘수가 빛납니다.',
    '{nickname}의 날카로운 한 수가 작렬했습니다.',
    '{nickname}의 노련한 한 수가 돋보입니다.',
    '{nickname}이(가) 결정적인 호수를 두었습니다.',
    '{nickname}의 침착한 명수가 형세를 흔듭니다.',
    '{nickname}이(가) 절묘한 한 수로 응수합니다.',
    '{nickname}의 통렬한 일격이 들어갔습니다!',
    '{nickname}의 한 수에 해설진이 감탄합니다.',
];

// 실수(mistake) 이벤트 멘트 풀.
const MISTAKE_COMMENTARY_TEMPLATES: readonly string[] = [
    '{nickname}의 실수가 나왔습니다.',
    '{nickname}의 한 수가 흔들립니다.',
    '{nickname}이(가) 잠시 균형을 잃었습니다.',
    '{nickname}의 착점이 다소 어긋났습니다.',
    '{nickname}의 손길이 평소답지 않게 흔들렸습니다.',
    '{nickname}의 판단이 살짝 빗나갑니다.',
    '{nickname}의 수읽기에 빈틈이 보입니다.',
    '{nickname}의 한 수가 아쉬움을 남깁니다.',
    '{nickname}이(가) 의외의 악수를 둡니다.',
    '{nickname}의 집중력이 잠시 흐트러졌습니다.',
];

const pickFromTemplates = (templates: readonly string[], nickname: string): string => {
    const template = templates[Math.floor(Math.random() * templates.length)] ?? templates[0]!;
    return template.replace('{nickname}', nickname);
};

/** 초·중·종을 각각 maxPly의 1/3 구간으로 나눈다 (예: 180수 → 1~60 / 61~120 / 121~180). */
const phaseThirdStarts = (maxPly: number): { midStart: number; endStart: number } => {
    const third = Math.max(1, Math.floor(maxPly / 3));
    return { midStart: third + 1, endStart: 2 * third + 1 };
};

const phaseMetaForPly = (ply: number, maxPly: number): { phase: CommentaryPhase; label: string } => {
    const { midStart, endStart } = phaseThirdStarts(maxPly);
    if (ply >= endStart) return { phase: 'end', label: '종반전' };
    if (ply >= midStart) return { phase: 'mid', label: '중반전' };
    return { phase: 'early', label: '초반전' };
};

const phaseStartMessageForPly = (ply: number, maxPly: number): { phase: CommentaryPhase; text: string } | null => {
    const { midStart, endStart } = phaseThirdStarts(maxPly);
    if (ply === 1) {
        return { phase: 'early', text: '초반전이 시작되었습니다. 포석과 첫 전투 흐름을 살펴봅니다.' };
    }
    if (ply === midStart) {
        return { phase: 'mid', text: '중반전이 시작되었습니다. 중앙 싸움과 형세 다툼이 거세집니다.' };
    }
    if (ply === endStart) {
        return { phase: 'end', text: '종반전이 시작되었습니다. 집 계산과 세세한 손익이 중요해집니다.' };
    }
    return null;
};

const describeCurrentMatch = (tournament: TournamentState, match: NonNullable<TournamentState['rounds'][number]['matches'][number]>) => {
    const roundIndex = tournament.currentSimulatingMatch?.roundIndex ?? -1;
    const roundName = tournament.rounds[roundIndex]?.name ?? '현재 라운드';
    const p1Name = match.players[0]?.nickname ?? '선수 1';
    const p2Name = match.players[1]?.nickname ?? '선수 2';
    const finishedUserMatches = tournament.rounds.flatMap(round => round.matches).filter(m => m.isUserMatch && m.isFinished).length;
    const headline = finishedUserMatches > 0 ? '다음 경기가 시작되었습니다.' : '경기가 시작되었습니다.';
    return { roundName, p1Name, p2Name, headline };
};

const readPersistedSimulation = (userId: string, type: TournamentState['type']): PersistedTournamentSimulation | null => {
    try {
        const raw = sessionStorage.getItem(getStorageKey(userId, type));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as PersistedTournamentSimulation;
        if (parsed.userId !== userId || parsed.tournament?.type !== type) return null;
        return parsed;
    } catch {
        return null;
    }
};

const persistSimulation = (userId: string, tournament: TournamentState, rngState: number | null) => {
    try {
        const payload: PersistedTournamentSimulation = {
            userId,
            tournament,
            matchKey: getMatchKey(tournament),
            rngState,
            savedAt: Date.now(),
        };
        sessionStorage.setItem(getStorageKey(userId, tournament.type), JSON.stringify(payload));
    } catch (error) {
        console.warn('[useTournamentSimulation] Failed to persist simulation state', error);
    }
};

const clearPersistedSimulation = (userId: string, type: TournamentState['type']) => {
    try {
        sessionStorage.removeItem(getStorageKey(userId, type));
    } catch {
        // ignore
    }
};

/** 실대국 기보 수순 애니메이션: 매치당 브라우저 세션에서 한 번만 재생 (탭 복귀·리렌더로 처음부터 다시 돌지 않도록) */
const getChampionshipRealAnimationDoneStorageKey = (userId: string, type: TournamentState['type']) =>
    `championshipRealAnimDone_${userId}_${type}`;

const readChampionshipRealAnimationDoneKeys = (userId: string, type: TournamentState['type']): Set<string> => {
    try {
        const raw = sessionStorage.getItem(getChampionshipRealAnimationDoneStorageKey(userId, type));
        if (!raw) return new Set();
        const arr = JSON.parse(raw) as unknown;
        if (!Array.isArray(arr)) return new Set();
        return new Set(arr.filter((x): x is string => typeof x === 'string'));
    } catch {
        return new Set();
    }
};

const markChampionshipRealAnimationDoneOnce = (userId: string, type: TournamentState['type'], matchKey: string) => {
    try {
        const s = readChampionshipRealAnimationDoneKeys(userId, type);
        s.add(matchKey);
        const capped = [...s].slice(-48);
        sessionStorage.setItem(getChampionshipRealAnimationDoneStorageKey(userId, type), JSON.stringify(capped));
    } catch {
        // ignore
    }
};

const resolveInitialTournament = (tournament: TournamentState | null, currentUser: User | null): TournamentState | null => {
    if (!currentUser || !tournament?.type) return tournament;

    const persisted = readPersistedSimulation(currentUser.id, tournament.type);
    if (!persisted) return tournament;

    const persistedMatchKey = persisted.matchKey;
    const incomingMatchKey = getMatchKey(tournament);

    if (tournament.status !== 'round_in_progress') {
        clearPersistedSimulation(currentUser.id, tournament.type);
        return tournament;
    }

    // 이미 이 매치에서 수순 재생을 끝낸 경우: 중간 ply 세션 복원으로 다시 애니메이션하지 않도록 서버 스냅샷을 쓴다.
    if (
        persisted.tournament.status === 'round_in_progress' &&
        persistedMatchKey &&
        persistedMatchKey === incomingMatchKey &&
        readChampionshipRealAnimationDoneKeys(currentUser.id, tournament.type).has(incomingMatchKey)
    ) {
        clearPersistedSimulation(currentUser.id, tournament.type);
        return tournament;
    }

    if (persisted.tournament.status === 'round_in_progress' &&
        persistedMatchKey &&
        persistedMatchKey === incomingMatchKey &&
        (persisted.tournament.timeElapsed || 0) >= (tournament.timeElapsed || 0)) {
        return persisted.tournament;
    }

    if (persistedMatchKey && persistedMatchKey !== incomingMatchKey) {
        clearPersistedSimulation(currentUser.id, tournament.type);
    }

    return tournament;
};

export const useTournamentSimulation = (
    tournament: TournamentState | null,
    currentUser: User | null,
    playbackSpeed: ChampionshipPlaybackSpeed = 1,
) => {
    const { handlers } = useAppContext();
    const [localTournament, setLocalTournament] = useState<TournamentState | null>(() => resolveInitialTournament(tournament, currentUser));
    const localTournamentRef = useRef<TournamentState | null>(localTournament);
    localTournamentRef.current = localTournament;

    // Refs for simulation state
    const simulationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isSimulatingRef = useRef(false);
    const rngRef = useRef<SeededRandom | null>(null);
    const player1Ref = useRef<any>(null);
    const player2Ref = useRef<any>(null);
    const player1ScoreRef = useRef(0);
    const player2ScoreRef = useRef(0);
    const commentaryRef = useRef<any[]>([]);
    const timeElapsedRef = useRef(0);
    // 배속 변경을 진행 중인 중계 루프에 즉시 반영하기 위해 ref로 보관한다.
    const playbackSpeedRef = useRef<ChampionshipPlaybackSpeed>(playbackSpeed);
    useEffect(() => {
        playbackSpeedRef.current = playbackSpeed;
    }, [playbackSpeed]);

    // 매 매치당 [경기 시작] 멘트를 단 한 번만 push하기 위한 가드.
    // currentUser/socket 등으로 useEffect가 첫 tick(1.5s) 이전에 재실행되면
    // realGame.currentPly가 아직 0이어서 if (ply === 0) 블록이 또 들어가 멘트가 중복된다.
    // 같은 매치 키에 대해 이미 푸시했다면 건너뛴다.
    const announcedStartMatchKeyRef = useRef<string | null>(null);
    /** 챔피언십 실대국: 마지막 수까지 재생한 뒤 서버 완료 전까지 동일 매치 재시작 방지 */
    const championshipRealPlaybackTerminalLockRef = useRef<string | null>(null);
    /** 동일 매치에 COMPLETE_TOURNAMENT_SIMULATION 중복 스케줄 방지(애니메이션 생략 복귀 경로 포함) */
    const championshipRealCompleteDispatchKeyRef = useRef<string | null>(null);
    const realMatchScoringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Track current match to detect changes
    const currentMatchKeyRef = useRef<string | null>(getMatchKey(localTournament));

    // Update local tournament state when tournament prop changes
    useEffect(() => {
        const resolvedTournament = resolveInitialTournament(tournament, currentUser);

        if (!resolvedTournament) {
            setLocalTournament(null);
            return;
        }

        const matchKey = getMatchKey(resolvedTournament);
        const prevStableMatchKey = currentMatchKeyRef.current;
        // WS/USER_UPDATE가 잠깐 currentSimulatingMatch를 빼면 getMatchKey가 null이 되어
        // 여기서 전부 리셋되면 실대국 중계가 처음부터 무한 반복처럼 보인다.
        // (계가 지연 타이머·COMPLETE 전송도 끊길 수 있음)
        const pendingRealMatchCompletion = realMatchScoringTimeoutRef.current != null;
        const skipResetForFlakyRealMatchKey =
            matchKey == null &&
            typeof prevStableMatchKey === 'string' &&
            prevStableMatchKey.startsWith('real:') &&
            (resolvedTournament.status === 'round_in_progress' ||
                (pendingRealMatchCompletion &&
                    (resolvedTournament.status === 'bracket_ready' ||
                        resolvedTournament.status === 'round_complete')));

        // If match changed, reset simulation state
        if (matchKey !== prevStableMatchKey && !skipResetForFlakyRealMatchKey) {
            console.log('[useTournamentSimulation] Match changed, resetting simulation state', {
                prevKey: prevStableMatchKey,
                newKey: matchKey,
                status: resolvedTournament.status,
                hasSeed: !!resolvedTournament.simulationSeed
            });

            if (simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
                simulationIntervalRef.current = null;
            }
            if (realMatchScoringTimeoutRef.current) {
                clearTimeout(realMatchScoringTimeoutRef.current);
                realMatchScoringTimeoutRef.current = null;
            }
            // getMatchKey가 잠깐 null로만 바뀌는 경우(다른 탭·절전·WS 생략) 터미널 락을 지우면
            // 같은 실대국 키로 돌아왔을 때 중계가 처음부터 다시 재생될 수 있다.
            // 새 매치 키가 확정됐을 때만 락·시작 멘트 가드를 해제한다.
            if (matchKey != null) {
                championshipRealPlaybackTerminalLockRef.current = null;
                announcedStartMatchKeyRef.current = null;
                championshipRealCompleteDispatchKeyRef.current = null;
            }

            isSimulatingRef.current = false;
            timeElapsedRef.current = 0;
            player1ScoreRef.current = 0;
            player2ScoreRef.current = 0;
            commentaryRef.current = [];
            rngRef.current = null;
            player1Ref.current = null;
            player2Ref.current = null;

            currentMatchKeyRef.current = matchKey;
        }

        setLocalTournament(prev => {
            if (!prev) return resolvedTournament;

            const prevK = getMatchKey(prev);
            const resK = getMatchKey(resolvedTournament);
            if (
                resK == null &&
                typeof prevK === 'string' &&
                prevK.startsWith('real:') &&
                resolvedTournament.status === 'round_in_progress' &&
                prev.status === 'round_in_progress' &&
                prev.currentSimulatingMatch
            ) {
                const sim = prev.currentSimulatingMatch;
                const prevMatch = prev.rounds[sim.roundIndex]?.matches[sim.matchIndex];
                const serverMatch = resolvedTournament.rounds[sim.roundIndex]?.matches[sim.matchIndex];
                const prevId = prevMatch?.id;
                const serverId = serverMatch?.id;
                const idsAlign = prevId == null || serverId == null || prevId === serverId;
                // 서버가 해당 칸을 이미 종료로 보냈거나 다른 경기(id)로 갱신된 경우,
                // 이전 currentSimulatingMatch를 붙이면 직전 대국이 다시 재생되는 현상이 난다.
                const canRestoreFlakySimPointer =
                    !!serverMatch && !serverMatch.isFinished && idsAlign;
                if (canRestoreFlakySimPointer) {
                    const patchedResolved = {
                        ...resolvedTournament,
                        currentSimulatingMatch: prev.currentSimulatingMatch,
                    };
                    const mergedRounds = mergeResolvedRoundsPreserveChampionshipPlayback(prev, patchedResolved);
                    return {
                        ...patchedResolved,
                        rounds: mergedRounds,
                        timeElapsed: prev.timeElapsed,
                        currentMatchScores: prev.currentMatchScores,
                        currentMatchCommentary: prev.currentMatchCommentary,
                        lastScoreIncrement: prev.lastScoreIncrement,
                        players: resolvedTournament.players,
                    };
                }
            }

            if (prev.status === 'round_in_progress' &&
                resolvedTournament.status === 'round_in_progress' &&
                getMatchKey(prev) === getMatchKey(resolvedTournament)) {
                const sim = prev.currentSimulatingMatch;
                const prevGame =
                    sim &&
                    prev.rounds[sim.roundIndex]?.matches[sim.matchIndex]?.championshipRealGame;
                const resolvedGame =
                    sim &&
                    resolvedTournament.rounds[sim.roundIndex]?.matches[sim.matchIndex]?.championshipRealGame;
                const playbackClientAhead =
                    !!prevGame?.moves?.length &&
                    !!resolvedGame?.moves?.length &&
                    prevGame.moves.length === resolvedGame.moves.length &&
                    ((prevGame.currentPly || 0) > (resolvedGame.currentPly || 0) ||
                        ((prev.timeElapsed || 0) > (resolvedTournament.timeElapsed || 0) &&
                            (prevGame.currentPly || 0) >= (resolvedGame.currentPly || 0)));
                const usePrevClientState =
                    (prev.timeElapsed || 0) > (resolvedTournament.timeElapsed || 0) || playbackClientAhead;
                if (usePrevClientState) {
                    const rounds = playbackClientAhead
                        ? mergeResolvedRoundsPreserveChampionshipPlayback(prev, resolvedTournament)
                        : resolvedTournament.rounds;
                    const prevMatch =
                        sim && prev.rounds[sim.roundIndex]?.matches[sim.matchIndex];
                    const useServerPlayers = !!prevMatch?.championshipRealGame?.moves?.length;
                    return {
                        ...resolvedTournament,
                        rounds,
                        timeElapsed: prev.timeElapsed,
                        currentMatchScores: prev.currentMatchScores,
                        currentMatchCommentary: prev.currentMatchCommentary,
                        lastScoreIncrement: prev.lastScoreIncrement,
                        players: useServerPlayers
                            ? resolvedTournament.players
                            : mergeResolvedPlayersKeepPrevSimStats(prev.players, resolvedTournament.players),
                    };
                }
            }

            return resolvedTournament;
        });
    }, [tournament, currentUser]);

    // Persist in-progress simulation so a refresh can resume mid-match.
    useEffect(() => {
        if (!currentUser || !localTournament) return;

        const matchKey = getMatchKey(localTournament);
        if (localTournament.status === 'round_in_progress' && matchKey && rngRef.current) {
            persistSimulation(currentUser.id, localTournament, rngRef.current.getState());
            return;
        }

        clearPersistedSimulation(currentUser.id, localTournament.type);
    }, [
        currentUser,
        localTournament?.type,
        localTournament?.status,
        localTournament?.simulationSeed,
        localTournament?.currentSimulatingMatch?.roundIndex,
        localTournament?.currentSimulatingMatch?.matchIndex,
        localTournament?.timeElapsed,
        localTournament?.currentMatchScores?.player1,
        localTournament?.currentMatchScores?.player2,
        localTournament?.currentMatchCommentary?.length,
    ]);

    // Main simulation effect
    useEffect(() => {
        if (!localTournament || !currentUser) {
            if (simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
                simulationIntervalRef.current = null;
            }
            if (realMatchScoringTimeoutRef.current) {
                clearTimeout(realMatchScoringTimeoutRef.current);
                realMatchScoringTimeoutRef.current = null;
            }
            isSimulatingRef.current = false;
            return;
        }

        const shouldStartSimulation =
            localTournament.status === 'round_in_progress' &&
            localTournament.currentSimulatingMatch !== null &&
            !isSimulatingRef.current &&
            !simulationIntervalRef.current;

        if (!shouldStartSimulation) {
            if (localTournament.status !== 'round_in_progress' && simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
                simulationIntervalRef.current = null;
                isSimulatingRef.current = false;
            }
            return;
        }

        const match = localTournament.currentSimulatingMatch
            ? localTournament.rounds[localTournament.currentSimulatingMatch.roundIndex]
                ?.matches[localTournament.currentSimulatingMatch.matchIndex]
            : null;

        if (!match || match.isFinished || !match.players[0] || !match.players[1]) {
            console.warn('[useTournamentSimulation] Cannot start simulation: invalid match', {
                hasMatch: !!match,
                isFinished: match?.isFinished,
                hasPlayers: !!(match?.players[0] && match?.players[1])
            });
            return;
        }

        const realGame = match.championshipRealGame;
        if (realGame?.moves?.length) {
            const playbackMatchKey = getMatchKey(localTournament);
            const fullyPlayedOut =
                realGame.status === 'finished' ||
                ((realGame.currentPly || 0) >= realGame.moves.length && realGame.moves.length > 0);
            if (fullyPlayedOut) {
                if (playbackMatchKey) championshipRealPlaybackTerminalLockRef.current = playbackMatchKey;
                return;
            }
            if (playbackMatchKey && championshipRealPlaybackTerminalLockRef.current === playbackMatchKey) {
                return;
            }

            // 세션에서 이미 수순 재생을 끝낸 매치: 다시 한 수씩 돌리지 않고 최종 국면으로 두고 COMPLETE만 보장
            if (
                playbackMatchKey &&
                currentUser &&
                readChampionshipRealAnimationDoneKeys(currentUser.id, localTournament.type).has(playbackMatchKey)
            ) {
                championshipRealPlaybackTerminalLockRef.current = playbackMatchKey;
                isSimulatingRef.current = true;
                const commentaryResume = [...(localTournament.currentMatchCommentary || [])];
                const nMoves = realGame.moves.length;
                const lastM = nMoves > 0 ? realGame.moves[nMoves - 1] : undefined;

                setLocalTournament(prev => {
                    if (!prev?.currentSimulatingMatch) return prev;
                    const updated = { ...prev, rounds: prev.rounds.map(r => ({ ...r, matches: r.matches.map(m => ({ ...m })) })) };
                    const m = updated.rounds[prev.currentSimulatingMatch.roundIndex]?.matches[prev.currentSimulatingMatch.matchIndex];
                    if (!m?.championshipRealGame) return updated;
                    const rg = m.championshipRealGame;
                    const nm = rg.moves?.length ?? 0;
                    if (!nm) return updated;
                    m.championshipRealGame = {
                        ...rg,
                        boardState: boardAfterMoves(rg.boardSize, rg.moves, nm),
                        currentPly: nm,
                        lastMove: lastM ? { x: lastM.x, y: lastM.y } : rg.lastMove,
                        status: 'scoring',
                        timeMetrics: {
                            ...rg.timeMetrics,
                            generatedAt: rg.timeMetrics?.generatedAt ?? Date.now(),
                            generationMs: rg.timeMetrics?.generationMs ?? 0,
                            playbackStartedAt: rg.timeMetrics?.playbackStartedAt ?? Date.now(),
                            scoringStartedAt: Date.now(),
                        },
                    };
                    updated.timeElapsed = nm;
                    updated.currentMatchCommentary = commentaryResume;
                    return updated;
                });

                if (
                    !match.isFinished &&
                    !realMatchScoringTimeoutRef.current &&
                    championshipRealCompleteDispatchKeyRef.current !== playbackMatchKey
                ) {
                    championshipRealCompleteDispatchKeyRef.current = playbackMatchKey;
                    realMatchScoringTimeoutRef.current = setTimeout(() => {
                        realMatchScoringTimeoutRef.current = null;
                        const lt = localTournamentRef.current;
                        if (!lt?.currentSimulatingMatch) {
                            isSimulatingRef.current = false;
                            return;
                        }
                        const sim = lt.currentSimulatingMatch;
                        const m2 = lt.rounds[sim.roundIndex]?.matches[sim.matchIndex];
                        if (!m2?.championshipRealGame?.moves?.length) {
                            isSimulatingRef.current = false;
                            return;
                        }
                        const rg2 = m2.championshipRealGame;
                        if (getMatchKey(lt) !== playbackMatchKey) {
                            isSimulatingRef.current = false;
                            return;
                        }
                        if (m2.isFinished) {
                            isSimulatingRef.current = false;
                            return;
                        }
                        const c = [...(lt.currentMatchCommentary || [])];
                        const md = describeCurrentMatch(lt, m2);
                        const winner = lt.players.find(p => p.id === rg2.winnerId);
                        const blackPlayer = lt.players.find(p => p.id === rg2.blackPlayerId);
                        const whitePlayer = lt.players.find(p => p.id === rg2.whitePlayerId);
                        c.push({
                            text: `[최종계가] ${winner?.nickname ?? '승자'}, ${Math.abs(rg2.finalScore?.scoreLead ?? 0).toFixed(1)}집 승리`,
                            phase: 'end',
                            isRandomEvent: false,
                        });
                        c.push({
                            text: `[경기 결과] ${md.roundName} 종료 - ${winner?.nickname ?? '승자'} 승리. 흑 ${blackPlayer?.nickname ?? '흑'} ${rg2.finalScore?.black.toFixed(1) ?? '-'}집, 백 ${whitePlayer?.nickname ?? '백'} ${rg2.finalScore?.white.toFixed(1) ?? '-'}집.`,
                            phase: 'end',
                            isRandomEvent: false,
                        });
                        void handlers.handleAction({
                            type: 'COMPLETE_TOURNAMENT_SIMULATION',
                            payload: {
                                type: lt.type,
                                result: {
                                    timeElapsed: rg2.moves.length,
                                    player1Score: rg2.finalScore?.black ?? 0,
                                    player2Score: rg2.finalScore?.white ?? 0,
                                    commentary: c,
                                    winnerId: rg2.winnerId || '',
                                },
                            },
                        });
                        isSimulatingRef.current = false;
                    }, CHAMPIONSHIP_REAL_MATCH_SCORING_DELAY_MS);
                } else {
                    isSimulatingRef.current = false;
                }

                return () => {
                    if (simulationIntervalRef.current) {
                        clearTimeout(simulationIntervalRef.current);
                        simulationIntervalRef.current = null;
                    }
                    isSimulatingRef.current = false;
                };
            }

            isSimulatingRef.current = true;
            let ply = Math.max(0, realGame.currentPly || 0);
            const commentary = [...(localTournament.currentMatchCommentary || [])];
            const matchDescription = describeCurrentMatch(localTournament, match);

            if (ply === 0) {
                // 매 경기 시작 시 [경기 시작] 멘트만 추가한다.
                // "초반전이 시작되었습니다." 멘트는 아래 setInterval 내부에서 cappedPly === 1 시점에 한 번만 push하므로
                // 여기서 firstPhaseMessage를 또 push하면 한 매치당 두 번씩 중복 출력되어 제거한다.
                //
                // 추가로 currentUser 등 deps 변경으로 useEffect가 첫 tick(1.5s) 이전에 재실행될 수 있는데,
                // 이때 realGame.currentPly가 아직 0이라 다시 이 분기로 들어와 멘트가 중복된다.
                // 같은 매치(roundIndex_matchIndex_seed/maxPly)에 대해 announcedStartMatchKeyRef로 1회만 푸시되도록 가드한다.
                const sim = localTournament.currentSimulatingMatch;
                const startMatchKey = sim
                    ? `${localTournament.type}|${sim.roundIndex}|${sim.matchIndex}|${realGame.maxPly}|${realGame.boardSize}`
                    : `${localTournament.type}|null|null|${realGame.maxPly}|${realGame.boardSize}`;
                const alreadyAnnounced = announcedStartMatchKeyRef.current === startMatchKey;

                if (!alreadyAnnounced) {
                    announcedStartMatchKeyRef.current = startMatchKey;
                    commentary.push({
                        text: `[경기 시작] ${matchDescription.headline} ${matchDescription.roundName} - ${matchDescription.p1Name} vs ${matchDescription.p2Name}, ${realGame.boardSize}줄 ${realGame.maxPly}수 대국입니다.`,
                        phase: 'early',
                        isRandomEvent: false,
                    });
                    setLocalTournament(prev => {
                        if (!prev?.currentSimulatingMatch) return prev;
                        const updated = { ...prev, rounds: prev.rounds.map(r => ({ ...r, matches: r.matches.map(m => ({ ...m })) })) };
                        const m = updated.rounds[prev.currentSimulatingMatch.roundIndex]?.matches[prev.currentSimulatingMatch.matchIndex];
                        if (!m?.championshipRealGame) return updated;
                        m.championshipRealGame = {
                            ...m.championshipRealGame,
                            boardState: createEmptyBoard(realGame.boardSize),
                            currentPly: 0,
                            lastMove: null,
                            status: 'playing',
                        };
                        updated.timeElapsed = 0;
                        updated.currentMatchCommentary = [...commentary];
                        return updated;
                    });
                }
            }

            // setTimeout 체인으로 매 틱마다 최신 배속을 ref에서 읽어 다음 간격을 결정한다.
            // 이렇게 하면 사용자가 진행 중에 배속 버튼을 눌러도 다음 수부터 즉시 반영된다.
            const playMoveTick = () => {
                ply++;
                const cappedPly = Math.min(ply, realGame.moves.length);
                const move = realGame.moves[cappedPly - 1];
                const event = realGame.events?.find((e) => e.ply === cappedPly);
                const phaseMeta = phaseMetaForPly(cappedPly, realGame.maxPly);
                const phaseStartMessage = phaseStartMessageForPly(cappedPly, realGame.maxPly);

                if (phaseStartMessage) {
                    // 단계 전환은 한 매치당 한 번씩만 트리거되므로 직접 push해 매 경기 모두 표시되게 한다.
                    commentary.push({ ...phaseStartMessage, isRandomEvent: false });
                }

                if (move) {
                    const actor = localTournament.players.find(p => p.id === move.actorId);
                    if (event) {
                        const nickname = actor?.nickname ?? '선수';
                        const eventBody = event.type === 'mistake'
                            ? pickFromTemplates(MISTAKE_COMMENTARY_TEMPLATES, nickname)
                            : pickFromTemplates(BEST_MOVE_COMMENTARY_TEMPLATES, nickname);
                        commentary.push({
                            // 이벤트가 발생한 수 번호를 멘트 앞에 [N수] 형태로 표기한다.
                            text: `[${cappedPly}수] ${eventBody}`,
                            phase: phaseMeta.phase,
                            isRandomEvent: true,
                        });
                    }
                }

                setLocalTournament(prev => {
                    if (!prev?.currentSimulatingMatch) return prev;
                    const updated = { ...prev, rounds: prev.rounds.map(r => ({ ...r, matches: r.matches.map(m => ({ ...m })) })) };
                    const m = updated.rounds[prev.currentSimulatingMatch.roundIndex]?.matches[prev.currentSimulatingMatch.matchIndex];
                    if (!m?.championshipRealGame) return updated;
                    m.championshipRealGame = {
                        ...m.championshipRealGame,
                        boardState: boardAfterMoves(realGame.boardSize, realGame.moves, cappedPly),
                        currentPly: cappedPly,
                        lastMove: move ? { x: move.x, y: move.y } : m.championshipRealGame.lastMove,
                        status: cappedPly >= realGame.moves.length ? 'scoring' : 'playing',
                        timeMetrics: {
                            generatedAt: m.championshipRealGame.timeMetrics?.generatedAt ?? realGame.timeMetrics?.generatedAt ?? Date.now(),
                            generationMs: m.championshipRealGame.timeMetrics?.generationMs ?? realGame.timeMetrics?.generationMs ?? 0,
                            playbackStartedAt: m.championshipRealGame.timeMetrics?.playbackStartedAt ?? Date.now(),
                        },
                    };
                    updated.timeElapsed = cappedPly;
                    updated.currentMatchCommentary = [...commentary];
                    return updated;
                });

                if (cappedPly >= realGame.moves.length) {
                    if (simulationIntervalRef.current) {
                        clearTimeout(simulationIntervalRef.current);
                        simulationIntervalRef.current = null;
                    }

                    if (playbackMatchKey) {
                        championshipRealPlaybackTerminalLockRef.current = playbackMatchKey;
                        if (currentUser) {
                            markChampionshipRealAnimationDoneOnce(currentUser.id, localTournament.type, playbackMatchKey);
                        }
                    }

                    commentary.push({ text: `${realGame.maxPly}수 진행이 완료되어 계가 중입니다...`, phase: 'end', isRandomEvent: false });
                    setLocalTournament(prev => {
                        if (!prev?.currentSimulatingMatch) return prev;
                        const updated = { ...prev, currentMatchCommentary: [...commentary], rounds: prev.rounds.map(r => ({ ...r, matches: r.matches.map(m => ({ ...m })) })) };
                        const m = updated.rounds[prev.currentSimulatingMatch.roundIndex]?.matches[prev.currentSimulatingMatch.matchIndex];
                        if (m?.championshipRealGame) {
                            m.championshipRealGame = {
                                ...m.championshipRealGame,
                                boardState: realGame.boardState,
                                currentPly: realGame.moves.length,
                                status: 'scoring',
                                timeMetrics: {
                                    generatedAt: m.championshipRealGame.timeMetrics?.generatedAt ?? realGame.timeMetrics?.generatedAt ?? Date.now(),
                                    generationMs: m.championshipRealGame.timeMetrics?.generationMs ?? realGame.timeMetrics?.generationMs ?? 0,
                                    playbackStartedAt: m.championshipRealGame.timeMetrics?.playbackStartedAt,
                                    scoringStartedAt: Date.now(),
                                },
                            };
                        }
                        return updated;
                    });

                    if (realMatchScoringTimeoutRef.current) {
                        clearTimeout(realMatchScoringTimeoutRef.current);
                    }
                    if (playbackMatchKey) {
                        championshipRealCompleteDispatchKeyRef.current = playbackMatchKey;
                    }
                    realMatchScoringTimeoutRef.current = setTimeout(() => {
                        realMatchScoringTimeoutRef.current = null;
                        const winner = localTournament.players.find(p => p.id === realGame.winnerId);
                        const blackPlayer = localTournament.players.find(p => p.id === realGame.blackPlayerId);
                        const whitePlayer = localTournament.players.find(p => p.id === realGame.whitePlayerId);
                        commentary.push({
                            text: `[최종계가] ${winner?.nickname ?? '승자'}, ${Math.abs(realGame.finalScore?.scoreLead ?? 0).toFixed(1)}집 승리`,
                            phase: 'end',
                            isRandomEvent: false,
                        });
                        commentary.push({
                            text: `[경기 결과] ${matchDescription.roundName} 종료 - ${winner?.nickname ?? '승자'} 승리. 흑 ${blackPlayer?.nickname ?? '흑'} ${realGame.finalScore?.black.toFixed(1) ?? '-'}집, 백 ${whitePlayer?.nickname ?? '백'} ${realGame.finalScore?.white.toFixed(1) ?? '-'}집.`,
                            phase: 'end',
                            isRandomEvent: false,
                        });
                        const completionPayload = {
                            type: localTournament.type,
                            result: {
                                timeElapsed: realGame.moves.length,
                                player1Score: realGame.finalScore?.black ?? 0,
                                player2Score: realGame.finalScore?.white ?? 0,
                                commentary,
                                winnerId: realGame.winnerId || '',
                            }
                        };
                        void handlers.handleAction({
                            type: 'COMPLETE_TOURNAMENT_SIMULATION',
                            payload: completionPayload,
                        });
                        isSimulatingRef.current = false;
                    }, CHAMPIONSHIP_REAL_MATCH_SCORING_DELAY_MS);
                    return; // 마지막 수에 도달했으면 다음 틱을 예약하지 않는다.
                }

                // 다음 수: 매 틱마다 최신 배속을 읽어 적용 (사용자가 중간에 변경해도 즉시 반영).
                simulationIntervalRef.current = setTimeout(playMoveTick, moveIntervalMsForSpeed(playbackSpeedRef.current));
            };

            simulationIntervalRef.current = setTimeout(playMoveTick, moveIntervalMsForSpeed(playbackSpeedRef.current));

            return () => {
                if (simulationIntervalRef.current) {
                    clearTimeout(simulationIntervalRef.current);
                    simulationIntervalRef.current = null;
                }
                // 실대국 계가 지연 타이머는 여기서 지우지 않는다. effect deps가 바뀌며 cleanup이 돌 때
                // COMPLETE_TOURNAMENT_SIMULATION이 스케줄에서 사라져 무한 재생만 고치고 전송이 누락된다.
                // 타이머는 매치 키가 바뀔 때(위 useEffect)만 정리한다.
                isSimulatingRef.current = false;
            };
        }

        const p1 = localTournament.players.find(p => p.id === match.players[0]!.id);
        const p2 = localTournament.players.find(p => p.id === match.players[1]!.id);

        if (!p1 || !p2) {
            console.warn('[useTournamentSimulation] Cannot start simulation: players not found');
            return;
        }

        console.log('[useTournamentSimulation] Starting simulation', {
            roundIndex: localTournament.currentSimulatingMatch!.roundIndex,
            matchIndex: localTournament.currentSimulatingMatch!.matchIndex,
            p1: p1.nickname,
            p2: p2.nickname
        });

        const persisted = readPersistedSimulation(currentUser.id, localTournament.type);
        const canResumePersisted =
            !!persisted &&
            persisted.matchKey === getMatchKey(localTournament) &&
            persisted.rngState !== null &&
            (localTournament.timeElapsed || 0) > 0;

        isSimulatingRef.current = true;
        player1Ref.current = JSON.parse(JSON.stringify(p1));
        player2Ref.current = JSON.parse(JSON.stringify(p2));
        rngRef.current = new SeededRandom(getEffectiveSimulationSeed(localTournament));

        if (canResumePersisted) {
            rngRef.current.setState(persisted!.rngState!);
            player1ScoreRef.current = localTournament.currentMatchScores?.player1 || 0;
            player2ScoreRef.current = localTournament.currentMatchScores?.player2 || 0;
            commentaryRef.current = [...(localTournament.currentMatchCommentary || [])];
            timeElapsedRef.current = localTournament.timeElapsed || 0;
        } else {
            const isP1User = p1.id === currentUser.id;
            const isP2User = p2.id === currentUser.id;

            if (isP1User && p1.condition !== undefined && p1.condition !== null && p1.condition !== 1000 && p1.condition >= 40 && p1.condition <= 100) {
                player1Ref.current.condition = p1.condition;
            } else if (!isP1User && (p1.condition === undefined || p1.condition === null || p1.condition === 1000 || p1.condition < 40 || p1.condition > 100)) {
                player1Ref.current.condition = rngRef.current.randomInt(40, 100);
            } else {
                player1Ref.current.condition = p1.condition || rngRef.current.randomInt(40, 100);
            }

            if (isP2User && p2.condition !== undefined && p2.condition !== null && p2.condition !== 1000 && p2.condition >= 40 && p2.condition <= 100) {
                player2Ref.current.condition = p2.condition;
            } else if (!isP2User && (p2.condition === undefined || p2.condition === null || p2.condition === 1000 || p2.condition < 40 || p2.condition > 100)) {
                player2Ref.current.condition = rngRef.current.randomInt(40, 100);
            } else {
                player2Ref.current.condition = p2.condition || rngRef.current.randomInt(40, 100);
            }

            if (player1Ref.current.originalStats) {
                player1Ref.current.stats = JSON.parse(JSON.stringify(player1Ref.current.originalStats));
            }
            if (player2Ref.current.originalStats) {
                player2Ref.current.stats = JSON.parse(JSON.stringify(player2Ref.current.originalStats));
            }

            player1ScoreRef.current = 0;
            player2ScoreRef.current = 0;
            commentaryRef.current = [];
            timeElapsedRef.current = 0;
        }

        try {
            simulationIntervalRef.current = setInterval(() => {
                if (!rngRef.current || !player1Ref.current || !player2Ref.current) {
                    console.warn('[useTournamentSimulation] Missing refs in interval');
                    return;
                }

                timeElapsedRef.current++;

                const prevP1Score = player1ScoreRef.current;
                const prevP2Score = player2ScoreRef.current;

                const result = runClientSimulationStep(
                    rngRef.current,
                    player1Ref.current,
                    player2Ref.current,
                    timeElapsedRef.current,
                    player1ScoreRef.current,
                    player2ScoreRef.current,
                    commentaryRef.current
                );

                const p1ScoreIncrement = result.player1Score - prevP1Score;
                const p2ScoreIncrement = result.player2Score - prevP2Score;
                const p1IsCritical = result.p1IsCritical || false;
                const p2IsCritical = result.p2IsCritical || false;

                player1ScoreRef.current = result.player1Score;
                player2ScoreRef.current = result.player2Score;
                commentaryRef.current = result.commentary;

                setLocalTournament(prev => {
                    if (!prev) return prev;
                    const updated = { ...prev };
                    updated.timeElapsed = timeElapsedRef.current;
                    if (!updated.currentMatchScores) {
                        updated.currentMatchScores = { player1: 0, player2: 0 };
                    }
                    updated.currentMatchScores.player1 = player1ScoreRef.current;
                    updated.currentMatchScores.player2 = player2ScoreRef.current;
                    updated.currentMatchCommentary = [...commentaryRef.current];
                    updated.lastScoreIncrement = {
                        player1: p1ScoreIncrement > 0 ? {
                            base: p1ScoreIncrement,
                            actual: p1ScoreIncrement,
                            isCritical: p1IsCritical
                        } : null,
                        player2: p2ScoreIncrement > 0 ? {
                            base: p2ScoreIncrement,
                            actual: p2ScoreIncrement,
                            isCritical: p2IsCritical
                        } : null
                    };
                    updated.players = updated.players.map(p => {
                        if (p.id === player1Ref.current.id) {
                            return { ...player1Ref.current, stats: { ...player1Ref.current.stats } };
                        }
                        if (p.id === player2Ref.current.id) {
                            return { ...player2Ref.current, stats: { ...player2Ref.current.stats } };
                        }
                        return p;
                    });
                    return updated;
                });

                if (timeElapsedRef.current >= TOTAL_GAME_DURATION) {
                    if (simulationIntervalRef.current) {
                        clearInterval(simulationIntervalRef.current);
                        simulationIntervalRef.current = null;
                    }
                    isSimulatingRef.current = false;

                    const totalScore = player1ScoreRef.current + player2ScoreRef.current;
                    const p1Percent = totalScore > 0 ? (player1ScoreRef.current / totalScore) * 100 : 50;
                    const diffPercent = Math.abs(p1Percent - 50) * 2;
                    const scoreDiff = Math.round(diffPercent / 2) + 0.5;

                    let winnerId: string;
                    let winnerNickname: string;
                    if (scoreDiff < 0.5) {
                        const randomWinner = (rngRef.current && rngRef.current.random() < 0.5) ? player1Ref.current : player2Ref.current;
                        winnerId = randomWinner.id;
                        winnerNickname = randomWinner.nickname;
                    } else {
                        const winner = p1Percent > 50 ? player1Ref.current : player2Ref.current;
                        winnerId = winner.id;
                        winnerNickname = winner.nickname;
                    }

                    const finalCommentaryText = scoreDiff < 0.5
                        ? `[최종결과] ${winnerNickname}, 0.5집 승리!`
                        : `[최종결과] ${winnerNickname}, ${scoreDiff.toFixed(1)}집 승리!`;

                    commentaryRef.current.push({
                        text: finalCommentaryText,
                        phase: 'end',
                        isRandomEvent: false
                    });
                    commentaryRef.current.push({
                        text: `${winnerNickname}님이 승리했습니다!`,
                        phase: 'end',
                        isRandomEvent: false
                    });

                    setLocalTournament(prev => {
                        if (!prev) return prev;
                        const updated = { ...prev };
                        updated.timeElapsed = TOTAL_GAME_DURATION;
                        if (!updated.currentMatchScores) {
                            updated.currentMatchScores = { player1: 0, player2: 0 };
                        }
                        updated.currentMatchScores.player1 = player1ScoreRef.current;
                        updated.currentMatchScores.player2 = player2ScoreRef.current;
                        updated.currentMatchCommentary = [...commentaryRef.current];
                        updated.simulationSeed = undefined;
                        return updated;
                    });

                    clearPersistedSimulation(currentUser.id, localTournament.type);

                    const completionPayload = {
                        type: localTournament.type,
                        result: {
                            timeElapsed: TOTAL_GAME_DURATION,
                            player1Score: player1ScoreRef.current,
                            player2Score: player2ScoreRef.current,
                            commentary: commentaryRef.current,
                            winnerId,
                        }
                    };
                    const sendCompletionWithRetry = async (attempt: number) => {
                        try {
                            const response = await handlers.handleAction({
                                type: 'COMPLETE_TOURNAMENT_SIMULATION',
                                payload: completionPayload,
                            }) as { error?: string } | undefined;
                            if (response?.error) {
                                throw new Error(response.error);
                            }
                        } catch (error) {
                            if (attempt < 3) {
                                setTimeout(() => {
                                    void sendCompletionWithRetry(attempt + 1);
                                }, 500 * (attempt + 1));
                            } else {
                                console.error('[useTournamentSimulation] Failed to submit completion after retries:', error);
                            }
                        }
                    };
                    void sendCompletionWithRetry(0);

                    console.log('[useTournamentSimulation] Simulation completed, result sent to server');
                }
            }, 1000);

            console.log('[useTournamentSimulation] Simulation interval started');
        } catch (error) {
            console.error('[useTournamentSimulation] Error starting simulation:', error);
            isSimulatingRef.current = false;
            if (simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
                simulationIntervalRef.current = null;
            }
        }

        return () => {
            if (simulationIntervalRef.current) {
                clearInterval(simulationIntervalRef.current);
                simulationIntervalRef.current = null;
            }
            isSimulatingRef.current = false;
        };
    }, [getMatchKey(localTournament), localTournament?.status, currentUser?.id]);

    return localTournament;
};
