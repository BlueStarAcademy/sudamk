import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const MIN_SCALE = 0.62;
const SCALE_EPS = 0.008;

/**
 * 경기 결과 모달 본문: 사용 가능 높이에 맞춰 균일 축소(스크롤 대신 fit).
 * PC·모바일 공통.
 */
export function useGameResultModalContentFit(enabled: boolean) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);

    const measure = useCallback(() => {
        const container = containerRef.current;
        const content = contentRef.current;
        if (!container || !content) return;

        const available = container.clientHeight;
        const needed = content.offsetHeight;
        if (available <= 8 || needed <= 8) {
            setScale(1);
            return;
        }

        const raw = available / needed;
        const next = raw >= 1 - SCALE_EPS ? 1 : Math.max(MIN_SCALE, raw);
        setScale((prev) => (Math.abs(prev - next) < 0.004 ? prev : next));
    }, []);

    useLayoutEffect(() => {
        if (!enabled) {
            setScale(1);
            return;
        }

        let raf = 0;
        const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(measure);
        };

        schedule();

        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
        const container = containerRef.current;
        const content = contentRef.current;
        if (container) ro?.observe(container);
        if (content) ro?.observe(content);

        window.addEventListener('resize', schedule);
        const vv = window.visualViewport;
        vv?.addEventListener('resize', schedule);

        return () => {
            cancelAnimationFrame(raf);
            ro?.disconnect();
            window.removeEventListener('resize', schedule);
            vv?.removeEventListener('resize', schedule);
        };
    }, [enabled, measure]);

    const isScaled = scale < 1 - SCALE_EPS;

    return { containerRef, contentRef, scale, isScaled };
}
