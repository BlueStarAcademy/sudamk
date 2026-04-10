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

function imageBoxClass(compact: boolean): string {
    return compact
        ? 'h-14 w-14'
        : 'h-[4.75rem] w-[4.75rem] min-[1024px]:h-[5.25rem] min-[1024px]:w-[5.25rem]';
}

/** 통화 골드: 아이콘만 박스, 하단에 수량 + 「골드」 */
export const ResultModalGoldCurrencySlot: React.FC<{
    amount: number;
    compact: boolean;
    dimmed?: boolean;
}> = ({ amount, compact, dimmed }) => (
    <div className={`flex flex-col items-center gap-0.5 ${dimmed ? 'opacity-80' : ''}`}>
        <div className={`${BOX_GOLD} ${imageBoxClass(compact)}`}>
            <img
                src="/images/icon/Gold.png"
                alt=""
                className={compact ? 'h-9 w-9 object-contain p-0.5' : 'h-11 w-11 object-contain p-1 min-[1024px]:h-12 min-[1024px]:w-12'}
            />
        </div>
        <span
            className={
                compact
                    ? 'text-center text-[0.72rem] font-bold tabular-nums text-amber-100'
                    : 'text-center text-sm font-bold tabular-nums text-amber-100 min-[1024px]:text-base'
            }
        >
            {amount.toLocaleString()}
        </span>
        <span className="text-center text-[0.62rem] font-semibold leading-none text-amber-200/78 sm:text-[0.65rem]">골드</span>
    </div>
);

/** 소모품/아이템: 이미지만 박스, 하단에 이름(골드 꾸러미 등) */
export const ResultModalItemRewardSlot: React.FC<{
    imageSrc?: string | null;
    name: string;
    quantity?: number;
    compact: boolean;
    dimmed?: boolean;
    onImageError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}> = ({ imageSrc, name, quantity, compact, dimmed, onImageError }) => {
    const displayName = formatRewardItemDisplayName(name);
    const imgClass = compact ? 'h-10 w-10 object-contain p-0.5' : 'h-11 w-11 object-contain p-1 min-[1024px]:h-12 min-[1024px]:w-12';
    return (
        <div
            className={`flex max-w-[5.75rem] flex-col items-center gap-0.5 sm:max-w-[6.75rem] min-[1024px]:max-w-[7.25rem] ${
                dimmed ? 'opacity-80' : ''
            }`}
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
            <p
                className={`line-clamp-2 w-full text-center font-semibold leading-tight text-violet-200 ${
                    compact ? 'text-[0.62rem] sm:text-[0.65rem]' : 'text-xs min-[1024px]:text-[0.8125rem]'
                }`}
            >
                {displayName}
                {quantity != null && quantity > 1 ? ` ×${quantity}` : ''}
            </p>
        </div>
    );
};

/** 보상 한 줄 영역: 데이터 도착 전·후 동일 높이로 모달 흔들림 방지 */
export const RESULT_MODAL_REWARDS_ROW_MIN_H_CLASS = 'min-h-[7.5rem] w-full sm:min-h-[10rem]';
