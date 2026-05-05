/**
 * 페어 로비 `pairLobbyOwnerId`는 방장 좌석과 일치할 때만 "방장 전용 베이스 배치"로 취급한다.
 * (좌석과 무관한 id가 남아 있으면 양측 플레이어 UI가 비는 버그를 방지)
 */
export function getEffectivePairLobbyOwnerId(session: {
    player1: { id: string };
    player2: { id: string };
    settings?: { pairGame?: { pairLobbyOwnerId?: string } };
}): string | undefined {
    const raw = session.settings?.pairGame?.pairLobbyOwnerId;
    if (typeof raw !== 'string' || raw.length === 0) return undefined;
    if (raw !== session.player1.id && raw !== session.player2.id) return undefined;
    return raw;
}
