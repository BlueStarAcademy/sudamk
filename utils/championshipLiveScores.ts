import { processMoveClient } from '../client/goLogicClient.js';
import { Player, type BoardState } from '../types/index.js';
import { calculateScoreManually } from '../shared/utils/manualScoring.js';

const createEmptyBoard = (boardSize: number): BoardState =>
    Array.from({ length: boardSize }, () => Array.from({ length: boardSize }, () => Player.None));

/**
 * 챔피언십 실대국 기보 재생 중 `ply`수까지 둔 직후 판·따내기로 한국식 집 점수를 계산한다.
 * (`shared/utils/manualScoring` — 서버 `generateChampionshipRealMatch`와 동일 경로)
 */
export function championshipAreaScoresAtPly(
    boardSize: number,
    moves: Array<{ x: number; y: number; player: Player }>,
    ply: number,
): { black: number; white: number } | null {
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
