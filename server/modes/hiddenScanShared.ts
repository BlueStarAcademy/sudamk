import type * as types from '../../types/index.js';

export function isHiddenMoveAtIndex(game: types.LiveGameSession, idx: number): boolean {
    const hm = game.hiddenMoves as Record<string, boolean> | undefined;
    if (!hm || idx < 0) return false;
    return !!(hm[idx] ?? hm[String(idx)]);
}

/** 동일 교차점 재착수 등으로 수순에 같은 좌표가 여러 번 나올 수 있어, 히든 판정은 마지막 수순을 사용 */
export function findLastMoveIndexAt(game: types.LiveGameSession, x: number, y: number): number {
    const hist = game.moveHistory;
    if (!hist?.length) return -1;
    for (let i = hist.length - 1; i >= 0; i--) {
        const m = hist[i];
        if (m.x === x && m.y === y) return i;
    }
    return -1;
}

export type HiddenScanBoardEval = {
    moveIndex: number;
    isAiInitialHiddenStone: boolean;
    isHiddenCell: boolean;
    alreadyFoundByMyScan: boolean;
    /** 처음 발견한 히든만 true — 스캔 소모 없음·스캔 모드 유지(몰래공개) */
    success: boolean;
};

export function evaluateHiddenScanBoard(game: types.LiveGameSession, userId: string, x: number, y: number): HiddenScanBoardEval {
    const isAiInitialHiddenStone = !!(
        (game as any).aiInitialHiddenStone &&
        (game as any).aiInitialHiddenStone.x === x &&
        (game as any).aiInitialHiddenStone.y === y
    );
    const moveIndex = findLastMoveIndexAt(game, x, y);
    const isHiddenCell = (moveIndex !== -1 && isHiddenMoveAtIndex(game, moveIndex)) || !!isAiInitialHiddenStone;
    const myRevealed = game.revealedHiddenMoves?.[userId] || [];
    const alreadyFoundByMyScan =
        (moveIndex !== -1 && myRevealed.includes(moveIndex)) ||
        (!!(game as any).scannedAiInitialHiddenByUser?.[userId] && isAiInitialHiddenStone);
    const success = isHiddenCell && !alreadyFoundByMyScan;
    return { moveIndex, isAiInitialHiddenStone, isHiddenCell, alreadyFoundByMyScan, success };
}

/** 스캔 첫 적중 시 몰래공개만 기록 (permanentlyRevealedStones에는 넣지 않음) */
export function recordSoftHiddenScanDiscovery(
    game: types.LiveGameSession,
    userId: string,
    evalResult: HiddenScanBoardEval
): void {
    if (!evalResult.success) return;
    const { moveIndex, isAiInitialHiddenStone } = evalResult;
    if (!game.revealedHiddenMoves) game.revealedHiddenMoves = {};
    if (!game.revealedHiddenMoves[userId]) game.revealedHiddenMoves[userId] = [];
    if (moveIndex !== -1 && !game.revealedHiddenMoves[userId].includes(moveIndex)) {
        game.revealedHiddenMoves[userId].push(moveIndex);
    }
    if (isAiInitialHiddenStone) {
        if (!(game as any).scannedAiInitialHiddenByUser) (game as any).scannedAiInitialHiddenByUser = {};
        (game as any).scannedAiInitialHiddenByUser[userId] = true;
    }
}

export function buildHiddenScanAnimation(now: number, playerId: string, x: number, y: number, success: boolean) {
    return {
        type: 'scan' as const,
        point: { x, y },
        success,
        startTime: now,
        duration: 2000,
        playerId,
        ...(success ? { towerResumeScanning: true } : {}),
    };
}

export type ScanTargetOptions = {
    /** 타워/싱글 mix 등: hiddenMoves가 아닌 상대 돌도 스캔 대상으로 볼지 */
    includeLooseOpponentStones: boolean;
    hiddenStoneCountOrMix: boolean;
};

/** START_SCANNING 진입 가능 여부: 상대 미전체공개 히든이 남았는지(내가 이미 몰래공개한 칸 제외) */
export function hasOpponentHiddenScanTargets(
    game: types.LiveGameSession,
    userId: string,
    opponentPlayerEnum: types.Player,
    opts: ScanTargetOptions
): boolean {
    const myRevealedIdx = game.revealedHiddenMoves?.[userId] || [];
    const hasUnrevealedInMoveHistory = !!(
        game.hiddenMoves &&
        game.moveHistory &&
        game.moveHistory.some((m: types.Move, idx: number) => {
            if (m.x === -1 || m.y === -1) return false;
            if (m.player !== opponentPlayerEnum) return false;
            if (!isHiddenMoveAtIndex(game, idx)) return false;
            const isRevealed = game.permanentlyRevealedStones?.some((p: types.Point) => p.x === m.x && p.y === m.y);
            const stillOnBoard = game.boardState?.[m.y]?.[m.x] === opponentPlayerEnum;
            const alreadyFoundByMyScan = myRevealedIdx.includes(idx);
            return !isRevealed && stillOnBoard && !alreadyFoundByMyScan;
        })
    );

    const aiHidden = (game as any).aiInitialHiddenStone as { x: number; y: number } | undefined;
    const aiInitialAlreadySoftFound = !!(aiHidden && (game as any).scannedAiInitialHiddenByUser?.[userId]);
    const hasUnrevealedAiInitial = !!(
        aiHidden &&
        !game.permanentlyRevealedStones?.some((p: types.Point) => p.x === aiHidden.x && p.y === aiHidden.y) &&
        game.boardState?.[aiHidden.y]?.[aiHidden.x] === opponentPlayerEnum &&
        !aiInitialAlreadySoftFound
    );

    let hasLoose = false;
    if (opts.includeLooseOpponentStones && opts.hiddenStoneCountOrMix && game.boardState && game.moveHistory) {
        hasLoose = game.moveHistory.some((m: types.Move) => {
            if (m.x < 0 || m.y < 0) return false;
            if (m.player !== opponentPlayerEnum) return false;
            const isRevealed = game.permanentlyRevealedStones?.some((p: types.Point) => p.x === m.x && p.y === m.y);
            const stillOnBoard = game.boardState![m.y][m.x] === opponentPlayerEnum;
            return !isRevealed && stillOnBoard;
        });
    }

    return hasUnrevealedInMoveHistory || hasUnrevealedAiInitial || hasLoose;
}
