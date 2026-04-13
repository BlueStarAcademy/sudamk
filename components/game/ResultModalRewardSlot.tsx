import React from 'react';
import { ItemGrade } from '../../types/enums.js';
import { gradeBackgrounds, gradeStyles } from '../../constants.js';

function equipmentGradeBorderClass(grade: ItemGrade): string {
    switch (grade) {
        case ItemGrade.Normal:
            return 'border-zinc-500/55';
        case ItemGrade.Uncommon:
            return 'border-emerald-500/50';
        case ItemGrade.Rare:
            return 'border-sky-500/50';
        case ItemGrade.Epic:
            return 'border-violet-500/50';
        case ItemGrade.Legendary:
            return 'border-rose-500/50';
        case ItemGrade.Mythic:
            return 'border-amber-400/50';
        case ItemGrade.Transcendent:
            return 'border-cyan-400/55';
        default:
            return 'border-zinc-500/55';
    }
}

/** 모험·결과 모달: 장비 등급에 맞는 슬롯 테두리·배경(인벤/획득 UI와 동일 이미지) */
export function equipmentGradeRewardIconShellClassNames(grade: ItemGrade): {
    outer: string;
    bgStyle: React.CSSProperties;
    transcendentClass: string;
} {
    const bg = gradeBackgrounds[grade] ?? gradeBackgrounds[ItemGrade.Normal];
    return {
        outer: `relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-white/10 ${equipmentGradeBorderClass(grade)}`,
        bgStyle: { backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center' },
        transcendentClass: grade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : '',
    };
}

/** 아이템 표기: 골드꾸러미 → 골드 꾸러미 */
export function formatRewardItemDisplayName(raw: string): string {
    if (!raw) return raw;
    return raw.includes('골드꾸러미') ? raw.replace(/골드꾸러미/g, '골드 꾸러미') : raw;
}

export const RESULT_MODAL_BOX_GOLD_CLASS =
    'flex flex-shrink-0 items-center justify-center rounded-lg border-2 border-amber-400/45 bg-gradient-to-br from-amber-950/70 via-yellow-900/35 to-zinc-950/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-amber-400/20';
export const RESULT_MODAL_BOX_ITEM_CLASS =
    'flex flex-shrink-0 items-center justify-center rounded-lg border-2 border-violet-500/45 bg-gradient-to-br from-violet-950/55 via-purple-900/35 to-zinc-950/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-violet-400/15';

const BOX_GOLD = RESULT_MODAL_BOX_GOLD_CLASS;
const BOX_ITEM = RESULT_MODAL_BOX_ITEM_CLASS;

/** 모바일 보상 한 줄: 골드·EXP·아이템 아이콘 박스 동일 크기(좁은 폭에서도 한 줄 배치) */
export const RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS =
    'h-10 w-10 min-[360px]:h-11 min-[360px]:w-11 min-[400px]:h-12 min-[400px]:w-12 sm:h-14 sm:w-14';

function imageBoxClass(compact: boolean): string {
    return compact
        ? RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS
        : 'h-[4.75rem] w-[4.75rem] min-[1024px]:h-[5.25rem] min-[1024px]:w-[5.25rem]';
}

/** 통화 골드: 아이콘 박스 + 수량(아이콘이 종류를 나타내므로 「골드」 라벨 없음) */
export const ResultModalGoldCurrencySlot: React.FC<{
    amount: number;
    compact: boolean;
    dimmed?: boolean;
    /** 도감·지역·특화 효과 등으로 추가된 골드 — 총액 `amount` 옆에 (+N) */
    understandingBonus?: number;
}> = ({ amount, compact, dimmed, understandingBonus }) => (
    <div
        className={`flex flex-col items-center gap-0.5 ${compact ? 'shrink-0' : ''} ${dimmed ? 'opacity-80' : ''}`}
        title={
            understandingBonus != null && understandingBonus > 0
                ? `골드 ${amount.toLocaleString()} (모험 이해도·효과 +${understandingBonus.toLocaleString()})`
                : `골드 ${amount.toLocaleString()}`
        }
    >
        <div className={`${BOX_GOLD} ${imageBoxClass(compact)}`}>
            <img
                src="/images/icon/Gold.png"
                alt=""
                className={
                    compact
                        ? 'h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 min-[400px]:h-9 min-[400px]:w-9 object-contain p-0.5 sm:h-9 sm:w-9'
                        : 'h-11 w-11 object-contain p-1 min-[1024px]:h-12 min-[1024px]:w-12'
                }
            />
        </div>
        <span
            className={
                compact
                    ? 'flex max-w-[5.5rem] flex-wrap items-baseline justify-center gap-x-0.5 text-center text-[0.72rem] font-bold tabular-nums text-amber-100'
                    : 'flex max-w-[7rem] flex-wrap items-baseline justify-center gap-x-1 text-center text-sm font-bold tabular-nums text-amber-100 min-[1024px]:max-w-[8rem] min-[1024px]:text-base'
            }
        >
            <span className="whitespace-nowrap">{amount.toLocaleString()}</span>
            {understandingBonus != null && understandingBonus > 0 && (
                <span
                    className={
                        compact
                            ? 'whitespace-nowrap text-[0.62rem] font-semibold text-emerald-300/95'
                            : 'whitespace-nowrap text-xs font-semibold text-emerald-300/95 min-[1024px]:text-sm'
                    }
                >
                    (+{understandingBonus.toLocaleString()})
                </span>
            )}
        </span>
    </div>
);

/** 소모품/아이템: 이미지가 있으면 아이콘으로 식별 → 하단에는 개수만(×n). 이미지 없을 때만 이름 표시 */
export const ResultModalItemRewardSlot: React.FC<{
    imageSrc?: string | null;
    name: string;
    quantity?: number;
    compact: boolean;
    dimmed?: boolean;
    onImageError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
    /** 이미지가 있어도 이름을 아이콘 아래에 표시(모험 장비 결과 등) */
    alwaysShowNameBelow?: boolean;
    /** 재료 등: 이름 없이 아이콘 아래 개수만(1개일 때도 표시) */
    materialQuantityOnly?: boolean;
    /** 장비: 등급별 배경·테두리(일반=회색 톤, 에픽=보라 등) */
    equipmentGrade?: ItemGrade;
}> = ({
    imageSrc,
    name,
    quantity,
    compact,
    dimmed,
    onImageError,
    alwaysShowNameBelow,
    materialQuantityOnly,
    equipmentGrade,
}) => {
    const displayName = formatRewardItemDisplayName(name);
    const imgClass = compact
        ? 'h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 min-[400px]:h-9 min-[400px]:w-9 object-contain p-0.5 sm:h-10 sm:w-10'
        : 'h-11 w-11 object-contain p-1 min-[1024px]:h-12 min-[1024px]:w-12';
    const showQuantityBelow =
        imageSrc &&
        quantity != null &&
        quantity >= 1 &&
        (materialQuantityOnly ? true : quantity > 1);
    const showNameBelow = !materialQuantityOnly && (!imageSrc || alwaysShowNameBelow);
    const labelTone = equipmentGrade != null ? gradeStyles[equipmentGrade]?.color ?? 'text-violet-200' : 'text-violet-200';
    const iconBox = (() => {
        if (equipmentGrade != null) {
            const shell = equipmentGradeRewardIconShellClassNames(equipmentGrade);
            return (
                <div className={`${shell.outer} ${imageBoxClass(compact)}`}>
                    <div
                        className={`pointer-events-none absolute inset-0 ${shell.transcendentClass}`}
                        style={shell.bgStyle}
                        aria-hidden
                    />
                    <div className="relative z-[1] flex h-full w-full items-center justify-center">
                        {imageSrc ? (
                            <img src={imageSrc} alt="" className={imgClass} onError={onImageError} />
                        ) : (
                            <span
                                className={`line-clamp-3 px-1 text-center text-[0.58rem] font-medium leading-tight ${labelTone} sm:text-[0.62rem]`}
                            >
                                {displayName}
                            </span>
                        )}
                    </div>
                </div>
            );
        }
        return (
            <div className={`${BOX_ITEM} ${imageBoxClass(compact)}`}>
                {imageSrc ? (
                    <img src={imageSrc} alt="" className={imgClass} onError={onImageError} />
                ) : (
                    <span className="line-clamp-3 px-1 text-center text-[0.58rem] font-medium leading-tight text-violet-200/95 sm:text-[0.62rem]">
                        {displayName}
                    </span>
                )}
            </div>
        );
    })();
    return (
        <div
            className={`flex flex-col items-center gap-0.5 ${
                compact
                    ? 'w-[2.5rem] shrink-0 min-[360px]:w-[2.75rem] min-[400px]:w-12 sm:w-auto sm:max-w-[6.75rem]'
                    : 'max-w-[5.75rem] sm:max-w-[6.75rem] min-[1024px]:max-w-[7.25rem]'
            } ${dimmed ? 'opacity-80' : ''}`}
            title={displayName + (quantity != null && quantity > 1 ? ` ×${quantity}` : '')}
        >
            {iconBox}
            {showNameBelow && (
                <p
                    className={`line-clamp-2 w-full text-center font-semibold leading-tight ${labelTone} ${
                        compact ? 'text-[0.62rem] sm:text-[0.65rem]' : 'text-xs min-[1024px]:text-[0.8125rem]'
                    }`}
                >
                    {displayName}
                    {quantity != null && quantity > 1 ? ` ×${quantity}` : ''}
                </p>
            )}
            {showQuantityBelow && (
                <p
                    className={`w-full text-center font-semibold tabular-nums leading-tight ${labelTone} ${
                        compact ? 'text-[0.62rem] sm:text-[0.65rem]' : 'text-xs min-[1024px]:text-[0.8125rem]'
                    }`}
                >
                    ×{quantity}
                </p>
            )}
        </div>
    );
};

/** 보상 한 줄 영역: 데이터 도착 전·후 동일 높이로 모달 흔들림 방지 */
export const RESULT_MODAL_REWARDS_ROW_MIN_H_CLASS = 'min-h-[6.25rem] w-full sm:min-h-[10rem]';

/** 모바일 보상 줄 컨테이너: 한 줄 우선, 필요 시 가로 스크롤 */
export const RESULT_MODAL_REWARDS_ROW_MOBILE_CLASS = `flex ${RESULT_MODAL_REWARDS_ROW_MIN_H_CLASS} w-full min-w-0 flex-row flex-nowrap items-center justify-center gap-1 overflow-x-auto overscroll-x-contain pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] min-[480px]:justify-center`;

/** 모바일 모험 등 4칸 고정: 가로 스크롤 없이 한 줄(열 폭 균등) */
export const RESULT_MODAL_REWARDS_ROW_MOBILE_FOUR_COL_CLASS =
    'grid w-full min-w-0 grid-cols-4 gap-1 items-start justify-items-center min-h-[4.75rem] py-0.5 sm:min-h-[5rem]';

/** 도전의 탑 등 결과 모달: 획득 보상 줄 높이를 낮춤(동일 한 줄·가로 스크롤) */
export const RESULT_MODAL_REWARDS_ROW_MOBILE_COMPACT_CLASS = `flex min-h-[2.85rem] w-full min-w-0 flex-row flex-nowrap items-center justify-center gap-0.5 overflow-x-auto overscroll-x-contain py-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] min-[480px]:justify-center`;
