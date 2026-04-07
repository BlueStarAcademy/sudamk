import { useEffect, useState } from 'react';

/** 터치 태블릿 ~8인치 이상으로 볼 때 뷰포트 짧은 변 최소값(CSS 논리 px, 기기별 근사) */
export const TABLET_8IN_MIN_SHORT_SIDE_CSS_PX = 744;

/** 태블릿으로 볼 때 긴 변 상한 — 일반 데스크톱·노트북 전체 폭은 제외 */
export const TABLET_MAX_LONG_SIDE_CSS_PX = 1600;

/**
 * 짧은 변이 TABLET_8IN_MIN_SHORT_SIDE_CSS_PX 미만(예: 1280×720)이어도 가로(landscape)이고
 * 긴 변이 이 값 이상이면 태블릿으로 보고 PC(16:9) 셸을 쓴다. 폰 가로(긴 변 ~900 미만)는 제외.
 */
export const TABLET_LANDSCAPE_MIN_LONG_SIDE_CSS_PX = 1024;

export type TouchLayoutProfile = {
    /** 폰·소형 터치 기기: 항상 세로형 네이티브 셸 */
    isPhoneHandheldTouch: boolean;
    /** 8인치급 이상 터치 태블릿: PC(16:9) 셸 */
    isLargeTouchTablet: boolean;
};

export function computeTouchLayoutProfile(): TouchLayoutProfile {
    if (typeof window === 'undefined') {
        return { isPhoneHandheldTouch: false, isLargeTouchTablet: false };
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const shortSide = Math.min(w, h);
    const longSide = Math.max(w, h);
    const hasTouch = (typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0) > 0;
    const tabletLikePointer =
        window.matchMedia?.('(pointer: coarse)').matches === true ||
        window.matchMedia?.('(hover: none)').matches === true;

    if (!hasTouch || !tabletLikePointer) {
        return { isPhoneHandheldTouch: false, isLargeTouchTablet: false };
    }

    if (shortSide >= TABLET_8IN_MIN_SHORT_SIDE_CSS_PX && longSide <= TABLET_MAX_LONG_SIDE_CSS_PX) {
        return { isPhoneHandheldTouch: false, isLargeTouchTablet: true };
    }
    if (shortSide < TABLET_8IN_MIN_SHORT_SIDE_CSS_PX) {
        const landscape = w > h;
        if (
            landscape &&
            longSide >= TABLET_LANDSCAPE_MIN_LONG_SIDE_CSS_PX &&
            longSide <= TABLET_MAX_LONG_SIDE_CSS_PX
        ) {
            return { isPhoneHandheldTouch: false, isLargeTouchTablet: true };
        }
        return { isPhoneHandheldTouch: true, isLargeTouchTablet: false };
    }

    return { isPhoneHandheldTouch: false, isLargeTouchTablet: false };
}

/** 터치 폰 vs 8인치+ 태블릿 구분(리사이즈·미디어쿼리 반영) */
export function useTouchLayoutProfile(): TouchLayoutProfile {
    const [profile, setProfile] = useState<TouchLayoutProfile>(() => computeTouchLayoutProfile());

    useEffect(() => {
        const update = () => setProfile(computeTouchLayoutProfile());
        update();
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        const mqCoarse = window.matchMedia('(pointer: coarse)');
        const mqHover = window.matchMedia('(hover: none)');
        mqCoarse.addEventListener('change', update);
        mqHover.addEventListener('change', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
            mqCoarse.removeEventListener('change', update);
            mqHover.removeEventListener('change', update);
        };
    }, []);

    return profile;
}

const getViewportSize = () => {
    if (typeof window === 'undefined') {
        return { width: 0, height: 0 };
    }
    return { width: window.innerWidth, height: window.innerHeight };
};

/** 모바일 레이아웃은 폰 크기까지만 허용 (8인치급 태블릿은 PC 레이아웃 유지) */
export const PHONE_LAYOUT_MAX_WIDTH_PX = 768;
const getEffectivePhoneBreakpoint = (breakpoint: number) => Math.min(breakpoint, PHONE_LAYOUT_MAX_WIDTH_PX);
const isHandheldWidth = (width: number, breakpoint: number) => width < getEffectivePhoneBreakpoint(breakpoint);
const isPortraitViewport = (width: number, height: number) => width <= height;

/**
 * 좁은 화면에서 세로(portrait) 뷰포트일 때만 모바일 전용 레이아웃을 쓴다.
 * 같은 폭이라도 가로(landscape)로 돌리면 뷰가 넓어지므로 PC와 동일한 레이아웃으로 본다.
 * @param breakpoint - 이 너비 미만일 때만 모바일 레이아웃 후보 (세로일 때만 실제 적용)
 * @returns true = 모바일 레이아웃 (좁은 화면 + 세로), false = PC와 동일한 레이아웃
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
 * 현재 화면이 세로(portrait)인지.
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
