import { useState, useLayoutEffect } from 'react';
import { getModalScaleFitPaddingPx } from '../utils/modalViewportPadding.js';

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
            const { horizontal, top, bottom } = getModalScaleFitPaddingPx();
            let availW: number;
            let availH: number;
            if (root) {
                const r = root.getBoundingClientRect();
                availW = r.width - horizontal;
                availH = r.height - top - bottom;
            } else {
                const vv = window.visualViewport;
                availW = (vv?.width ?? window.innerWidth) - horizontal;
                availH = (vv?.height ?? window.innerHeight) - top - bottom;
            }
            availW = Math.max(40, availW);
            availH = Math.max(40, availH);
            const sx = availW / designWidth;
            const sy = availH / designHeight;
            const s = Math.min(1, sx, sy) * 0.99;
            setScale(Math.max(0.08, Number.isFinite(s) ? s : 1));
        };

        read();
        const root = document.getElementById('sudamr-modal-root');
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
        if (root && ro) ro.observe(root);
        window.addEventListener('resize', read);
        const vv = window.visualViewport;
        vv?.addEventListener('resize', read);
        vv?.addEventListener('scroll', read);
        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', read);
            vv?.removeEventListener('resize', read);
            vv?.removeEventListener('scroll', read);
        };
    }, [designWidth, designHeight, enabled]);

    return enabled ? scale : 1;
}
