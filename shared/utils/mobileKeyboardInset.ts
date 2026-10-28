/** 주소창·시스템 UI 흔들림과 구분하기 위한 최소 키보드 가림 높이 */
export const MOBILE_KEYBOARD_INSET_THRESHOLD_PX = 80;

export type VisualViewportSize = {
    height: number;
    offsetTop: number;
};

/**
 * 레이아웃 뷰포트 대비 visualViewport 하단이 가려진 양(키보드 등).
 * iOS/Android 소프트 키보드가 열리면 보통 threshold 이상으로 커지고, 닫히면 0에 가깝다.
 */
export function measureMobileKeyboardBottomInset(opts?: {
    innerHeight?: number;
    visualViewport?: VisualViewportSize | null;
}): number {
    const innerHeight =
        opts?.innerHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 0);
    const vv =
        opts && 'visualViewport' in opts
            ? opts.visualViewport
            : typeof window !== 'undefined'
              ? window.visualViewport
                ? { height: window.visualViewport.height, offsetTop: window.visualViewport.offsetTop }
                : null
              : null;
    if (!vv || !(innerHeight > 0) || !(vv.height > 0)) return 0;
    const inset = Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop));
    return inset >= MOBILE_KEYBOARD_INSET_THRESHOLD_PX ? inset : 0;
}

export function measureVisualViewportHeight(opts?: {
    fallbackHeight?: number;
    visualViewport?: VisualViewportSize | null;
}): number {
    const vv =
        opts && 'visualViewport' in opts
            ? opts.visualViewport
            : typeof window !== 'undefined'
              ? window.visualViewport
                ? { height: window.visualViewport.height, offsetTop: window.visualViewport.offsetTop }
                : null
              : null;
    if (vv && vv.height > 0) return Math.round(vv.height);
    return Math.round(
        opts?.fallbackHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 0),
    );
}
