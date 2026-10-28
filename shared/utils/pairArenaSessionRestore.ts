import {
    PAIR_LOBBY_FOCUS_ROOM_TAB_SESSION_KEY,
    POST_GAME_OPEN_HOME_LOBBY_SESSION_KEY,
    POST_GAME_PAIR_ROOM_RESTORE_SESSION_KEY,
} from '../constants/pairArena.js';
import type { ArenaChannel, ArenaLobbyIntent } from '../types/api.js';
import { arenaLobbyHash } from './arenaLobbyDestination.js';

export type PairArenaLobbyChannel = ArenaChannel;

export type PostGameHomeLobbyKind = 'friendly' | 'playful';

/** 대기실에서 만든 유지 방 — 랭킹 합성 ID·일회용 AI 껍데기는 제외 */
export function isPersistentPairWaitingRoomId(roomId: string | null | undefined): roomId is string {
    if (!roomId) return false;
    if (roomId.startsWith('pair-ai-ephemeral-')) return false;
    if (roomId.startsWith('pair-duo-ranked-')) return false;
    if (roomId.startsWith('pair-ranked-')) return false;
    return roomId.length > 0;
}

export function normalizePairArenaLobbyChannel(value: unknown): PairArenaLobbyChannel {
    return value === 'strategic' || value === 'playful' || value === 'pair' || value === 'friendly'
        ? value
        : 'pair';
}

export function postGameHomeLobbyKindFromChannel(
    channel: PairArenaLobbyChannel | null | undefined,
): PostGameHomeLobbyKind {
    return channel === 'playful' ? 'playful' : 'friendly';
}

/** `Game`이 `gameState_${gameId}`에 넣는 PVP 페어 경기장 복귀용 스냅샷 */
export function readPairArenaRestoreFromGameStateStorage(gameId: string): {
    roomId: string;
    lobbyChannel: PairArenaLobbyChannel;
    lobbyIntent?: ArenaLobbyIntent;
} | null {
    try {
        const raw = sessionStorage.getItem(`gameState_${gameId}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as {
            pairArenaRestore?: { roomId?: unknown; lobbyChannel?: unknown; lobbyIntent?: unknown };
        };
        const pr = parsed.pairArenaRestore;
        const roomId = typeof pr?.roomId === 'string' && pr.roomId.length > 0 ? pr.roomId : null;
        if (!roomId) return null;
        const lobbyChannel = normalizePairArenaLobbyChannel(pr?.lobbyChannel);
        const li = pr?.lobbyIntent;
        const lobbyIntent: ArenaLobbyIntent | undefined = li === 'pvp' || li === 'ai' ? li : undefined;
        return { roomId, lobbyChannel, lobbyIntent };
    } catch {
        return null;
    }
}

export function pairArenaLobbyHash(
    lobbyChannel: PairArenaLobbyChannel,
    lobbyIntent: ArenaLobbyIntent = 'pvp',
): string {
    return arenaLobbyHash({ intent: lobbyIntent, channel: lobbyChannel });
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

export function stashPostGameOpenHomeLobby(kind: PostGameHomeLobbyKind): void {
    try {
        sessionStorage.setItem(POST_GAME_OPEN_HOME_LOBBY_SESSION_KEY, kind);
    } catch {
        // ignore
    }
}

export function consumePostGameOpenHomeLobby(): PostGameHomeLobbyKind | null {
    try {
        const raw = sessionStorage.getItem(POST_GAME_OPEN_HOME_LOBBY_SESSION_KEY);
        if (raw !== 'friendly' && raw !== 'playful') return null;
        sessionStorage.removeItem(POST_GAME_OPEN_HOME_LOBBY_SESSION_KEY);
        return raw;
    } catch {
        return null;
    }
}

export type PostGamePairRoomRestoreSource = {
    settings?: {
        pairGame?: { roomId?: string | null; lobbyChannel?: unknown; pairMode?: unknown } | null;
        pairWaitingRoomReturn?: { roomId?: string | null; lobbyChannel?: unknown } | null;
    } | null;
};

/** pairGame 페어국 또는 duo 1:1의 pairWaitingRoomReturn에서 복귀 방 정보를 읽는다. */
export function resolvePostGamePairRoomRestore(
    session: PostGamePairRoomRestoreSource,
): { roomId: string; lobbyChannel: PairArenaLobbyChannel; lobbyIntent: ArenaLobbyIntent } | null {
    const pairGame = session.settings?.pairGame;
    if (isPersistentPairWaitingRoomId(pairGame?.roomId)) {
        return {
            roomId: pairGame.roomId,
            lobbyChannel: normalizePairArenaLobbyChannel(pairGame.lobbyChannel),
            lobbyIntent: pairGame.pairMode === 'ai' ? 'ai' : 'pvp',
        };
    }
    const shell = session.settings?.pairWaitingRoomReturn;
    if (!isPersistentPairWaitingRoomId(shell?.roomId)) return null;
    return {
        roomId: shell.roomId,
        lobbyChannel: normalizePairArenaLobbyChannel(shell.lobbyChannel),
        lobbyIntent: 'pvp',
    };
}

/**
 * 친선·놀이 대기실 방에서 시작한 대국이 끝나면 같은 방으로 돌아가도록 복원 키를 남긴다.
 * 홈 퀵유틸 임베드가 이 키를 읽어 대기실을 다시 연다.
 */
export function stashPostGamePairRoomLobbyReturn(session: PostGamePairRoomRestoreSource): void {
    const restore = resolvePostGamePairRoomRestore(session);
    if (!restore) return;
    stashPairArenaRoomRestoreForLobbyNavigation(restore.roomId, restore.lobbyChannel);
    stashPostGameOpenHomeLobby(postGameHomeLobbyKindFromChannel(restore.lobbyChannel));
}

/**
 * 종료 후 대국실에 남는 PVP linger 후보.
 * 친선·놀이 방 껍데기(`pairWaitingRoomReturn` / `pairGame.roomId`)로 복귀할 대국은 제외한다.
 */
export function sessionShouldRetainEndedPvpLingerRoom(session: {
    gameStatus?: string | null;
    isSinglePlayer?: boolean;
    isAiGame?: boolean;
    settings?: PostGamePairRoomRestoreSource['settings'];
} | null | undefined): boolean {
    if (!session) return false;
    if (session.gameStatus !== 'ended' && session.gameStatus !== 'no_contest') return false;
    if (session.isSinglePlayer || session.isAiGame) return false;
    if (resolvePostGamePairRoomRestore(session)) return false;
    if (session.settings?.pairGame) return false;
    return true;
}
