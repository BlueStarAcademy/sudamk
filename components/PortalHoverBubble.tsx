import React, { useLayoutEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

export type PortalBubblePlacement = 'top' | 'right';

const Z_TOOLTIP = 2147483646;

function getPortalTarget(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    return document.body;
}

/**
 * 모달/overflow 위에도 보이도록 body로 포털 + position:fixed.
 * 말풍선 위로 마우스를 옮겨도 유지하려면 onBubblePointerEnter/Leave 로 부모 state와 연결.
 */
export const PortalHoverBubble: React.FC<{
    show: boolean;
    anchorRef: React.RefObject<HTMLElement | null>;
    placement: PortalBubblePlacement;
    className: string;
    children: React.ReactNode;
    onBubblePointerEnter?: () => void;
    onBubblePointerLeave?: () => void;
}> = ({ show, anchorRef, placement, className, children, onBubblePointerEnter, onBubblePointerLeave }) => {
    const [pos, setPos] = useState<{ top: number; left: number; transform: string } | null>(null);

    const updatePos = useCallback(() => {
        const el = anchorRef.current;
        if (!el || !show) return;
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
        if (!show) {
            setPos(null);
            return;
        }
        updatePos();
        const w = window;
        w.addEventListener('scroll', updatePos, true);
        w.addEventListener('resize', updatePos);
        return () => {
            w.removeEventListener('scroll', updatePos, true);
            w.removeEventListener('resize', updatePos);
        };
    }, [show, updatePos]);

    if (!show || !pos) return null;
    const target = getPortalTarget();
    if (!target) return null;

    return createPortal(
        <div
            role="tooltip"
            className={className}
            style={{
                position: 'fixed',
                top: pos.top,
                left: pos.left,
                transform: pos.transform,
                zIndex: Z_TOOLTIP,
            }}
            onMouseEnter={onBubblePointerEnter}
            onMouseLeave={onBubblePointerLeave}
        >
            {children}
        </div>,
        target
    );
};
