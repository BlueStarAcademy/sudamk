import React, { useCallback, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { gradeStyles } from '../shared/constants/items.js';
import { getStandardEquipmentBoxDisplayGrades, parseStandardEquipmentBoxLevel } from '../shared/constants/shopLootTables.js';

/** 상점·챔피언십 등 이미지 설명 팝오버 — 일반 모달(z~6만) 위에 표시 */
export const SHOP_IMAGE_DESC_POPOVER_Z = 130_000;

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

/** 골드/다이아 상점 `equipment_box_1`~`6` 설명 — 등급명만 `gradeStyles` 색상(챔피언십 상점과 동일 팔레트) */
export const StandardEquipmentBoxShopDescription: React.FC<{
    itemId: string;
    textClassName?: string;
    /** `equipment_box_*`가 아니거나 테이블이 비었을 때 */
    fallback?: React.ReactNode;
}> = ({ itemId, textClassName, fallback = null }) => {
    const level = parseStandardEquipmentBoxLevel(itemId);
    if (level == null) return <>{fallback}</>;
    const grades = getStandardEquipmentBoxDisplayGrades(level);
    if (grades.length === 0) return <>{fallback}</>;
    const low = grades[0]!;
    const high = grades[grades.length - 1]!;
    const lowSt = gradeStyles[low];
    const highSt = gradeStyles[high];
    const cls = textClassName ?? 'text-[11px] sm:text-xs';
    return (
        <p className={`text-left leading-relaxed text-slate-100 ${cls}`}>
            <span className={`font-bold ${lowSt.color}`}>{lowSt.name}</span>
            {low !== high ? (
                <>
                    <span className="text-slate-400">~</span>
                    <span className={`font-bold ${highSt.color}`}>{highSt.name}</span>
                </>
            ) : null}
            <span> 등급 장비.</span>
        </p>
    );
};

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
    /** false면 전체 화면 히트 레이어 없음(데스크톱 호버 툴팁 등). 기본 true(모바일 탭 닫기). */
    fullscreenBackdrop?: boolean;
}> = ({ open, anchorRef, onRequestClose, children, fullscreenBackdrop = true }) => {
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
            {fullscreenBackdrop ? (
                <div
                    className="fixed inset-0 bg-transparent"
                    style={{ zIndex: SHOP_IMAGE_DESC_POPOVER_Z - 1, touchAction: 'manipulation' }}
                    aria-hidden
                    onPointerDown={(e) => {
                        e.preventDefault();
                        onRequestClose();
                    }}
                />
            ) : null}
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
