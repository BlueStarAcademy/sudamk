/**
 * 스피드 바둑 시간 압박 공통 규칙(초).
 * - 수당 시계: 매 수 SPEED_PER_MOVE_SECONDS(10초), 10초 안에 두면 다음 수에서 리셋
 * - 막대·카운트다운 주기: 11초(네트워크·렌더 여유 1초 포함)
 * - 상대 +1점: 해당 수에서 10초 초과마다 (대국 전체 누적 아님)
 * - UI 숫자: 10→1만 표시(11은 노출하지 않음)
 */
export const SPEED_PER_MOVE_SECONDS = 10;

export const SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT = 11;

/** 상대 집수(+1)·계가 timeBonus 집계 간격(초) — 수당 시계 기준 */
export const SPEED_TIME_PRESSURE_SCORING_SECONDS_PER_POINT = SPEED_PER_MOVE_SECONDS;

/** 로비·모드 선택 등에 쓰는 스피드 바둑 한 줄 설명 */
export const SPEED_GO_MODE_DESCRIPTION = `한 수당 ${SPEED_PER_MOVE_SECONDS}초 안에 두면 다시 ${SPEED_PER_MOVE_SECONDS}초가 회복됩니다. ${SPEED_PER_MOVE_SECONDS}초를 넘길 때마다 상대방에게 1점이 더해집니다.`;

/** PVP 대국 전 안내(특수 규칙) 한 줄 */
export const SPEED_GO_PVP_SPECIAL_HIGHLIGHT = `수당 ${SPEED_PER_MOVE_SECONDS}초 초읽기 · ${SPEED_PER_MOVE_SECONDS}초 초과마다 상대 +1점 · 메인 시간 소진 시 시간패`;

/** 막대 옆 카운트다운에 표시하는 최대 초(11초 주기를 10→1로 매핑) */
export const SPEED_TIME_PRESSURE_UI_COUNTDOWN_MAX_SECONDS = 10;

/** @deprecated 막대 주기 — {@link SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT} */
export const SPEED_TIME_PRESSURE_SECONDS_PER_POINT = SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT;

/** @deprecated {@link SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT} */
export const SPEED_TIME_PRESSURE_SERVER_SECONDS_PER_POINT = SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT;

/** @deprecated {@link SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT} */
export const SPEED_TIME_PRESSURE_UI_BAR_SECONDS = SPEED_TIME_PRESSURE_BAR_SECONDS_PER_POINT;
