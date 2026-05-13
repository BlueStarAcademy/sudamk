import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { HandleActionResult, ServerAction } from '../../types/api.js';
import type { UserWithStatus } from '../../types.js';
import {
    CHAMPIONSHIP_SHOP_CHANGE,
    CHAMPIONSHIP_SHOP_EQUIPMENT,
    CHAMPIONSHIP_SHOP_SPECIAL,
    type ChampionshipShopProduct,
    type ChampionshipShopTab,
} from '../../shared/constants/championshipShop.js';
import { isDifferentWeekKST } from '../../shared/utils/timeUtils.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { specialResourceIcons } from '../resourceIcons.js';
import { formatShopItemDescription, ShopMobileImageDescriptionPortal } from '../shopImageDescriptionPopover.js';

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

const ChampionshipProductCard: React.FC<{
    p: ChampionshipShopProduct;
    mobile: boolean;
    champ: number;
    purchases: UserWithStatus['championshipShopWeekPurchases'];
    now: number;
    busyId: string | null;
    onBuy: (productId: string, price: number) => void;
}> = ({ p, mobile, champ, purchases, now, busyId, onBuy }) => {
    const price = p.champCoins;
    const canAfford = champ >= price;
    const wk = p.tab === 'special' ? weeklyUsed(purchases, p.id, now) : 0;
    const wkLimit = p.tab === 'special' ? p.weeklyLimit : undefined;
    const wkLeft = wkLimit != null ? Math.max(0, wkLimit - wk) : null;
    const atWeeklyCap = wkLimit != null && wkLeft === 0;
    const disabled = busyId != null || !canAfford || atWeeklyCap;
    const [showDescription, setShowDescription] = useState(false);
    const imageAnchorRef = useRef<HTMLDivElement>(null);
    const refinedDescription = formatShopItemDescription(p.description);

    return (
        <div className="group relative flex min-h-0 flex-col items-center overflow-hidden rounded-lg border border-amber-500/25 bg-black/30 p-2 text-center shadow-inner">
            <div
                ref={imageAnchorRef}
                className="relative mb-1 flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-[#312e81]/35 via-[#1e1b4b]/20 to-transparent shadow-[0_0_20px_-8px_rgba(251,191,36,0.35)] transition-transform hover:scale-105"
                onClick={() => setShowDescription(!showDescription)}
                onMouseEnter={() => {
                    if (!mobile) setShowDescription(true);
                }}
                onMouseLeave={() => {
                    if (!mobile) setShowDescription(false);
                }}
            >
                <img src={p.image} alt="" className="max-h-12 max-w-12 object-contain p-0.5" loading="lazy" decoding="async" />
            </div>
            <h3
                className={`mb-1 w-full min-w-0 px-0.5 text-center font-bold leading-tight tracking-tight text-amber-50 ${
                    mobile ? 'line-clamp-2 min-h-[2rem] text-[10px]' : 'line-clamp-2 min-h-[2.25rem] text-[11px] sm:text-xs'
                }`}
                title={p.label}
            >
                {p.label}
            </h3>
            {showDescription && mobile && (
                <ShopMobileImageDescriptionPortal
                    open
                    anchorRef={imageAnchorRef}
                    onRequestClose={() => setShowDescription(false)}
                >
                    <p className="text-left text-[11px] leading-relaxed text-slate-100">{refinedDescription}</p>
                </ShopMobileImageDescriptionPortal>
            )}
            {showDescription && !mobile && (
                <div className="absolute left-1/2 top-20 z-50 w-52 -translate-x-1/2 rounded-lg border border-indigo-400/50 bg-[#0b1220] p-2 shadow-xl">
                    <p className="text-left text-[10px] leading-relaxed text-slate-100">{refinedDescription}</p>
                </div>
            )}
            <button
                type="button"
                disabled={disabled}
                onClick={() => onBuy(p.id, price)}
                className={`mt-auto flex w-full min-h-[2.75rem] flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-1 text-center font-semibold leading-tight transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 disabled:cursor-not-allowed disabled:opacity-55 ${
                    disabled
                        ? 'border-zinc-600/50 bg-zinc-800/90 text-zinc-500'
                        : 'border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 text-slate-900 shadow-[0_10px_28px_-14px_rgba(251,191,36,0.75)] hover:from-amber-300 hover:to-amber-500'
                }`}
            >
                <div className="flex items-center justify-center gap-1 font-bold tabular-nums">
                    {busyId === p.id ? (
                        <span className="text-xs">…</span>
                    ) : atWeeklyCap ? (
                        <span className="text-[11px]">한도</span>
                    ) : (
                        <>
                            <img
                                src={specialResourceIcons.champCoins}
                                alt=""
                                className="h-4 w-4 shrink-0 object-contain"
                                loading="lazy"
                                decoding="async"
                            />
                            <span className={`${mobile ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>{price.toLocaleString()}</span>
                        </>
                    )}
                </div>
                {wkLimit != null && !atWeeklyCap && busyId !== p.id ? (
                    <span className="max-w-full px-0 text-center text-[9px] leading-tight tracking-tight text-slate-800/95">
                        이번 주 {wk}/{wkLimit}
                    </span>
                ) : null}
            </button>
        </div>
    );
};

const ChampionshipShopPanel: React.FC<{
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void | Promise<unknown>;
}> = ({ currentUser, onAction }) => {
    const { isNativeMobile } = useNativeMobileShell();
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
            <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2 overflow-y-auto overflow-x-hidden sm:grid-cols-3 [-webkit-overflow-scrolling:touch]">
                {rows.map((p) => (
                    <ChampionshipProductCard
                        key={p.id}
                        p={p}
                        mobile={isNativeMobile}
                        champ={champ}
                        purchases={purchases}
                        now={now}
                        busyId={busyId}
                        onBuy={buy}
                    />
                ))}
            </div>
        </div>
    );
};

export default ChampionshipShopPanel;
