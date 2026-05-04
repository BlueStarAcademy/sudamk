/**
 * 인게임 경기 결과 모달(모든 경기장·모드 공통).
 * DraggableWindow `mobileViewportFit` 시 노치·홈 인디케이터 안에서 잘리지 않도록 상한을 맞춘다.
 *
 * 사용처: `GameSummaryModal`, `SinglePlayerSummaryModal`, `TowerSummaryModal`, `NoContestModal`, `DungeonStageSummaryModal`.
 * 새 결과 모달을 추가할 때 동일 상수를 넘기지 않으면 기기별로 잘림/노출이 갈릴 수 있다.
 */
export const GAME_RESULT_MOBILE_VIEWPORT_MAX_HEIGHT_CSS =
    'min(88dvh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 20px))';

export const GAME_RESULT_MOBILE_VIEWPORT_MAX_HEIGHT_VH = 88;

/** `calc(100dvh - Npx)` clamp와 함께 쓰는 하단 여백(홈 바·푸터 크롬) */
export const GAME_RESULT_MOBILE_DVH_BOTTOM_GAP_PX = 48;
