import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    getAdventureChapterRewardPreview,
    getAdventureChapterRewardVisual,
} from '../../shared/utils/adventureChapterRewardPreview.js';
import { gradeBackgrounds } from '../../shared/constants/items.js';
import { ItemGrade } from '../../shared/types/enums.js';
import type { AdventureStageId } from '../../constants/adventureConstants.js';

const GOLD_SRC = '/images/icon/Gold.png';

type Props = {
    stageId: AdventureStageId;
    /** 로비 카드 등 좁은 영역 */
    compact?: boolean;
    className?: string;
    /**
     * scroll: 가로 스크롤(기본)
     * wrap: 가로 스크롤 없이 줄바꿈(맵 좌측 도킹 등 — 패널 너비에 맞춤)
     */
    iconLayout?: 'scroll' | 'wrap';
};

type BubbleState = { id: string; x: number; y: number; text: string; placeAbove: boolean };

/** 테두리 박스 안에 아이콘만 */
const RewardIconBox: React.FC<{
    gradeBg: string;
    compact?: boolean;
    children: React.ReactNode;
}> = ({ gradeBg, compact, children }) => {
    const cellW = compact ? 'w-9 min-w-[2.25rem]' : 'w-11 min-w-[2.75rem] sm:w-[2.875rem] sm:min-w-[2.875rem]';
    const boxH = compact ? 'h-9 min-h-[2.25rem]' : 'h-11 min-h-[2.75rem] sm:h-12 sm:min-h-[3rem]';

    return (
        <div
            className={`flex ${cellW} ${boxH} shrink-0 items-center justify-center overflow-hidden rounded-md border border-amber-400/40 shadow-[0_2px_10px_rgba(0,0,0,0.35)]`}
            style={{
                backgroundImage: `linear-gradient(165deg, rgba(0,0,0,0.38), rgba(0,0,0,0.82)), url(${gradeBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            {children}
        </div>
    );
};

const BUBBLE_MAX_H = 120;
const BUBBLE_PAD = 8;

const AdventureChapterRewardHints: React.FC<Props> = ({ stageId, compact, className, iconLayout = 'scroll' }) => {
    const p = useMemo(() => getAdventureChapterRewardPreview(stageId), [stageId]);
    const v = useMemo(() => getAdventureChapterRewardVisual(stageId), [stageId]);
    const [bubble, setBubble] = useState<BubbleState | null>(null);

    const iconMaxInner = compact ? 'h-[1.35rem] w-[1.35rem]' : 'h-7 w-7 sm:h-8 sm:w-8';

    const openBubble = useCallback((id: string, anchorEl: HTMLElement, text: string) => {
        setBubble((prev) => {
            if (prev?.id === id) return null;
            const r = anchorEl.getBoundingClientRect();
            const pad = 10;
            const x = Math.min(window.innerWidth - pad, Math.max(pad, r.left + r.width / 2));
            const spaceBelow = window.innerHeight - r.bottom - BUBBLE_PAD;
            const placeAbove = spaceBelow < BUBBLE_MAX_H && r.top > BUBBLE_MAX_H;
            const y = placeAbove ? r.top - BUBBLE_PAD : r.bottom + BUBBLE_PAD;
            return { id, x, y, text, placeAbove };
        });
    }, []);

    useEffect(() => {
        if (!bubble) return;
        const closeAll = () => setBubble(null);
        const onDocClick = (e: MouseEvent) => {
            const el = e.target;
            if (!(el instanceof Element)) return;
            if (el.closest('[data-adventure-reward-trigger]') || el.closest('[data-adventure-reward-bubble]')) return;
            setBubble(null);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setBubble(null);
        };
        const t = window.setTimeout(() => {
            document.addEventListener('click', onDocClick);
        }, 0);
        window.addEventListener('scroll', closeAll, true);
        window.addEventListener('resize', closeAll);
        document.addEventListener('keydown', onKey);
        return () => {
            window.clearTimeout(t);
            document.removeEventListener('click', onDocClick);
            window.removeEventListener('scroll', closeAll, true);
            window.removeEventListener('resize', closeAll);
            document.removeEventListener('keydown', onKey);
        };
    }, [bubble]);

    const onTriggerClick = useCallback(
        (id: string, text: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
            openBubble(id, e.currentTarget, text);
        },
        [openBubble],
    );

    const goldSlots: { id: string; gradeBg: string; bubbleText: string }[] = [
        {
            id: 'gold-normal',
            gradeBg: gradeBackgrounds[ItemGrade.Legendary],
            bubbleText: `승리 골드(참고) 약 ${v.goldNormalRange.min.toLocaleString()}~${v.goldNormalRange.max.toLocaleString()}`,
        },
    ];
    if (v.goldBoss19Range) {
        goldSlots.push({
            id: 'gold-boss19',
            gradeBg: gradeBackgrounds[ItemGrade.Mythic],
            bubbleText: `19줄 보스 승리 시 골드 약 ${v.goldBoss19Range.min.toLocaleString()}~${v.goldBoss19Range.max.toLocaleString()}`,
        });
    }

    const tier = v.equipmentMaxTier;

    const bubblePortal =
        bubble &&
        typeof document !== 'undefined' &&
        createPortal(
            <div
                data-adventure-reward-bubble
                role="tooltip"
                className="fixed z-[96] w-max max-w-[min(calc(100vw-1.25rem),16rem)] rounded-lg border border-amber-400/55 bg-zinc-950 px-2.5 py-2 text-center shadow-[0_12px_40px_rgba(0,0,0,0.82),inset_0_1px_0_rgba(255,255,255,0.06)]"
                style={{
                    left: bubble.x,
                    top: bubble.y,
                    transform: `translate(-50%, ${bubble.placeAbove ? '-100%' : '0'}) translateY(${bubble.placeAbove ? '-4px' : '4px'})`,
                }}
            >
                <p className="text-[10px] font-semibold leading-snug text-amber-50 sm:text-xs">{bubble.text}</p>
            </div>,
            document.body,
        );

    return (
        <div className={className} role="region" aria-label="획득 가능 보상">
            <h2
                className={
                    compact
                        ? 'mb-1 text-center text-[10px] font-bold tracking-wide text-amber-100 drop-shadow-sm'
                        : 'mb-2 text-center text-[11px] font-bold tracking-wide text-amber-50 sm:text-xs'
                }
            >
                획득 가능 보상
            </h2>
            <div
                className={
                    iconLayout === 'wrap'
                        ? compact
                            ? 'overflow-x-visible overflow-y-visible px-2 pb-1 pt-0.5'
                            : 'overflow-x-visible overflow-y-visible px-2.5 pb-1.5 pt-0.5 sm:px-3 sm:pb-2'
                        : compact
                          ? 'overflow-x-auto overflow-y-visible px-1.5 pb-0.5 [-webkit-overflow-scrolling:touch] scroll-pl-2 scroll-pr-2 [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgba(245,158,11,0.45)_rgba(24,24,27,0.35)] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-900/70 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-500/40'
                          : 'overflow-x-auto overflow-y-visible px-2 pb-0.5 sm:px-2.5 scroll-pl-2 scroll-pr-2 sm:scroll-pl-2.5 sm:scroll-pr-2.5 [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:rgba(245,158,11,0.5)_rgba(24,24,27,0.45)] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-zinc-900/75 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-amber-500/45 hover:[&::-webkit-scrollbar-thumb]:bg-amber-400/55'
                }
            >
                <div
                    className={
                        iconLayout === 'wrap'
                            ? compact
                                ? 'mx-auto flex max-w-[10.5rem] flex-wrap items-stretch justify-center gap-0.5'
                                : 'mx-auto flex max-w-[12.5rem] flex-wrap items-stretch justify-center gap-1.5 sm:max-w-[14rem] sm:gap-2'
                            : compact
                              ? 'flex w-max min-w-full flex-nowrap items-stretch justify-center gap-0.5'
                              : 'flex w-max min-w-full flex-nowrap items-stretch justify-center gap-1 sm:gap-1.5'
                    }
                >
                {goldSlots.map((slot) => (
                    <button
                        key={slot.id}
                        type="button"
                        data-adventure-reward-trigger
                        aria-label={`골드 보상 범위 보기: ${slot.bubbleText}`}
                        aria-expanded={bubble?.id === slot.id}
                        onClick={onTriggerClick(slot.id, slot.bubbleText)}
                        className="shrink-0 cursor-pointer rounded-md border border-transparent p-0 transition hover:border-amber-400/35 hover:brightness-110 active:scale-[0.98]"
                    >
                        <RewardIconBox gradeBg={slot.gradeBg} compact={compact}>
                            <img src={GOLD_SRC} alt="" className={`${iconMaxInner} object-contain drop-shadow`} draggable={false} />
                        </RewardIconBox>
                    </button>
                ))}

                <button
                    type="button"
                    data-adventure-reward-trigger
                    aria-label={`장비 보상 범위 보기: 지급 장비 등급 ${p.equipmentGradeRange}`}
                    aria-expanded={bubble?.id === 'equipment'}
                    onClick={onTriggerClick('equipment', `지급 장비 등급: ${p.equipmentGradeRange}`)}
                    className="shrink-0 cursor-pointer rounded-md border border-transparent p-0 transition hover:border-amber-400/35 hover:brightness-110 active:scale-[0.98]"
                >
                    <RewardIconBox gradeBg={tier.gradeBg} compact={compact}>
                        <div className="relative flex items-center justify-center">
                            <img
                                src={tier.image}
                                alt=""
                                className={`${iconMaxInner} object-contain opacity-95`}
                                draggable={false}
                            />
                            <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
                                <span className="rounded-full border border-white/30 bg-black/55 px-0.5 py-px text-[0.55rem] font-black leading-none text-white shadow-sm sm:text-[0.65rem]">
                                    ?
                                </span>
                            </span>
                        </div>
                    </RewardIconBox>
                </button>

                {v.materials.map((mat, i) => {
                    const line = p.materialQtyLines[i] ?? `${mat.qtyMin === mat.qtyMax ? mat.qtyMin : `${mat.qtyMin}~${mat.qtyMax}`}`;
                    const id = `mat-${i}`;
                    return (
                        <button
                            key={`${mat.image}-${i}`}
                            type="button"
                            data-adventure-reward-trigger
                            aria-label={`강화석 보상: ${line}`}
                            aria-expanded={bubble?.id === id}
                            onClick={onTriggerClick(id, line)}
                            className="shrink-0 cursor-pointer rounded-md border border-transparent p-0 transition hover:border-amber-400/35 hover:brightness-110 active:scale-[0.98]"
                        >
                            <RewardIconBox gradeBg={mat.gradeBg} compact={compact}>
                                <img src={mat.image} alt="" className={`${iconMaxInner} object-contain`} draggable={false} />
                            </RewardIconBox>
                        </button>
                    );
                })}
                </div>
            </div>
            {bubblePortal}
        </div>
    );
};

export default AdventureChapterRewardHints;
