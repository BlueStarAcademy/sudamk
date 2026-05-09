import { processMoveClient } from '../client/goLogicClient.js';
import { Player, type BoardState } from '../types/index.js';
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
