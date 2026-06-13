import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const MIN_SCALE = 0.62;
const SCALE_EPS = 0.008;

/**
 * 경기 결과 모달 본문: 사용 가능 높이에 맞춰 균일 축소(스크롤 대신 fit).
 * PC·모바일 공통. 레이아웃 높이가 아직 0이거나 축소만으로는 담기지 않으면 스크롤로 폴백.
 */
export function useGameResultModalContentFit(enabled: boolean) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [useScrollFallback, setUseScrollFallback] = useState(!enabled);

    const measure = useCallback(() => {
        if (!enabled) {
            setScale(1);
            setUseScrollFallback(true);
            return;
        }

        const container = containerRef.current;
        const content = contentRef.current;
        if (!container || !content) return;

        const available = container.clientHeight;
        const needed = Math.max(content.scrollHeight, content.offsetHeight);

        if (available <= 8 || needed <= 8) {
            setScale(1);
            setUseScrollFallback(true);
            return;
        }

        const raw = available / needed;
        const cappedScale = raw >= 1 - SCALE_EPS ? 1 : Math.max(MIN_SCALE, raw);
        const fitsWithCap = needed * cappedScale <= available + 2;

        if (!fitsWithCap) {
            setScale(1);
            setUseScrollFallback(true);
            return;
        }

        setUseScrollFallback(false);
        const next = cappedScale;
        setScale((prev) => (Math.abs(prev - next) < 0.004 ? prev : next));
    }, [enabled]);

    useLayoutEffect(() => {
        if (!enabled) {
            setScale(1);
            setUseScrollFallback(true);
            return;
        }

        let raf = 0;
        const schedule = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(measure);
        };

        schedule();
        // flex 레이아웃 직후 clientHeight가 0인 한 프레임이 있어 한 번 더 측정
        const retry = window.setTimeout(schedule, 0);

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
            window.clearTimeout(retry);
            ro?.disconnect();
            window.removeEventListener('resize', schedule);
            vv?.removeEventListener('resize', schedule);
        };
    }, [enabled, measure]);

    const isScaled = enabled && !useScrollFallback && scale < 1 - SCALE_EPS;

    return { containerRef, contentRef, scale, isScaled, useScrollFallback: !enabled || useScrollFallback };
}
