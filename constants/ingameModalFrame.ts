/**
 * PC 게임 스케일 캔버스(1920×1080 설계) 안에서 인게임 모달이 바둑판 패널을 덮는 정도의 상한.
 * DraggableWindow가 modalLayerUsesDesignPixels + InGameModalLayoutContext일 때 적용.
 */
export const INGAME_BOARD_FRAME_MAX_WIDTH_PX = 920;
export const INGAME_BOARD_FRAME_MAX_HEIGHT_PX = 860;

/**
 * 우측 사이드바(~320px)가 있을 때 화면 정중앙이 아니라 바둑판 열 쪽으로 살짝 당김.
 * (translate(-50%,-50%) 기준 오프셋, 설계 픽셀)
 */
export const INGAME_MODAL_DEFAULT_OFFSET_X = -112;
export const INGAME_MODAL_DEFAULT_OFFSET_Y = 20;

/** 인게임 경기 결과: 바둑판 오른쪽(사이드바 쪽)에 세로로 도킹할 때의 설계 폭 */
export const INGAME_RESULT_PANEL_WIDTH_PX = 400;
/** 바둑판 우측 가장자리와 결과 패널 사이 간격(스크린 px 기준) */
export const INGAME_RESULT_PANEL_BOARD_GAP_PX = 16;
