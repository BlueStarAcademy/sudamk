import { GameMode, UserWithStatus } from '../../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants.js';

/** 전략/놀이 집계 경기장에 속하는지 (서버 waitingLobby 우선, 구버전 호환으로 mode 카테고리) */
export function userMatchesAggregateWaitingLobby(u: UserWithStatus, strategic: boolean): boolean {
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
