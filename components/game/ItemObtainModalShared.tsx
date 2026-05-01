import React from 'react';

/** 단일 획득·구매 미리보기 카드(아이템 획득 / 수량 선택 상단 등 공통) */
export const ITEM_OBTAIN_UNIFIED_CARD_CLASS =
    'relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-b from-[#161d2e] via-[#0e131f] to-[#070a10] shadow-[0_0_0_1px_rgba(251,191,36,0.1),0_28px_56px_-24px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.07)]';

export const ITEM_OBTAIN_CARD_RADIAL_STYLE: React.CSSProperties = {
    opacity: 0.14,
    background:
        'radial-gradient(ellipse 90% 50% at 50% -8%, rgba(251, 191, 36, 0.42), transparent 60%), radial-gradient(ellipse 65% 40% at 80% 100%, rgba(56, 189, 248, 0.1), transparent 50%)',
};

/** 다중 획득 그리드·이미지 슬롯 공통: 우측 하단 개수 */
export const ITEM_OBTAIN_COUNT_BADGE_CLASS =
    'absolute bottom-1 right-1 z-10 min-w-[1.35rem] rounded-full border border-white/15 bg-gradient-to-b from-zinc-800/95 to-zinc-950/95 px-1.5 py-0.5 text-center text-[10px] font-black tabular-nums text-slate-100 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.65)]';

const NAME_SCROLL_ROW_CLASS =
    'min-w-0 flex-1 overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export type SingleItemObtainCardProps = {
    leftVisual: React.ReactNode;
    /** 줄임표 없이 한 줄 — 가로 스크롤로 전체 표시 (문자열 또는 등급 색 등 노드) */
    name: React.ReactNode;
    description?: string;
    usageLines?: string[];
    /** a11y / 래퍼 */
    regionAriaLabel?: string;
};

export const SingleItemObtainCard: React.FC<SingleItemObtainCardProps> = ({
    leftVisual,
    name,
    description = '',
    usageLines = [],
    regionAriaLabel = '획득 아이템',
}) => {
    const showFooter = !!description.trim() || usageLines.length > 0;
    return (
        <div className={ITEM_OBTAIN_UNIFIED_CARD_CLASS} role="region" aria-label={regionAriaLabel}>
            <div className="pointer-events-none absolute inset-0" style={ITEM_OBTAIN_CARD_RADIAL_STYLE} aria-hidden />
            <div className="relative flex flex-row items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5 sm:py-5">
                {leftVisual}
                <div className={NAME_SCROLL_ROW_CLASS}>
                    <h2 className="inline-block whitespace-nowrap pr-1 text-left text-sm font-black tracking-tight text-slate-100 sm:text-base">
                        {name}
                    </h2>
                </div>
            </div>
            {showFooter ? (
                <div className="space-y-2 border-t border-white/[0.08] px-4 pb-4 pt-3 sm:px-5">
                    {description.trim() ? (
                        <p className="text-xs leading-relaxed text-slate-300 sm:text-[13px]">{description.trim()}</p>
                    ) : null}
                    {usageLines.length > 0 ? (
                        <div className="space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200/75 sm:text-[11px]">사용처</p>
                            <ul className="list-inside list-disc space-y-0.5 text-[11px] leading-snug text-slate-200/90 sm:text-xs">
                                {usageLines.map((line, i) => (
                                    <li key={i}>{line}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
};
