import {
    LOBBY_CHANNEL_CAPACITY,
    LOBBY_CHANNEL_COUNT,
    LOBBY_CHANNEL_MIN,
    isValidLobbyChannel,
} from '../constants/lobbyChannel.js';
import { UserStatus } from '../types/enums.js';
import type { UserStatusInfo } from '../types/api.js';

export type LobbyChannelStatusMap = Record<string, Pick<UserStatusInfo, 'status' | 'lobbyChannel'> | undefined>;

/** Offline 제외 — 채널 정원에 포함되는 접속자 */
export function isLobbyChannelOccupant(status: Pick<UserStatusInfo, 'status'> | null | undefined): boolean {
    if (!status) return false;
    return status.status !== UserStatus.Offline;
}

export function resolveLobbyChannel(status: Pick<UserStatusInfo, 'lobbyChannel'> | null | undefined): number | null {
    const ch = status?.lobbyChannel;
    return isValidLobbyChannel(ch) ? ch : null;
}

/**
 * 채널 변경 모달·정원 집계용 맵.
 * - 전체 온라인 유저를 넣어야 다른 채널 인원이 맞게 나오고
 * - 본인은 항상 `viewerChannel`로 보정(목록의 「나를 포함한 접속자」와 동일)
 */
export function buildLobbyChannelStatusMap(params: {
    users: Array<{ id?: string; status?: UserStatusInfo['status']; lobbyChannel?: number | null } | null | undefined>;
    viewer?: { id?: string; status?: UserStatusInfo['status']; lobbyChannel?: number | null } | null;
    viewerChannel?: number | null;
}): LobbyChannelStatusMap {
    const map: LobbyChannelStatusMap = {};
    for (const u of params.users) {
        if (!u?.id) continue;
        map[u.id] = { status: u.status, lobbyChannel: u.lobbyChannel ?? undefined };
    }
    const viewer = params.viewer;
    if (viewer?.id) {
        const ch =
            resolveLobbyChannel(viewer) ??
            (isValidLobbyChannel(params.viewerChannel) ? params.viewerChannel : null) ??
            resolveLobbyChannel(map[viewer.id]) ??
            LOBBY_CHANNEL_MIN;
        map[viewer.id] = {
            status: viewer.status ?? map[viewer.id]?.status ?? UserStatus.Online,
            lobbyChannel: ch,
        };
    }
    return map;
}

export function countUsersInLobbyChannel(
    userStatuses: LobbyChannelStatusMap,
    channel: number,
    excludeUserId?: string,
): number {
    if (!isValidLobbyChannel(channel)) return 0;
    let count = 0;
    for (const [userId, st] of Object.entries(userStatuses)) {
        if (excludeUserId && userId === excludeUserId) continue;
        if (!isLobbyChannelOccupant(st)) continue;
        if (resolveLobbyChannel(st) === channel) count += 1;
    }
    return count;
}

export function canJoinLobbyChannel(
    userStatuses: LobbyChannelStatusMap,
    channel: number,
    excludeUserId?: string,
): boolean {
    if (!isValidLobbyChannel(channel)) return false;
    return countUsersInLobbyChannel(userStatuses, channel, excludeUserId) < LOBBY_CHANNEL_CAPACITY;
}

/** 1부터 순회해 정원이 남은 첫 채널. 전부 만원이면 null */
export function allocateLobbyChannel(userStatuses: LobbyChannelStatusMap, excludeUserId?: string): number | null {
    for (let ch = LOBBY_CHANNEL_MIN; ch <= LOBBY_CHANNEL_COUNT; ch += 1) {
        if (canJoinLobbyChannel(userStatuses, ch, excludeUserId)) return ch;
    }
    return null;
}

export function ensureLobbyChannel(
    userStatuses: LobbyChannelStatusMap,
    current: Pick<UserStatusInfo, 'lobbyChannel'> | null | undefined,
    userId?: string,
): number {
    const existing = resolveLobbyChannel(current);
    if (existing != null) return existing;
    return allocateLobbyChannel(userStatuses, userId) ?? LOBBY_CHANNEL_MIN;
}
