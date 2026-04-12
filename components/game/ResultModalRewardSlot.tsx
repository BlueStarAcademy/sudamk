import React from 'react';

/** 아이템 표기: 골드꾸러미 → 골드 꾸러미 */
export function formatRewardItemDisplayName(raw: string): string {
    if (!raw) return raw;
    return raw.includes('골드꾸러미') ? raw.replace(/골드꾸러미/g, '골드 꾸러미') : raw;
}

const BOX_GOLD =
    'flex flex-shrink-0 items-center justify-center rounded-lg border-2 border-amber-400/45 bg-gradient-to-br from-amber-950/70 via-yellow-900/35 to-zinc-950/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-inset ring-amber-400/20';
const BOX_ITEM =
    'flex flex-shrink-0 items-center justify-center rounded-lg border-2 border-violet-500/45 bg-gradient-to-br from-violet-950/55 via-purple-900/35 to-zinc-950/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-inset ring-violet-400/15';

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
    /** 지역 이해도 버프 등으로 추가된 골드 — 총액 `amount` 옆에 (+N) */
    understandingBonus?: number;
}> = ({ amount, compact, dimmed, understandingBonus }) => (
    <div
        className={`flex flex-col items-center gap-0.5 ${compact ? 'shrink-0' : ''} ${dimmed ? 'opacity-80' : ''}`}
        title={
            understandingBonus != null && understandingBonus > 0
                ? `골드 ${amount.toLocaleString()} (지역 이해도 +${understandingBonus.toLocaleString()})`
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
}> = ({ imageSrc, name, quantity, compact, dimmed, onImageError }) => {
    const displayName = formatRewardItemDisplayName(name);
    const imgClass = compact
        ? 'h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 min-[400px]:h-9 min-[400px]:w-9 object-contain p-0.5 sm:h-10 sm:w-10'
        : 'h-11 w-11 object-contain p-1 min-[1024px]:h-12 min-[1024px]:w-12';
    const showQuantityBelow = imageSrc && quantity != null && quantity > 1;
    const showNameBelow = !imageSrc;
    return (
        <div
            className={`flex flex-col items-center gap-0.5 ${
                compact
                    ? 'w-[2.5rem] shrink-0 min-[360px]:w-[2.75rem] min-[400px]:w-12 sm:w-auto sm:max-w-[6.75rem]'
                    : 'max-w-[5.75rem] sm:max-w-[6.75rem] min-[1024px]:max-w-[7.25rem]'
            } ${dimmed ? 'opacity-80' : ''}`}
            title={displayName + (quantity != null && quantity > 1 ? ` ×${quantity}` : '')}
        >
            <div className={`${BOX_ITEM} ${imageBoxClass(compact)}`}>
                {imageSrc ? (
                    <img src={imageSrc} alt="" className={imgClass} onError={onImageError} />
                ) : (
                    <span className="line-clamp-3 px-1 text-center text-[0.58rem] font-medium leading-tight text-violet-200/95 sm:text-[0.62rem]">
                        {displayName}
                    </span>
                )}
            </div>
            {showNameBelow && (
                <p
                    className={`line-clamp-2 w-full text-center font-semibold leading-tight text-violet-200 ${
                        compact ? 'text-[0.62rem] sm:text-[0.65rem]' : 'text-xs min-[1024px]:text-[0.8125rem]'
                    }`}
                >
                    {displayName}
                    {quantity != null && quantity > 1 ? ` ×${quantity}` : ''}
                </p>
            )}
            {showQuantityBelow && (
                <p
                    className={`w-full text-center font-semibold tabular-nums leading-tight text-violet-200 ${
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

/** 도전의 탑 등 결과 모달: 획득 보상 줄 높이를 낮춤(동일 한 줄·가로 스크롤) */
export const RESULT_MODAL_REWARDS_ROW_MOBILE_COMPACT_CLASS = `flex min-h-[2.85rem] w-full min-w-0 flex-row flex-nowrap items-center justify-center gap-0.5 overflow-x-auto overscroll-x-contain py-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] min-[480px]:justify-center`;
