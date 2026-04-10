import React from 'react';

export type ResultModalXpVariant = 'strategy' | 'playful';

const VARIANT = {
    strategy: {
        box: 'border-emerald-400/35 bg-gradient-to-br from-emerald-700/45 via-emerald-950/95 to-black/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-emerald-400/30',
        labelMode: 'text-[0.5rem] font-bold leading-none text-emerald-100/95 sm:text-[0.52rem]',
        labelExp: 'mt-[3px] text-[0.58rem] font-black leading-none tracking-[0.08em] text-emerald-50 sm:text-[0.6rem]',
        amount: 'text-[0.65rem] font-semibold tabular-nums leading-tight text-emerald-100 sm:text-[0.7rem]',
    },
    playful: {
        box: 'border-sky-400/45 bg-gradient-to-br from-sky-600/55 via-violet-900/85 to-indigo-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ring-sky-400/35',
        labelMode: 'text-[0.5rem] font-bold leading-none text-sky-100/95 sm:text-[0.52rem]',
        labelExp: 'mt-[3px] text-[0.58rem] font-black leading-none tracking-[0.08em] text-violet-100 sm:text-[0.6rem]',
        amount: 'text-[0.65rem] font-semibold tabular-nums leading-tight text-sky-100 sm:text-[0.7rem]',
    },
} as const;

const DENSITY_BOX = {
    compact: 'h-9 w-9 sm:h-10 sm:w-10',
    comfortable: 'h-10 w-10 sm:h-11 sm:w-11',
} as const;

/**
 * 게임 결과·시작 전 모달에서 공통으로 쓰는 경험치 획득 배지(전략/놀이 구분).
 * 싱글·탑·PvP 요약의 보상 줄과 동일한 시각 언어.
 */
export const ResultModalXpRewardBadge: React.FC<{
    variant: ResultModalXpVariant;
    amount: number;
    /** compact: 9–10단(프리모달·모바일 요약) / comfortable: 한 단 더 큼 */
    density?: keyof typeof DENSITY_BOX;
    className?: string;
    title?: string;
}> = ({ variant, amount, density = 'compact', className = '', title }) => {
    if (amount <= 0) return null;
    const v = VARIANT[variant];
    const modeLabel = variant === 'strategy' ? '전략' : '놀이';
    const defaultTitle = `${modeLabel} 경험치 +${amount.toLocaleString()}`;

    return (
        <div
            className={`flex flex-col items-center gap-0.5 ${className}`.trim()}
            title={title ?? defaultTitle}
        >
            <div
                className={`flex ${DENSITY_BOX[density]} shrink-0 flex-col items-center justify-center rounded-lg border ring-1 ring-inset ${v.box}`}
                aria-hidden
            >
                <span className={v.labelMode}>{modeLabel}</span>
                <span className={v.labelExp}>EXP</span>
            </div>
            <span className={`text-center ${v.amount}`}>+{amount.toLocaleString()}</span>
        </div>
    );
};
