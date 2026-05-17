import { processMoveClient } from '../client/goLogicClient.js';
import { Player, type AnalysisResult, type BoardState } from '../types/index.js';
import { calculateScoreManually } from '../shared/utils/manualScoring.js';

const createEmptyBoard = (boardSize: number): BoardState =>
    Array.from({ length: boardSize }, () => Array.from({ length: boardSize }, () => Player.None));

type ReplayMovesResult = {
    board: BoardState;
    captures: Record<Player, number>;
};

function replayChampionshipMovesUpToPly(
    boardSize: number,
    moves: Array<{ x: number; y: number; player: Player }>,
    ply: number,
): ReplayMovesResult | null {
    const n = Math.max(0, Math.min(Math.floor(ply), moves.length));
    if (n === 0) return null;

    let board = createEmptyBoard(boardSize);
    let koInfo: { point: { x: number; y: number }; turn: number } | null = null;
    const captures: Record<Player, number> = {
        [Player.None]: 0,
        [Player.Black]: 0,
        [Player.White]: 0,
    };

    for (let i = 0; i < n; i++) {
        const move = moves[i]!;
        const result = processMoveClient(board, move, koInfo, i);
        if (!result.isValid) continue;
        board = result.newBoardState;
        koInfo = result.newKoInfo;
        captures[move.player] += result.capturedStones.length;
    }

    return { board, captures };
}

/**
 * 챔피언십 실대국 기보 재생 중 `ply`수까지 상대를 따낸 돌(캡처) 개수만 집계한다.
 * (영토·사석 계가와 무관하게 재생 중·계가 연출 중에도 숫자가 들쭉날쭉하지 않게 패널에 쓴다.)
 */
export function championshipCapturesAtPly(
    boardSize: number,
    moves: Array<{ x: number; y: number; player: Player }>,
    ply: number,
): { black: number; white: number } | null {
    const replay = replayChampionshipMovesUpToPly(boardSize, moves, ply);
    if (!replay) return null;
    return {
        black: replay.captures[Player.Black],
        white: replay.captures[Player.White],
    };
}

/**
 * 챔피언십 실대국 기보 재생 중 `ply`수까지 둔 직후 판·따내기로 한국식 집 점수를 계산한다.
 * (`shared/utils/manualScoring` — 서버 `generateChampionshipRealMatch`와 동일 경로)
 */
export type ChampionshipPanelScoreKind = 'captures' | 'final';

type ChampionshipRealGameScoreSource = {
    boardSize: number;
    moves?: Array<{ x: number; y: number; player: Player }>;
    currentPly?: number;
    status?: string;
    finalScore?: { black: number; white: number } | null;
};

/**
 * 챔피언십 인게임 경기장 상단 점수 패널용: 기보 재생·계가 연출 중에는 따낸 돌 수,
 * 종료 후에는 서버 확정 집 점수를 반환한다.
 */
export function resolveChampionshipPanelScores(
    rg: ChampionshipRealGameScoreSource | null | undefined,
    options: { isPlaybackActive: boolean },
): { black: number; white: number; kind: ChampionshipPanelScoreKind } | null {
    if (!rg?.moves?.length) return null;
    const ply = rg.currentPly ?? 0;
    const showAuthoritativeFinal = rg.status === 'finished';

    if (
        options.isPlaybackActive ||
        rg.status === 'scoring' ||
        (rg.status === 'playing' && ply > 0)
    ) {
        if (ply <= 0) return null;
        const cap = championshipCapturesAtPly(rg.boardSize, rg.moves, Math.min(ply, rg.moves.length));
        if (!cap) return null;
        return { black: cap.black, white: cap.white, kind: 'captures' };
    }

    if (showAuthoritativeFinal && rg.finalScore) {
        return { black: rg.finalScore.black, white: rg.finalScore.white, kind: 'final' };
    }
    return null;
}

export function formatChampionshipPanelScoreDisplay(
    score: number | null | undefined,
    kind: ChampionshipPanelScoreKind | null | undefined,
): string {
    if (score == null || kind == null) return '-';
    return kind === 'captures' ? String(Math.round(score)) : score.toFixed(1);
}

export function championshipAreaScoresAtPly(
    boardSize: number,
    moves: Array<{ x: number; y: number; player: Player }>,
    ply: number,
): { black: number; white: number } | null {
    const replay = replayChampionshipMovesUpToPly(boardSize, moves, ply);
    if (!replay) return null;
    const { board, captures } = replay;
    const n = Math.max(0, Math.min(Math.floor(ply), moves.length));

    const analysis = calculateScoreManually(
        {
            id: 'championship-replay-score',
            boardState: board,
            settings: { boardSize, komi: 6.5 },
            finalKomi: 6.5,
            captures,
            moveHistory: moves.slice(0, n).map((m) => ({ x: m.x, y: m.y })),
        } as any,
        { silent: true },
    );

    const black = analysis.areaScore?.black;
    const white = analysis.areaScore?.white;
    if (typeof black !== 'number' || typeof white !== 'number') return null;
    return { black, white };
}

type ChampionshipTerritoryAnalysisSource = {
    boardSize: number;
    moves?: Array<{ x: number; y: number; player: Player }>;
    boardState?: BoardState;
    status?: string;
    scoringAnalysis?: AnalysisResult | null;
};

/**
 * 챔피언십 실대국 계가·종료 판면의 영토/사석 오버레이용 분석 결과.
 * 서버가 내려준 KataGo `scoringAnalysis`를 우선 사용하고, 없을 때만 클라이언트 manual 폴백.
 */
export function resolveChampionshipTerritoryAnalysisForRealGame(
    rg: ChampionshipTerritoryAnalysisSource | null | undefined,
): AnalysisResult | null {
    if (rg?.scoringAnalysis) return rg.scoringAnalysis;
    return championshipTerritoryAnalysisForRealGame(rg);
}

/**
 * @deprecated {@link resolveChampionshipTerritoryAnalysisForRealGame} 사용 (KataGo 스냅샷 우선)
 * 서버 KataGo 분석이 없을 때 `manualScoring`으로 최종 국면을 산출한다.
 */
export function championshipTerritoryAnalysisForRealGame(
    rg: ChampionshipTerritoryAnalysisSource | null | undefined,
): AnalysisResult | null {
    if (!rg?.moves?.length) return null;
    const n = rg.moves.length;
    const replay = replayChampionshipMovesUpToPly(rg.boardSize, rg.moves, n);
    if (!replay) return null;
    const { board, captures } = replay;
    return calculateScoreManually(
        {
            id: 'championship-territory-overlay',
            boardState: board,
            settings: { boardSize: rg.boardSize, komi: 6.5 },
            finalKomi: 6.5,
            captures,
            moveHistory: rg.moves.map((m) => ({ x: m.x, y: m.y })),
        } as any,
        { silent: true },
    );
}
