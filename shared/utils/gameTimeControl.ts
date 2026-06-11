import { GameMode } from '../types/enums.js';
import { mixGoOrPureModeIncludes } from './mixGoRules.js';
import { SPEED_PER_MOVE_SECONDS } from '../constants/speedTimePressure.js';

type TimeControlSession = {
    mode: GameMode;
    settings?: { timeIncrement?: number; mixedModes?: GameMode[] };
    gameCategory?: string;
};

/** 스피드·믹스(스피드 포함) 모드 여부 */
export function isSpeedMode(session: TimeControlSession): boolean {
    return mixGoOrPureModeIncludes(session.mode, session.settings?.mixedModes, GameMode.Speed);
}

/**
 * 스피드 수당 10초·초과 페널티 오버레이 활성 여부.
 * 메인 시계(Fischer/초읽기)와 공존한다.
 */
export function hasSpeedPerMovePressure(session: TimeControlSession): boolean {
    return isSpeedMode(session);
}

/** @deprecated {@link hasSpeedPerMovePressure} — 스피드 모드·오버레이 동일 의미 */
export function isSpeedPerMoveTimeControl(session: TimeControlSession): boolean {
    return hasSpeedPerMovePressure(session);
}

export function getSpeedPerMoveSeconds(_session?: TimeControlSession): number {
    return SPEED_PER_MOVE_SECONDS;
}

/** 메인 시계가 Fischer(수 후 시간 추가)인지. 스피드도 timeIncrement > 0이면 true. */
export function isFischerStyleTimeControl(session: TimeControlSession): boolean {
    return (session.settings?.timeIncrement ?? 0) > 0;
}

export function getFischerIncrementSeconds(session: TimeControlSession): number {
    return isFischerStyleTimeControl(session) ? (session.settings?.timeIncrement ?? 0) : 0;
}
