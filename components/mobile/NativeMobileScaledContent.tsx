import React, { useLayoutEffect, useRef, useState } from 'react';
import {
    NATIVE_MOBILE_CONTENT_BASE_WIDTH_PX,
    NATIVE_MOBILE_CONTENT_BASE_HEIGHT_PX,
} from '../../constants/ads.js';

/**
 * 720×1280 논리 프레임을 유지한 채 가로를 셸(하단 독·배너와 동일 폭)에 맞춰 축소한다.
 * 예전에는 세로까지 맞추느라 min(sx,sy)로 줄여 가로에 빈 여백이 생겼음 → 가로 우선, 세로는 스크롤.
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
            if (sw <= 0) return;
            const sx = sw / NATIVE_MOBILE_CONTENT_BASE_WIDTH_PX;
            const s = Math.min(sx, 1);
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
            className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-stretch overflow-y-auto overflow-x-hidden overscroll-y-contain"
        >
            <div
                className="relative w-full flex-shrink-0 overflow-x-hidden"
                style={{
                    height: bh * scale,
                }}
            >
                <div
                    className="absolute left-0 top-0 overflow-hidden"
                    style={{
                        width: bw,
                        height: bh,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                    }}
                >
                    <div className="flex min-h-full min-w-0 flex-col">{children}</div>
                </div>
            </div>
        </div>
    );
};

export default NativeMobileScaledContent;
