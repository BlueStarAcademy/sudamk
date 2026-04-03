import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface MobileSlideDeckProps {
    children: React.ReactNode[];
    className?: string;
    /** 슬라이드 트랙 높이 (기본: 부모 채움) */
    trackClassName?: string;
    showDots?: boolean;
    /** 하단 인디케이터 영역 클래스 */
    footerClassName?: string;
}

/**
 * 가로 스와이프 슬라이드 (scroll-snap). 각 자식은 한 슬라이드 전체 너비.
 */
const MobileSlideDeck: React.FC<MobileSlideDeckProps> = ({
    children,
    className = '',
    trackClassName = '',
    showDots = true,
    footerClassName = '',
}) => {
    const slides = React.Children.toArray(children).filter(Boolean);
    const n = slides.length;
    const ref = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);

    const onScroll = useCallback(() => {
        const el = ref.current;
        if (!el || n <= 0) return;
        const w = el.clientWidth;
        if (w <= 0) return;
        const i = Math.round(el.scrollLeft / w);
        setIndex(Math.min(Math.max(0, i), n - 1));
    }, [n]);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, [onScroll]);

    const goTo = (i: number) => {
        const el = ref.current;
        if (!el) return;
        const w = el.clientWidth;
        el.scrollTo({ left: i * w, behavior: 'smooth' });
    };

    if (n === 0) return null;

    return (
        <div className={`flex flex-col min-h-0 flex-1 ${className}`}>
            <div
                ref={ref}
                className={`flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory min-h-0 flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${trackClassName}`}
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {slides.map((slide, i) => (
                    <div
                        key={i}
                        className="min-w-full w-full shrink-0 snap-start snap-always h-full min-h-0 flex flex-col overflow-y-auto overflow-x-hidden"
                    >
                        {slide}
                    </div>
                ))}
            </div>
            {showDots && n > 1 && (
                <div className={`flex items-center justify-center gap-1.5 py-2 flex-shrink-0 ${footerClassName}`}>
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => goTo(i)}
                            className={`h-2 rounded-full transition-all ${i === index ? 'w-5 bg-accent' : 'w-2 bg-tertiary/70'}`}
                            aria-label={`슬라이드 ${i + 1} / ${n}`}
                        />
                    ))}
                    <span className="ml-2 text-xs text-text-secondary tabular-nums">
                        {index + 1}/{n}
                    </span>
                </div>
            )}
        </div>
    );
};

export default MobileSlideDeck;
