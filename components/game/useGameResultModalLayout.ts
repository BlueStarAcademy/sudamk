import { useMemo } from 'react';
import { useViewportUniformScale } from '../../hooks/useViewportUniformScale.js';
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
    minUniformScale = 0.56,
}: UseGameResultModalLayoutArgs) {
    // 결과 모달은 패널/텍스트 밀도가 높아 "딱 맞춤"보다 약간 더 줄여야 스크롤이 사라지고 가독성이 유지된다.
    const measuredUniformScale = useViewportUniformScale(designWidth * 1.14, designHeight * 1.16, true);
    const uniformScale = useMemo(
        () => Math.max(minUniformScale, Math.min(1, measuredUniformScale)),
        [measuredUniformScale, minUniformScale],
    );

    const mobileTextScale = useMemo(() => {
        if (!isMobile) return Math.max(0.9, uniformScale);
        return Math.max(0.76, Math.min(0.94, uniformScale * 0.98));
    }, [isMobile, uniformScale]);

    const mobileImageScale = useMemo(() => {
        if (!isMobile) return Math.max(0.9, uniformScale);
        return Math.max(0.78, Math.min(0.95, uniformScale * 1.02));
    }, [isMobile, uniformScale]);

    const desktopTextScale = useMemo(
        () => Math.max(0.82, Math.min(0.98, uniformScale * 0.94)),
        [uniformScale],
    );

    const commonWindowProps = useMemo(
        () => ({
            uniformPcScale: true as const,
            pcViewportMaxHeightCss: 'min(97dvh, calc(100vh - 8px))',
            bodyNoScroll: true as const,
            mobileViewportFit: isMobile,
            mobileLockViewportHeight: isMobile,
            mobileViewportMaxHeightVh: isMobile ? GAME_RESULT_MOBILE_VIEWPORT_MAX_HEIGHT_VH : 92,
            mobileViewportMaxHeightCss: isMobile ? GAME_RESULT_MOBILE_VIEWPORT_MAX_HEIGHT_CSS : undefined,
            mobileViewportDvhBottomGapPx: isMobile ? GAME_RESULT_MOBILE_DVH_BOTTOM_GAP_PX : undefined,
        }),
        [isMobile],
    );

    return {
        uniformScale,
        desktopTextScale,
        mobileTextScale,
        mobileImageScale,
        commonWindowProps,
    };
}

