import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserWithStatus } from '../types.js';
import Button from './Button.js';
import { SUDAMR_MODAL_CLOSE_BUTTON_CLASS } from './DraggableWindow.js';
import { countTowerLobbyInventoryQty, towerShopInventoryNameOrIdsForItem } from '../utils/towerLobbyInventory.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { MAX_GAME_INTEGER_INPUT } from '../shared/constants/numericLimits.js';
import { clampGameInt } from '../shared/utils/gameIntegerField.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from '../shared/utils/walletAmountDisplay.js';
import { buildInventoryItemPreviewForPurchase } from '../shared/utils/bagItemDetailHelpers.js';
import {
    getTowerItemPurchaseLimit,
    getTowerItemTodayPurchased,
    resolveTowerShopItem,
    TOWER_SHOP_ITEMS,
    towerShopItemIdFromSlotKey,
    type TowerShopItemDef,
} from '../shared/constants/towerShopItems.js';
import { EquipmentDetailPanel } from './EquipmentDetailPanel.js';

export { towerShopItemIdFromSlotKey };

interface CartItem {
    itemId: string;
    quantity: number;
}

interface TowerItemShopModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onBuy: (itemId: string, quantity: number) => Promise<void>;
    /** 0개 탭으로 연 상점일 때 미리 선택할 아이템 (서버 itemId: 턴 추가, 미사일, …) */
    initialSelectedItemId?: string | null;
}

const TOWER_ITEMS = TOWER_SHOP_ITEMS;
type TowerItem = TowerShopItemDef;

