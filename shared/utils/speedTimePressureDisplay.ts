import {
    SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT,
    SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT,
    SPEED_TIME_PRESSURE_UI_COUNTDOWN_MAX_SECONDS,
} from '../constants/speedTimePressure.js';

export function getSpeedTimePressureBarWithinChunk(usedSec: number): number {
    const interval = SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT;
    const u = Math.max(0, usedSec);
    return ((u % interval) + interval) % interval;
}

/** 11초 막대 주기 안에서 0~1 진행률 */
export function getSpeedTimePressureBarProgress(usedSec: number): number {
    return getSpeedTimePressureBarWithinChunk(usedSec) / SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT;
}

/** 막대 옆 초 표시: 10→1 (11은 표시하지 않음) */
export function getSpeedTimePressureUiCountdownSeconds(usedSec: number): number {
    const progress = getSpeedTimePressureBarProgress(usedSec);
    const max = SPEED_TIME_PRESSURE_UI_COUNTDOWN_MAX_SECONDS;
    return Math.max(1, Math.min(max, Math.ceil((1 - progress) * max)));
}

/** 누적 소비 초 → 상대 시간 보너스 집수 */
export function getSpeedTimePressureBonusPointsFromConsumedSec(consumedSec: number): number {
    return Math.floor(Math.max(0, consumedSec) / SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT);
}

export {
    SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT,
    SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT,
    SPEED_TIME_PRESSURE_UI_COUNTDOWN_MAX_SECONDS,
};
