import { useEffect, useState } from 'react';
import { subscribeLayoutViewportChange } from './useIsMobileLayout.js';
import {
    measureMobileKeyboardBottomInset,
    measureVisualViewportHeight,
} from '../shared/utils/mobileKeyboardInset.js';

export type MobileKeyboardBottomInsetState = {
    /** 소프트 키보드 등으로 가려진 하단 픽셀(임계값 미만이면 0) */
    insetPx: number;
    /** visualViewport 높이(키보드 열림 시 줄어든 값) */
    visualViewportHeightPx: number;
    isOpen: boolean;
};

const IDLE: MobileKeyboardBottomInsetState = {
    insetPx: 0,
    visualViewportHeightPx: 0,
    isOpen: false,
};

function readInsetState(): MobileKeyboardBottomInsetState {
    if (typeof window === 'undefined') return IDLE;
    const insetPx = measureMobileKeyboardBottomInset();
    const visualViewportHeightPx = measureVisualViewportHeight({
        fallbackHeight: window.innerHeight,
    });
    return {
        insetPx,
        visualViewportHeightPx,
        isOpen: insetPx > 0,
    };
}

/**
 * 모바일 소프트 키보드가 뷰포트 하단을 가리는 양을 추적한다.
 * `enabled`가 false면 항상 0(비활성)을 반환한다.
 */
export function useMobileKeyboardBottomInset(enabled: boolean): MobileKeyboardBottomInsetState {
    const [state, setState] = useState<MobileKeyboardBottomInsetState>(() =>
        enabled ? readInsetState() : IDLE,
    );

    useEffect(() => {
        if (!enabled) {
            setState(IDLE);
            return;
        }
        const update = () => setState(readInsetState());
        update();
        return subscribeLayoutViewportChange(update);
    }, [enabled]);

    return enabled ? state : IDLE;
}
