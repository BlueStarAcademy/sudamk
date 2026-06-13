import { useMemo } from 'react';
import { useViewportUniformScale } from '../../hooks/useViewportUniformScale.js';
import {
    INGAME_RESULT_PANEL_MIN_HEIGHT_PX,
    INGAME_RESULT_PANEL_WIDTH_PX,
} from '../../constants/ingameModalFrame.js';
import {
    GAME_RESULT_MOBILE_DVH_BOTTOM_GAP_PX,
    GAME_RESULT_MOBILE_VIEWPORT_MAX_HEIGHT_CSS,
    GAME_RESULT_MOBILE_VIEWPORT_MAX_HEIGHT_VH,
} from './gameResultModalViewport.js';

type UseGameResultModalLayoutArgs = {
    isMobile: boolean;
    designWidth: number;
    designHeight: number;
    minUniformScale?: number;
    /** false면 데스크톱 좁은 사이드 도킹·투명 배경 미적용(던전 결과 등) */
    desktopSideDock?: boolean;
};

/**
 * 경기 결과 계열 모달 공통 레이아웃/스케일 정책.
 * - 화면 비율에 맞게 모달 프레임을 균일 축소
 * - 텍스트/이미지 스케일 값을 공통으로 계산
 * - DraggableWindow 뷰포트 맞춤 옵션을 공통 제공
 */
export function useGameResultModalLayout({
    isMobile,
    designWidth,
    designHeight,
    minUniformScale = 0.54,
    desktopSideDock = true,
}: UseGameResultModalLayoutArgs) {
    const measuredUniformScale = useViewportUniformScale(designWidth * 1.08, designHeight * 1.06, true);
    const uniformScale = useMemo(
        () => Math.max(minUniformScale, Math.min(1, measuredUniformScale)),
        [measuredUniformScale, minUniformScale],
    );

    const mobileTextScale = useMemo(() => {
        if (!isMobile) return Math.max(0.94, uniformScale);
        return Math.max(0.92, Math.min(1, uniformScale * 1.05));
    }, [isMobile, uniformScale]);

    const mobileImageScale = useMemo(() => {
        if (!isMobile) return Math.max(0.9, uniformScale);
        return Math.max(0.86, Math.min(1, uniformScale * 1.02));
    }, [isMobile, uniformScale]);

    const desktopTextScale = useMemo(
        () => Math.max(0.92, Math.min(1, uniformScale * 0.99)),
        [uniformScale],
    );

    const useDesktopSideDock = !isMobile && desktopSideDock;

    const commonWindowProps = useMemo(
        () => ({
            uniformPcScale: true as const,
            pcViewportMaxHeightCss: isMobile
                ? undefined
                : 'min(96dvh, calc(100vh - 12px))',
            pcViewportMaxWidthCss: useDesktopSideDock ? `${INGAME_RESULT_PANEL_WIDTH_PX}px` : undefined,
            bodyNoScroll: true as const,
            mobileViewportFit: isMobile,
            mobileLockViewportHeight: isMobile,
            mobileViewportMaxHeightVh: isMobile ? GAME_RESULT_MOBILE_VIEWPORT_MAX_HEIGHT_VH : 92,
            mobileViewportMaxHeightCss: isMobile ? GAME_RESULT_MOBILE_VIEWPORT_MAX_HEIGHT_CSS : undefined,
            mobileViewportDvhBottomGapPx: isMobile ? GAME_RESULT_MOBILE_DVH_BOTTOM_GAP_PX : undefined,
            ingameResultSideDock: useDesktopSideDock,
            skipIngameBoardFrameSizeCap: useDesktopSideDock,
            transparentModalBackdrop: useDesktopSideDock,
            modalBackdrop: isMobile,
            shrinkHeightToContent: false,
            initialWidth: isMobile ? designWidth : useDesktopSideDock ? INGAME_RESULT_PANEL_WIDTH_PX : designWidth,
            initialHeight: isMobile
                ? designHeight
                : useDesktopSideDock
                  ? INGAME_RESULT_PANEL_MIN_HEIGHT_PX
                  : designHeight,
        }),
        [isMobile, designWidth, designHeight, useDesktopSideDock],
    );

    return {
        uniformScale,
        desktopTextScale,
        mobileTextScale,
        mobileImageScale,
        commonWindowProps,
        desktopPanelWidth: INGAME_RESULT_PANEL_WIDTH_PX,
    };
}

