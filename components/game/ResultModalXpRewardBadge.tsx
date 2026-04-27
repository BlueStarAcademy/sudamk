import React from 'react';
import { RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS } from './ResultModalRewardSlot.js';

/** 데스크톱·넓은 화면: 골드·아이템 슬롯과 동일한 아이콘 박스 크기 */
const COMFORTABLE_BOX_CLASS =
    'h-[4.75rem] w-[4.75rem] min-[1024px]:h-[5.25rem] min-[1024px]:w-[5.25rem]';

export type ResultModalXpVariant = 'strategy' | 'playful';

const VARIANT = {
    strategy: {
        box: 'border-emerald-400/35 bg-gradient-to-br from-emerald-700/45 via-emerald-950/95 to-black/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-emerald-400/30',
        labelMode: 'text-[0.74rem] font-bold leading-none text-emerald-100/95 min-[1024px]:text-[0.98rem]',
        labelExp: 'mt-[4px] text-[0.86rem] font-black leading-none tracking-[0.08em] text-emerald-50 min-[1024px]:text-[1.06rem]',
        amount:
            'text-sm font-bold tabular-nums leading-tight text-emerald-100 min-[1024px]:text-base',
        labelModeCompact:
            'text-[0.68rem] min-[360px]:text-[0.72rem] min-[400px]:text-[0.76rem] font-bold leading-none text-emerald-100/95',
        labelExpCompact:
            'mt-0.5 text-[0.76rem] min-[360px]:text-[0.8rem] min-[400px]:text-[0.84rem] font-black leading-none tracking-[0.06em] text-emerald-50',
        amountCompact:
            'text-[0.72rem] font-bold tabular-nums leading-tight text-emerald-100',
    },
    playful: {
        box: 'border-sky-400/45 bg-gradient-to-br from-sky-600/55 via-violet-900/85 to-indigo-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ring-sky-400/35',
        labelMode: 'text-[0.55rem] font-bold leading-none text-sky-100/95 min-[1024px]:text-xs',
        labelExp: 'mt-[3px] text-[0.62rem] font-black leading-none tracking-[0.08em] text-violet-100 min-[1024px]:text-[0.7rem]',
        amount: 'text-sm font-bold tabular-nums leading-tight text-sky-100 min-[1024px]:text-base',
        labelModeCompact:
            'text-[0.5rem] min-[360px]:text-[0.52rem] min-[400px]:text-[0.54rem] font-bold leading-none text-sky-100/95',
        labelExpCompact:
            'mt-px text-[0.56rem] min-[360px]:text-[0.58rem] min-[400px]:text-[0.6rem] font-black leading-none tracking-[0.06em] text-violet-100',
        amountCompact: 'text-[0.72rem] font-bold tabular-nums leading-tight text-sky-100',
    },
} as const;

/** 싱글/탑 게임 설명 모달 클리어 보상 줄: 골드·아이템 슬롯과 동일 (h-9 / sm:h-10) */
const PRE_GAME_CLEAR_REWARD_BOX_CLASS = 'h-9 w-9 sm:h-10 sm:w-10';

const DENSITY_BOX = {
    compact: RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS,
    comfortable: COMFORTABLE_BOX_CLASS,
    /** PreGameDescriptionLayout 계열 한 줄 보상과 픽셀 정렬 맞춤 */
    preGameInline: PRE_GAME_CLEAR_REWARD_BOX_CLASS,
} as const;

/**
 * 게임 결과·시작 전 모달에서 공통으로 쓰는 경험치 획득 배지(전략/놀이 구분).
 * 싱글·탑·PvP 요약의 보상 줄과 동일한 시각 언어.
 */
export const ResultModalXpRewardBadge: React.FC<{
    variant: ResultModalXpVariant;
    amount: number;
    /** compact: 결과 모달 보상 줄 / comfortable: 데스크톱 한 단 더 큼 / preGameInline: 싱글 시작 설명 모달 골드·아이템과 동일 크기 */
    density?: keyof typeof DENSITY_BOX;
    className?: string;
    title?: string;
    hideAmount?: boolean;
}> = ({ variant, amount, density = 'compact', className = '', title, hideAmount = false }) => {
    if (amount <= 0) return null;
    const v = VARIANT[variant];
    const modeLabel = variant === 'strategy' ? '전략' : '놀이';
    const defaultTitle = `${modeLabel} 경험치 +${amount.toLocaleString()}`;

    const isPreGameInline = density === 'preGameInline';
    const isCompact = density === 'compact' || isPreGameInline;

    const labelModeClass =
        isPreGameInline && variant === 'strategy'
            ? 'text-[0.58rem] font-bold leading-none text-emerald-100/95 sm:text-[0.62rem]'
            : isPreGameInline && variant === 'playful'
              ? 'text-[0.52rem] font-bold leading-none text-sky-100/95 sm:text-[0.55rem]'
              : isCompact
                ? v.labelModeCompact
                : v.labelMode;
    const labelExpClass =
        isPreGameInline && variant === 'strategy'
            ? 'mt-px text-[0.62rem] font-black leading-none tracking-[0.05em] text-emerald-50 sm:text-[0.66rem]'
            : isPreGameInline && variant === 'playful'
              ? 'mt-px text-[0.54rem] font-black leading-none tracking-[0.05em] text-violet-100 sm:text-[0.58rem]'
              : isCompact
                ? v.labelExpCompact
                : v.labelExp;

    return (
        <div
            className={`flex flex-col items-center gap-0.5 ${isCompact ? 'shrink-0' : ''} ${className}`.trim()}
            title={title ?? defaultTitle}
        >
            <div
                className={`flex ${DENSITY_BOX[density]} shrink-0 flex-col items-center justify-center rounded-lg border ring-1 ring-inset ${v.box}`}
                aria-hidden
            >
                <span className={labelModeClass}>{modeLabel}</span>
                <span className={labelExpClass}>EXP</span>
            </div>
            {!hideAmount && (
                <span
                    className={`text-center ${isCompact ? `flex max-w-[5.5rem] flex-wrap items-baseline justify-center gap-x-0.5 ${v.amountCompact}` : v.amount}`}
                >
                    <span className="whitespace-nowrap">+{amount.toLocaleString()}</span>
                </span>
            )}
        </div>
    );
};
