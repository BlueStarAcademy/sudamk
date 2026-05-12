import React from 'react';
import { RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS } from './ResultModalRewardSlot.js';

/** 데스크톱·넓은 화면: 골드·아이템 슬롯과 동일한 아이콘 박스 크기 */
const COMFORTABLE_BOX_CLASS =
    'h-[4.75rem] w-[4.75rem] min-[1024px]:h-[5.25rem] min-[1024px]:w-[5.25rem]';

export type ResultModalXpVariant = 'strategy' | 'playful' | 'pet';

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
    pet: {
        box: 'border-fuchsia-400/45 bg-gradient-to-br from-fuchsia-600/55 via-purple-950/90 to-slate-950/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] ring-fuchsia-400/35',
        labelMode: 'text-[0.62rem] font-bold leading-none text-fuchsia-100/95 min-[1024px]:text-[0.76rem]',
        labelExp: 'mt-[3px] text-[0.72rem] font-black leading-none tracking-[0.08em] text-pink-100 min-[1024px]:text-[0.86rem]',
        amount: 'text-sm font-bold tabular-nums leading-tight text-fuchsia-100 min-[1024px]:text-base',
        labelModeCompact:
            'text-[0.56rem] min-[360px]:text-[0.6rem] min-[400px]:text-[0.64rem] font-bold leading-none text-fuchsia-100/95',
        labelExpCompact:
            'mt-px text-[0.64rem] min-[360px]:text-[0.68rem] min-[400px]:text-[0.72rem] font-black leading-none tracking-[0.06em] text-pink-100',
        amountCompact: 'text-[0.72rem] font-bold tabular-nums leading-tight text-fuchsia-100',
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
 * 게임 결과·시작 전 모달에서 공통으로 쓰는 경험치 획득 배지(EXP / 놀이 / 펫 구분).
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
    /** 페어 등: 펫 XP +0일 때도 배지 자리를 유지(변동 없음 표시) */
    allowZeroDisplay?: boolean;
    /** 펫 수련 등: 기본 XP와 특화 추가분을 `+기본 (+특화)`로 표시 */
    petXpSpecSplit?: { base: number; spec: number };
}> = ({
    variant,
    amount,
    density = 'compact',
    className = '',
    title,
    hideAmount = false,
    allowZeroDisplay = false,
    petXpSpecSplit,
}) => {
    const showPetZero = variant === 'pet' && allowZeroDisplay && amount <= 0;
    if (amount <= 0 && !showPetZero) return null;
    const v = VARIANT[variant];
    const modeLabel = variant === 'strategy' ? '' : variant === 'playful' ? '놀이' : '펫';
    const defaultTitle =
        showPetZero
            ? '변동 없음'
            : variant === 'pet' && petXpSpecSplit && petXpSpecSplit.spec > 0
              ? `기본 +${petXpSpecSplit.base.toLocaleString()} (특화 +${petXpSpecSplit.spec.toLocaleString()})`
              : variant === 'strategy'
                ? `EXP +${amount.toLocaleString()}`
                : variant === 'pet'
                  ? `EXP +${amount.toLocaleString()}`
                  : `${modeLabel} 경험치 +${amount.toLocaleString()}`;

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
                {modeLabel ? <span className={labelModeClass}>{modeLabel}</span> : null}
                <span className={labelExpClass}>EXP</span>
            </div>
            {!hideAmount && (
                <span
                    className={`text-center ${isCompact ? `flex max-w-[5.5rem] flex-wrap items-baseline justify-center gap-x-0.5 ${v.amountCompact}` : v.amount}`}
                >
                    {showPetZero ? (
                        <span className="whitespace-nowrap text-slate-400">변동 없음</span>
                    ) : variant === 'pet' && petXpSpecSplit ? (
                        <span className="flex flex-wrap items-baseline justify-center gap-x-0.5 whitespace-nowrap">
                            <span>+{petXpSpecSplit.base.toLocaleString()}</span>
                            {petXpSpecSplit.spec > 0 ? (
                                <span className="font-semibold text-emerald-300/95">(+{petXpSpecSplit.spec.toLocaleString()})</span>
                            ) : null}
                        </span>
                    ) : (
                        <span className="whitespace-nowrap">+{amount.toLocaleString()}</span>
                    )}
                </span>
            )}
        </div>
    );
};

/** 펫 XP 대신 등급 강화 안내(보상 줄 슬롯 크기 맞춤) */
export const ResultModalPetGradeUpgradeNeededSlot: React.FC<{
    density?: keyof typeof DENSITY_BOX;
    className?: string;
}> = ({ density = 'compact', className = '' }) => {
    const v = VARIANT.pet;
    const isCompact = density === 'compact' || density === 'preGameInline';
    const lineClass = isCompact
        ? 'max-w-[4.75rem] text-center text-[0.58rem] font-extrabold leading-tight tracking-tight text-pink-100 min-[360px]:text-[0.62rem]'
        : 'max-w-[5.25rem] text-center text-[0.68rem] font-extrabold leading-tight text-pink-100 min-[1024px]:text-[0.76rem]';
    return (
        <div
            className={`flex flex-col items-center gap-0.5 ${isCompact ? 'shrink-0' : ''} ${className}`.trim()}
            title="펫 등급강화 필요"
        >
            <div
                className={`flex ${DENSITY_BOX[density]} shrink-0 flex-col items-center justify-center rounded-lg border px-0.5 ring-1 ring-inset ${v.box}`}
                role="status"
            >
                <span className={lineClass}>펫 등급강화 필요</span>
            </div>
        </div>
    );
};
