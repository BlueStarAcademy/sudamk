import { useEffect, useState } from 'react';

const getViewportSize = () => {
    if (typeof window === 'undefined') {
        return { width: 0, height: 0 };
    }
    return { width: window.innerWidth, height: window.innerHeight };
};

const isHandheldWidth = (width: number, breakpoint: number) => width < breakpoint;
const isPortraitViewport = (width: number, height: number) => width <= height;

/**
 * 모바일에서 가로 모드만 사용하므로, "모바일 레이아웃"은 세로일 때만 적용.
 * 가로 모드(landscape)에서는 항상 PC와 동일한 UI를 사용.
 * @param breakpoint - 이 너비 미만일 때만 모바일 레이아웃 후보 (세로일 때만 실제 적용)
 * @returns true = 모바일 레이아웃 사용 (좁은 화면 + 세로), false = PC와 동일한 레이아웃
 */
export function useIsMobileLayout(breakpoint: number = 1024): boolean {
    const [isMobile, setIsMobile] = useState(() => {
        const { width, height } = getViewportSize();
        return isHandheldWidth(width, breakpoint) && isPortraitViewport(width, height);
    });

    useEffect(() => {
        const update = () => {
            const { width, height } = getViewportSize();
            setIsMobile(isHandheldWidth(width, breakpoint) && isPortraitViewport(width, height));
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, [breakpoint]);

    return isMobile;
}

/** 좁은 화면의 휴대기기 여부. 레이아웃이 아니라 safe-area/회전 정책 판단용. */
export function useIsHandheldDevice(breakpoint: number = 1024): boolean {
    const [isHandheld, setIsHandheld] = useState(() => {
        const { width } = getViewportSize();
        return isHandheldWidth(width, breakpoint);
    });

    useEffect(() => {
        const update = () => {
            const { width } = getViewportSize();
            setIsHandheld(isHandheldWidth(width, breakpoint));
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, [breakpoint]);

    return isHandheld;
}

/** 뷰포트 높이가 이 값 미만이면 네이티브 모바일 레이아웃 후보(PC동일 레이아웃이 꺼진 경우). PC 셸 최소 높이에도 동일 값 사용. */
export const VIEWPORT_HEIGHT_LAYOUT_BREAKPOINT = 600;

/**
 * 뷰포트 높이가 maxHeightExclusive 미만인지 (리사이즈·visualViewport 반영).
 * 짧은 데스크톱 창·가로폭은 넓은 상태에서도 모바일 셸 전환에 사용.
 */
export function useViewportHeightBelow(maxHeightExclusive: number): boolean {
    const [below, setBelow] = useState(() => getViewportSize().height < maxHeightExclusive);

    useEffect(() => {
        const update = () => {
            const vv = window.visualViewport;
            const h = vv?.height ?? window.innerHeight;
            setBelow(h < maxHeightExclusive);
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        window.visualViewport?.addEventListener('resize', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
            window.visualViewport?.removeEventListener('resize', update);
        };
    }, [maxHeightExclusive]);

    return below;
}

/**
 * 현재 화면이 세로(portrait)인지. 모바일에서 가로 모드만 허용할 때 세로면 "돌려주세요" 오버레이 표시용.
 */
export function useIsPortrait(): boolean {
    const [isPortrait, setIsPortrait] = useState(() => {
        const { width, height } = getViewportSize();
        return isPortraitViewport(width, height);
    });

    useEffect(() => {
        const update = () => {
            const { width, height } = getViewportSize();
            setIsPortrait(isPortraitViewport(width, height));
        };
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, []);

    return isPortrait;
}
