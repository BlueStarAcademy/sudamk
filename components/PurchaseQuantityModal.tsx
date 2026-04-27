import React, { useState, useMemo, useEffect } from 'react';
import DraggableWindow from './DraggableWindow.js';
import { UserWithStatus, InventoryItemType } from '../types.js';
import { BASE_SLOTS_PER_CATEGORY } from '../constants/items.js';
import { isActionPointConsumable } from '../constants/items.js';

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
    };
    currentUser: UserWithStatus;
    onClose: () => void;
    onConfirm: (itemId: string, quantity: number) => void;
}

const PurchaseQuantityModal: React.FC<PurchaseQuantityModalProps> = ({ item, currentUser, onClose, onConfirm }) => {
    const [quantity, setQuantity] = useState(1);
    const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

    const isTieredPriceItem = ['action_point_10', 'action_point_20', 'action_point_30'].includes(item.itemId);
    const remainingDaily = item.limit ?? (isTieredPriceItem ? 0 : Infinity);
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
    }, [item.itemId, item.type, currentUser.inventory, currentUser.inventorySlots]);

    const maxQuantity = useMemo(() => {
        const currency = isGold ? (currentUser.gold ?? 0) : (currentUser.diamonds ?? 0);
        const maxByCurrency = !isTieredPriceItem && pricePerItem > 0 ? Math.floor(currency / pricePerItem) : (isTieredPriceItem ? maxAffordByTieredPrices : Infinity);
        const byLimit = isTieredPriceItem ? remainingDaily : (item.limit ?? Infinity);
        const cap = Math.min(byLimit, maxByCurrency, 999);
        return Math.max(0, cap);
    }, [item.limit, currentUser.gold, currentUser.diamonds, isGold, pricePerItem, isTieredPriceItem, remainingDaily, maxAffordByTieredPrices]);

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

    const handleConfirm = () => {
        if (quantity > maxByInventory) {
            if (maxByInventory <= 0) {
                setNoticeMessage('가방 공간이 부족합니다. 가방을 정리한 뒤 다시 구매해 주세요.');
            } else {
                setNoticeMessage(`가방 공간이 부족합니다. 현재 ${maxByInventory}개까지만 구매할 수 있습니다.`);
            }
            return;
        }
        if (quantity > 0 && quantity <= maxQuantity) {
            onConfirm(item.itemId, quantity);
        }
        onClose();
    };

    const showImage = item.image || isTieredPriceItem;
    const isActionPoint = isTieredPriceItem || (item.name && isActionPointConsumable(item.name));

    return (
        <DraggableWindow title="수량 선택" onClose={onClose} windowId="purchase-quantity" initialWidth={420}>
            <div className="flex flex-col items-stretch p-1">
                {/* 상단: 아이템 이미지 + 이름 */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-slate-800/90 via-slate-900/95 to-slate-800/90 border border-slate-600/50 shadow-inner mb-4">
                    <div className="relative w-20 h-20 flex-shrink-0 rounded-xl bg-slate-700/60 border border-slate-500/40 flex items-center justify-center overflow-hidden">
                        {showImage && (
                            isActionPoint ? (
                                <div className="flex flex-col items-center justify-center text-amber-300">
                                    <span className="text-3xl leading-none" aria-hidden>⚡</span>
                                    {item.badge && <span className="text-sm font-bold text-amber-200 mt-0.5">{item.badge}</span>}
                                </div>
                            ) : (
                                <img src={item.image!} alt={item.name} className="w-full h-full object-contain p-1.5" />
                            )
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white truncate">{item.name}</h3>
                        {remainingDaily !== Infinity && remainingDaily > 0 && (
                            <p className="text-xs text-slate-400 mt-1">일일 남은 구매 가능: {remainingDaily}개</p>
                        )}
                    </div>
                </div>

                {/* 수량 조절: 고급 스타일 */}
                <div className="rounded-xl bg-slate-800/50 border border-slate-600/40 p-4 mb-4">
                    <p className="text-sm font-medium text-slate-300 mb-3">구매 수량</p>
                    <div className="flex items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                            disabled={quantity <= 1}
                            className="w-11 h-11 rounded-xl bg-slate-600 hover:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-500/50 text-white font-bold text-xl flex items-center justify-center shadow-md transition-all active:scale-95"
                        >
                            −
                        </button>
                        <input
                            type="number"
                            value={quantity}
                            onChange={e => setQuantity(Math.max(1, Math.min(maxQuantity, Number(e.target.value) || 1)))}
                            className="w-24 h-12 text-center text-2xl font-bold bg-slate-700/80 border border-slate-500/50 rounded-xl text-white focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400/50 outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}
                            disabled={quantity >= maxQuantity}
                            className="w-11 h-11 rounded-xl bg-slate-600 hover:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-500/50 text-white font-bold text-xl flex items-center justify-center shadow-md transition-all active:scale-95"
                        >
                            +
                        </button>
                        <button
                            type="button"
                            onClick={() => setQuantity(maxQuantity)}
                            disabled={maxQuantity <= 0}
                            className="h-11 px-4 rounded-xl bg-gradient-to-r from-amber-500/90 to-amber-600/90 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-400/50 text-slate-900 font-bold text-sm shadow-md transition-all active:scale-95"
                        >
                            Max
                        </button>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max={Math.max(1, maxQuantity)}
                        value={quantity}
                        onChange={e => setQuantity(Number(e.target.value))}
                        className="w-full h-2 mt-3 rounded-full appearance-none bg-slate-600 accent-amber-500 cursor-pointer"
                    />
                </div>

                {/* 총 가격 */}
                <div className="rounded-xl bg-slate-800/50 border border-slate-600/40 p-4 mb-4 flex items-center justify-between">
                    <span className="text-slate-300 font-medium">총 가격</span>
                    <div className="flex items-center gap-2 font-bold text-xl text-amber-300">
                        <img src={isGold ? '/images/icon/Gold.png' : '/images/icon/Zem.png'} alt={isGold ? '골드' : '다이아'} className="w-7 h-7 object-contain" />
                        <span>{totalPrice.toLocaleString()}</span>
                    </div>
                </div>

                {/* 버튼 */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-slate-600 hover:bg-slate-500 border border-slate-500/50 text-white font-semibold shadow-md transition-all active:scale-[0.98]"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={quantity === 0 || quantity > maxQuantity}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500/90 to-emerald-600/90 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed border border-emerald-400/50 text-white font-semibold shadow-md transition-all active:scale-[0.98]"
                    >
                        구매
                    </button>
                </div>
                {noticeMessage && (
                    <p className="mt-2 text-center text-sm font-medium text-rose-300">
                        {noticeMessage}
                    </p>
                )}
            </div>
        </DraggableWindow>
    );
};

export default PurchaseQuantityModal;
