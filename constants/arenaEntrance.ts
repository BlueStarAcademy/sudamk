/**
 * 경기장(콘텐츠 허브) 입장 on/off — 개별 GameMode 활성화(gameModeAvailability)와 별도.
 * 관리자 서버 설정에서 토글, KV `arenaEntranceAvailability`에 부분 저장 후 병합.
 */
export const ARENA_ENTRANCE_KEYS = [
    'singleplayer',
    'tower',
    'strategicLobby',
    'normalLobby',
    'friendlyLobby',
    'playfulLobby',
    'pairLobby',
    'championship',
    'adventure',
] as const;

export type ArenaEntranceKey = (typeof ARENA_ENTRANCE_KEYS)[number];

export const ARENA_ENTRANCE_LABELS: Record<ArenaEntranceKey, string> = {
    singleplayer: '모험',
    tower: '도전의 탑',
    strategicLobby: '랭킹전',
    normalLobby: '일반전',
    friendlyLobby: '친선전',
    playfulLobby: '놀이터',
    pairLobby: '페어',
    championship: '챔피언십',
    adventure: '탐험',
};

export const ARENA_ENTRANCE_CLOSED_MESSAGE: Record<ArenaEntranceKey, string> = {
    singleplayer: '모험 입장이 일시적으로 닫혀 있습니다.',
    tower: '도전의 탑 입장이 일시적으로 닫혀 있습니다.',
    strategicLobby: '랭킹전 입장이 일시적으로 닫혀 있습니다.',
    normalLobby: '일반전 입장이 일시적으로 닫혀 있습니다.',
    friendlyLobby: '친선전 입장이 일시적으로 닫혀 있습니다.',
    playfulLobby: '놀이터 입장이 일시적으로 닫혀 있습니다.',
    pairLobby: '페어 입장이 일시적으로 닫혀 있습니다.',
    championship: '챔피언십이 일시적으로 닫혀 있습니다.',
    adventure: '탐험이 일시적으로 닫혀 있습니다.',
};

const DEFAULT_OPEN: Record<ArenaEntranceKey, boolean> = {
    singleplayer: true,
    tower: true,
    strategicLobby: true,
    normalLobby: true,
    friendlyLobby: true,
    playfulLobby: true,
    pairLobby: true,
    championship: true,
    adventure: true,
};

export function mergeArenaEntranceAvailability(
    raw: Partial<Record<string, boolean>> | null | undefined,
): Record<ArenaEntranceKey, boolean> {
    const out = { ...DEFAULT_OPEN };
    if (!raw || typeof raw !== 'object') return out;
    for (const k of ARENA_ENTRANCE_KEYS) {
        if (typeof raw[k] === 'boolean') {
            out[k] = raw[k];
        }
    }
    return out;
}

export function isArenaEntranceOpen(
    serverPartial: Partial<Record<string, boolean>> | null | undefined,
    key: ArenaEntranceKey,
): boolean {
    return mergeArenaEntranceAvailability(serverPartial)[key];
}
