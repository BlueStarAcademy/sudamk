import { useEffect, useState } from 'react';

/** 터치 태블릿 ~8인치 이상으로 볼 때 뷰포트 짧은 변 최소값(CSS 논리 px, 기기별 근사) */
export const TABLET_8IN_MIN_SHORT_SIDE_CSS_PX = 744;

/** 태블릿으로 볼 때 긴 변 상한 — 큰 태블릿·신형 iPad 세로 논리 높이(2000px대) 포함, 일반 울트라와이드 데스크톱은 터치 없으면 제외 */
export const TABLET_MAX_LONG_SIDE_CSS_PX = 2800;

/**
 * 짧은 변이 744 미만인 가로(landscape) 태블릿만 따로 볼 때 긴 변 상한(폴드·울트라와이드 터치 창 등 과도한 매칭 방지).
 */
export const TABLET_NARROW_SHORT_SIDE_LANDSCAPE_MAX_LONG_CSS_PX = 3200;

/**
 * 짧은 변이 TABLET_8IN_MIN_SHORT_SIDE_CSS_PX 미만(예: 1280×720)이어도 가로(landscape)이고
 * 긴 변이 이 값 이상이면 태블릿으로 보고 PC(16:9) 셸을 쓴다. 폰 가로(긴 변 ~900 미만)는 제외.
 * 1023px 등 1px 단위 반올림으로 1024 미만이 되는 기기를 포함하려고 1000으로 둔다.
 */
export const TABLET_LANDSCAPE_MIN_LONG_SIDE_CSS_PX = 1000;
/**
 * 가로 태블릿 보정 하한.
 * 일부 보급형 안드로이드 태블릿은 CSS viewport가 8~9인치여도 short side가 ~500px대로 내려간다.
 * 폰 가로(보통 short side 400px대)와의 경계를 두기 위해 500px로 둔다.
 */
export const TABLET_LANDSCAPE_MIN_SHORT_SIDE_CSS_PX = 500;
/**
 * 가로 태블릿 보정: 긴 변 하한.
 * K10급(1280x800 물리 해상도) 기기에서 브라우저 zoom/DPR 반영 후 long side가 1000 미만으로 보일 수 있어
 * 태블릿 오검출을 줄이기 위해 800px까지 허용한다.
 */
export const TABLET_LANDSCAPE_MIN_LONG_SIDE_RELAXED_CSS_PX = 800;

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
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent ?? '' : '';
    const isAndroidUa = /Android/i.test(ua);
    // iPadOS Safari는 데스크톱 UA(Macintosh)로 보일 수 있어 터치 동시 확인이 필요하다.
    const isIpadLikeUa = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && hasTouch);
    const tabletLikePointer =
        window.matchMedia?.('(pointer: coarse)').matches === true ||
        window.matchMedia?.('(hover: none)').matches === true;
    // 일부 태블릿(키보드/펜/마우스 연결)은 coarse/hover 판정이 바뀌어도 화면 크기상 태블릿이다.
    const likelyTabletBySize = hasTouch && longSide >= TABLET_LANDSCAPE_MIN_LONG_SIDE_CSS_PX;
    const likelyTabletByUaAndSize =
        (isAndroidUa || isIpadLikeUa) &&
        shortSide >= TABLET_LANDSCAPE_MIN_SHORT_SIDE_CSS_PX &&
        longSide >= TABLET_LANDSCAPE_MIN_LONG_SIDE_RELAXED_CSS_PX;
    /** iPhone/iPod: 일부 iOS·WebView에서 (pointer:coarse)가 잠깐 false여도 실제 휴대폰이다 */
    const likelyApplePhoneByUa = /iPhone|iPod/i.test(ua);
    /** Android 폰: UA에 Mobile이 있는 경우가 많고, 주변기기·접근성으로 coarse가 꺼져도 폰으로 본다 */
    const likelyAndroidPhoneByUa =
        isAndroidUa && /Mobile/i.test(ua) && !/\bTablet\b/i.test(ua) && !/Silk\//i.test(ua);
    const treatAsTouchTablet =
        (hasTouch && (tabletLikePointer || likelyTabletBySize)) ||
        likelyTabletByUaAndSize ||
        (hasTouch && (likelyApplePhoneByUa || likelyAndroidPhoneByUa));

    if (!treatAsTouchTablet) {
        return { isPhoneHandheldTouch: false, isLargeTouchTablet: false };
    }

    if (shortSide >= TABLET_8IN_MIN_SHORT_SIDE_CSS_PX && longSide <= TABLET_MAX_LONG_SIDE_CSS_PX) {
        return { isPhoneHandheldTouch: false, isLargeTouchTablet: true };
    }
    if (shortSide < TABLET_8IN_MIN_SHORT_SIDE_CSS_PX) {
        const landscape = w > h;
        if (
            landscape &&
            shortSide >= TABLET_LANDSCAPE_MIN_SHORT_SIDE_CSS_PX &&
            longSide >= TABLET_LANDSCAPE_MIN_LONG_SIDE_RELAXED_CSS_PX &&
            longSide <= TABLET_NARROW_SHORT_SIDE_LANDSCAPE_MAX_LONG_CSS_PX
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
        window.addEventListener('sudamr-portrait-lock-change', update);
        const mqCoarse = window.matchMedia('(pointer: coarse)');
        const mqHover = window.matchMedia('(hover: none)');
        mqCoarse.addEventListener('change', update);
        mqHover.addEventListener('change', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
            window.removeEventListener('sudamr-portrait-lock-change', update);
            mqCoarse.removeEventListener('change', update);
            mqHover.removeEventListener('change', update);
        };
    }, []);

    return profile;
}

