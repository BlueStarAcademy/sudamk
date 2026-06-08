import { GameMode } from '../types/enums.js';
import { mixGoOrPureModeIncludes } from './mixGoRules.js';
import { SPEED_PER_MOVE_SECONDS } from '../constants/speedTimePressure.js';

type TimeControlSession = {
    mode: GameMode;
    settings?: { timeIncrement?: number; mixedModes?: GameMode[] };
    gameCategory?: string;
};

/** 스피드·믹스(스피드 포함): 수당 10초 초읽기 + 메인 제한시간 이중 시계 */
export function isSpeedPerMoveTimeControl(session: TimeControlSession): boolean {
    return mixGoOrPureModeIncludes(session.mode, session.settings?.mixedModes, GameMode.Speed);
}

export function getSpeedPerMoveSeconds(_session?: TimeControlSession): number {
    return SPEED_PER_MOVE_SECONDS;
}

/**
 * 길드 전쟁(비스피드) 등 피셔식 증가가 적용되는지.
 * 스피드 바둑은 수당 초읽기 규칙을 쓰므로 Fischer가 아니다.
 */
export function isFischerStyleTimeControl(session: TimeControlSession): boolean {
    if (isSpeedPerMoveTimeControl(session)) return false;
    if (session.gameCategory === 'guildwar' && (session.settings?.timeIncrement ?? 0) > 0) return true;
    return false;
}

export function getFischerIncrementSeconds(session: TimeControlSession): number {
    return isFischerStyleTimeControl(session) ? (session.settings?.timeIncrement ?? 0) : 0;
}
