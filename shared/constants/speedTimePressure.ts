/**
 * 스피드 바둑 시간 압박 공통 규칙(초).
 * 피셔 시계에서 소비된 시간이 이 간격마다 1구간으로 집계되며, 상대 보너스(+1) 판정·UI 진행 막대·도움말에 동일하게 사용한다.
 * (PVP/PVE·길드전·싱글·모험 공통 — 네트워크 왕복 여유 포함 11초 운용)
 */
export const SPEED_TIME_PRESSURE_SECONDS_PER_POINT = 11;

/** @deprecated {@link SPEED_TIME_PRESSURE_SECONDS_PER_POINT}와 동일 — 기존 import 호환 */
export const SPEED_TIME_PRESSURE_SERVER_SECONDS_PER_POINT = SPEED_TIME_PRESSURE_SECONDS_PER_POINT;

/** @deprecated {@link SPEED_TIME_PRESSURE_SECONDS_PER_POINT}와 동일 — 서버 판정과 UI 주기 통일 */
export const SPEED_TIME_PRESSURE_UI_BAR_SECONDS = SPEED_TIME_PRESSURE_SECONDS_PER_POINT;
