import type { LiveGameSession } from '../types/entities.js';
import type { PveItemActionClientSync } from '../types/api.js';
import { Player } from '../types/enums.js';
import { aiUserId } from '../shared/constants/auth.js';

const isAiControlledPlayerId = (id: string | undefined | null): boolean =>
    id === aiUserId || Boolean(id && (id.startsWith('dungeon-bot-') || id.startsWith('pair-') || id.startsWith('pet-ai-')));

const getOwnerIdAt = (session: LiveGameSession, x: number, y: number): string | null | undefined => {
    const owner = session.boardState?.[y]?.[x];
    if (owner === Player.Black) return session.blackPlayerId;
    if (owner === Player.White) return session.whitePlayerId;
    return undefined;
};

const isHumanControlledPlayer = (session: LiveGameSession, player: Player): boolean => {
    const id = player === Player.Black ? session.blackPlayerId : player === Player.White ? session.whitePlayerId : undefined;
    return !!id && !isAiControlledPlayerId(id);
};

function sanitizeHiddenMovesWithHumanMarkers(
    session: LiveGameSession,
    hiddenMoves: LiveGameSession['hiddenMoves']
): LiveGameSession['hiddenMoves'] {
    const markers = (session as { humanHiddenStonePoints?: Array<{ x: number; y: number; player?: Player }> }).humanHiddenStonePoints;
    if (!hiddenMoves || !Array.isArray(session.moveHistory) || !Array.isArray(markers) || markers.length === 0) {
        return hiddenMoves;
    }
    const next: NonNullable<LiveGameSession['hiddenMoves']> = {};
    for (const [rawIndex, isHidden] of Object.entries(hiddenMoves)) {
        if (!isHidden) continue;
        const index = Number(rawIndex);
        if (!Number.isInteger(index) || index < 0) continue;
        const move = session.moveHistory[index];
        if (!move || move.x < 0 || move.y < 0) continue;
        if (isHumanControlledPlayer(session, move.player)) {
            const markerExists = markers.some(marker =>
                marker.x === move.x &&
                marker.y === move.y &&
                (marker.player === undefined || marker.player === move.player)
            );
            if (!markerExists) continue;
        }
        next[index] = true;
    }
    return Object.keys(next).length > 0 ? next : undefined;
}

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
        hiddenMoves: sanitizeHiddenMovesWithHumanMarkers(session, session.hiddenMoves),
        humanHiddenStonePoints: (session as { humanHiddenStonePoints?: Array<{ x: number; y: number; player?: Player }> })
            .humanHiddenStonePoints?.map((point) => ({ ...point })),
        permanentlyRevealedStones: session.permanentlyRevealedStones?.map((p) => ({ ...p })),
        baseStones: session.baseStones?.map((p) => ({ ...p })),
        blackPatternStones: session.blackPatternStones?.map((p) => ({ ...p })),
        whitePatternStones: session.whitePatternStones?.map((p) => ({ ...p })),
        consumedPatternIntersections: Array.isArray((session as any).consumedPatternIntersections)
            ? (session as any).consumedPatternIntersections.map((p: { x: number; y: number }) => ({ ...p }))
            : undefined,
        currentPlayer: session.currentPlayer,
        gameStatus: session.gameStatus,
        captures: session.captures ? { ...session.captures } : undefined,
        baseStoneCaptures: session.baseStoneCaptures ? { ...session.baseStoneCaptures } : undefined,
        hiddenStoneCaptures: session.hiddenStoneCaptures ? { ...session.hiddenStoneCaptures } : undefined,
        koInfo: session.koInfo,
        totalTurns: session.totalTurns,
    };
    const ai = (session as { aiInitialHiddenStone?: { x: number; y: number } | null }).aiInitialHiddenStone;
    if (ai != null && typeof ai === 'object' && typeof ai.x === 'number' && typeof ai.y === 'number') {
        const ownerId = getOwnerIdAt(session, ai.x, ai.y);
        if (isAiControlledPlayerId(ownerId)) {
            sync.aiInitialHiddenStone = { x: ai.x, y: ai.y };
        }
    } else if (ai === null) {
        sync.aiInitialHiddenStone = null;
    }
    return sync;
}
