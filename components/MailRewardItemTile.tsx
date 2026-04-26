import React from 'react';
import { InventoryItem } from '../types.js';
import { ItemGrade } from '../types/enums.js';
import { gradeBackgrounds, gradeStyles } from '../constants';
import { getMailEquipmentDisplayStars, isMailAttachmentEquipment } from '../shared/utils/equipmentEnhancementStars.js';
import { getItemTemplateByName } from '../utils/itemTemplateLookup.js';
import { isActionPointConsumable } from '../constants/items.js';

function resolveItemImageSrc(path: string | undefined): string {
    if (!path) return '/images/icon/Reward.png';
    if (path.startsWith('http') || path.startsWith('/')) return path;
    return `/${path}`;
}

function resolveMailAttachmentImage(item: InventoryItem): string {
    const lookupKey = item.name ?? (item as { itemId?: string }).itemId;
    const fallbackTemplate = lookupKey ? getItemTemplateByName(lookupKey) : null;
    // 행동력 회복제는 저장된 우편 이미지보다 템플릿 아이콘을 우선한다.
    if (isActionPointConsumable(lookupKey) || isActionPointConsumable(fallbackTemplate?.name)) {
        return resolveItemImageSrc(fallbackTemplate?.image);
    }
    if (item.image && item.image.trim().length > 0) {
        return resolveItemImageSrc(item.image);
    }
    return resolveItemImageSrc(fallbackTemplate?.image);
}

function getActionPointBadge(item: InventoryItem): string | null {
    const raw = (item.name ?? (item as { itemId?: string }).itemId ?? '').trim();
    const template = raw ? getItemTemplateByName(raw) : null;
    const name = template?.name ?? raw;
    if (!isActionPointConsumable(name)) return null;

    const match = name.match(/\+(\d+)/);
    return match ? `+${match[1]}` : null;
}

export type MailRewardItemTileVariant = 'sm' | 'md' | 'lg';

const sizeMap: Record<MailRewardItemTileVariant, { box: string; iconPct: string; label: string }> = {
    sm: { box: 'h-11 w-11', iconPct: '82%', label: 'text-[10px]' },
    md: { box: 'h-14 w-14', iconPct: '85%', label: 'text-[11px]' },
    lg: { box: 'h-[4.5rem] w-[4.5rem]', iconPct: '86%', label: 'text-xs' },
};

/**
 * 우편 첨부·보상 요약 등에서 장비는 등급 배경·강화(+N) 표시, 그 외는 아이콘만.
 */
const MailRewardItemTile: React.FC<{
    item: InventoryItem;
    variant?: MailRewardItemTileVariant;
    className?: string;
}> = ({ item, variant = 'md', className = '' }) => {
    const { box, iconPct, label } = sizeMap[variant];
    const qty = item.quantity ?? 1;
    const stars = getMailEquipmentDisplayStars(item);
    const displayName = item.name ?? (item as { itemId?: string }).itemId ?? '보상';
    const actionPointBadge = getActionPointBadge(item);

    if (isMailAttachmentEquipment(item)) {
        const g = item.grade ?? ItemGrade.Normal;
        const gs = gradeStyles[g] ?? gradeStyles[ItemGrade.Normal];
        return (
            <div className={`flex flex-col items-center gap-1 text-center min-w-0 ${className}`}>
                <div
                    className={`relative shrink-0 overflow-hidden rounded-xl shadow-md ring-1 ring-black/30 dark:ring-amber-950/40 ${box}`}
                >
                    <img
                        src={gradeBackgrounds[g]}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        aria-hidden
                    />
                    <img
                    src={resolveMailAttachmentImage(item)}
                        alt=""
                        className="pointer-events-none absolute left-1/2 top-1/2 max-h-full max-w-full -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-md"
                        style={{ width: iconPct, height: iconPct }}
                        aria-hidden
                    />
                    {stars > 0 ? (
                        <span className="absolute bottom-0.5 right-0.5 z-10 rounded-md border border-amber-400/40 bg-gradient-to-b from-amber-950/95 to-black/90 px-1 py-px text-[9px] font-black tabular-nums text-amber-200 shadow-sm">
                            +{stars}
                        </span>
                    ) : null}
                </div>
                {stars > 0 ? (
                    <span className={`text-[10px] font-bold tabular-nums text-amber-300/95`}>+{stars}강화</span>
                ) : null}
                <span className={`max-w-[6.5rem] font-semibold leading-tight line-clamp-2 ${label} ${gs.color}`}>{displayName}</span>
                {qty > 1 ? <span className="text-[10px] font-medium text-gray-400">×{qty}</span> : null}
            </div>
        );
    }

    return (
        <div className={`flex flex-col items-center gap-1 text-center min-w-0 ${className}`}>
            <div
                className={`relative flex shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-b from-zinc-800/90 to-zinc-950/90 shadow-inner ${box}`}
            >
                {actionPointBadge ? (
                    <>
                        <span
                            className="flex h-full w-full items-center justify-center text-[1.9rem] leading-none drop-shadow-[0_6px_12px_rgba(30,64,175,0.4)]"
                            aria-hidden
                        >
                            ⚡
                        </span>
                        <span className="absolute right-0 top-0 rounded-bl bg-gray-900/90 px-1 text-[10px] font-bold leading-tight text-cyan-300 shadow-md">
                            {actionPointBadge}
                        </span>
                    </>
                ) : (
                    <img
                        src={resolveMailAttachmentImage(item)}
                        alt=""
                        className="max-h-[88%] max-w-[88%] object-contain drop-shadow"
                        aria-hidden
                    />
                )}
            </div>
            <span className={`max-w-[6.5rem] leading-tight line-clamp-2 text-gray-200 ${label}`}>{displayName}</span>
            {qty > 1 ? <span className="text-[10px] font-medium text-gray-400">×{qty}</span> : null}
        </div>
    );
};

export default MailRewardItemTile;
