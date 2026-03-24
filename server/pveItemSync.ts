import type { LiveGameSession, PveItemActionClientSync } from '../shared/types/index.js';

/** PVE: 클라(TOWER_CLIENT_MOVE 등)만 앞서 있는 판·hiddenMoves를 아이템 액션 직전 서버 세션에 반영 */
export function applyPveItemActionClientSync(game: LiveGameSession, payload: unknown): void {
    const sync = (payload as { clientSync?: PveItemActionClientSync })?.clientSync;
    if (!sync || typeof sync !== 'object') return;
    if (!Array.isArray(sync.boardState) || sync.boardState.length === 0) return;
    if (!Array.isArray(sync.moveHistory)) return;
    game.boardState = sync.boardState.map((row: number[]) => [...row]);
    game.moveHistory = sync.moveHistory.map((m) => ({ ...m }));
    if (sync.hiddenMoves != null && typeof sync.hiddenMoves === 'object') {
        game.hiddenMoves = { ...sync.hiddenMoves };
    }
    if (Array.isArray(sync.permanentlyRevealedStones)) {
        game.permanentlyRevealedStones = sync.permanentlyRevealedStones.map((p) => ({ ...p }));
    }
    if (sync.aiInitialHiddenStone === null) {
        (game as { aiInitialHiddenStone?: unknown }).aiInitialHiddenStone = undefined;
    } else if (
        sync.aiInitialHiddenStone &&
        typeof (sync.aiInitialHiddenStone as { x?: number }).x === 'number' &&
        typeof (sync.aiInitialHiddenStone as { y?: number }).y === 'number'
    ) {
        (game as { aiInitialHiddenStone?: { x: number; y: number } }).aiInitialHiddenStone = {
            x: sync.aiInitialHiddenStone.x,
            y: sync.aiInitialHiddenStone.y,
        };
    }
    if (sync.currentPlayer !== undefined && sync.currentPlayer !== null) {
        game.currentPlayer = sync.currentPlayer;
    }
    if (sync.captures && typeof sync.captures === 'object') {
        game.captures = { ...game.captures, ...sync.captures } as typeof game.captures;
    }
    if ('koInfo' in sync) {
        game.koInfo = sync.koInfo ?? null;
    }
    if (sync.totalTurns != null && Number.isFinite(sync.totalTurns)) {
        game.totalTurns = sync.totalTurns;
    }
}
