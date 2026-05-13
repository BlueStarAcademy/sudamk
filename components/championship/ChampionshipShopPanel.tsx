import React, { useCallback, useMemo, useState } from 'react';
import type { HandleActionResult, ServerAction } from '../../types/api.js';
import type { UserWithStatus } from '../../types.js';
import {
    CHAMPIONSHIP_SHOP_CHANGE,
    CHAMPIONSHIP_SHOP_EQUIPMENT,
    CHAMPIONSHIP_SHOP_SPECIAL,
    type ChampionshipShopTab,
} from '../../shared/constants/championshipShop.js';
import { isDifferentWeekKST } from '../../shared/utils/timeUtils.js';

const TAB_BTN =
    'min-h-[2.25rem] flex-1 rounded-md px-2 text-xs font-black transition-colors sm:text-sm border border-transparent';
const TAB_ACTIVE = 'bg-amber-500/90 text-slate-950 shadow border-amber-400/50';
const TAB_IDLE = 'text-amber-100/85 hover:bg-white/10 border-transparent';

function weeklyUsed(
    purchases: UserWithStatus['championshipShopWeekPurchases'],
    productId: string,
    now: number
): number {
    const rec = purchases?.[productId];
    if (!rec || isDifferentWeekKST(rec.date, now)) return 0;
    return rec.quantity;
}

const ChampionshipShopPanel: React.FC<{
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void | Promise<unknown>;
}> = ({ currentUser, onAction }) => {
    const [tab, setTab] = useState<ChampionshipShopTab>('equipment');
    const [busyId, setBusyId] = useState<string | null>(null);
    const now = Date.now();
    const champ = currentUser.champCoins ?? 0;
    const purchases = currentUser.championshipShopWeekPurchases;

    const rows = useMemo(() => {
        if (tab === 'equipment') return [...CHAMPIONSHIP_SHOP_EQUIPMENT];
        if (tab === 'change') return [...CHAMPIONSHIP_SHOP_CHANGE];
        return [...CHAMPIONSHIP_SHOP_SPECIAL];
    }, [tab]);

    const buy = useCallback(
        async (productId: string, price: number) => {
            if (busyId) return;
            if ((currentUser.champCoins ?? 0) < price) {
                window.alert('챔프 코인이 부족합니다.');
                return;
            }
            setBusyId(productId);
            try {
                const res = (await onAction({
                    type: 'BUY_CHAMPIONSHIP_SHOP_ITEM',
                    payload: { productId, quantity: 1 },
                })) as HandleActionResult | void;
                if (res && typeof res === 'object' && 'error' in res && res.error) {
                    window.alert(String(res.error));
                }
            } catch {
                window.alert('구매에 실패했습니다. 잠시 후 다시 시도해 주세요.');
            } finally {
                setBusyId(null);
            }
        },
        [busyId, currentUser.champCoins, onAction]
    );

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
            <div
                role="tablist"
                aria-label="챔피언십 상점 카테고리"
                className="flex w-full shrink-0 gap-1 rounded-lg border border-amber-500/35 bg-black/40 p-0.5 shadow-inner"
            >
                {(
                    [
                        ['equipment', '장비상자'] as const,
                        ['change', '변경권'] as const,
                        ['special', '특수'] as const,
                    ] as const
                ).map(([key, label]) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={tab === key}
                        onClick={() => setTab(key)}
                        className={`${TAB_BTN} ${tab === key ? TAB_ACTIVE : TAB_IDLE}`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-2 overflow-y-auto overflow-x-hidden sm:grid-cols-2 [-webkit-overflow-scrolling:touch]">
                {rows.map((p) => {
                    const price = p.champCoins;
                    const canAfford = champ >= price;
                    const wk = p.tab === 'special' ? weeklyUsed(purchases, p.id, now) : 0;
                    const wkLimit = p.tab === 'special' ? p.weeklyLimit : undefined;
                    const wkLeft = wkLimit != null ? Math.max(0, wkLimit - wk) : null;
                    const atWeeklyCap = wkLimit != null && wkLeft === 0;
                    const disabled = busyId != null || !canAfford || atWeeklyCap;
                    return (
                        <div
                            key={p.id}
                            className="flex min-h-[5.5rem] flex-col justify-between gap-1.5 rounded-lg border border-amber-500/25 bg-black/30 p-2 shadow-inner sm:min-h-[6rem]"
                        >
                            <div className="flex min-w-0 gap-2">
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/40 sm:h-14 sm:w-14">
                                    <img src={p.image} alt="" className="max-h-11 max-w-11 object-contain" loading="lazy" decoding="async" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold leading-tight text-amber-50 sm:text-base">{p.label}</div>
                                    <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-zinc-400 sm:text-xs">{p.description}</p>
                                    {wkLimit != null ? (
                                        <div className="mt-0.5 text-[10px] font-semibold text-amber-200/80">
                                            이번 주 구매 {wk}/{wkLimit}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-white/10 pt-1.5">
                                <div className="flex items-center gap-1 text-xs font-bold tabular-nums text-amber-200 sm:text-sm">
                                    <img src="/images/icon/champcoin.webp" alt="" className="h-4 w-4 object-contain" loading="lazy" decoding="async" />
                                    <span>{price.toLocaleString()}</span>
                                </div>
                                <button
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => void buy(p.id, price)}
                                    className={`rounded-md px-2.5 py-1 text-[11px] font-black sm:text-xs ${
                                        disabled
                                            ? 'cursor-not-allowed bg-zinc-800 text-zinc-500'
                                            : 'bg-amber-500 text-slate-950 shadow hover:bg-amber-400 active:scale-[0.98]'
                                    }`}
                                >
                                    {busyId === p.id ? '…' : atWeeklyCap ? '한도' : '구매'}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ChampionshipShopPanel;
