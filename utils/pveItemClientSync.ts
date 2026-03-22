import type { LiveGameSession } from '../types/entities.js';
import type { PveItemActionClientSync } from '../types/api.js';

/** 탑/싱글 PVE: 서버 히든·스캔 검증용 스냅샷 (TOWER_CLIENT_MOVE 등으로 서버가 뒤처진 경우) */
export function buildPveItemActionClientSync(session: LiveGameSession): PveItemActionClientSync | undefined {
    const boardState = session.boardState;
    const moveHistory = session.moveHistory;
    if (!Array.isArray(boardState) || boardState.length === 0 || !Array.isArray(moveHistory)) {
        return undefined;
    }
    const sync: PveItemActionClientSync = {
        boardState: boardState.map((row) => [...row]),
        moveHistory: moveHistory.map((m) => ({ ...m })),
        hiddenMoves: session.hiddenMoves ? { ...session.hiddenMoves } : undefined,
        permanentlyRevealedStones: session.permanentlyRevealedStones?.map((p) => ({ ...p })),
        currentPlayer: session.currentPlayer,
        captures: session.captures ? { ...session.captures } : undefined,
        koInfo: session.koInfo,
        totalTurns: session.totalTurns,
    };
    const ai = (session as { aiInitialHiddenStone?: { x: number; y: number } | null }).aiInitialHiddenStone;
    if (ai != null && typeof ai === 'object' && typeof ai.x === 'number' && typeof ai.y === 'number') {
        sync.aiInitialHiddenStone = { x: ai.x, y: ai.y };
    } else if (ai === null) {
        sync.aiInitialHiddenStone = null;
    }
    return sync;
}
