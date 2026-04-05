import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** 인게임 크롬 전용(모달 z-30보다 아래). 없으면 body 폴백 */
function getGameChromePortalTarget(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    return document.getElementById('sudamr-game-chrome-root') ?? document.body;
}

/** 스케일 캔버스 좌표 오염 방지 + 잘못 저장된 위치 폐기 */
const storageKeyFor = (layoutMode: 'mobile' | 'desktop') =>
    layoutMode === 'mobile' ? 'sudamr-moveConfirmPanel-m-v3' : 'sudamr-moveConfirmPanel-d-v3';

type Pos = { left: number; top: number };

/** 화면 밖으로 거의 나가도 잡을 수 있는 최소 노출 폭 */
const MIN_GRAB_PX = 16;

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

/** 뷰포트(실제 화면) 기준 — 패널이 최소 MIN_GRAB_PX만 겹치면 허용 */
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
    const [dragPos, setDragPos] = useState<Pos | null>(null);
    const draggingRef = useRef(false);
    const dragOriginRef = useRef<{ startClientX: number; startClientY: number; startLeft: number; startTop: number } | null>(
        null
    );
    const liveDragPosRef = useRef<Pos | null>(null);
    const activePointerIdRef = useRef<number | null>(null);
    const globalListenersRef = useRef<{
        move: (e: PointerEvent) => void;
        up: (e: PointerEvent) => void;
    } | null>(null);

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

    const removeGlobalDragListeners = useCallback(() => {
        const g = globalListenersRef.current;
        if (g) {
            window.removeEventListener('pointermove', g.move, true);
            window.removeEventListener('pointerup', g.up, true);
            window.removeEventListener('pointercancel', g.up, true);
            globalListenersRef.current = null;
        }
        activePointerIdRef.current = null;
    }, []);

    const finishDrag = useCallback(() => {
        if (!draggingRef.current) return;
        draggingRef.current = false;
        dragOriginRef.current = null;
        const p = liveDragPosRef.current;
        liveDragPosRef.current = null;
        setDragPos(null);
        removeGlobalDragListeners();
        if (p) persistPos(p);
    }, [persistPos, removeGlobalDragListeners]);

    const onGlobalPointerMove = useCallback((e: PointerEvent) => {
        if (!draggingRef.current || e.pointerId !== activePointerIdRef.current) return;
        const origin = dragOriginRef.current;
        if (!origin) return;
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

    const onGlobalPointerUp = useCallback(
        (e: PointerEvent) => {
            if (e.pointerId !== activePointerIdRef.current) return;
            finishDrag();
        },
        [finishDrag]
    );

    const onPointerDownHandle = useCallback(
        (e: React.PointerEvent) => {
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
            activePointerIdRef.current = e.pointerId;

            const move = (ev: PointerEvent) => onGlobalPointerMove(ev);
            const up = (ev: PointerEvent) => onGlobalPointerUp(ev);
            globalListenersRef.current = { move, up };
            window.addEventListener('pointermove', move, { capture: true });
            window.addEventListener('pointerup', up, { capture: true });
            window.addEventListener('pointercancel', up, { capture: true });

            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
                /* 일부 환경에서 실패해도 윈도우 리스너로 동작 */
            }
        },
        [onGlobalPointerMove, onGlobalPointerUp]
    );

    const endDragFromHandle = useCallback(
        (e: React.PointerEvent) => {
            if (!draggingRef.current) return;
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
                /* */
            }
            finishDrag();
        },
        [finishDrag]
    );

    const onLostPointerCapture = useCallback(() => {
        if (draggingRef.current) finishDrag();
    }, [finishDrag]);

    useEffect(() => {
        return () => {
            removeGlobalDragListeners();
            draggingRef.current = false;
        };
    }, [removeGlobalDragListeners]);

    const displayPos = dragPos ?? effectivePos;

    const panelPositionStyle = useMemo((): React.CSSProperties => {
        if (typeof document === 'undefined') return {};
        const host = document.getElementById('sudamr-game-chrome-root');
        if (!host) {
            return {
                position: 'fixed',
                left: displayPos.left,
                top: displayPos.top,
                zIndex: 5,
            };
        }
        const r = host.getBoundingClientRect();
        const dw = host.offsetWidth || 1;
        const dh = host.offsetHeight || 1;
        return {
            position: 'absolute',
            left: ((displayPos.left - r.left) * dw) / Math.max(r.width, 1),
            top: ((displayPos.top - r.top) * dh) / Math.max(r.height, 1),
            zIndex: 10,
        };
    }, [displayPos.left, displayPos.top, resizeTick]);

    const panel = (
        <div
            ref={wrapRef}
            className="pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-gray-700/80 shadow-2xl"
            style={panelPositionStyle}
        >
            <div
                role="button"
                tabIndex={0}
                aria-label="착수 패널 드래그로 위치 조절"
                title="드래그하여 위치 조절"
                className="flex cursor-grab touch-none select-none items-center justify-center border-b border-gray-700/60 bg-gray-800/95 px-3 py-2 active:cursor-grabbing"
                style={{ touchAction: 'none' }}
                onPointerDown={onPointerDownHandle}
                onPointerUp={endDragFromHandle}
                onPointerCancel={endDragFromHandle}
                onLostPointerCapture={onLostPointerCapture}
            >
                <span aria-hidden className="select-none text-base leading-none tracking-tight text-gray-500">
                    ⋮⋮
                </span>
            </div>
            <div className="flex min-w-[110px] flex-col items-center gap-2 bg-gray-900/70 px-3 py-2">{children}</div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    const portalTarget = getGameChromePortalTarget();
    if (!portalTarget) return null;
    return createPortal(panel, portalTarget);
};