const TowerItemShopModal: React.FC<TowerItemShopModalProps> = ({ currentUser, onClose, onBuy, initialSelectedItemId }) => {
    const { t } = useTranslation('game');
    const { t: tCommon } = useTranslation('common');
    const { isNativeMobile } = useNativeMobileShell();
    const { updateTrigger } = useAppContext();
    const [selectedItem, setSelectedItem] = useState<TowerShopItemDef | null>(() => resolveTowerShopItem(initialSelectedItemId));
    const [cart, setCart] = useState<Record<string, number>>({});

    useEffect(() => {
        setSelectedItem(resolveTowerShopItem(initialSelectedItemId));
    }, [initialSelectedItemId]);

    const ownedQtyByItemId = useMemo(() => {
        const inv = currentUser.inventory;
        const map: Record<string, number> = {};
        for (const it of TOWER_ITEMS) {
            map[it.itemId] = countTowerLobbyInventoryQty(inv, towerShopInventoryNameOrIdsForItem(it.itemId));
        }
        return map;
    }, [currentUser.inventory, currentUser.id, updateTrigger]);

    const getCurrentOwned = (itemId: string): number => ownedQtyByItemId[itemId] ?? 0;

    const towerPreviewInventoryItem = useMemo(() => {
        if (!selectedItem) return null;
        return buildInventoryItemPreviewForPurchase({
            itemId: selectedItem.itemId,
            name: selectedItem.name,
            type: 'consumable',
            image: selectedItem.icon,
            description: selectedItem.description,
        });
    }, [selectedItem]);

    const getItemPurchaseInfo = (item: TowerItem) => {
        const currentOwned = getCurrentOwned(item.itemId);
        const todayPurchased = getTowerItemTodayPurchased(currentUser, item.itemId);
        const cartQuantity = cart[item.itemId] || 0;
        const { maxCanBuy } = getTowerItemPurchaseLimit(currentUser, item);
        const atMaxOwned = currentOwned >= item.maxOwned;
        const atDailyLimit = todayPurchased >= item.dailyPurchaseLimit;
        const canBuyMore = maxCanBuy > 0;
        return { canBuyMore, maxCanBuy, currentOwned, todayPurchased, cartQuantity, atMaxOwned, atDailyLimit };
    };

    const handleQuantityChange = (itemId: string, delta: number) => {
        const item = TOWER_ITEMS.find(i => i.itemId === itemId);
        if (!item) return;

        const { maxCanBuy, currentOwned, todayPurchased } = getItemPurchaseInfo(item);
        const currentCartQuantity = cart[itemId] || 0;
        const newQuantity = Math.max(0, Math.min(maxCanBuy, clampGameInt(currentCartQuantity + delta)));
        
        if (newQuantity === 0) {
            const newCart = { ...cart };
            delete newCart[itemId];
            setCart(newCart);
        } else {
            setCart({ ...cart, [itemId]: newQuantity });
        }
    };

    const handleSetQuantity = (itemId: string, quantity: number) => {
        const item = TOWER_ITEMS.find(i => i.itemId === itemId);
        if (!item) return;

        const { maxCanBuy } = getItemPurchaseInfo(item);
        const newQuantity = Math.max(0, Math.min(maxCanBuy, clampGameInt(quantity)));
        
        if (newQuantity === 0) {
            const newCart = { ...cart };
            delete newCart[itemId];
            setCart(newCart);
        } else {
            setCart({ ...cart, [itemId]: newQuantity });
        }
    };

    const handlePurchase = async () => {
        const itemsToBuy = Object.entries(cart).filter(([_, quantity]) => quantity > 0);
        if (itemsToBuy.length === 0) return;

        // 각 아이템을 순차적으로 구매 (서버에서 한 번에 여러 아이템 구매를 지원하지 않으므로)
        // for...of 루프를 사용하여 각 구매가 완료될 때까지 기다림
        for (const [itemId, quantity] of itemsToBuy) {
            try {
                await onBuy(itemId, quantity);
            } catch (error) {
                console.error(`[TowerItemShopModal] Failed to purchase ${itemId}:`, error);
            }
        }
        
        setCart({});
    };

    const totalPrice = useMemo(() => {
        return Object.entries(cart).reduce((total, [itemId, quantity]) => {
            const item = TOWER_ITEMS.find(i => i.itemId === itemId);
            if (!item || quantity <= 0) return total;
            return total + (item.price.gold || 0) * quantity + (item.price.diamonds || 0) * quantity;
        }, 0);
    }, [cart]);

    const totalGold = useMemo(() => {
        return Object.entries(cart).reduce((total, [itemId, quantity]) => {
            const item = TOWER_ITEMS.find(i => i.itemId === itemId);
            if (!item || quantity <= 0) return total;
            return total + (item.price.gold || 0) * quantity;
        }, 0);
    }, [cart]);

    const totalDiamonds = useMemo(() => {
        return Object.entries(cart).reduce((total, [itemId, quantity]) => {
            const item = TOWER_ITEMS.find(i => i.itemId === itemId);
            if (!item || quantity <= 0) return total;
            return total + (item.price.diamonds || 0) * quantity;
        }, 0);
    }, [cart]);

    const canAfford = (currentUser.gold || 0) >= totalGold && (currentUser.diamonds || 0) >= totalDiamonds;
    const hasItemsInCart = Object.values(cart).some(qty => qty > 0);
    const selectedInfo = selectedItem ? getItemPurchaseInfo(selectedItem) : null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className={`sudamr-panel-edge-host flex max-h-full w-full flex-col overflow-hidden rounded-xl border-2 border-amber-600/50 bg-gradient-to-br from-gray-900/95 via-amber-950/90 to-gray-800/95 shadow-2xl shadow-amber-900/50 backdrop-blur-md ${isNativeMobile ? 'max-w-[96vw] p-3' : 'max-w-5xl p-4 sm:p-6'}`}>
                <div className={`flex justify-between items-center flex-shrink-0 ${isNativeMobile ? 'mb-2' : 'mb-4'}`}>
                    <h2 className={`${isNativeMobile ? 'text-base' : 'text-xl sm:text-2xl'} font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-300`}>
                        도전의 탑 아이템 구매
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className={SUDAMR_MODAL_CLOSE_BUTTON_CLASS}
                        aria-label={t('towerShop.closeAria')}
                    >
                        닫기
                    </button>
                </div>

                <div className={`flex-1 min-h-0 overflow-hidden ${isNativeMobile ? 'mb-2 overflow-y-auto pr-0.5' : 'mb-4'}`}>
                    {selectedItem && selectedInfo && isNativeMobile && towerPreviewInventoryItem && (
                        <div className="mb-2 min-h-0 overflow-x-hidden rounded-lg border border-amber-700/35 bg-gray-800/40 p-2">
                            <EquipmentDetailPanel
                                item={towerPreviewInventoryItem}
                                optionsScrollable={false}
                                comfortableTypography={false}
                                showAcquireSources
                                hideOwnedQuantity
                                iconSlotPx={56}
                            />
                            <div className="mt-2 border-t border-amber-700/30 pt-2 text-[11px] text-amber-300/90">
                                <p>보유제한 {selectedItem.maxOwned}개</p>
                                <p>구매제한 일일 {selectedItem.dailyPurchaseLimit}개</p>
                            </div>
                        </div>
                    )}

                    {isNativeMobile ? (
                        <div className="space-y-2">
                            <div className="grid grid-cols-3 gap-1.5">
                                {TOWER_ITEMS.map((item) => {
                                    const { canBuyMore, currentOwned, cartQuantity } = getItemPurchaseInfo(item);
                                    const isSelected = selectedItem?.itemId === item.itemId;
                                    return (
                                        <button
                                            key={item.itemId}
                                            onClick={() => setSelectedItem(item)}
                                            className={`rounded-lg border p-1.5 transition-all ${
                                                isSelected
                                                    ? 'border-amber-500 bg-amber-900/35'
                                                    : canBuyMore
                                                    ? 'border-amber-700/35 bg-gray-800/45'
                                                    : 'border-gray-700/40 bg-gray-900/45 opacity-70'
                                            }`}
                                        >
                                            <div className="relative mx-auto h-10 w-10">
                                                <img src={item.icon} alt={item.name} className="h-full w-full object-contain" />
                                                {cartQuantity > 0 && (
                                                    <span className="absolute -top-1 -right-1 rounded-full border border-amber-900 bg-emerald-400 px-1 text-[9px] font-bold leading-none text-gray-900">
                                                        x{cartQuantity}
                                                    </span>
                                                )}
                                                <span className={`absolute -bottom-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full border border-amber-900 px-1 text-[9px] font-bold leading-none ${currentOwned > 0 ? 'bg-yellow-400 text-gray-900' : 'bg-gray-600 text-gray-300'}`}>
                                                    {currentOwned}
                                                </span>
                                            </div>
                                            <div className="mt-0.5 flex items-center justify-center gap-1">
                                                {item.price.gold && <img src="/images/icon/Gold.webp" alt={tCommon('gold')} className="h-3 w-3" />}
                                                {item.price.diamonds && <img src="/images/icon/Zem.webp" alt={tCommon('diamonds')} className="h-3 w-3" />}
                                                <span className="text-[10px] font-semibold text-amber-100">
                                                    {item.price.gold
                                                        ? formatGoldAmountKoG(item.price.gold)
                                                        : formatWalletDiamonds(item.price.diamonds ?? 0)}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {(() => {
                                if (!selectedItem || !selectedInfo) return null;
                                const { canBuyMore, maxCanBuy, cartQuantity, atMaxOwned, atDailyLimit } = selectedInfo;
                                return (
                                    <div className="rounded-lg border border-amber-700/35 bg-black/25 p-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-amber-200">{t('towerShop.selectQty')}</label>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => handleQuantityChange(selectedItem.itemId, -1)}
                                                    disabled={!canBuyMore || (cartQuantity || 0) <= 0}
                                                    className="h-7 w-7 rounded border border-amber-700/35 bg-amber-900/40 text-amber-100 disabled:opacity-40"
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={Math.min(maxCanBuy, MAX_GAME_INTEGER_INPUT)}
                                                    value={cartQuantity || 0}
                                                    onChange={(e) => handleSetQuantity(selectedItem.itemId, parseInt(e.target.value, 10) || 0)}
                                                    className="w-14 rounded border border-amber-700/35 bg-gray-800/50 text-center text-xs text-amber-100"
                                                />
                                                <button
                                                    onClick={() => handleQuantityChange(selectedItem.itemId, 1)}
                                                    disabled={!canBuyMore || (cartQuantity || 0) >= maxCanBuy}
                                                    className="h-7 w-7 rounded border border-amber-700/35 bg-amber-900/40 text-amber-100 disabled:opacity-40"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                        {(atMaxOwned || atDailyLimit) && (
                                            <p className="mt-1 text-center text-[10px] text-red-400">
                                                {atMaxOwned ? t('towerShop.ownedLimit') : t('towerShop.dailyLimit')}
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="flex h-full gap-4 min-h-0 overflow-hidden">
                            <div className="w-1/3 flex flex-col gap-2 overflow-y-auto pr-2 flex-shrink-0">
                                {TOWER_ITEMS.map((item) => {
                                    const { canBuyMore, cartQuantity } = getItemPurchaseInfo(item);
                                    const isSelected = selectedItem?.itemId === item.itemId;
                                    return (
                                        <button
                                            key={item.itemId}
                                            onClick={() => setSelectedItem(item)}
                                            className={`p-3 rounded-lg border-2 transition-all text-left ${
                                                isSelected
                                                    ? 'border-amber-500 bg-amber-900/40 shadow-lg shadow-amber-600/50'
                                                    : canBuyMore
                                                    ? 'border-amber-700/40 bg-gray-800/40 hover:border-amber-600/60 hover:bg-gray-700/50'
                                                    : 'border-gray-700/40 bg-gray-900/40 opacity-60 hover:opacity-80'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-12 h-12 flex-shrink-0">
                                                    <img src={item.icon} alt={item.name} className="w-full h-full object-contain" />
                                                    {cartQuantity > 0 && (
                                                        <div className="absolute -top-1 -right-1 bg-yellow-400 text-gray-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-amber-900">
                                                            {cartQuantity}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-amber-100 truncate">{item.name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {item.price.gold && (
                                                            <div className="flex items-center gap-1">
                                                                <img src="/images/icon/Gold.webp" alt={tCommon('gold')} className="w-3 h-3" />
                                                                <span className="text-xs text-yellow-300 font-semibold">{item.price.gold}</span>
                                                            </div>
                                                        )}
                                                        {item.price.diamonds && (
                                                            <div className="flex items-center gap-1">
                                                                <img src="/images/icon/Zem.webp" alt={tCommon('diamonds')} className="w-3 h-3" />
                                                                <span className="text-xs text-blue-300 font-semibold">{item.price.diamonds}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            {selectedItem && towerPreviewInventoryItem && (
                                <div className="flex flex-1 min-h-0 flex-col rounded-lg border border-amber-700/30 bg-gray-800/40 p-3">
                                    <div className="mb-2 min-h-0 flex-1 overflow-x-hidden pr-0.5">
                                        <EquipmentDetailPanel
                                            item={towerPreviewInventoryItem}
                                            optionsScrollable={false}
                                            comfortableTypography={false}
                                            showAcquireSources
                                            hideOwnedQuantity
                                            iconSlotPx={60}
                                        />
                                    </div>
                                    <div className="mb-3 space-y-2 text-xs text-amber-300/85">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{t('towerShop.ownedCap')}</span>
                                            <span>최대 {selectedItem.maxOwned}개 보유 가능</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold">{t('towerShop.purchaseCap')}</span>
                                            <span>하루 최대 {selectedItem.dailyPurchaseLimit}개 구매 가능</span>
                                        </div>
                                    </div>
                                    <div className="border-t border-amber-700/40 pt-4">
                                        {(() => {
                                            const { canBuyMore, maxCanBuy, currentOwned, todayPurchased, cartQuantity, atMaxOwned, atDailyLimit } = getItemPurchaseInfo(selectedItem);
                                            return (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-sm text-amber-200 font-semibold">{t('towerShop.selectQty')}:</label>
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => handleQuantityChange(selectedItem.itemId, -1)} disabled={!canBuyMore || (cartQuantity || 0) <= 0} className="w-8 h-8 rounded bg-amber-900/40 border border-amber-700/30 hover:bg-amber-800/60 text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed">-</button>
                                                            <input type="number" min={0} max={Math.min(maxCanBuy, MAX_GAME_INTEGER_INPUT)} value={cartQuantity || 0} onChange={(e) => handleSetQuantity(selectedItem.itemId, parseInt(e.target.value, 10) || 0)} className="w-16 text-center bg-gray-800/40 border border-amber-700/30 rounded text-amber-200" />
                                                            <button onClick={() => handleQuantityChange(selectedItem.itemId, 1)} disabled={!canBuyMore || (cartQuantity || 0) >= maxCanBuy} className="w-8 h-8 rounded bg-amber-900/40 border border-amber-700/30 hover:bg-amber-800/60 text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed">+</button>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-amber-300/80 space-y-1">
                                                        <p>현재 보유: {currentOwned}/{selectedItem.maxOwned}개</p>
                                                        <p>오늘 구매: {atMaxOwned ? selectedItem.dailyPurchaseLimit : todayPurchased}/{selectedItem.dailyPurchaseLimit}개</p>
                                                        <p>최대 구매 가능: {maxCanBuy}개</p>
                                                    </div>
                                                    {atMaxOwned && <p className="text-xs text-red-400 text-center">{t('towerShop.maxOwnedBuy')}</p>}
                                                    {!atMaxOwned && atDailyLimit && <p className="text-xs text-red-400 text-center">{t('towerShop.dailyLimitReached')}</p>}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 하단: 장바구니 및 구매 버튼 */}
                <div className={`border-t border-amber-700/40 flex-shrink-0 ${isNativeMobile ? 'pt-2' : 'pt-4'}`}>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0" />
                        
                        {/* 총 가격 */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className={`${isNativeMobile ? 'text-sm' : 'text-xs'} font-bold text-amber-200`}>{t('towerShop.totalPrice')}</span>
                            <div className="flex items-center gap-2">
                                {totalGold > 0 ? (
                                    <div className="flex items-center gap-1">
                                        <img src="/images/icon/Gold.webp" alt={tCommon('gold')} className={`${isNativeMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
                                        <span className={`${isNativeMobile ? 'text-sm' : 'text-xs'} font-bold ${canAfford ? 'text-yellow-300' : 'text-red-400'}`}>
                                            {totalGold.toLocaleString()}
                                        </span>
                                    </div>
                                ) : totalDiamonds > 0 ? (
                                    <div className="flex items-center gap-1">
                                        <img src="/images/icon/Zem.webp" alt={tCommon('diamonds')} className={`${isNativeMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
                                        <span className={`${isNativeMobile ? 'text-sm' : 'text-xs'} font-bold ${canAfford ? 'text-blue-300' : 'text-red-400'}`}>
                                            {totalDiamonds.toLocaleString()}
                                        </span>
                                    </div>
                                ) : (
                                    <span className={`${isNativeMobile ? 'text-sm' : 'text-xs'} text-amber-300/60`}>0</span>
                                )}
                            </div>
                        </div>
                        
                        {/* 구매하기 버튼 */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <Button
                                onClick={handlePurchase}
                                disabled={!hasItemsInCart || !canAfford}
                                colorScheme="accent"
                                className={`!min-w-0 ${isNativeMobile ? '!py-2 !px-4 !text-sm' : '!py-1.5 !px-4 !text-xs'}`}
                            >
                                구매하기
                            </Button>
                            {hasItemsInCart && !canAfford && (
                                <p className={`${isNativeMobile ? 'text-xs' : 'text-[10px]'} text-red-400 text-right`}>
                                    재화 부족
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TowerItemShopModal;
