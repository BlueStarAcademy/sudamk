import React, { useLayoutEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

export type PortalBubblePlacement = 'top' | 'right';

const Z_TOOLTIP = 2147483646;
const VIEW_MARGIN = 12;

function getPortalTarget(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    return document.body;
}

function readViewportRect(): { vx: number; vy: number; vw: number; vh: number } {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    return {
        vx: vv?.offsetLeft ?? 0,
        vy: vv?.offsetTop ?? 0,
        vw: vv?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 0),
        vh: vv?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 0),
    };
}

/**
 * 모달/overflow 위에도 보이도록 body로 포털 + position:fixed.
 * 말풍선 위로 마우스를 옮겨도 유지하려면 onBubblePointerEnter/Leave 로 부모 state와 연결.
 * 앵커·버블 크기로 visualViewport 안에 들어오도록 좌표를 맞춥니다.
 */
export const PortalHoverBubble: React.FC<{
    show: boolean;
    anchorRef: React.RefObject<HTMLElement | null>;
    placement: PortalBubblePlacement;
    className: string;
    children: React.ReactNode;
    onBubblePointerEnter?: () => void;
    onBubblePointerLeave?: () => void;
    /** 포털에 그려진 말풍선 루트 DOM (외부 클릭 판별 등) */
    bubbleMountRef?: React.MutableRefObject<HTMLDivElement | null>;
}> = ({ show, anchorRef, placement, className, children, onBubblePointerEnter, onBubblePointerLeave, bubbleMountRef }) => {
    const bubbleRef = useRef<HTMLDivElement | null>(null) as React.MutableRefObject<HTMLDivElement | null>;
    const [pos, setPos] = useState<{ top: number; left: number; transform: string } | null>(null);

    const computePos = useCallback(() => {
        const el = anchorRef.current;
        const bubble = bubbleRef.current;
        if (!el || !bubble || !show) return null;

        const r = el.getBoundingClientRect();
        const { vx, vy, vw, vh } = readViewportRect();
        const m = VIEW_MARGIN;
        const bw = bubble.offsetWidth || bubble.getBoundingClientRect().width;
        const bh = bubble.offsetHeight || bubble.getBoundingClientRect().height;

        let left: number;
        let top: number;
        let transform: string;

        if (placement === 'top') {
            left = r.left + r.width / 2;
            top = r.top - 8;
            transform = 'translate(-50%, -100%)';

            let bubbleTop = top - bh;
            let bubbleBottom = top;
            if (bubbleTop < vy + m) {
                top = r.bottom + 8;
                transform = 'translate(-50%, 0)';
                bubbleTop = top;
                bubbleBottom = top + bh;
            }
            if (bubbleBottom > vy + vh - m) {
                top = Math.max(vy + m, vy + vh - m - bh);
            }

            let bubbleLeft = left - bw / 2;
            let bubbleRight = left + bw / 2;
            if (bubbleLeft < vx + m) {
                left += vx + m - bubbleLeft;
            }
            bubbleLeft = left - bw / 2;
            bubbleRight = left + bw / 2;
            if (bubbleRight > vx + vw - m) {
                left -= bubbleRight - (vx + vw - m);
            }
        } else {
            left = r.right + 8;
            top = r.top + r.height / 2;
            transform = 'translateY(-50%)';

            let bubbleLeft = left;
            let bubbleRight = left + bw;
            if (bubbleRight > vx + vw - m) {
                left = r.left - 8;
                transform = 'translate(-100%, -50%)';
                bubbleLeft = left - bw;
                bubbleRight = left;
            }
            if (bubbleLeft < vx + m) {
                left += vx + m - bubbleLeft;
            }

            let bubbleTop = top - bh / 2;
            let bubbleBottom = top + bh / 2;
            if (bubbleTop < vy + m) {
                top += vy + m - bubbleTop;
            }
            bubbleTop = top - bh / 2;
            bubbleBottom = top + bh / 2;
            if (bubbleBottom > vy + vh - m) {
                top -= bubbleBottom - (vy + vh - m);
            }
        }

        return { left, top, transform };
    }, [show, placement, anchorRef]);

    const applyPos = useCallback(() => {
        const next = computePos();
        if (!next) return;
        setPos(prev => {
            if (
                prev &&
                Math.abs(prev.left - next.left) < 0.5 &&
                Math.abs(prev.top - next.top) < 0.5 &&
                prev.transform === next.transform
            ) {
                return prev;
            }
            return next;
        });
    }, [computePos]);

    useLayoutEffect(() => {
        if (!show) {
            setPos(null);
            return;
        }
        const el = anchorRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (placement === 'top') {
            setPos({
                left: r.left + r.width / 2,
                top: r.top - 8,
                transform: 'translate(-50%, -100%)',
            });
        } else {
            setPos({
                left: r.right + 8,
                top: r.top + r.height / 2,
                transform: 'translateY(-50%)',
            });
        }
    }, [show, placement, anchorRef]);

    useLayoutEffect(() => {
        if (!show || !pos) return;
        const id = requestAnimationFrame(() => {
            applyPos();
            requestAnimationFrame(() => applyPos());
        });
        return () => cancelAnimationFrame(id);
    }, [show, pos, children, applyPos]);

    useLayoutEffect(() => {
        if (!show) return;
        const w = window;
        const onMove = () => {
            const el = anchorRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            if (placement === 'top') {
                setPos({
                    left: r.left + r.width / 2,
                    top: r.top - 8,
                    transform: 'translate(-50%, -100%)',
                });
            } else {
                setPos({
                    left: r.right + 8,
                    top: r.top + r.height / 2,
                    transform: 'translateY(-50%)',
                });
            }
            requestAnimationFrame(() => applyPos());
        };
        w.addEventListener('scroll', onMove, true);
        w.addEventListener('resize', onMove);
        const vv = w.visualViewport;
        vv?.addEventListener('resize', onMove);
        vv?.addEventListener('scroll', onMove);
        return () => {
            w.removeEventListener('scroll', onMove, true);
            w.removeEventListener('resize', onMove);
            vv?.removeEventListener('resize', onMove);
            vv?.removeEventListener('scroll', onMove);
        };
    }, [show, placement, anchorRef, applyPos]);

    if (!show || !pos) return null;
    const target = getPortalTarget();
    if (!target) return null;

    return createPortal(
        <div
            ref={(node) => {
                bubbleRef.current = node;
                if (bubbleMountRef) bubbleMountRef.current = node;
            }}
            role="tooltip"
            className={className}
            style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                transform: pos.transform,
                zIndex: Z_TOOLTIP,
                maxWidth: `calc(100vw - ${VIEW_MARGIN * 2}px)`,
            }}
            onMouseEnter={onBubblePointerEnter}
            onMouseLeave={onBubblePointerLeave}
        >
            {children}
        </div>,
        target
    );
};
