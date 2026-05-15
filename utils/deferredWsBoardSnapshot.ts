import type { LiveGameSession } from '../types.js';

/** moveHistory 길이로 “한 수 앞선” 지연 표시 스냅샷을 고른다 (PASS 포함 전체 길이). */
export function wsSessionMoveHistoryLen(session: LiveGameSession | null | undefined): number {
    const mh = session?.moveHistory;
    return Array.isArray(mh) ? mh.length : 0;
}

/**
 * AI 수 WS 지연 적용 중 서버가 먼저 `scoring`만 보낼 때,
 * React state보다 긴 수순을 가진 pending 스냅샷을 선택해 마지막 착점·판면이 사라지지 않게 한다.
 */
export function pickRicherWsBoardSnapshot(
    client: LiveGameSession | null | undefined,
    pendingDeferred: LiveGameSession | null | undefined,
): LiveGameSession | null | undefined {
    if (!pendingDeferred) return client ?? undefined;
    if (!client) return pendingDeferred;
    return wsSessionMoveHistoryLen(pendingDeferred) > wsSessionMoveHistoryLen(client) ? pendingDeferred : client;
}
