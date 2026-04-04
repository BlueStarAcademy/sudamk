import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const storageKeyFor = (layoutMode: 'mobile' | 'desktop') =>
    layoutMode === 'mobile' ? 'sudamr-moveConfirmPanel-m' : 'sudamr-moveConfirmPanel-d';

type Pos = { left: number; top: number };

/** 화면 밖으로 거의 다 나가도 최소 한 줄(이만큼)은 잡을 수 있게 남김 */
const MIN_GRAB_PX = 32;

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function getVisualViewportBox(): { vl: number; vt: number; vw: number; vh: number } {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (vv) {
        return { vl: vv.offsetLeft, vt: vv.offsetTop, vw: vv.width, vh: vv.height };
    }
    return {
        vl: 0,
        vt: 0,
        vw: typeof window !== 'undefined' ? window.innerWidth : 400,
        vh: typeof window !== 'undefined' ? window.innerHeight : 800,
    };
}

/** 패널을 거의 자유 배치: 뷰포트와 겹치는 영역이 최소 MIN_GRAB_PX만 있으면 됨 */
function clampPanelPosition(left: number, top: number, panelW: number, panelH: number): Pos {
    const { vl, vt, vw, vh } = getVisualViewportBox();
    const minLeft = vl - (panelW - MIN_GRAB_PX);
    const maxLeft = vl + vw - MIN_GRAB_PX;
    const minTop = vt - (panelH - MIN_GRAB_PX);
    const maxTop = vt + vh - MIN_GRAB_PX;
    return {
        left: clamp(left, minLeft, maxLeft),
        top: clamp(top, minTop, maxTop),
    };
}

export const DraggableMoveConfirmPanel: React.FC<{
    layoutMode: 'mobile' | 'desktop';
    children: React.ReactNode;
}> = ({ layoutMode, children }) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const storageKey = storageKeyFor(layoutMode);
    const [savedPos, setSavedPos] = useState<Pos | null>(null);
    /** 드래그 중에는 여기만 렌더에 반영 — 부모(Game) 리렌더가 effectivePos로 style을 덮어쓰면 위치가 튀는 버그 방지 */
    const [dragPos, setDragPos] = useState<Pos | null>(null);
    const draggingRef = useRef(false);
    const dragOriginRef = useRef<{ startClientX: number; startClientY: number; startLeft: number; startTop: number } | null>(null);
    const liveDragPosRef = useRef<Pos | null>(null);

    const defaultPos = useCallback((): Pos => {
        const { vl, vt, vw, vh } = getVisualViewportBox();
        const approxW = 130;
        const approxH = 140;
        const margin = 12;
        if (layoutMode === 'mobile') {
            const left = vl + vw / 2 - approxW / 2;
            const top = vt + vh - approxH - margin - 8;
            return clampPanelPosition(left, top, approxW, approxH);
        }
        const left = vl + vw * 0.5 + 200 - approxW / 2;
        const top = vt + vh / 2 - approxH / 2;
        return clampPanelPosition(left, top, approxW, approxH);
    }, [layoutMode]);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) {
                setSavedPos(null);
                return;
            }
            const p = JSON.parse(raw) as Pos;
            if (typeof p.left === 'number' && typeof p.top === 'number') setSavedPos(p);
            else setSavedPos(null);
        } catch {
            setSavedPos(null);
        }
    }, [storageKey]);

    const [resizeTick, setResizeTick] = useState(0);
    useEffect(() => {
        const onResize = () => setResizeTick((t) => t + 1);
        window.addEventListener('resize', onResize);
        const vv = window.visualViewport;
        vv?.addEventListener('resize', onResize);
        vv?.addEventListener('scroll', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            vv?.removeEventListener('resize', onResize);
            vv?.removeEventListener('scroll', onResize);
        };
    }, []);

    const effectivePos = useMemo(() => {
        const el = wrapRef.current;
        const w = el?.offsetWidth ?? 130;
        const h = el?.offsetHeight ?? 140;
        if (savedPos) {
            return clampPanelPosition(savedPos.left, savedPos.top, w, h);
        }
        return defaultPos();
    }, [savedPos, defaultPos, resizeTick]);

    const persistPos = useCallback(
        (p: Pos) => {
            setSavedPos(p);
            try {
                localStorage.setItem(storageKey, JSON.stringify(p));
            } catch {
                /* ignore */
            }
        },
        [storageKey]
    );

    const onPointerDownHandle = useCallback((e: React.PointerEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        const el = wrapRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        draggingRef.current = true;
        const start = { left: rect.left, top: rect.top };
        liveDragPosRef.current = start;
        setDragPos(start);
        dragOriginRef.current = {
            startClientX: e.clientX,
            startClientY: e.clientY,
            startLeft: rect.left,
            startTop: rect.top,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
    }, []);

    const onPointerMove = useCallback((e: React.PointerEvent) => {
        const origin = dragOriginRef.current;
        if (!origin || !draggingRef.current) return;
        const el = wrapRef.current;
        if (!el) return;
        const dx = e.clientX - origin.startClientX;
        const dy = e.clientY - origin.startClientY;
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const next = clampPanelPosition(origin.startLeft + dx, origin.startTop + dy, w, h);
        liveDragPosRef.current = next;
        setDragPos(next);
    }, []);

    const finishDrag = useCallback(() => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        dragOriginRef.current = null;
        const p = liveDragPosRef.current;
        liveDragPosRef.current = null;
        setDragPos(null);
        if (p) persistPos(p);
    }, [persistPos]);

    const endDrag = useCallback(
        (e: React.PointerEvent) => {
            if (!draggingRef.current) return;
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
                /* already released */
            }
            finishDrag();
        },
        [finishDrag]
    );

    const onLostPointerCapture = useCallback(() => {
        finishDrag();
    }, [finishDrag]);

    const displayPos = dragPos ?? effectivePos;

    return (
        <div
            ref={wrapRef}
            className="pointer-events-auto fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-gray-700/80 shadow-2xl"
            style={{ left: displayPos.left, top: displayPos.top }}
        >
            <div
                role="button"
                tabIndex={0}
                aria-label="착수 패널 드래그로 위치 조절"
                title="드래그하여 위치 조절"
                className="flex cursor-grab touch-none select-none items-center justify-center border-b border-gray-700/60 bg-gray-800/95 px-3 py-2 active:cursor-grabbing"
                onPointerDown={onPointerDownHandle}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onLostPointerCapture={onLostPointerCapture}
            >
                <span aria-hidden className="select-none text-base leading-none tracking-tight text-gray-500">
                    ⋮⋮
                </span>
            </div>
            <div className="flex flex-col items-center gap-2 bg-gray-900/70 px-3 py-2 min-w-[110px]">{children}</div>
        </div>
    );
};
