import type { UserStatusInfo, VolatileState } from '../../types/index.js';
import { isValidLobbyChannel } from '../../shared/constants/lobbyChannel.js';
import { ensureLobbyChannel } from '../../shared/utils/lobbyChannel.js';

/**
 * userStatuses 덮어쓸 때 lobbyChannel을 보존하거나, 없으면 자동 배정한다.
 */
export function stampLobbyChannel(
    userStatuses: VolatileState['userStatuses'],
    userId: string,
    next: UserStatusInfo,
): UserStatusInfo {
    const prev = userStatuses[userId];
    const lobbyChannel = isValidLobbyChannel(next.lobbyChannel)
        ? next.lobbyChannel
        : ensureLobbyChannel(userStatuses, prev, userId);
    return { ...next, lobbyChannel };
}

export function setUserStatusPreservingLobbyChannel(
    volatileState: VolatileState,
    userId: string,
    next: UserStatusInfo,
): UserStatusInfo {
    const stamped = stampLobbyChannel(volatileState.userStatuses, userId, next);
    volatileState.userStatuses[userId] = stamped;
    return stamped;
}
