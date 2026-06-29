import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react';

type DragState = {
    isPointerDown: boolean;
    isDragging: boolean;
    startX: number;
    scrollLeft: number;
    pointerId: number;
};

/** 폼·링크만 제외 — 게임 모드 카드(`button`) 위에서도 잡아끌기 스크롤 가능. 드래그 후 클릭은 `suppressClickRef`로 차단 */
const INTERACTIVE_SELECTOR = 'input, select, textarea, a[href]';

/** 가로 드래그 스크롤 영역 — 이미지 고스트 드래그·텍스트 선택 방지 */
export const LOBBY_HORIZONTAL_MODE_PICKER_DRAG_GUARD_CLASS =
    'touch-pan-x select-none [&_img]:pointer-events-none [&_img]:select-none [&_img]:[-webkit-user-drag:none]';

export function useHorizontalDragScroll(dragThreshold = 4) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const dragStateRef = useRef<DragState>({
        isPointerDown: false,
        isDragging: false,
        startX: 0,
        scrollLeft: 0,
        pointerId: -1,
    });
    const suppressClickRef = useRef(false);
    const [isDragging, setIsDragging] = useState(false);
    const dragThresholdRef = useRef(dragThreshold);
    const clearWindowPointerListenersRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        dragThresholdRef.current = dragThreshold;
    }, [dragThreshold]);

    useEffect(() => {
        return () => {
            clearWindowPointerListenersRef.current?.();
        };
    }, []);

    const canScrollHorizontally = useCallback((el: HTMLDivElement) => el.scrollWidth > el.clientWidth + 1, []);

    const finishPointerSession = useCallback((pointerId: number) => {
        const state = dragStateRef.current;
        if (!state.isPointerDown || state.pointerId !== pointerId) return;

        state.isPointerDown = false;
        if (state.isDragging) {
            state.isDragging = false;
            setIsDragging(false);
            try {
                scrollRef.current?.releasePointerCapture(pointerId);
            } catch {
                /* ignore */
            }
        }
        clearWindowPointerListenersRef.current?.();
        clearWindowPointerListenersRef.current = null;
    }, []);

    const handlePointerMove = useCallback((clientX: number, pointerId: number, preventDefault?: () => void) => {
        const state = dragStateRef.current;
        if (!state.isPointerDown || pointerId !== state.pointerId) return;

        const el = scrollRef.current;
        if (!el) return;

        const deltaX = clientX - state.startX;
        if (!state.isDragging) {
            if (Math.abs(deltaX) < dragThresholdRef.current) return;
            state.isDragging = true;
            suppressClickRef.current = true;
            setIsDragging(true);
            try {
                el.setPointerCapture(pointerId);
            } catch {
                /* ignore */
            }
        }

        el.scrollLeft = state.scrollLeft - deltaX;
        preventDefault?.();
    }, []);

    const onPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (event.button !== 0) return;
            const el = scrollRef.current;
            if (!el || !canScrollHorizontally(el)) return;

            const target = event.target as HTMLElement | null;
            if (target?.closest(INTERACTIVE_SELECTOR)) return;

            clearWindowPointerListenersRef.current?.();

            dragStateRef.current = {
                isPointerDown: true,
                isDragging: false,
                startX: event.clientX,
                scrollLeft: el.scrollLeft,
                pointerId: event.pointerId,
            };

            const onWindowPointerMove = (e: PointerEvent) => {
                handlePointerMove(e.clientX, e.pointerId, () => e.preventDefault());
            };
            const onWindowPointerEnd = (e: PointerEvent) => {
                finishPointerSession(e.pointerId);
            };

            window.addEventListener('pointermove', onWindowPointerMove);
            window.addEventListener('pointerup', onWindowPointerEnd);
            window.addEventListener('pointercancel', onWindowPointerEnd);

            clearWindowPointerListenersRef.current = () => {
                window.removeEventListener('pointermove', onWindowPointerMove);
                window.removeEventListener('pointerup', onWindowPointerEnd);
                window.removeEventListener('pointercancel', onWindowPointerEnd);
            };
        },
        [canScrollHorizontally, finishPointerSession, handlePointerMove],
    );

    const onPointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            handlePointerMove(event.clientX, event.pointerId, () => event.preventDefault());
        },
        [handlePointerMove],
    );

    const endDrag = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            finishPointerSession(event.pointerId);
        },
        [finishPointerSession],
    );

    const onClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!suppressClickRef.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = false;
    }, []);

    const onDragStart = useCallback((event: ReactDragEvent<HTMLDivElement>) => {
        event.preventDefault();
    }, []);

    const scrollClassName = isDragging ? 'cursor-grabbing' : 'cursor-grab';

    return {
        scrollRef,
        scrollClassName,
        dragScrollProps: {
            onPointerDown,
            onPointerMove,
            onPointerUp: endDrag,
            onPointerCancel: endDrag,
            onClickCapture,
            onDragStart,
        },
    };
};
