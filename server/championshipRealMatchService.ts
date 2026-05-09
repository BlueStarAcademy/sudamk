import type { BoardState, ChampionshipRealGameEvent, ChampionshipRealGameState, Match, Move, PlayerForTournament, Point, User } from '../shared/types/index.js';
import { CoreStat, Player } from '../shared/types/index.js';
import {
    DEFAULT_CHAMPIONSHIP_REAL_MATCH_RULES,
    type ChampionshipKataPhase,
    type ChampionshipRealMatchRules,
    championshipBestMoveChancePercent,
    championshipEventBranchBestMovePercent,
    championshipKataLevelForPly,
    championshipMistakeChancePercent,
} from '../shared/constants/championshipRealMatch.js';
import { getChampionshipAbilityKataLadder } from './championshipAbilityKataStore.js';
import { processMove } from './goLogic.js';
import { calculateScoreManually } from '../shared/utils/manualScoring.js';
import { generateKataServerMoveCandidateDetails, isKataServerAvailable } from './kataServerService.js';

type KoInfo = { point: Point; turn: number } | null;

type MoveCandidate = {
    point: Point;
    score: number;
};

export type ChampionshipRealMatchGenerationResult = {
    game: ChampionshipRealGameState;
    winner: PlayerForTournament;
    scorePercent: { player1: number; player2: number };
};

function createEmptyBoard(boardSize: number): BoardState {
    return Array.from({ length: boardSize }, () => Array.from({ length: boardSize }, () => Player.None));
}

function cloneBoard(board: BoardState): BoardState {
    return board.map(row => [...row]);
}

function opponentOf(player: Player): Player {
    return player === Player.Black ? Player.White : Player.Black;
}

function normalizeCondition(condition: number | undefined | null): number {
    const n = Math.round(Number(condition));
    if (!Number.isFinite(n)) return 1;
    return Math.max(1, Math.min(100, n));
}

export function assignChampionshipCondition(): number {
    return Math.floor(Math.random() * 100) + 1;
}

function isLegalPoint(board: BoardState, point: Point, player: Player, koInfo: KoInfo, moveCount: number): boolean {
    return processMove(board, { ...point, player }, koInfo as any, moveCount).isValid;
}

function legalCandidates(board: BoardState, player: Player, koInfo: KoInfo, moveCount: number): MoveCandidate[] {
    const boardSize = board.length;
    const center = (boardSize - 1) / 2;
    const candidates: MoveCandidate[] = [];
    for (let y = 0; y < boardSize; y++) {
        for (let x = 0; x < boardSize; x++) {
            if (board[y][x] !== Player.None) continue;
            const point = { x, y };
            const result = processMove(board, { ...point, player }, koInfo as any, moveCount);
            if (!result.isValid) continue;
            const distanceFromCenter = Math.abs(center - x) + Math.abs(center - y);
            const captureScore = result.capturedStones.length * 12;
            const influenceScore = Math.max(0, boardSize - distanceFromCenter);
            const noise = Math.random() * 4;
            candidates.push({ point, score: influenceScore + captureScore + noise });
        }
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates;
}

function chooseMoveByKataLevel(candidates: MoveCandidate[], kataLevel: number): { reportedMove: Point; bestMove: Point } | null {
    if (candidates.length === 0) return null;
    const bestMove = candidates[0]!.point;
    const weakness = Math.max(0, 7 - kataLevel);
    const poolSize = Math.min(candidates.length, Math.max(1, 1 + Math.floor(weakness / 2)));
    const picked = candidates[Math.floor(Math.random() * poolSize)] ?? candidates[0]!;
    return { reportedMove: picked.point, bestMove };
}

async function chooseMoveByKataServer(params: {
    boardState: BoardState;
    color: Player.Black | Player.White;
    koInfo: KoInfo;
    moves: Move[];
    boardSize: number;
    kataLevel: number;
    matchId: string;
    ply: number;
}): Promise<{ reportedMove: Point; bestMove: Point } | null> {
    if (!isKataServerAvailable()) return null;
    try {
        const details = await generateKataServerMoveCandidateDetails({
            boardSize: params.boardSize,
            player: params.color === Player.Black ? 'black' : 'white',
            moveHistory: params.moves.map((m) => ({ x: m.x, y: m.y, player: m.player })),
            level: params.kataLevel,
            komi: 6.5,
            gameId: `championship-${params.matchId}`,
            kataSessionTag: `ply${params.ply}`,
            allowPass: false,
            moveApiRetries: 1,
            skipApplyDelay: true,
        });

        const legalReported = details.candidates.find((point) =>
            isLegalPoint(params.boardState, point, params.color, params.koInfo, params.moves.length),
        );
        const bestMove =
            details.bestMove && isLegalPoint(params.boardState, details.bestMove, params.color, params.koInfo, params.moves.length)
                ? details.bestMove
                : legalReported;
        const reportedMove =
            details.reportedMove && isLegalPoint(params.boardState, details.reportedMove, params.color, params.koInfo, params.moves.length)
                ? details.reportedMove
                : legalReported;

        if (!reportedMove || !bestMove) return null;
        return { reportedMove, bestMove };
    } catch (error) {
        console.warn(
            `[ChampionshipRealMatch] KataServer move failed, falling back to heuristic. match=${params.matchId} ply=${params.ply} level=${params.kataLevel}`,
            error,
        );
        return null;
    }
}

function shuffledAdjacentMoves(point: Point): Point[] {
    const moves = [
        { x: point.x + 1, y: point.y },
        { x: point.x - 1, y: point.y },
        { x: point.x, y: point.y + 1 },
        { x: point.x, y: point.y - 1 },
    ];
    for (let i = moves.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [moves[i], moves[j]] = [moves[j]!, moves[i]!];
    }
    return moves;
}

function chooseMistakeMove(board: BoardState, bestMove: Point, player: Player, koInfo: KoInfo, moveCount: number): Point | null {
    for (const point of shuffledAdjacentMoves(bestMove)) {
        if (isLegalPoint(board, point, player, koInfo, moveCount)) return point;
    }
    return null;
}

function buildPhaseStats(
    player: PlayerForTournament,
    rules: ChampionshipRealMatchRules,
    abilityKataLadder: ReturnType<typeof getChampionshipAbilityKataLadder>,
) {
    const result: Record<ChampionshipKataPhase, { abilityScore: number; kataLevel: number }> = {
        opening: { abilityScore: 0, kataLevel: -30 },
        midgame: { abilityScore: 0, kataLevel: -30 },
        endgame: { abilityScore: 0, kataLevel: -30 },
    };
    for (const phase of Object.keys(result) as ChampionshipKataPhase[]) {
        const ply = rules.phasePly[phase].from;
        const levelInfo = championshipKataLevelForPly(ply, player.stats, rules, abilityKataLadder);
        result[phase] = { abilityScore: levelInfo.abilityScore, kataLevel: levelInfo.kataLevel };
    }
    return result;
}

function randomIntInclusive(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
}

/** 직전 이벤트가 난 ply 이후, 상대가 둘 차례인 ply만 [lastPly+5, lastPly+7] 안에서 무작위로 고른다. */
function pickNextEventPlyForPlayer(
    lastPly: number,
    nextPlayerId: string,
    blackId: string,
    maxPly: number,
): number | null {
    const lo = lastPly + 5;
    const hi = lastPly + 7;
    const wantsBlack = nextPlayerId === blackId;
    const candidates: number[] = [];
    for (let p = lo; p <= hi; p++) {
        if (p > maxPly) break;
        const isBlackTurn = p % 2 === 1;
        if (wantsBlack === isBlackTurn) candidates.push(p);
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)]!;
}

