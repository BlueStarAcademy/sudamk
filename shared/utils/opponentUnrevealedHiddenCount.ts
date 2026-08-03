import { Player, type LiveGameSession, type Move, type Point } from '../types/index.js';

export type OpponentUnrevealedHiddenCountOptions = {
    /** 타워/싱글 mix 등: hiddenMoves가 아닌 상대 돌도 스캔 대상으로 볼지 */
    includeLooseOpponentStones?: boolean;
    hiddenStoneCountOrMix?: boolean;
    /**
     * 페어 히든·타워 병합 타이밍: 보드 칸이 None이어도 히든 수순이면 카운트.
     * (상대 본인 색 돌이 있는 칸은 제외하지 않음 — 호출부가 이미 상대색만 봄)
     */
    allowEmptyBoardCellForHiddenMoves?: boolean;
    /** 타워 사전 배치 AI 초기 히든은 스캔/표시 대상에서 제외 */
    excludePrePlacedAiInitialHidden?: boolean;
};

function isHiddenMoveAtIndex(game: LiveGameSession, idx: number): boolean {
    const hm = game.hiddenMoves as Record<string, boolean> | undefined;
    if (!hm || idx < 0) return false;
    return !!(hm[idx] ?? hm[String(idx)]);
}

function isPermanentlyRevealedAt(game: LiveGameSession, x: number, y: number): boolean {
    return !!game.permanentlyRevealedStones?.some((p: Point) => p.x === x && p.y === y);
}

function boardCellAllowsHiddenTarget(
    game: LiveGameSession,
    x: number,
    y: number,
    opponentPlayer: Player,
    allowEmpty: boolean,
): boolean {
    const board = game.boardState;
    if (!Array.isArray(board) || board.length === 0) return false;
    const row = board[y];
    if (!row || x < 0 || x >= row.length || y < 0 || y >= board.length) return false;
    const cell = row[x];
    if (cell === opponentPlayer) return true;
    if (allowEmpty && cell === Player.None) return true;
    return false;
}

/**
 * 보드에 남아 있는 “뷰어가 아직 못 찾은” 상대 미공개 히든 개수.
 * 서버 START_SCANNING / 클라 canScan과 동일 규칙(옵션으로 모드별 예외).
 */
export function countUnrevealedOpponentHiddenStones(
    game: LiveGameSession,
    viewerUserId: string,
    opponentPlayer: Player,
    opts: OpponentUnrevealedHiddenCountOptions = {},
): number {
    if (opponentPlayer !== Player.Black && opponentPlayer !== Player.White) return 0;

    const allowEmpty = !!opts.allowEmptyBoardCellForHiddenMoves;
    const myRevealedIdx = game.revealedHiddenMoves?.[viewerUserId] || [];
    const seen = new Set<string>();

    const tryAdd = (x: number, y: number): void => {
        const key = `${x},${y}`;
        if (seen.has(key)) return;
        seen.add(key);
    };

    if (game.hiddenMoves && game.moveHistory?.length) {
        for (let idx = 0; idx < game.moveHistory.length; idx++) {
            if (!isHiddenMoveAtIndex(game, idx)) continue;
            const m = game.moveHistory[idx] as Move;
            if (!m || m.x < 0 || m.y < 0) continue;
            if (m.player !== opponentPlayer) continue;
            if (myRevealedIdx.includes(idx)) continue;
            if (isPermanentlyRevealedAt(game, m.x, m.y)) continue;
            if (!boardCellAllowsHiddenTarget(game, m.x, m.y, opponentPlayer, allowEmpty)) continue;
            tryAdd(m.x, m.y);
        }
    }

    const aiHidden = (game as { aiInitialHiddenStone?: Point | null }).aiInitialHiddenStone;
    const aiPrePlaced = !!(game as { aiInitialHiddenStoneIsPrePlaced?: boolean }).aiInitialHiddenStoneIsPrePlaced;
    const skipAiInitial = opts.excludePrePlacedAiInitialHidden && aiPrePlaced;
    const aiInitialAlreadySoftFound = !!(
        aiHidden && (game as { scannedAiInitialHiddenByUser?: Record<string, boolean> }).scannedAiInitialHiddenByUser?.[
            viewerUserId
        ]
    );
    if (
        aiHidden &&
        !skipAiInitial &&
        typeof aiHidden.x === 'number' &&
        typeof aiHidden.y === 'number' &&
        aiHidden.x >= 0 &&
        aiHidden.y >= 0 &&
        !isPermanentlyRevealedAt(game, aiHidden.x, aiHidden.y) &&
        !aiInitialAlreadySoftFound &&
        boardCellAllowsHiddenTarget(game, aiHidden.x, aiHidden.y, opponentPlayer, allowEmpty)
    ) {
        tryAdd(aiHidden.x, aiHidden.y);
    }

    if (opts.includeLooseOpponentStones && opts.hiddenStoneCountOrMix && game.boardState && game.moveHistory) {
        for (const m of game.moveHistory) {
            if (!m || m.x < 0 || m.y < 0) continue;
            if (m.player !== opponentPlayer) continue;
            if (isPermanentlyRevealedAt(game, m.x, m.y)) continue;
            // loose: 서버와 동일하게 상대 돌이 보드에 남아 있어야 함 (빈칸 예외 없음)
            if (game.boardState[m.y]?.[m.x] !== opponentPlayer) continue;
            tryAdd(m.x, m.y);
        }
    }

    return seen.size;
}

export function hasOpponentHiddenScanTargets(
    game: LiveGameSession,
    viewerUserId: string,
    opponentPlayer: Player,
    opts: OpponentUnrevealedHiddenCountOptions = {},
): boolean {
    return countUnrevealedOpponentHiddenStones(game, viewerUserId, opponentPlayer, opts) > 0;
}
