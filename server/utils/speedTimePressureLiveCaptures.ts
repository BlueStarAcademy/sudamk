import type { LiveGameSession } from '../../types/index.js';
import {
    SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT,
    SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT,
    SPEED_TIME_PRESSURE_SECONDS_PER_POINT,
    SPEED_TIME_PRESSURE_SERVER_SECONDS_PER_POINT,
} from '../../shared/constants/speedTimePressure.js';
import {
    getSpeedTimeBonusPointsDesired as getSpeedTimeBonusPointsDesiredCore,
    getSpeedTimePressureConsumptionSnapshot as getSpeedTimePressureConsumptionSnapshotCore,
    isSessionSpeedTimePressureMode,
    syncSpeedTimePressureCaptures as syncSpeedTimePressureCapturesCore,
} from '../../shared/utils/speedTimePressureSessionSync.js';
import { aiUserId } from '../aiPlayer.js';
import { hasTimeControl, shouldEnforceTimeControl } from '../modes/shared.js';

export {
    SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT,
    SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT,
    SPEED_TIME_PRESSURE_SECONDS_PER_POINT,
    SPEED_TIME_PRESSURE_SERVER_SECONDS_PER_POINT,
    isSessionSpeedTimePressureMode,
};

/**
 * 착수·패스 직후 시계(남은 시간·turnDeadline)·`__speedBonusConsumedSec` 반영 여부.
 * PVP는 패배까지 강제, AI/싱글/페어 AI 등 스피드는 패배 없이도 피셔 막대·시간 압박(공통 간격)으로 상대 점수용 시계를 유지한다.
 */
export function shouldRunGoClockAccountingForSession(game: LiveGameSession): boolean {
    if (!hasTimeControl(game.settings)) return false;
    if (shouldEnforceTimeControl(game)) return true;
    return isSessionSpeedTimePressureMode(game);
}

export function getSpeedTimePressureConsumptionSnapshot(
    session: LiveGameSession,
    nowMs: number,
): { blackConsumed: number; whiteConsumed: number } {
    return getSpeedTimePressureConsumptionSnapshotCore(session, nowMs, aiUserId);
}

export function getSpeedTimeBonusPointsDesired(
    session: LiveGameSession,
    nowMs: number,
): { blackBonus: number; whiteBonus: number } {
    return getSpeedTimeBonusPointsDesiredCore(session, nowMs, aiUserId);
}

export function syncSpeedTimePressureCaptures(game: LiveGameSession, nowMs: number): boolean {
    return syncSpeedTimePressureCapturesCore(game, nowMs, aiUserId);
}