/** App.tsx 가 html 에 sudamr-handheld-portrait-lock 을 붙인 상태(소형 폰 물리 가로 → 세로 UI 고정) */
export function isHandheldPortraitLockActive(): boolean {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('sudamr-handheld-portrait-lock');
}

/**
 * 레이아웃·훅용 뷰포트 크기. `sudamr-handheld-portrait-lock` 일 때는 물리 가로여도 세로로 들고 있을 때와 같은 w/h로 본다.
 */
export function getLayoutViewportSize(): { width: number; height: number } {
    if (typeof window === 'undefined') {
        return { width: 0, height: 0 };
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    /** html 클래스가 켜진 뒤에는 터치 프로필과 무관하게 스왑(App·프로필 판정 불일치 시에도 일관) */
    if (isHandheldPortraitLockActive()) {
        return { width: Math.min(w, h), height: Math.max(w, h) };
    }
    return { width: w, height: h };
}

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
        const { width, height } = getLayoutViewportSize();
        return isHandheldWidth(width, breakpoint) && isPortraitViewport(width, height);
    });

    useEffect(() => {
        const update = () => {
            const { width, height } = getLayoutViewportSize();
            setIsMobile(isHandheldWidth(width, breakpoint) && isPortraitViewport(width, height));
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        window.addEventListener('sudamr-portrait-lock-change', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
            window.removeEventListener('sudamr-portrait-lock-change', update);
        };
    }, [breakpoint]);

    return isMobile;
}

/** 좁은 화면의 휴대기기 여부. 레이아웃이 아니라 safe-area/회전 정책 판단용. */
export function useIsHandheldDevice(breakpoint: number = 1024): boolean {
    const [isHandheld, setIsHandheld] = useState(() => {
        const { width, height } = getLayoutViewportSize();
        const touch = computeTouchLayoutProfile();
        if (touch.isLargeTouchTablet && width > height) return false;
        return isHandheldWidth(width, breakpoint);
    });

    useEffect(() => {
        const update = () => {
            const { width, height } = getLayoutViewportSize();
            const touch = computeTouchLayoutProfile();
            if (touch.isLargeTouchTablet && width > height) {
                setIsHandheld(false);
                return;
            }
            setIsHandheld(isHandheldWidth(width, breakpoint));
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        window.addEventListener('sudamr-portrait-lock-change', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
            window.removeEventListener('sudamr-portrait-lock-change', update);
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
    const [below, setBelow] = useState(() => getLayoutViewportSize().height < maxHeightExclusive);

    useEffect(() => {
        const update = () => {
            let h: number;
            if (isHandheldPortraitLockActive()) {
                h = getLayoutViewportSize().height;
            } else {
                const vv = window.visualViewport;
                h = vv?.height ?? window.innerHeight;
            }
            setBelow(h < maxHeightExclusive);
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        window.addEventListener('sudamr-portrait-lock-change', update);
        window.visualViewport?.addEventListener('resize', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
            window.removeEventListener('sudamr-portrait-lock-change', update);
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
        const { width, height } = getLayoutViewportSize();
        return isPortraitViewport(width, height);
    });

    useEffect(() => {
        const update = () => {
            const { width, height } = getLayoutViewportSize();
            setIsPortrait(isPortraitViewport(width, height));
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        window.addEventListener('sudamr-portrait-lock-change', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
            window.removeEventListener('sudamr-portrait-lock-change', update);
        };
    }, []);

    return isPortrait;
}
