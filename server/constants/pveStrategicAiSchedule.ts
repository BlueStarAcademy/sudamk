/**
 * 모험·길드전 서버 Kata AI: 유저 수(또는 패스) 직후 `aiTurnStartTime`과 인라인 `makeAiMove` 대기를 맞춰
 * 메인 루프 setImmediate와 인라인 경로가 동시에 잠금만 잡고 스킵되는 레이스를 줄인다.
 */
export const PVE_STRATEGIC_SERVER_AI_POST_HUMAN_DELAY_MS = 1200;

/** PVE AI 턴이 이 시간 이상 진행 없으면 서버 워치독이 복구(잠금 해제 + queue 재등록)를 시도한다. */
export const PVE_AI_SERVER_WATCHDOG_MS = 9_000;
