import { useCallback, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react';

type DragState = {
    isPointerDown: boolean;
    isDragging: boolean;
    startX: number;
    scrollLeft: number;
    pointerId: number;
};

const INTERACTIVE_SELECTOR = 'button, a, input, select, textarea, [role="button"], [data-lobby-mode-card]';

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

    const canScrollHorizontally = useCallback((el: HTMLDivElement) => el.scrollWidth > el.clientWidth + 1, []);

    const onPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (event.button !== 0) return;
            const el = scrollRef.current;
            if (!el || !canScrollHorizontally(el)) return;

            const target = event.target as HTMLElement | null;
            if (target?.closest(INTERACTIVE_SELECTOR)) return;

            dragStateRef.current = {
                isPointerDown: true,
                isDragging: false,
                startX: event.clientX,
                scrollLeft: el.scrollLeft,
                pointerId: event.pointerId,
            };
            // pointerdown에서 preventDefault 하면 모바일 WebView에서 자식 카드 click이 누락됨 — 드래그 시작 시에만 막는다.
        },
        [canScrollHorizontally],
    );

    const onPointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const state = dragStateRef.current;
            if (!state.isPointerDown || event.pointerId !== state.pointerId) return;

            const el = scrollRef.current;
            if (!el) return;

            const deltaX = event.clientX - state.startX;
            if (!state.isDragging) {
                if (Math.abs(deltaX) < dragThreshold) return;
                state.isDragging = true;
                suppressClickRef.current = true;
                setIsDragging(true);
                try {
                    el.setPointerCapture(event.pointerId);
                } catch {
                    /* ignore */
                }
            }

            el.scrollLeft = state.scrollLeft - deltaX;
            event.preventDefault();
        },
        [dragThreshold],
    );

    const endDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        const state = dragStateRef.current;
        if (!state.isPointerDown || event.pointerId !== state.pointerId) return;

        state.isPointerDown = false;
        if (state.isDragging) {
            state.isDragging = false;
            setIsDragging(false);
            try {
                scrollRef.current?.releasePointerCapture(event.pointerId);
            } catch {
                /* ignore */
            }
        }
    }, []);

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
            onPointerLeave: endDrag,
            onPointerCancel: endDrag,
            onClickCapture,
            onDragStart,
        },
    };
}
