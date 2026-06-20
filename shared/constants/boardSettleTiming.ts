/**
 * GoBoard 따낸 점수 플로트·히든 포획 지연·디바운스와 맞춤.
 * (components/GoBoard.tsx 의 CAPTURE_FLOAT_MS / DEBOUNCE_MS / hiddenRevealScoreFloatLagMs)
 * 자동 계가로 `scoring` UI·서버 트리거 전에 마지막 착점·표시가 끝나도록 최소 대기 시간.
 */
export const BOARD_CAPTURE_SCORE_FLOAT_MS = 2850;
export const BOARD_CAPTURE_FLOAT_HIDDEN_EXTRA_LAG_MS = 450;
export const BOARD_CAPTURE_FLOAT_DEBOUNCE_MS = 48;
/** 따낸 돌을 보드에서 먼저 지운 뒤 +N 플로트를 재생하기 위한 짧은 간격 */
export const BOARD_CAPTURE_FLOAT_AFTER_STONES_MS = 120;
/** 플로트 제거 타이머·렌더 1프레임 여유 */
export const BOARD_SETTLE_AFTER_FLOAT_BUFFER_MS = 250;

export const BOARD_SETTLE_BEFORE_SCORING_MS =
    BOARD_CAPTURE_SCORE_FLOAT_MS +
    BOARD_CAPTURE_FLOAT_HIDDEN_EXTRA_LAG_MS +
    BOARD_CAPTURE_FLOAT_DEBOUNCE_MS +
    BOARD_SETTLE_AFTER_FLOAT_BUFFER_MS;
