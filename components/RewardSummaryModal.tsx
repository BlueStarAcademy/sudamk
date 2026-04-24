import React, { useEffect, useMemo } from 'react';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import Button from './Button.js';
import { InventoryItem, QuestReward, ItemGrade } from '../types.js';
import MailRewardItemTile from './MailRewardItemTile.js';
import { audioService } from '../services/audioService.js';

interface RewardSummaryModalProps {
    summary: {
        reward: QuestReward;
        items: InventoryItem[];
        title: string;
    };
    onClose: () => void;
    isTopmost?: boolean;
}

const RewardSummaryModal: React.FC<RewardSummaryModalProps> = ({ summary, onClose, isTopmost }) => {
    const { reward, items, title } = summary;

    const fallbackRewardItems = useMemo<InventoryItem[]>(() => {
        if (!Array.isArray(reward.items) || reward.items.length === 0) return [];
        return (reward.items as Array<InventoryItem | { itemId: string; quantity: number }>).map((entry, index) => {
            if ('itemId' in entry && !('name' in entry)) {
                const itemId = entry.itemId;
                const quantity = Number(entry.quantity ?? 1) || 1;
                return {
                    id: `reward-item-${itemId}-${index}`,
                    type: 'consumable' as InventoryItem['type'],
                    name: itemId,
                    quantity,
                } as InventoryItem;
            }
            return entry as InventoryItem;
        });
    }, [reward.items]);

    // 서버가 실제 아이템 인스턴스를 주면 우선 사용하고, 없을 때는 reward.items 정의를 fallback으로 표시
    const displayItems = items.length > 0 ? items : fallbackRewardItems;

    const hasAnyCurrencyReward =
        (reward.gold ?? 0) > 0 ||
        (reward.diamonds ?? 0) > 0 ||
        (reward.actionPoints ?? 0) > 0 ||
        (reward.guildCoins ?? 0) > 0 ||
        (reward.guildXp ?? 0) > 0 ||
        (reward.xp?.type === 'blacksmith' && (reward.xp?.amount ?? 0) > 0);
    const hasAnyItemReward = displayItems.length > 0;

    const bestItemGrade = useMemo(() => {
        if (!displayItems.length) return null;
        const order: ItemGrade[] = [
            ItemGrade.Normal,
            ItemGrade.Uncommon,
            ItemGrade.Rare,
            ItemGrade.Epic,
            ItemGrade.Legendary,
            ItemGrade.Mythic,
            ItemGrade.Transcendent,
        ];
        return displayItems.reduce<ItemGrade | null>((best, cur) => {
            const g = cur.grade ?? ItemGrade.Normal;
            if (!best) return g;
            return order.indexOf(g) > order.indexOf(best) ? g : best;
        }, null);
    }, [displayItems]);

    useEffect(() => {
        if (!hasAnyCurrencyReward && !hasAnyItemReward) return;
        let cancelled = false;
        const high = [ItemGrade.Epic, ItemGrade.Legendary, ItemGrade.Mythic, ItemGrade.Transcendent];
        void (async () => {
            await audioService.initialize();
            if (cancelled) return;
            if (bestItemGrade && high.includes(bestItemGrade)) {
                audioService.gachaEpicOrHigher();
            } else {
                audioService.claimReward();
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [hasAnyCurrencyReward, hasAnyItemReward, bestItemGrade]);

    const frame =
        'rounded-2xl border border-amber-500/20 bg-gradient-to-b from-zinc-950/95 via-zinc-900/90 to-black shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';

    return (
        <DraggableWindow title={title} onClose={onClose} windowId="quest-reward-summary" initialWidth={440} isTopmost={isTopmost}>
            <>
            <div className="px-1 pb-1">
                <div className={`${frame} overflow-hidden`}>
                    <div className="border-b border-amber-500/15 bg-gradient-to-r from-amber-950/50 via-black/40 to-amber-950/50 px-5 py-6 text-center">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">Reward</p>
                        <h2 className="mt-2 whitespace-nowrap bg-gradient-to-r from-amber-50 via-amber-200 to-amber-100 bg-clip-text text-xl font-black tracking-tight text-transparent drop-shadow-sm sm:text-2xl">
                            보상을 획득했습니다
                        </h2>
                    </div>

                    <div className="space-y-4 p-5">
                        {hasAnyCurrencyReward && (
                        <div className="rounded-xl border border-white/5 bg-black/40 p-4 shadow-inner">
                            <h3 className="mb-3 text-center text-[11px] font-bold uppercase tracking-wider text-zinc-500">획득 재화</h3>
                            <div className="flex flex-col items-center gap-2.5 text-sm">
                                {(reward.gold ?? 0) > 0 && (
                                    <div className="flex w-full max-w-[16rem] items-center justify-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-950/25 px-4 py-2.5 shadow-inner">
                                        <img src="/images/icon/Gold.png" alt="" className="h-6 w-6 shrink-0 object-contain" title="골드" />
                                        <span className="text-lg font-bold tabular-nums text-amber-200 sm:text-xl">
                                            +{reward.gold!.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {(reward.diamonds ?? 0) > 0 && (
                                    <div className="flex w-full max-w-[16rem] items-center justify-center gap-2.5 rounded-xl border border-cyan-500/20 bg-cyan-950/25 px-4 py-2.5 shadow-inner">
                                        <img src="/images/icon/Zem.png" alt="" className="h-6 w-6 shrink-0 object-contain" title="다이아" />
                                        <span className="text-lg font-bold tabular-nums text-cyan-200 sm:text-xl">
                                            +{reward.diamonds!.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {(reward.actionPoints ?? 0) > 0 && (
                                    <div className="flex w-full max-w-[16rem] items-center justify-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-950/25 px-4 py-2.5 shadow-inner">
                                        <span
                                            className="flex h-6 w-6 shrink-0 items-center justify-center text-base font-black leading-none text-emerald-300"
                                            aria-hidden
                                        >
                                            ⚡
                                        </span>
                                        <span className="text-lg font-bold tabular-nums text-emerald-300 sm:text-xl">
                                            +{reward.actionPoints!.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {(reward.guildCoins ?? 0) > 0 && (
                                    <div className="flex w-full max-w-[16rem] items-center justify-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-950/25 px-4 py-2.5 shadow-inner">
                                        <img src="/images/guild/tokken.png" alt="" className="h-6 w-6 shrink-0 object-contain" title="길드 코인" />
                                        <span className="text-lg font-bold tabular-nums text-amber-200 sm:text-xl">
                                            +{reward.guildCoins!.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {(reward.guildXp ?? 0) > 0 && (
                                    <div className="flex w-full max-w-[16rem] items-center justify-center gap-2.5 rounded-xl border border-blue-500/20 bg-blue-950/25 px-4 py-2.5 shadow-inner">
                                        <img src="/images/guild/button/guildlab.png" alt="" className="h-6 w-6 shrink-0 object-contain" title="길드 경험치" />
                                        <span className="text-lg font-bold tabular-nums text-blue-200 sm:text-xl">
                                            +{reward.guildXp!.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                                {reward.xp?.type === 'blacksmith' && (reward.xp?.amount ?? 0) > 0 && (
                                    <div className="flex w-full max-w-[16rem] items-center justify-center gap-2.5 rounded-xl border border-orange-500/20 bg-orange-950/25 px-4 py-2.5 shadow-inner">
                                        <img src="/images/equipments/moru.png" alt="" className="h-6 w-6 shrink-0 object-contain" title="대장간 경험치" />
                                        <span className="text-lg font-bold tabular-nums text-orange-300 sm:text-xl">
                                            +{reward.xp!.amount.toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        )}

                        {hasAnyItemReward && (
                            <div className="rounded-xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/80 to-black/80 p-4">
                                <h3 className="mb-4 flex items-center justify-center gap-2 text-sm font-bold text-amber-100/90">
                                    <span className="h-px w-6 bg-gradient-to-r from-transparent to-amber-500/50" aria-hidden />
                                    획득 아이템
                                    <span className="h-px w-6 bg-gradient-to-l from-transparent to-amber-500/50" aria-hidden />
                                </h3>
                                <div className="flex flex-wrap justify-center gap-x-4 gap-y-4 sm:gap-x-3 sm:gap-y-3">
                                    {displayItems.map((item, index) => (
                                        <MailRewardItemTile key={index} item={item} variant="md" />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

                <div className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} mt-5 flex justify-center px-1 pb-1`}>
                    <Button
                        onClick={onClose}
                        className="min-w-[8.5rem] !rounded-xl !px-10 !py-2.5 !text-base !font-bold shadow-lg shadow-amber-950/20"
                        colorScheme="blue"
                    >
                        확인
                    </Button>
                </div>
            </>
        </DraggableWindow>
    );
};

export default RewardSummaryModal;
