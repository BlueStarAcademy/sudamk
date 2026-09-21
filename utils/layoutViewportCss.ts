import { getLayoutViewportSize, isHandheldPortraitLockActive } from '../hooks/useIsMobileLayout.js';

/**
 * 문서 루트 `--vh`를 레이아웃용 뷰포트 높이와 맞춘다.
 * 폰 물리 가로 + portrait-lock 시에는 논리 세로(긴 변)와 동일해야 모바일 셸·calc(var(--vh)*100)이 회전 셸과 맞는다.
 * 그 외(태블릿 PWA 가로 포함)는 visualViewport 높이를 우선해 시스템바가 잘림을 만들지 않게 한다.
 */
export function syncDocumentViewportHeightVar(): void {
    if (typeof document === 'undefined') return;
    let height = getLayoutViewportSize().height;
    if (!isHandheldPortraitLockActive() && typeof window !== 'undefined') {
        const vv = window.visualViewport;
        if (vv && vv.height > 0) {
            height = vv.height;
        }
    }
    document.documentElement.style.setProperty('--vh', `${height * 0.01}px`);
}
