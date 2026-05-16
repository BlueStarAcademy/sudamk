/**
 * 스피드 바둑 시간 압박 공통 규칙(초).
 * - 막대·카운트다운 주기: 11초(네트워크·렌더 여유 1초 포함)
 * - 상대 +1점·계가 timeBonus: 실제 소비 10초마다
 * - UI 숫자: 10→1만 표시(11은 노출하지 않음)
 */
export const SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT = 11;

/** 상대 집수(+1)·계가 시간 보너스 집계 간격(초) */
export const SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT = 10;

/** 막대 옆 카운트다운에 표시하는 최대 초(11초 주기를 10→1로 매핑) */
export const SPEED_TIME_PRESSURE_UI_COUNTDOWN_MAX_SECONDS = 10;

/** @deprecated 막대 주기 — {@link SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT} */
export const SPEED_TIME_PRESSURE_SECONDS_PER_POINT = SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT;

/** @deprecated {@link SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT} */
export const SPEED_TIME_PRESSURE_SERVER_SECONDS_PER_POINT = SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT;

/** @deprecated {@link SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT} */
export const SPEED_TIME_PRESSURE_UI_BAR_SECONDS = SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT;
