type AspectFitFrameArgs = {
    viewportWidth: number;
    viewportHeight: number;
    designWidth: number;
    designHeight: number;
    widthRatio?: number;
    heightRatio?: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
};

/**
 * 뷰포트 대비 모달 프레임을 같은 비율로 맞춰 계산한다.
 * 폭/높이를 따로 clamp하면 비율이 깨지므로, 먼저 설계 비율로 fit한 뒤 범위를 보정한다.
 */
export function resolveAspectFittedModalFrame({
    viewportWidth,
    viewportHeight,
    designWidth,
    designHeight,
    widthRatio = 0.9,
    heightRatio = 0.9,
    minWidth = 320,
    maxWidth = Number.POSITIVE_INFINITY,
    minHeight = 280,
    maxHeight = Number.POSITIVE_INFINITY,
}: AspectFitFrameArgs): { width: number; height: number; scale: number } {
    const safeViewportWidth = Math.max(1, viewportWidth);
    const safeViewportHeight = Math.max(1, viewportHeight);
    const safeDesignWidth = Math.max(1, designWidth);
    const safeDesignHeight = Math.max(1, designHeight);

    const maxFitWidth = Math.max(1, safeViewportWidth * widthRatio);
    const maxFitHeight = Math.max(1, safeViewportHeight * heightRatio);
    const fitScale = Math.min(maxFitWidth / safeDesignWidth, maxFitHeight / safeDesignHeight);
    const baseScale = Number.isFinite(fitScale) ? fitScale : 1;

    let width = safeDesignWidth * baseScale;
    let height = safeDesignHeight * baseScale;
    const aspect = safeDesignWidth / safeDesignHeight;

    width = Math.min(maxWidth, Math.max(minWidth, width));
    height = width / aspect;

    if (height < minHeight) {
        height = minHeight;
        width = height * aspect;
    } else if (height > maxHeight) {
        height = maxHeight;
        width = height * aspect;
    }

    width = Math.min(maxWidth, Math.max(minWidth, width));
    height = Math.min(maxHeight, Math.max(minHeight, height));

    return {
        width: Math.round(width),
        height: Math.round(height),
        scale: Math.max(0.05, Math.min(1, width / safeDesignWidth)),
    };
}

