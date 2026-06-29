import React from 'react';
import { useTranslation } from 'react-i18next';
import { CONSUMABLE_ITEMS } from '../../constants/index.js';
import type { SinglePlayerStageInfo } from '../../shared/types/entities.js';

export type StageClearReward = SinglePlayerStageInfo['rewards']['firstClear'];

const ExpBadge: React.FC<{ sizeClass: string; muted?: boolean }> = ({ sizeClass, muted }) => (
    <span
        className={`inline-flex shrink-0 items-center justify-center rounded bg-emerald-500/25 font-black leading-none text-emerald-100 ring-1 ring-emerald-300/30 ${sizeClass} ${muted ? 'opacity-55 grayscale' : ''}`}
    >
        EXP
    </span>
);

const StageClearRewardPreview: React.FC<{
    reward: StageClearReward;
    claimed: boolean;
    tabShelf: boolean;
    isMobile: boolean;
    usePremiumDesktop: boolean;
    align?: 'center' | 'end';
    resolveItemImage?: (itemId: string) => string | undefined;
    resolveItemTitle?: (itemId: string) => string | undefined;
}> = ({ reward, claimed, tabShelf, isMobile, usePremiumDesktop, align = 'center', resolveItemImage, resolveItemTitle }) => {
    const { t } = useTranslation(['lobby', 'common']);
    const textClass = claimed
        ? 'text-stone-400/90'
        : 'text-amber-200/95';
    const goldTextClass = claimed ? 'text-stone-400/90' : 'text-yellow-300';
    const expTextClass = claimed ? 'text-stone-400/90' : 'text-emerald-200';
    const iconClass = claimed ? 'opacity-55 grayscale' : '';
    const textSize = tabShelf
        ? 'text-[9px]'
        : isMobile
          ? 'text-[10px]'
          : usePremiumDesktop
            ? 'text-[10px]'
            : 'text-xs sm:text-sm';
    const iconSize = tabShelf ? 'h-3 w-3' : isMobile ? 'h-4 w-4' : 'h-4 w-4 sm:h-5 sm:w-5';
    const expBadgeSize = tabShelf
        ? 'h-3 min-w-[1.35rem] px-0.5 text-[6px]'
        : isMobile
          ? 'h-3.5 min-w-[1.5rem] px-0.5 text-[7px]'
          : 'h-4 min-w-[1.65rem] px-0.5 text-[8px] sm:text-[9px]';
    const alignClass = align === 'end' ? 'justify-end' : 'justify-center';
    const segmentClass = 'inline-flex min-w-0 shrink-0 items-center gap-0.5';

    const hasGold = reward.gold > 0;
    const hasExp = reward.exp > 0;
    const hasItems = Array.isArray(reward.items) && reward.items.length > 0;
    const hasBonus = typeof reward.bonus === 'string' && reward.bonus.length > 0;

    if (!hasGold && !hasExp && !hasItems && !hasBonus) {
        return (
            <div className={`truncate text-center font-semibold ${textClass} ${textSize}`}>
                —
            </div>
        );
    }

    return (
        <div
            className={`flex w-full flex-nowrap items-center ${alignClass} gap-x-2 font-semibold ${textSize} ${tabShelf ? 'min-h-[2.25rem]' : ''}`}
        >
            {hasGold && (
                <span className={segmentClass} title={t('common:resources.gold')}>
                    <img
                        src="/images/icon/Gold.webp"
                        alt={t('common:resources.gold')}
                        className={`${iconSize} ${iconClass}`}
                    />
                    <span className={`truncate tabular-nums ${goldTextClass}`}>{reward.gold.toLocaleString()}</span>
                </span>
            )}
            {hasExp && (
                <span className={segmentClass} title={`EXP ${reward.exp.toLocaleString()}`}>
                    <ExpBadge sizeClass={expBadgeSize} muted={claimed} />
                    <span className={`truncate tabular-nums ${expTextClass}`}>{reward.exp.toLocaleString()}</span>
                </span>
            )}
            {hasItems &&
                reward.items!.slice(0, 3).map((item, idx) => {
                    const resolvedImage = resolveItemImage?.(item.itemId);
                    const itemTemplate = resolvedImage
                        ? null
                        : CONSUMABLE_ITEMS.find((i) => i.name === item.itemId);
                    const imageSrc = resolvedImage ?? itemTemplate?.image;
                    if (!imageSrc) return null;
                    const title = resolveItemTitle?.(item.itemId) ?? item.itemId;
                    return (
                        <span key={`${item.itemId}-${idx}`} className={segmentClass} title={title}>
                            <img
                                src={imageSrc}
                                alt={title}
                                className={`${iconSize} ${iconClass}`}
                            />
                            <span className={`truncate tabular-nums ${textClass}`}>x{item.quantity.toLocaleString()}</span>
                        </span>
                    );
                })}
            {hasItems && reward.items!.length > 3 && <span className={textClass}>…</span>}
            {hasBonus && <span className={`truncate ${textClass}`}>{reward.bonus}</span>}
        </div>
    );
};

export default StageClearRewardPreview;
