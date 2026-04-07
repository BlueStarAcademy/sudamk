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
