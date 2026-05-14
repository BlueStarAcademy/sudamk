import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { HandleActionResult, ServerAction } from '../../types/api.js';
import type { UserWithStatus } from '../../types.js';
import {
    CHAMPIONSHIP_SHOP_CHANGE,
    CHAMPIONSHIP_SHOP_EQUIPMENT,
    CHAMPIONSHIP_SHOP_SPECIAL,
    type ChampionshipShopEquipmentProduct,
    type ChampionshipShopMaterialProduct,
    type ChampionshipShopProduct,
    type ChampionshipShopTab,
} from '../../shared/constants/championshipShop.js';
import { isDifferentWeekKST } from '../../shared/utils/timeUtils.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { specialResourceIcons } from '../resourceIcons.js';
import { formatShopItemDescription, ShopMobileImageDescriptionPortal } from '../shopImageDescriptionPopover.js';

const TAB_BTN =
    'min-h-[2.125rem] flex-1 rounded-md px-2 text-xs font-black transition-colors sm:min-h-[2.25rem] sm:text-sm border border-transparent';
const TAB_ACTIVE = 'bg-amber-500/90 text-slate-950 shadow border-amber-400/50';
const TAB_IDLE = 'text-amber-100/85 hover:bg-white/10 border-transparent';

export type ChampionshipShopPanelLayoutVariant = 'default' | 'asideIntrinsic';

const ASIDE_SHOP_GRID_MIN_H = 'min-h-[30.5rem] sm:min-h-[21.5rem]';

const CARD_H_COMPACT = 'h-[10.85rem] sm:h-[11.35rem]';
const CARD_H_DEFAULT = 'h-[11.35rem] sm:h-[11.85rem]';
const BTN_MIN_H = 'min-h-[3.15rem] sm:min-h-[3.25rem]';

function weeklyUsedThisWeek(
    purchases: UserWithStatus['championshipShopWeekPurchases'],
    productId: string,
    now: number
): number {
    const rec = purchases?.[productId];
    if (!rec || isDifferentWeekKST(rec.date, now)) return 0;
    return rec.quantity;
}

type SimpleShopProduct = ChampionshipShopEquipmentProduct | Extract<ChampionshipShopMaterialProduct, { tab: 'change' }>;

