import {
    PAIR_LOBBY_FOCUS_ROOM_TAB_SESSION_KEY,
    POST_GAME_PAIR_ROOM_RESTORE_SESSION_KEY,
} from '../constants/pairArena.js';

export type PairArenaLobbyChannel = 'pair' | 'strategic' | 'playful';

/** `Game`이 `gameState_${gameId}`에 넣는 PVP 페어 경기장 복귀용 스냅샷 */
export function readPairArenaRestoreFromGameStateStorage(gameId: string): {
    roomId: string;
    lobbyChannel: PairArenaLobbyChannel;
} | null {
    try {
        const raw = sessionStorage.getItem(`gameState_${gameId}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as {
            pairArenaRestore?: { roomId?: unknown; lobbyChannel?: unknown };
        };
        const pr = parsed.pairArenaRestore;
        const roomId = typeof pr?.roomId === 'string' && pr.roomId.length > 0 ? pr.roomId : null;
        if (!roomId) return null;
        const ch = pr?.lobbyChannel;
        const lobbyChannel: PairArenaLobbyChannel =
            ch === 'strategic' || ch === 'playful' || ch === 'pair' ? ch : 'pair';
        return { roomId, lobbyChannel };
    } catch {
        return null;
    }
}

export function pairArenaLobbyHash(lobbyChannel: PairArenaLobbyChannel): string {
    if (lobbyChannel === 'strategic') return '#/waiting/strategic';
    if (lobbyChannel === 'playful') return '#/waiting/playful';
    return '#/pair';
}

/** PairWaitingLobby가 읽고 제거하는 키 — 모바일 N번방 포커스·재입장 시도 */
export function stashPairArenaRoomRestoreForLobbyNavigation(
    roomId: string,
    _lobbyChannel: PairArenaLobbyChannel,
): void {
    try {
        sessionStorage.setItem(POST_GAME_PAIR_ROOM_RESTORE_SESSION_KEY, roomId);
        sessionStorage.setItem(PAIR_LOBBY_FOCUS_ROOM_TAB_SESSION_KEY, '1');
    } catch {
        // ignore
    }
}