function createManualScoringSession(params: {
    id: string;
    boardState: BoardState;
    boardSize: number;
    captures: Record<Player, number>;
}) {
    return {
        id: params.id,
        boardState: params.boardState,
        settings: { boardSize: params.boardSize, komi: 6.5 },
        finalKomi: 6.5,
        captures: params.captures,
        moveHistory: [],
    } as any;
}

export async function generateChampionshipRealMatch(
    match: Match,
    players: PlayerForTournament[],
    user: User,
    rules: ChampionshipRealMatchRules = DEFAULT_CHAMPIONSHIP_REAL_MATCH_RULES,
): Promise<ChampionshipRealMatchGenerationResult> {
    const startedAt = Date.now();
    if (!match.players[0] || !match.players[1]) {
        throw new Error('챔피언십 실제 대국 선수 정보가 올바르지 않습니다.');
    }

    const abilityKataLadder = getChampionshipAbilityKataLadder();

    const userPlayer = players.find(p => p.id === user.id);
    const opponentPlayer = players.find(p => p.id !== user.id && match.players.some(mp => mp?.id === p.id));
    const p1 = players.find(p => p.id === match.players[0]!.id);
    const p2 = players.find(p => p.id === match.players[1]!.id);
    const black = userPlayer && match.players.some(p => p?.id === user.id) ? userPlayer : p1!;
    const white = black.id === p1?.id ? p2! : opponentPlayer ?? p1!;

    const boardSize = rules.boardSize;
    let boardState = createEmptyBoard(boardSize);
    let koInfo: KoInfo = null;
    const moves: Move[] = [];
    const events: ChampionshipRealGameEvent[] = [];
    const captures: Record<Player, number> = {
        [Player.None]: 0,
        [Player.Black]: 0,
        [Player.White]: 0,
    };
    const playerByColor: Record<Player.Black | Player.White, PlayerForTournament> = {
        [Player.Black]: black,
        [Player.White]: white,
    };

    let nextEventPly: number | null = randomIntInclusive(5, 7);
    let nextEventPlayerId: string | null =
        nextEventPly !== null ? (nextEventPly % 2 === 1 ? black.id : white.id) : null;

    for (let ply = 1; ply <= rules.maxPly; ply++) {
        const color = ply % 2 === 1 ? Player.Black : Player.White;
        const actor = playerByColor[color];
        const levelInfo = championshipKataLevelForPly(ply, actor.stats, rules, abilityKataLadder);
        const candidates = legalCandidates(boardState, color, koInfo, moves.length);
        let chosen =
            (await chooseMoveByKataServer({
                boardState,
                color,
                koInfo,
                moves,
                boardSize,
                kataLevel: levelInfo.kataLevel,
                matchId: match.id,
                ply,
            })) ?? chooseMoveByKataLevel(candidates, levelInfo.kataLevel);
        // KataGo 응답이 막혀 있고 휴리스틱 후보까지 비었을 때만 종료. 후보가 남아 있다면
        // maxPly 끝까지 두는 것을 보장하기 위해 첫 번째 합법 후보를 임시로 사용한다.
        if (!chosen) {
            if (candidates.length === 0) break;
            chosen = { reportedMove: candidates[0]!.point, bestMove: candidates[0]!.point };
        }

        let appliedMove = chosen.reportedMove;
        const isScheduledEventPly =
            nextEventPly !== null && nextEventPlayerId !== null && ply === nextEventPly && actor.id === nextEventPlayerId;

        if (isScheduledEventPly) {
            const branchBestPct = championshipEventBranchBestMovePercent(levelInfo.abilityScore);
            const eventType: 'mistake' | 'bestMove' =
                Math.random() * 100 < branchBestPct ? 'bestMove' : 'mistake';
            if (eventType === 'mistake') {
                const chance = championshipMistakeChancePercent(actor.stats[CoreStat.Stability] || 0, normalizeCondition(actor.condition));
                const mistakeMove = Math.random() * 100 < chance
                    ? chooseMistakeMove(boardState, chosen.bestMove, color, koInfo, moves.length)
                    : null;
                if (mistakeMove) {
                    appliedMove = mistakeMove;
                    events.push({
                        ply,
                        playerId: actor.id,
                        player: color,
                        type: 'mistake',
                        chancePercent: chance,
                        originalMove: chosen.bestMove,
                        appliedMove,
                    });
                }
            } else {
                const chance = championshipBestMoveChancePercent(levelInfo.abilityScore, normalizeCondition(actor.condition));
                if (Math.random() * 100 < chance && isLegalPoint(boardState, chosen.bestMove, color, koInfo, moves.length)) {
                    appliedMove = chosen.bestMove;
                    events.push({
                        ply,
                        playerId: actor.id,
                        player: color,
                        type: 'bestMove',
                        chancePercent: chance,
                        originalMove: chosen.reportedMove,
                        appliedMove,
                    });
                }
            }

            const opponentId = actor.id === black.id ? white.id : black.id;
            nextEventPly = pickNextEventPlyForPlayer(ply, opponentId, black.id, rules.maxPly);
            nextEventPlayerId = nextEventPly !== null ? opponentId : null;
        }

        let result = processMove(boardState, { ...appliedMove, player: color }, koInfo as any, moves.length);
        // KO 등으로 적용 직전에 무효해진 경우, 합법 후보 목록에서 다른 수를 시도해 maxPly까지 진행한다.
        if (!result.isValid) {
            let fallbackApplied = false;
            for (const c of candidates) {
                const r = processMove(boardState, { ...c.point, player: color }, koInfo as any, moves.length);
                if (r.isValid) {
                    appliedMove = c.point;
                    result = r;
                    fallbackApplied = true;
                    break;
                }
            }
            if (!fallbackApplied) break;
        }

        boardState = result.newBoardState;
        koInfo = result.newKoInfo as KoInfo;
        captures[color] += result.capturedStones.length;
        moves.push({ ...appliedMove, player: color, actorId: actor.id });
    }

    const scoring = calculateScoreManually(createManualScoringSession({
        id: `championship-${match.id}`,
        boardState,
        boardSize,
        captures,
    }));
    const blackScore = scoring.areaScore?.black ?? 0;
    const whiteScore = scoring.areaScore?.white ?? 0;
    const winner = blackScore > whiteScore ? black : white;
    const totalScore = Math.max(1, blackScore + whiteScore);
    const player1IsBlack = match.players[0]?.id === black.id;
    const player1Score = player1IsBlack ? blackScore : whiteScore;
    const player2Score = player1IsBlack ? whiteScore : blackScore;

    const game: ChampionshipRealGameState = {
        boardSize,
        maxPly: rules.maxPly,
        blackPlayerId: black.id,
        whitePlayerId: white.id,
        boardState: cloneBoard(boardState),
        moves,
        lastMove: moves.length > 0 ? { x: moves[moves.length - 1]!.x, y: moves[moves.length - 1]!.y } : null,
        currentPly: 0,
        status: 'ready',
        finalScore: { black: blackScore, white: whiteScore, scoreLead: blackScore - whiteScore },
        winnerId: winner.id,
        events,
        phaseStatsByPlayerId: {
            [black.id]: buildPhaseStats(black, rules, abilityKataLadder),
            [white.id]: buildPhaseStats(white, rules, abilityKataLadder),
        },
        timeMetrics: {
            generatedAt: startedAt,
            generationMs: Date.now() - startedAt,
        },
    };

    return {
        game,
        winner,
        scorePercent: {
            player1: (player1Score / totalScore) * 100,
            player2: (player2Score / totalScore) * 100,
        },
    };
}
