/**
 * 모달 균일 scale·클램프용 여백.
 * 모바일에서 주소창·홈 인디케이터·visualViewport 오프셋으로 하단 버튼이 잘리는 것을 줄입니다.
 */
export function getModalScaleFitPaddingPx(): { horizontal: number; top: number; bottom: number } {
    if (typeof window === 'undefined') {
        return { horizontal: 24, top: 16, bottom: 48 };
    }

    let horizontal = 24;
    let top = 16;
    let bottom = 48;

    const vv = window.visualViewport;
    if (vv) {
        top = Math.max(top, 10 + Math.min(vv.offsetTop, 48));
        const layoutH = window.innerHeight;
        const vvBottom = vv.offsetTop + vv.height;
        const chromeBelow = Math.max(0, layoutH - vvBottom);
        bottom = Math.max(bottom, 20 + chromeBelow);
    }

    try {
        const probe = document.createElement('div');
        probe.setAttribute('aria-hidden', 'true');
        probe.style.cssText =
            'position:fixed;left:-100px;width:1px;height:1px;visibility:hidden;pointer-events:none;' +
            'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);';
        document.body.appendChild(probe);
        const cs = getComputedStyle(probe);
        const pt = parseFloat(cs.paddingTop) || 0;
        const pb = parseFloat(cs.paddingBottom) || 0;
        probe.remove();
        if (pb > 0) bottom = Math.max(bottom, pb + 28);
        if (pt > 0) top = Math.max(top, pt + 10);
    } catch {
        /* ignore */
    }

    return { horizontal, top, bottom };
}
