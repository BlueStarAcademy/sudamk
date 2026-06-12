import type { BoardState, LiveGameSession } from '../types.js';

/** 보드 상태의 빠른 fingerprint — 전체 JSON 직렬화 대신 사용 */
export function computeBoardQuickHash(board: BoardState | undefined | null): string {
    if (!board?.length) return '0';
    let hash = 17;
    let occupied = 0;
    for (let y = 0; y < board.length; y++) {
        const row = board[y];
        if (!row?.length) continue;
        for (let x = 0; x < row.length; x++) {
            const cell = row[x];
            if (cell != null && cell !== 0) {
                occupied++;
                hash = ((hash << 5) - hash + y * 997 + x * 31 + Number(cell)) | 0;
            }
        }
    }
    return `${occupied}:${hash}`;
}

function moveHistoryTailFingerprint(moveHistory: LiveGameSession['moveHistory']): string {
    const len = moveHistory?.length ?? 0;
    if (len === 0) return '0';
    const last = moveHistory![len - 1];
    return `${len}:${last?.x ?? -1},${last?.y ?? -1},${last?.player ?? 0}`;
}

function capturesFingerprint(captures: LiveGameSession['captures'] | undefined): string {
    if (!captures) return '';
    const b = captures[1 as keyof typeof captures] ?? 0;
    const w = captures[2 as keyof typeof captures] ?? 0;
    return `${b}|${w}`;
}

/**
 * GAME_UPDATE 동일성 비교용 경량 fingerprint.
 * `stableStringify(game)` 전체 직렬화보다 훨씬 저렴하다.
 */
export function computeGameSessionFingerprint(game: LiveGameSession): string {
    const parts = [
        game.serverRevision ?? 0,
        game.gameStatus ?? '',
        game.currentPlayer ?? 0,
        moveHistoryTailFingerprint(game.moveHistory),
        computeBoardQuickHash(game.boardState),
        game.animation?.type ?? '',
        (game.animation as { playerId?: string } | null)?.playerId ?? '',
        game.disconnectionState?.disconnectedPlayerId ?? '',
        game.disconnectionState?.timerStartedAt ?? 0,
        capturesFingerprint(game.captures),
        game.round ?? 0,
        game.totalTurns ?? 0,
        game.blackTimeLeft ?? 0,
        game.whiteTimeLeft ?? 0,
        game.revealAnimationEndTime ?? 0,
        (game as { aiHiddenItemAnimationEndTime?: number }).aiHiddenItemAnimationEndTime ?? 0,
    ];
    return parts.join(';');
}
