/** 홈 접속 채널(Ch.1–Ch.100) 샤딩 상수 */

export const LOBBY_CHANNEL_COUNT = 100;
export const LOBBY_CHANNEL_CAPACITY = 100;
export const LOBBY_CHANNELS_PER_PAGE = 10;
export const LOBBY_CHANNEL_MIN = 1;
export const LOBBY_CHANNEL_MAX = LOBBY_CHANNEL_COUNT;

/** 친구 등록 상한 */
export const FRIEND_LIMIT = 50;

export function isValidLobbyChannel(channel: unknown): channel is number {
    return (
        typeof channel === 'number' &&
        Number.isInteger(channel) &&
        channel >= LOBBY_CHANNEL_MIN &&
        channel <= LOBBY_CHANNEL_MAX
    );
}
