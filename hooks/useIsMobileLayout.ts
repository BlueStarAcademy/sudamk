import { useState, useEffect } from 'react';

/**
 * 모바일에서 가로 모드만 사용하므로, "모바일 레이아웃"은 세로일 때만 적용.
 * 가로 모드(landscape)에서는 항상 PC와 동일한 UI를 사용.
 * @param breakpoint - 이 너비 미만일 때만 모바일 레이아웃 후보 (세로일 때만 실제 적용)
 * @returns true = 모바일 레이아웃 사용 (좁은 화면 + 세로), false = PC와 동일한 레이아웃
 */
export function useIsMobileLayout(breakpoint: number = 1024): boolean {
    const [isMobile, setIsMobile] = useState(() => {
        if (typeof window === 'undefined') return false;
        const w = window.innerWidth;
        const h = window.innerHeight;
        return w < breakpoint && w <= h;
    });

    useEffect(() => {
        const update = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            setIsMobile(w < breakpoint && w <= h);
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

/**
 * 현재 화면이 세로(portrait)인지. 모바일에서 가로 모드만 허용할 때 세로면 "돌려주세요" 오버레이 표시용.
 */
export function useIsPortrait(): boolean {
    const [isPortrait, setIsPortrait] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth <= window.innerHeight;
    });

    useEffect(() => {
        const update = () => setIsPortrait(window.innerWidth <= window.innerHeight);
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, []);

    return isPortrait;
}

/** 세로 모드이면서 좁은 화면(모바일)일 때만 true. 가로 전용 오버레이 표시용. */
export function useShowLandscapeOnlyOverlay(): boolean {
    const [show, setShow] = useState(() => {
        if (typeof window === 'undefined') return false;
        const w = window.innerWidth;
        const h = window.innerHeight;
        return w <= h && w <= 1024;
    });

    useEffect(() => {
        const update = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            setShow(w <= h && w <= 1024);
        };
        update();
        window.addEventListener('resize', update);
        window.addEventListener('orientationchange', update);
        return () => {
            window.removeEventListener('resize', update);
            window.removeEventListener('orientationchange', update);
        };
    }, []);

    return show;
}
