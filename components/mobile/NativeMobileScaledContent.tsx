import React, { useLayoutEffect, useRef, useState } from 'react';
import {
    NATIVE_MOBILE_CONTENT_BASE_WIDTH_PX,
    NATIVE_MOBILE_CONTENT_BASE_HEIGHT_PX,
} from '../../constants/ads.js';

/**
 * 720×(최대 1280) 논리 프레임: 가로는 셸 폭에 맞추고(scale = min(sw/720,1)),
 * 세로는 할당된 main 높이에 맞게 논리 높이만 줄여 한 화면에 넣는다.
 * 고정 1280 + 가로만 스케일하면 시각 높이가 뷰포트를 넘겨 바깥 스크롤이 생기고 하단 그리드가 잘린다.
 */
const NativeMobileScaledContent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [logicalHeight, setLogicalHeight] = useState(NATIVE_MOBILE_CONTENT_BASE_HEIGHT_PX);

    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const measure = () => {
            const r = el.getBoundingClientRect();
            const sw = r.width;
            const sh = r.height;
            if (sw <= 0 || sh <= 0) return;
            const sx = sw / NATIVE_MOBILE_CONTENT_BASE_WIDTH_PX;
            const s = Math.min(sx, 1);
            const rawLogicalH = sh / s;
            const logicalH = Math.min(NATIVE_MOBILE_CONTENT_BASE_HEIGHT_PX, rawLogicalH);
            setScale(Number.isFinite(s) && s > 0 ? s : 1);
            setLogicalHeight(Number.isFinite(logicalH) && logicalH > 0 ? logicalH : NATIVE_MOBILE_CONTENT_BASE_HEIGHT_PX);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const bw = NATIVE_MOBILE_CONTENT_BASE_WIDTH_PX;

    return (
        <div
            ref={containerRef}
            className="flex min-h-0 w-full min-w-0 flex-1 flex-col items-stretch overflow-hidden overflow-x-hidden overscroll-y-none"
        >
            <div className="min-h-0 w-full flex-1 overflow-x-hidden overflow-hidden overscroll-y-none">
                <div
                    className="relative overflow-hidden"
                    style={{
                        width: bw * scale,
                        height: logicalHeight * scale,
                    }}
                >
                    <div
                        className="absolute left-0 top-0 flex min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-hidden"
                        style={{
                            width: bw,
                            height: logicalHeight,
                            transform: `scale(${scale})`,
                            transformOrigin: 'top left',
                        }}
                    >
                        <div className="flex h-full min-h-0 min-w-0 flex-col">{children}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NativeMobileScaledContent;
