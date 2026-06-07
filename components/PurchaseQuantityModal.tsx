import React, { useState, useMemo, useEffect } from 'react';
import DraggableWindow from './DraggableWindow.js';
import { UserWithStatus, InventoryItemType, InventoryItem, ItemGrade } from '../types.js';
import { BASE_SLOTS_PER_CATEGORY } from '../constants/items.js';
import { isActionPointConsumable } from '../constants/items.js';
import { buildInventoryItemPreviewForPurchase } from '../shared/utils/bagItemDetailHelpers.js';
import {
    getBagConsumableUsageHint,
    getMaterialBagUsageLines,
    resolveBagItemDetailImagePath,
    apConsumableLightningEmojiPx,
    apConsumableLightningPlusLabelPx,
} from '../shared/utils/bagItemDetailHelpers.js';
import { resolveBagItemAcquireLines } from '../shared/utils/itemAcquireSourceLines.js';
import { equipmentDetailGradeStyles } from './EquipmentDetailPanel.js';
import { MAX_GAME_INTEGER_INPUT } from '../shared/constants/numericLimits.js';
import { clampGameInt } from '../shared/utils/gameIntegerField.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from '../shared/utils/walletAmountDisplay.js';

/** 한 화면(수량·합계·버튼 포함)에 맞추기 위한 컴팩트 히어로 슬롯 */
const HERO_SLOT_PX = 88;

interface PurchaseQuantityModalProps {
    item: {
        itemId: string;
        name: string;
        price: { gold?: number; diamonds?: number };
        limit?: number;
        type: InventoryItemType;
        prices?: number[];
        purchasesToday?: number;
        image?: string;
        badge?: string;
        description?: string;
        /** 도전의 탑 아이템 — 보유·일일 구매 한도 표시 */
        towerPurchaseLimits?: {
            maxOwned: number;
            currentOwned: number;
            dailyPurchaseLimit: number;
            todayPurchased: number;
        };
    };
    currentUser: UserWithStatus;
    onClose: () => void;
    onConfirm: (itemId: string, quantity: number) => void | Promise<void>;
    /** 도전의 탑 아이템 등 — 가방 슬롯 대신 보유·일일 한도만 적용 */
    ignoreInventorySlotLimit?: boolean;
}

function typeLabelKo(it: InventoryItem): string {
    if (it.type === 'equipment') return '장비';
    if (it.type === 'consumable') return '소모품';
    return '재료';
}

function usageBlocks(it: InventoryItem): string[] {
    if (it.type === 'material') {
        const lines = getMaterialBagUsageLines(it.name);
        return lines.length > 0 ? lines : ['이 재료는 현재 어떤 장비 강화에도 사용되지 않습니다.'];
    }
    if (it.type === 'consumable') {
        const hint = getBagConsumableUsageHint(it.name);
        return [hint ?? '가방에서 사용할 수 있습니다.'];
    }
    return ['착용·강화·제련 등 캐릭터 성장에 사용합니다.'];
}

