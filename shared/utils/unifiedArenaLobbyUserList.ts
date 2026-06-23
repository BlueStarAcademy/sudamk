import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants/gameModes.js';
import { GameMode, UserStatus } from '../types/enums.js';
import type { ArenaChannel } from '../types/api.js';
import { ARENA_CHANNEL_LABEL, arenaChannelForUserStatus } from './arenaChannel.js';

/** 서버 `UserStatusInfo`와 동일한 최소 필드 — 전략·놀이·페어 연동 대국실 유저 목록에 사용 */
export type UnifiedArenaLobbyUserPick = {
    status: UserStatus;
    mode?: GameMode | null;
    waitingLobby?: 'strategic' | 'playful';
    inPairLobby?: boolean;
    arenaChannel?: ArenaChannel;
    gameId?: string;
};

/** 로비 화면·대기실 메타가 있는데 `in-game`이 남은 stale 상태를 대기로 보정한다. */
export function normalizeStaleArenaLobbyUserStatus<T extends UnifiedArenaLobbyUserPick>(u: T): T {
    if (u.status !== UserStatus.InGame) return u;
    if (u.waitingLobby || u.inPairLobby) {
        const { gameId: _drop, ...rest } = u;
        return { ...rest, status: UserStatus.Waiting } as T;
    }
    return u;
}

/** 전략/놀이 집계 대기실에 속하는지 (서버 waitingLobby 우선, 구버전 호환으로 mode 카테고리) */
export function userMatchesAggregateWaitingLobby(u: UnifiedArenaLobbyUserPick, strategic: boolean): boolean {
    if (strategic) {
        return (
            u.waitingLobby === 'strategic' ||
            (!u.waitingLobby && u.mode != null && SPECIAL_GAME_MODES.some((m) => m.mode === u.mode))
        );
    }
    return (
        u.waitingLobby === 'playful' ||
        (!u.waitingLobby && u.mode != null && PLAYFUL_GAME_MODES.some((m) => m.mode === u.mode))
    );
}

/**
 * 전략·놀이·페어 대국실 유저 목록을 공통으로 쓸 때의 포함 여부.
 * (어느 경기장 화면에 있든 동일 풀에서 서로 보이도록 연동)
 */
export function userInUnifiedArenaLobbyUserList(u: UnifiedArenaLobbyUserPick): boolean {
    const st = u.status;
    if (st === UserStatus.Offline || st === UserStatus.Spectating) {
        return false;
    }
    const matchesStrategicOrPlayfulAggregate =
        userMatchesAggregateWaitingLobby(u, true) || userMatchesAggregateWaitingLobby(u, false);
    if (
        u.inPairLobby &&
        (st === UserStatus.Online ||
            st === UserStatus.Waiting ||
            st === UserStatus.Resting ||
            st === UserStatus.Negotiating ||
            st === UserStatus.InGame)
    ) {
        return true;
    }
    if (st === UserStatus.InGame || st === UserStatus.Negotiating) {
        return matchesStrategicOrPlayfulAggregate;
    }
    if (st === UserStatus.Waiting || st === UserStatus.Resting) {
        return matchesStrategicOrPlayfulAggregate;
    }
    return false;
}

export function userArenaChannelBadge(u: UnifiedArenaLobbyUserPick): { channel: ArenaChannel; label: string } | null {
    const channel = arenaChannelForUserStatus({ ...u, mode: u.mode ?? undefined });
    return channel ? { channel, label: ARENA_CHANNEL_LABEL[channel] } : null;
}
