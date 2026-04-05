import { useState, useLayoutEffect } from 'react';

/**
 * `#sudamr-modal-root`(스케일 캔버스) 또는 visual viewport 기준으로
 * 설계 너비·높이가 화면에 들어가도록 균일 배율(최대 1)을 계산합니다.
 */
export function useViewportUniformScale(designWidth: number, designHeight: number, enabled: boolean): number {
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
        if (!enabled || designWidth <= 0 || designHeight <= 0) {
            setScale(1);
            return;
        }

        const read = () => {
            const root = document.getElementById('sudamr-modal-root');
            let availW: number;
            let availH: number;
            if (root) {
                const r = root.getBoundingClientRect();
                availW = r.width;
                availH = r.height;
            } else {
                const vv = window.visualViewport;
                availW = vv?.width ?? window.innerWidth;
                availH = vv?.height ?? window.innerHeight;
            }
            const padX = 32;
            const padY = 64;
            const sx = (availW - padX) / designWidth;
            const sy = (availH - padY) / designHeight;
            const s = Math.min(1, sx, sy);
            setScale(Math.max(0.2, Number.isFinite(s) ? s : 1));
        };

        read();
        const root = document.getElementById('sudamr-modal-root');
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
        if (root && ro) ro.observe(root);
        window.addEventListener('resize', read);
        window.visualViewport?.addEventListener('resize', read);
        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', read);
            window.visualViewport?.removeEventListener('resize', read);
        };
    }, [designWidth, designHeight, enabled]);

    return enabled ? scale : 1;
}