const PurchaseModalItemShowcase: React.FC<{ preview: InventoryItem; shopBadge?: string }> = ({ preview, shopBadge }) => {
    const styles = equipmentDetailGradeStyles[preview.grade];
    const isTranscendent = preview.grade === ItemGrade.Transcendent;
    const imagePath = preview.type === 'equipment' ? preview.image : resolveBagItemDetailImagePath(preview);
    const acquireLines = resolveBagItemAcquireLines(preview);
    const usageLines = usageBlocks(preview);
    const desc = (preview.description || '').trim() || '—';

    const apMatch = isActionPointConsumable(preview.name) ? preview.name.match(/\+(\d+)/) : null;
    const apValue = apMatch?.[1];

    return (
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-[#14151f] via-[#0c0d12] to-[#08090e] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-inset ring-black/40">
            <div className={`relative p-[1px] ${styles.frame}`}>
                <div className="rounded-[13px] bg-zinc-950/92 p-2 sm:p-2.5">
                    <div className="flex flex-row items-start gap-2.5">
                        {/* Large icon */}
                        <div className="mx-0 shrink-0">
                            <div
                                className={`relative overflow-hidden rounded-xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.75)] ring-1 ring-black/50 ${
                                    isTranscendent ? 'transcendent-grade-slot' : ''
                                }`}
                                style={{ width: HERO_SLOT_PX, height: HERO_SLOT_PX, containerType: 'size' }}
                            >
                                <img src={styles.background} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                {isActionPointConsumable(preview.name) ? (
                                    <span
                                        className="absolute inset-0 z-[2] flex flex-col items-center justify-center overflow-hidden px-[min(6px,8%)] leading-none"
                                        aria-hidden
                                        style={{ fontSize: `${apConsumableLightningEmojiPx(HERO_SLOT_PX)}px` }}
                                    >
                                        <span className="leading-none drop-shadow-[0_0_12px_rgba(34,211,238,0.55)]">⚡</span>
                                        {apValue ? (
                                            <span
                                                className="mt-1 max-w-full truncate font-bold leading-none text-cyan-200 drop-shadow-[0_0_6px_rgba(34,211,238,0.75)]"
                                                style={{ fontSize: `${apConsumableLightningPlusLabelPx(HERO_SLOT_PX)}px` }}
                                            >
                                                +{apValue}
                                            </span>
                                        ) : shopBadge ? (
                                            <span
                                                className="mt-1 max-w-full truncate font-bold leading-none text-cyan-200 drop-shadow-[0_0_6px_rgba(34,211,238,0.75)]"
                                                style={{ fontSize: `${apConsumableLightningPlusLabelPx(HERO_SLOT_PX)}px` }}
                                            >
                                                {shopBadge}
                                            </span>
                                        ) : null}
                                    </span>
                                ) : imagePath ? (
                                    <img
                                        src={imagePath}
                                        alt=""
                                        className="absolute left-1/2 top-1/2 z-[2] max-h-[82%] max-w-[82%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.55)]"
                                    />
                                ) : null}
                                {preview.type === 'equipment' && (preview.stars ?? 0) > 0 ? (
                                    <div className="absolute bottom-0.5 right-0.5 z-[3] rounded bg-black/55 px-1 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-white/10">
                                        ★{preview.stars}
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* Name + meta + description */}
                        <div className="min-w-0 flex-1 text-left">
                            <div className="flex flex-wrap items-center gap-1.5">
                                <h2
                                    className={`min-w-0 max-w-full text-base font-black leading-tight tracking-tight sm:text-lg ${styles.color}`}
                                    style={{ letterSpacing: '-0.02em' }}
                                >
                                    {preview.name}
                                </h2>
                                {shopBadge && !isActionPointConsumable(preview.name) ? (
                                    <span className="shrink-0 rounded border border-cyan-400/35 bg-cyan-950/40 px-1.5 py-px text-[10px] font-bold text-cyan-100 sm:text-[11px]">
                                        {shopBadge}
                                    </span>
                                ) : null}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="rounded-full border border-white/[0.1] bg-white/[0.04] px-2 py-px text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[11px]">
                                    구분 · {typeLabelKo(preview)}
                                </span>
                                <span
                                    className={`rounded-full border px-2 py-px text-[10px] font-bold tracking-wide ring-1 ring-inset sm:text-[11px] ${
                                        isTranscendent
                                            ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-100 ring-cyan-400/15'
                                            : 'border-white/10 bg-black/30 text-slate-200 ring-white/[0.06]'
                                    }`}
                                >
                                    등급 · <span className={styles.color}>{styles.name}</span>
                                </span>
                            </div>
                            <div className="mt-1.5 rounded-lg border border-white/[0.06] bg-black/30 p-2.5 ring-1 ring-inset ring-white/[0.03]">
                                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 sm:text-[11px]">설명</p>
                                <p className="mt-1 text-xs leading-snug text-slate-200/95 sm:text-[13px] sm:leading-snug">{desc}</p>
                            </div>
                        </div>
                    </div>

                    {/* 사용처 · 획득처 — 항상 세로 스택 */}
                    <div className="mt-2 flex flex-col gap-2.5">
                        <div className="group relative overflow-hidden rounded-lg border border-sky-500/20 bg-gradient-to-b from-sky-950/35 via-[#0a1018]/90 to-[#06080c] p-2.5 shadow-[inset_0_1px_0_rgba(56,189,248,0.08)] ring-1 ring-inset ring-sky-400/10">
                            <div
                                className="pointer-events-none absolute -right-6 -top-8 h-20 w-20 rounded-full bg-sky-400/10 blur-2xl transition-opacity group-hover:opacity-90"
                                aria-hidden
                            />
                            <div className="relative flex items-center gap-2 border-b border-sky-500/15 pb-1.5">
                                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sky-500/20 text-[11px] font-black text-sky-200 ring-1 ring-sky-400/25 sm:text-xs">
                                    ◈
                                </span>
                                <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-sky-200/90 sm:text-xs">사용처</span>
                            </div>
                            <ul className="relative mt-2 space-y-1.5 pl-0.5">
                                {usageLines.map((line, i) => (
                                    <li
                                        key={i}
                                        className="border-l-2 border-sky-400/35 pl-2 text-xs leading-snug text-slate-200/95 sm:text-[13px] sm:leading-snug"
                                    >
                                        {line}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="group relative overflow-hidden rounded-lg border border-amber-500/20 bg-gradient-to-b from-amber-950/30 via-[#120e0a]/92 to-[#080604] p-2.5 shadow-[inset_0_1px_0_rgba(251,191,36,0.07)] ring-1 ring-inset ring-amber-400/10">
                            <div
                                className="pointer-events-none absolute -left-4 -top-10 h-24 w-24 rounded-full bg-amber-400/10 blur-2xl transition-opacity group-hover:opacity-90"
                                aria-hidden
                            />
                            <div className="relative flex items-center gap-2 border-b border-amber-500/15 pb-1.5">
                                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/20 text-[11px] font-black text-amber-100 ring-1 ring-amber-400/25 sm:text-xs">
                                    ✦
                                </span>
                                <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-amber-100/90 sm:text-xs">획득처</span>
                            </div>
                            <ul className="relative mt-2 space-y-1.5 pl-0.5">
                                {acquireLines.length > 0 ? (
                                    acquireLines.map((line, i) => (
                                        <li
                                            key={i}
                                            className="border-l-2 border-amber-400/35 pl-2 text-xs leading-snug text-slate-200/95 sm:text-[13px] sm:leading-snug"
                                        >
                                            {line}
                                        </li>
                                    ))
                                ) : (
                                    <li className="border-l-2 border-amber-400/20 pl-2 text-xs text-slate-500 sm:text-[13px]">안내 문구가 없습니다.</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PurchaseQuantityModal: React.FC<PurchaseQuantityModalProps> = ({
    item,
    currentUser,
    onClose,
    onConfirm,
    ignoreInventorySlotLimit = false,
}) => {
    const [quantity, setQuantity] = useState(1);
    const [isConfirming, setIsConfirming] = useState(false);
    const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

    const isTieredPriceItem = ['action_point_10', 'action_point_20', 'action_point_30'].includes(item.itemId);
    const towerLimits = item.towerPurchaseLimits;
    const towerRemainingDaily = towerLimits
        ? Math.max(0, towerLimits.dailyPurchaseLimit - towerLimits.todayPurchased)
        : 0;
    const towerRemainingOwned = towerLimits
        ? Math.max(0, towerLimits.maxOwned - towerLimits.currentOwned)
        : 0;
    const remainingDaily = towerLimits
        ? towerRemainingDaily
        : item.limit ?? (isTieredPriceItem ? 0 : Infinity);
    const prices = item.prices;
    const purchasesToday = item.purchasesToday ?? 0;

    const maxAffordByTieredPrices = useMemo(() => {
        if (!isTieredPriceItem || !prices?.length || currentUser.gold == null) return 0;
        let sum = 0;
        let count = 0;
        for (let i = 0; i < remainingDaily; i++) {
            const idx = Math.min(purchasesToday + i, prices.length - 1);
            sum += prices[idx] ?? prices[prices.length - 1];
            if (sum > currentUser.gold) break;
            count++;
        }
        return count;
    }, [isTieredPriceItem, prices, purchasesToday, remainingDaily, currentUser.gold]);

    const isGold = !!item.price.gold;
    const pricePerItem = item.price.gold || item.price.diamonds || 0;

    const maxByInventory = useMemo(() => {
        if (ignoreInventorySlotLimit) return Infinity;

        if (item.type === 'equipment') {
            const equipmentCount = currentUser.inventory.filter(invItem => invItem.type === 'equipment').length;
            const inventorySlots = currentUser.inventorySlots?.equipment || BASE_SLOTS_PER_CATEGORY;
            const availableSlots = inventorySlots - equipmentCount;
            return Math.max(0, availableSlots);
        }

        const currentItemCount = currentUser.inventory.filter(invItem => invItem.id === item.itemId).length;
        const inventorySlots = currentUser.inventorySlots?.[item.type] || BASE_SLOTS_PER_CATEGORY;
        const availableSlots = inventorySlots - currentItemCount;
        return Math.max(0, availableSlots);
    }, [ignoreInventorySlotLimit, item.itemId, item.type, currentUser.inventory, currentUser.inventorySlots]);

    const maxQuantity = useMemo(() => {
        const currency = isGold ? (currentUser.gold ?? 0) : (currentUser.diamonds ?? 0);
        const maxByCurrency = !isTieredPriceItem && pricePerItem > 0 ? Math.floor(currency / pricePerItem) : (isTieredPriceItem ? maxAffordByTieredPrices : Infinity);
        const byLimit = towerLimits
            ? Math.min(towerRemainingDaily, towerRemainingOwned)
            : isTieredPriceItem
              ? remainingDaily
              : (item.limit ?? Infinity);
        const cap = Math.min(byLimit, maxByCurrency, MAX_GAME_INTEGER_INPUT, maxByInventory);
        return Math.max(0, cap);
    }, [
        item.limit,
        towerLimits,
        towerRemainingDaily,
        towerRemainingOwned,
        currentUser.gold,
        currentUser.diamonds,
        isGold,
        pricePerItem,
        isTieredPriceItem,
        remainingDaily,
        maxAffordByTieredPrices,
        maxByInventory,
    ]);

    const totalPrice = useMemo(() => {
        const q = quantity;
        if (isTieredPriceItem && prices?.length) {
            let sum = 0;
            for (let i = 0; i < q; i++) {
                const idx = Math.min(purchasesToday + i, prices.length - 1);
                sum += prices[idx] ?? prices[prices.length - 1];
            }
            return sum;
        }
        const pricePerItem = item.price.gold || item.price.diamonds || 0;
        return pricePerItem * q;
    }, [quantity, isTieredPriceItem, prices, purchasesToday, item.price.gold, item.price.diamonds]);

    useEffect(() => {
        if (maxQuantity > 0 && quantity > maxQuantity) setQuantity(maxQuantity);
    }, [maxQuantity]);

    useEffect(() => {
        if (noticeMessage) setNoticeMessage(null);
    }, [quantity, noticeMessage]);

    const handleConfirm = async () => {
        if (!ignoreInventorySlotLimit && quantity > maxByInventory) {
            if (maxByInventory <= 0) {
                setNoticeMessage('가방 공간이 부족합니다. 가방을 정리한 뒤 다시 구매해 주세요.');
            } else {
                setNoticeMessage(`가방 공간이 부족합니다. 현재 ${maxByInventory}개까지만 구매할 수 있습니다.`);
            }
            return;
        }
        if (quantity > 0 && quantity <= maxQuantity) {
            setIsConfirming(true);
            try {
                await onConfirm(item.itemId, quantity);
                onClose();
            } finally {
                setIsConfirming(false);
            }
        }
    };

    const previewItem = useMemo(
        () =>
            buildInventoryItemPreviewForPurchase({
                itemId: item.itemId,
                name: item.name,
                type: item.type,
                image: item.image,
                description: item.description,
            }),
        [item.itemId, item.name, item.type, item.image, item.description]
    );

    return (
        <DraggableWindow
            title="수량 선택"
            onClose={onClose}
            windowId="purchase-quantity"
            initialWidth={580}
            hideFooter
            shrinkHeightToContent
            bodyScrollable={false}
        >
            <div className="flex min-h-0 flex-col items-stretch px-1 pb-0.5 pt-0">
                <div className="mb-2 min-h-0 shrink-0">
                    <div className="overflow-visible" role="region" aria-label="구매 상품 상세">
                        <PurchaseModalItemShowcase preview={previewItem} shopBadge={item.badge} />
                    </div>
                </div>

                <div className="mb-2 flex min-h-[7.5rem] flex-row items-stretch gap-2">
                    <div className="min-w-0 flex-1 rounded-lg border border-white/[0.07] bg-gradient-to-b from-slate-800/85 to-slate-950/90 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/25">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-slate-500 sm:text-xs">
                                구매 수량
                            </span>
                            <span className="font-mono text-[11px] tabular-nums text-slate-500 sm:text-xs">
                                {maxQuantity <= 0 ? '0' : `1–${maxQuantity.toLocaleString()}`}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                                disabled={quantity <= 1}
                                aria-label="한 개 줄이기"
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-500/35 bg-slate-700/80 text-sm font-semibold text-slate-200 shadow-sm transition-colors hover:border-slate-400/45 hover:bg-slate-600/90 disabled:cursor-not-allowed disabled:opacity-35 active:scale-[0.97]"
                            >
                                −
                            </button>
                            <input
                                type="number"
                                min={1}
                                max={Math.max(1, maxQuantity)}
                                value={quantity}
                                onChange={(e) =>
                                    setQuantity(clampGameInt(Number(e.target.value) || 1, { min: 1, max: Math.max(1, maxQuantity) }))
                                }
                                className="h-7 min-w-[3.75rem] max-w-[6rem] rounded-md border border-slate-500/40 bg-slate-900/70 px-1 text-center text-sm font-semibold tabular-nums text-slate-100 shadow-inner outline-none ring-amber-500/0 transition-[box-shadow,border-color] focus:border-amber-400/40 focus:ring-2 focus:ring-amber-400/20"
                            />
                            <button
                                type="button"
                                onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}
                                disabled={quantity >= maxQuantity}
                                aria-label="한 개 늘리기"
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-500/35 bg-slate-700/80 text-sm font-semibold text-slate-200 shadow-sm transition-colors hover:border-slate-400/45 hover:bg-slate-600/90 disabled:cursor-not-allowed disabled:opacity-35 active:scale-[0.97]"
                            >
                                +
                            </button>
                            <button
                                type="button"
                                onClick={() => setQuantity(maxQuantity)}
                                disabled={maxQuantity <= 0}
                                className="ml-0.5 h-7 shrink-0 rounded-md border border-amber-500/35 bg-gradient-to-b from-amber-500/25 to-amber-950/40 px-2 text-[11px] font-bold tracking-tight text-amber-100/95 shadow-sm transition-colors hover:border-amber-400/50 hover:from-amber-400/35 disabled:cursor-not-allowed disabled:opacity-35 active:scale-[0.97] sm:text-xs"
                            >
                                Max
                            </button>
                        </div>
                        <div className="mt-1.5 px-0.5">
                            <input
                                type="range"
                                min="1"
                                max={Math.max(1, maxQuantity)}
                                value={quantity}
                                onChange={e => setQuantity(Number(e.target.value))}
                                className="h-1 w-full cursor-pointer rounded-full accent-amber-500"
                            />
                        </div>
                        <div
                            className="mt-1.5 flex min-h-[2.25rem] flex-col items-center justify-center gap-0.5 text-center text-xs leading-snug text-slate-500 sm:min-h-[2.5rem] sm:text-[13px] sm:leading-snug"
                            aria-live="polite"
                        >
                            {towerLimits ? (
                                <>
                                    <p className="leading-snug text-amber-200/85">
                                        보유 제한: 최대 {towerLimits.maxOwned}개 보유 가능
                                        <span className="text-amber-100/70">
                                            {' '}
                                            (현재 {towerLimits.currentOwned}/{towerLimits.maxOwned})
                                        </span>
                                    </p>
                                    <p className="leading-snug text-amber-200/85">
                                        구매 제한: 하루 최대 {towerLimits.dailyPurchaseLimit}개 구매 가능
                                        <span className="text-amber-100/70">
                                            {' '}
                                            (오늘 {towerLimits.todayPurchased}/{towerLimits.dailyPurchaseLimit})
                                        </span>
                                    </p>
                                    {towerRemainingOwned <= 0 ? (
                                        <p className="leading-snug text-rose-300/95">보유 개수가 최대치여서 구매할 수 없습니다.</p>
                                    ) : towerRemainingDaily <= 0 ? (
                                        <p className="leading-snug text-rose-300/95">오늘 구매 한도에 도달했습니다.</p>
                                    ) : (
                                        <p className="leading-snug text-slate-400">최대 구매 가능: {maxQuantity}개</p>
                                    )}
                                </>
                            ) : remainingDaily !== Infinity && remainingDaily > 0 ? (
                                <p className="leading-snug">일일 남은 구매 가능: {remainingDaily}개</p>
                            ) : (
                                <span className="invisible select-none leading-snug" aria-hidden>
                                    일일 남은 구매 가능: 0개
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex min-w-0 w-[11.5rem] shrink-0 flex-col justify-center overflow-hidden rounded-lg border border-amber-500/15 bg-gradient-to-r from-amber-950/25 via-slate-900/80 to-slate-950/90 p-2 ring-1 ring-inset ring-white/[0.04] sm:w-[13rem]">
                        <div className="flex flex-col gap-1.5">
                            <div className="min-w-0">
                                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-amber-200/55 sm:text-xs">합계</p>
                                <p className="mt-0.5 truncate text-xs leading-snug text-slate-500 sm:text-[13px] sm:leading-snug">
                                    결제 예정 금액
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 rounded border border-white/[0.06] bg-black/25 px-1.5 py-1">
                                <img
                                    src={isGold ? '/images/icon/Gold.webp' : '/images/icon/Zem.webp'}
                                    alt=""
                                    className="h-4 w-4 shrink-0 object-contain opacity-95"
                                    aria-hidden
                                />
                                <span className="min-w-0 flex-1 truncate text-right text-sm font-bold tabular-nums leading-snug text-amber-100/95 sm:text-base sm:leading-snug">
                                    {isGold ? formatGoldAmountKoG(totalPrice) : formatWalletDiamonds(totalPrice)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-1.5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-md border border-slate-500/40 bg-slate-700/50 py-1.5 text-[11px] font-semibold text-slate-200 shadow-sm transition-colors hover:border-slate-400/45 hover:bg-slate-600/55 active:scale-[0.99]"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={quantity === 0 || quantity > maxQuantity || isConfirming}
                        className="flex-1 rounded-md border border-emerald-500/35 bg-gradient-to-b from-emerald-600/85 to-emerald-950/50 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:border-emerald-400/45 hover:from-emerald-500/90 disabled:cursor-not-allowed disabled:opacity-45 active:scale-[0.99]"
                    >
                        {isConfirming ? '구매 중...' : '구매'}
                    </button>
                </div>
                {noticeMessage && (
                    <p className="mt-1.5 text-center text-xs font-medium leading-snug text-rose-300/95 sm:text-[13px] sm:leading-snug">
                        {noticeMessage}
                    </p>
                )}
            </div>
        </DraggableWindow>
    );
};

export default PurchaseQuantityModal;