/** 장비상자 · 변경권 — 주간 한도 없음 */
const ChampionshipSimpleShopCard: React.FC<{
    p: SimpleShopProduct;
    mobile: boolean;
    champ: number;
    busyId: string | null;
    onBuy: (productId: string, price: number) => void;
    compact: boolean;
}> = ({ p, mobile, champ, busyId, onBuy, compact }) => {
    const price = p.champCoins;
    const canAfford = champ >= price;
    const disabled = busyId != null || !canAfford;
    const [showDescription, setShowDescription] = useState(false);
    const imageAnchorRef = useRef<HTMLDivElement>(null);
    const refinedDescription = formatShopItemDescription(p.description);
    const cardH = compact ? CARD_H_COMPACT : CARD_H_DEFAULT;

    return (
        <div
            className={`group relative flex w-full min-w-0 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-amber-500/25 bg-black/30 p-1.5 text-center shadow-inner sm:p-2 ${cardH}`}
        >
            <div
                ref={imageAnchorRef}
                className={`relative mb-1 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-[#312e81]/35 via-[#1e1b4b]/20 to-transparent shadow-[0_0_18px_-8px_rgba(251,191,36,0.35)] transition-transform hover:scale-105 ${
                    compact ? 'flex h-12 w-12 sm:h-14 sm:w-14' : 'flex h-14 w-14 sm:h-16 sm:w-16'
                }`}
                onClick={() => setShowDescription(!showDescription)}
                onMouseEnter={() => {
                    if (!mobile) setShowDescription(true);
                }}
                onMouseLeave={() => {
                    if (!mobile) setShowDescription(false);
                }}
            >
                <img
                    src={p.image}
                    alt=""
                    className={`object-contain p-0.5 ${compact ? 'max-h-10 max-w-10 sm:max-h-12 sm:max-w-12' : 'max-h-12 max-w-12 sm:max-h-14 sm:max-w-14'}`}
                    loading="lazy"
                    decoding="async"
                />
            </div>
            <h3
                className={`line-clamp-2 flex min-h-0 flex-1 w-full flex-col justify-center px-0.5 text-center font-bold leading-snug tracking-tight text-amber-50 ${
                    compact ? 'min-h-[1.75rem] text-[9px] sm:min-h-[2rem] sm:text-[10px]' : `min-h-[2.25rem] ${mobile ? 'text-[10px]' : 'text-[11px] sm:text-xs'}`
                }`}
                title={p.label}
            >
                {p.label}
            </h3>
            {showDescription && (
                <ShopMobileImageDescriptionPortal
                    open
                    anchorRef={imageAnchorRef}
                    onRequestClose={() => setShowDescription(false)}
                    fullscreenBackdrop={mobile}
                >
                    <p className={`text-left leading-relaxed text-slate-100 ${mobile ? 'text-[11px]' : 'text-[11px] sm:text-xs'}`}>
                        {refinedDescription}
                    </p>
                </ShopMobileImageDescriptionPortal>
            )}
            <button
                type="button"
                disabled={disabled}
                onClick={() => onBuy(p.id, price)}
                className={`mt-auto box-border flex w-full shrink-0 items-center justify-center gap-1 rounded-lg border px-1.5 text-center font-semibold leading-none transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 disabled:cursor-not-allowed ${BTN_MIN_H} ${
                    disabled
                        ? 'border-zinc-600/50 bg-zinc-800/90 text-zinc-500'
                        : 'border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 text-slate-900 shadow-[0_8px_22px_-12px_rgba(251,191,36,0.75)] hover:from-amber-300 hover:to-amber-500'
                }`}
            >
                {busyId === p.id ? (
                    <span className="text-xs">…</span>
                ) : (
                    <>
                        <img
                            src={specialResourceIcons.champCoins}
                            alt=""
                            className="h-4 w-4 shrink-0 object-contain"
                            loading="lazy"
                            decoding="async"
                        />
                        <span className={`shrink-0 tabular-nums ${mobile ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>{price.toLocaleString()}</span>
                    </>
                )}
            </button>
        </div>
    );
};

type SpecialProduct = Extract<ChampionshipShopMaterialProduct, { tab: 'special' }>;

/** 특수 탭 전용 — 주간 한도·구매 버튼만 담당 (다른 탭과 UI 분리) */
const ChampionshipSpecialShopCard: React.FC<{
    p: SpecialProduct;
    mobile: boolean;
    champ: number;
    purchases: UserWithStatus['championshipShopWeekPurchases'];
    now: number;
    busyId: string | null;
    onBuy: (productId: string, price: number) => void;
    compact: boolean;
}> = ({ p, mobile, champ, purchases, now, busyId, onBuy, compact }) => {
    const price = p.champCoins;
    const limit = p.weeklyLimit ?? 0;
    const used = limit > 0 ? weeklyUsedThisWeek(purchases, p.id, now) : 0;
    const remaining = limit > 0 ? Math.max(0, limit - used) : Infinity;
    const atWeeklyCap = limit > 0 && remaining === 0;
    const canAfford = champ >= price;
    const busyHere = busyId === p.id;
    const disabled = busyId != null || !canAfford || atWeeklyCap;

    const [showDescription, setShowDescription] = useState(false);
    const imageAnchorRef = useRef<HTMLDivElement>(null);
    const refinedDescription = formatShopItemDescription(p.description);
    const cardH = compact ? CARD_H_COMPACT : CARD_H_DEFAULT;

    const weeklyMuted = disabled || busyHere;
    const weeklyLine =
        limit > 0 ? (
            <span
                className={`mt-0.5 max-w-full border-t pt-0.5 text-center text-[10px] font-semibold tabular-nums leading-tight tracking-tight sm:text-[11px] ${
                    weeklyMuted
                        ? 'border-white/10 text-amber-100/85'
                        : 'border-violet-950/25 text-violet-950 drop-shadow-[0_0.5px_0_rgba(255,255,255,0.35)]'
                }`}
            >
                (주간 {remaining}/{limit})
            </span>
        ) : null;

    const weeklyTitle =
        limit > 0
            ? atWeeklyCap
                ? `주간 남은 구매 0/${limit}회 (이번 주 한도 소진)`
                : `주간 남은 구매 ${remaining}/${limit}회 (이번 주 ${used}회 구매)`
            : undefined;

    return (
        <div
            className={`group relative flex w-full min-w-0 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-amber-500/25 bg-black/30 p-1.5 text-center shadow-inner sm:p-2 ${cardH}`}
        >
            <div
                ref={imageAnchorRef}
                className={`relative mb-1 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-[#312e81]/35 via-[#1e1b4b]/20 to-transparent shadow-[0_0_18px_-8px_rgba(251,191,36,0.35)] transition-transform hover:scale-105 ${
                    compact ? 'flex h-12 w-12 sm:h-14 sm:w-14' : 'flex h-14 w-14 sm:h-16 sm:w-16'
                }`}
                onClick={() => setShowDescription(!showDescription)}
                onMouseEnter={() => {
                    if (!mobile) setShowDescription(true);
                }}
                onMouseLeave={() => {
                    if (!mobile) setShowDescription(false);
                }}
            >
                <img
                    src={p.image}
                    alt=""
                    className={`object-contain p-0.5 ${compact ? 'max-h-10 max-w-10 sm:max-h-12 sm:max-w-12' : 'max-h-12 max-w-12 sm:max-h-14 sm:max-w-14'}`}
                    loading="lazy"
                    decoding="async"
                />
            </div>
            <h3
                className={`line-clamp-2 flex min-h-0 shrink-0 w-full flex-col justify-center px-0.5 text-center font-bold leading-snug tracking-tight text-amber-50 ${
                    compact ? 'min-h-[1.75rem] text-[9px] sm:min-h-[2rem] sm:text-[10px]' : `min-h-[2.25rem] ${mobile ? 'text-[10px]' : 'text-[11px] sm:text-xs'}`
                }`}
                title={p.label}
            >
                {p.label}
            </h3>
            {showDescription && (
                <ShopMobileImageDescriptionPortal
                    open
                    anchorRef={imageAnchorRef}
                    onRequestClose={() => setShowDescription(false)}
                    fullscreenBackdrop={mobile}
                >
                    <p className={`text-left leading-relaxed text-slate-100 ${mobile ? 'text-[11px]' : 'text-[11px] sm:text-xs'}`}>
                        {refinedDescription}
                    </p>
                </ShopMobileImageDescriptionPortal>
            )}
            <button
                type="button"
                disabled={disabled}
                onClick={() => onBuy(p.id, price)}
                title={weeklyTitle}
                className={`mt-auto box-border flex w-full shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 text-center font-semibold leading-none transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 disabled:cursor-not-allowed ${BTN_MIN_H} ${
                    disabled
                        ? 'border-zinc-600/50 bg-zinc-800/90 text-zinc-500'
                        : 'border-amber-400/50 bg-gradient-to-r from-amber-400/90 via-amber-300/90 to-amber-500/90 text-slate-900 shadow-[0_8px_22px_-12px_rgba(251,191,36,0.75)] hover:from-amber-300 hover:to-amber-500'
                }`}
            >
                {busyHere ? (
                    <>
                        <span className="text-xs">…</span>
                        {weeklyLine}
                    </>
                ) : atWeeklyCap ? (
                    <>
                        <span className="text-[11px] font-bold">한도</span>
                        {weeklyLine}
                    </>
                ) : (
                    <>
                        <span className={`inline-flex shrink-0 items-center justify-center gap-1 font-bold tabular-nums ${!canAfford ? 'opacity-45' : ''}`}>
                            <img
                                src={specialResourceIcons.champCoins}
                                alt=""
                                className="h-4 w-4 shrink-0 self-center object-contain"
                                loading="lazy"
                                decoding="async"
                            />
                            <span className={`shrink-0 self-center ${mobile ? 'text-[11px]' : 'text-xs sm:text-sm'}`}>{price.toLocaleString()}</span>
                        </span>
                        {weeklyLine}
                    </>
                )}
            </button>
        </div>
    );
};

function renderShopCard(
    p: ChampionshipShopProduct,
    ctx: {
        mobile: boolean;
        champ: number;
        purchases: UserWithStatus['championshipShopWeekPurchases'];
        now: number;
        busyId: string | null;
        onBuy: (productId: string, price: number) => void;
        compact: boolean;
    }
): React.ReactNode {
    if (p.tab === 'special') {
        return (
            <ChampionshipSpecialShopCard
                key={p.id}
                p={p}
                mobile={ctx.mobile}
                champ={ctx.champ}
                purchases={ctx.purchases}
                now={ctx.now}
                busyId={ctx.busyId}
                onBuy={ctx.onBuy}
                compact={ctx.compact}
            />
        );
    }
    return (
        <ChampionshipSimpleShopCard
            key={p.id}
            p={p as SimpleShopProduct}
            mobile={ctx.mobile}
            champ={ctx.champ}
            busyId={ctx.busyId}
            onBuy={ctx.onBuy}
            compact={ctx.compact}
        />
    );
}

const ChampionshipShopPanel: React.FC<{
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void | Promise<unknown>;
    layoutVariant?: ChampionshipShopPanelLayoutVariant;
}> = ({ currentUser, onAction, layoutVariant = 'default' }) => {
    const { isNativeMobile } = useNativeMobileShell();
    const isAsideIntrinsic = layoutVariant === 'asideIntrinsic';
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

    const cardCtx = useMemo(
        () => ({
            mobile: isNativeMobile,
            champ,
            purchases,
            now,
            busyId,
            onBuy: buy,
            compact: isAsideIntrinsic,
        }),
        [isNativeMobile, champ, purchases, now, busyId, buy, isAsideIntrinsic]
    );

    return (
        <div
            className={
                isAsideIntrinsic
                    ? 'flex w-full min-w-0 flex-none flex-col gap-1 overflow-hidden'
                    : 'flex min-h-0 flex-1 flex-col gap-2 overflow-hidden'
            }
        >
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
            <div
                className={
                    isAsideIntrinsic
                        ? `grid w-full shrink-0 grid-cols-2 grid-rows-3 grid-flow-row content-start gap-1.5 overflow-hidden sm:grid-cols-3 sm:grid-rows-2 sm:gap-2 ${ASIDE_SHOP_GRID_MIN_H}`
                        : 'grid min-h-0 flex-1 auto-rows-auto grid-cols-2 content-start gap-2 overflow-y-auto overflow-x-hidden sm:grid-cols-3 [-webkit-overflow-scrolling:touch]'
                }
            >
                {rows.map((p) => renderShopCard(p, cardCtx))}
            </div>
        </div>
    );
};

export default ChampionshipShopPanel;
