import { getLayoutViewportSize } from '../hooks/useIsMobileLayout.js';

/**
 * 문서 루트 `--vh`를 레이아웃용 뷰포트 높이와 맞춘다.
 * 폰 물리 가로 + portrait-lock 시에는 논리 세로(긴 변)와 동일해야 모바일 셸·calc(var(--vh)*100)이 회전 셸과 맞는다.
 */
export function syncDocumentViewportHeightVar(): void {
    if (typeof document === 'undefined') return;
    const { height } = getLayoutViewportSize();
    document.documentElement.style.setProperty('--vh', `${height * 0.01}px`);
}
