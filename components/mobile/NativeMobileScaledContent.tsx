import React, { useLayoutEffect, useRef, useState } from 'react';
import {
    NATIVE_MOBILE_CONTENT_BASE_WIDTH_PX,
    NATIVE_MOBILE_CONTENT_BASE_HEIGHT_PX,
} from '../../constants/ads.js';

/**
 * 720×1280 논리 프레임을 유지한 채, 남는 뷰포트에 맞춰 축소해 항상 세로형으로 보이게 함.
 * (광고·헤더는 바깥 셸에 두고 라우트 본문만 스케일)
 */
const NativeMobileScaledContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const measure = () => {
            const r = el.getBoundingClientRect();
            const sw = r.width;
            const sh = r.height;
            if (sw <= 0 || sh <= 0) return;
            const sx = sw / NATIVE_MOBILE_CONTENT_BASE_WIDTH_PX;
            const sy = sh / NATIVE_MOBILE_CONTENT_BASE_HEIGHT_PX;
            const s = Math.min(sx, sy, 1);
            setScale(Number.isFinite(s) && s > 0 ? s : 1);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const bw = NATIVE_MOBILE_CONTENT_BASE_WIDTH_PX;
    const bh = NATIVE_MOBILE_CONTENT_BASE_HEIGHT_PX;

    return (
        <div
            ref={containerRef}
            className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-center overflow-hidden"
        >
            <div
                className="relative flex-shrink-0 overflow-hidden"
                style={{
                    width: bw * scale,
                    height: bh * scale,
                }}
            >
                <div
                    className="absolute left-0 top-0 overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y"
                    style={{
                        width: bw,
                        height: bh,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        WebkitOverflowScrolling: 'touch',
                    }}
                >
                    <div className="flex min-h-full min-w-0 flex-col">{children}</div>
                </div>
            </div>
        </div>
    );
};

export default NativeMobileScaledContent;
