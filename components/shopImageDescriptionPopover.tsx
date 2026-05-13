import React, { useCallback, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** 모바일 상점 카드 `overflow-hidden` 밖에서 설명을 보이게 하기 위한 뷰포트 고정 레이어 */
export const SHOP_IMAGE_DESC_POPOVER_Z = 100_000;

export function formatShopItemDescription(desc: string): string {
    if (!desc) return '';
    const cleaned = desc
        .replace(/~/g, ' ~ ')
        .replace(/\s+/g, ' ')
        .trim();

    if (cleaned.endsWith('획득')) {
        return `${cleaned}합니다.`;
    }

    if (!/[.!?]$/.test(cleaned)) {
        return `${cleaned}.`;
    }

    return cleaned;
}

type ShopMobileDescBox = { left: number; top: number; maxW: number; transform: string };

function computeShopMobileDescBox(anchor: HTMLElement): ShopMobileDescBox {
    const rect = anchor.getBoundingClientRect();
    const margin = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxW = Math.min(288, vw - margin * 2);
    const centerX = rect.left + rect.width / 2;
    const left = Math.max(margin + maxW / 2, Math.min(vw - margin - maxW / 2, centerX));
    const gap = 8;
    const spaceBelow = vh - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const preferBelow = spaceBelow >= 96 || spaceBelow >= spaceAbove;
    if (preferBelow) {
        return { left, top: rect.bottom + gap, maxW, transform: 'translate(-50%, 0)' };
    }
    return { left, top: rect.top - gap, maxW, transform: 'translate(-50%, -100%)' };
}

export const ShopMobileImageDescriptionPortal: React.FC<{
    open: boolean;
    anchorRef: React.RefObject<HTMLDivElement | null>;
    onRequestClose: () => void;
    children: React.ReactNode;
}> = ({ open, anchorRef, onRequestClose, children }) => {
    const [box, setBox] = useState<ShopMobileDescBox | null>(null);

    const recompute = useCallback(() => {
        if (!open) {
            setBox(null);
            return;
        }
        const el = anchorRef.current;
        if (!el) {
            setBox(null);
            return;
        }
        setBox(computeShopMobileDescBox(el));
    }, [open, anchorRef]);

    useLayoutEffect(() => {
        if (!open) {
            setBox(null);
            return;
        }
        recompute();
        const el = anchorRef.current;
        const ro = typeof ResizeObserver !== 'undefined' && el ? new ResizeObserver(recompute) : null;
        if (el && ro) ro.observe(el);
        window.addEventListener('resize', recompute);
        window.addEventListener('scroll', recompute, true);
        return () => {
            ro?.disconnect();
            window.removeEventListener('resize', recompute);
            window.removeEventListener('scroll', recompute, true);
        };
    }, [open, recompute, anchorRef]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <>
            <div
                className="fixed inset-0 bg-transparent"
                style={{ zIndex: SHOP_IMAGE_DESC_POPOVER_Z - 1, touchAction: 'manipulation' }}
                aria-hidden
                onPointerDown={(e) => {
                    e.preventDefault();
                    onRequestClose();
                }}
            />
            {box ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    className="pointer-events-auto fixed max-h-[min(50dvh,320px)] overflow-y-auto rounded-lg border border-indigo-400/50 bg-[#0b1220] p-2.5 text-left text-slate-100 shadow-2xl [scrollbar-width:thin]"
                    style={{
                        zIndex: SHOP_IMAGE_DESC_POPOVER_Z,
                        left: box.left,
                        top: box.top,
                        transform: box.transform,
                        width: box.maxW,
                        maxWidth: box.maxW,
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {children}
                </div>
            ) : null}
        </>,
        document.body
    );
};
