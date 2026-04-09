import React, { useState, useMemo } from 'react';
import { UserWithStatus } from '../types.js';
import Button from './Button.js';
import { SUDAMR_MODAL_CLOSE_BUTTON_CLASS } from './DraggableWindow.js';
import { isSameDayKST } from '../utils/timeUtils.js';
import { countTowerLobbyInventoryQty } from '../utils/towerLobbyInventory.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

interface TowerItem {
    itemId: string;
    name: string;
    icon: string;
    price: { gold?: number; diamonds?: number };
    maxOwned: number; // 최대 보유 개수
    dailyPurchaseLimit: number; // 하루 구매 제한
    description: string;
}

interface CartItem {
    itemId: string;
    quantity: number;
}

interface TowerItemShopModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onBuy: (itemId: string, quantity: number) => Promise<void>;
}

const TOWER_ITEMS: TowerItem[] = [
    {
        itemId: '턴 추가',
        name: '턴 추가',
        icon: '/images/button/addturn.png',
        price: { gold: 300 },
        maxOwned: 3,
        dailyPurchaseLimit: 3,
        description: '도전의 탑 1~20층에서 사용 가능한 아이템입니다. 흑의 턴이 부족할 때 사용하면 턴수 제한이 3턴 증가합니다.'
    },
    {
        itemId: '미사일',
        name: '미사일',
        icon: '/images/button/missile.png',
        price: { gold: 300 },
        maxOwned: 2,
        dailyPurchaseLimit: 2,
        description: '도전의 탑 21~100층에서 사용 가능한 아이템입니다. 이미 놓여진 내 돌을 발사하여 이동시킬 수 있습니다.'
    },
    {
        itemId: '히든',
        name: '히든',
        icon: '/images/button/hidden.png',
        price: { gold: 500 },
        maxOwned: 2,
        dailyPurchaseLimit: 2,
        description: '도전의 탑 21~100층에서 사용 가능한 히든 아이템입니다. 상대에게 보이지 않는 돌을 배치할 수 있습니다.'
    },
    {
        itemId: '스캔',
        name: '스캔',
        icon: '/images/button/scan.png',
        price: { gold: 400 },
        maxOwned: 2,
        dailyPurchaseLimit: 2,
        description: '도전의 탑 21~100층에서 사용 가능한 스캔 아이템입니다. 상대방의 히든 돌을 찾아낼 수 있습니다.'
    },
    {
        itemId: '배치변경',
        name: '배치변경',
        icon: '/images/button/reflesh.png',
        price: { gold: 100 },
        maxOwned: 5,
        dailyPurchaseLimit: 5,
        description: '도전의 탑 모든 층에서 사용 가능한 배치변경 아이템입니다. 초기 돌 배치를 다시 랜덤하게 변경할 수 있습니다.'
    }
];

const TowerItemShopModal: React.FC<TowerItemShopModalProps> = ({ currentUser, onClose, onBuy }) => {
    const { isNativeMobile } = useNativeMobileShell();
    const [selectedItem, setSelectedItem] = useState<TowerItem | null>(TOWER_ITEMS[0]);
    const [cart, setCart] = useState<Record<string, number>>({});

    const getCurrentOwned = (itemId: string): number =>
        countTowerLobbyInventoryQty(currentUser.inventory, [itemId]);

    // 오늘(KST) 구매한 개수 계산 — 서버와 동일 키(itemId)·날짜 기준
    const getTodayPurchased = (itemId: string): number => {
        const dailyPurchases = currentUser.dailyShopPurchases ?? {};
        const purchaseRecord = dailyPurchases[itemId];
        if (!purchaseRecord || typeof purchaseRecord !== 'object') return 0;
        const date = typeof purchaseRecord.date === 'number' ? purchaseRecord.date : undefined;
        if (date == null || !isSameDayKST(date, Date.now())) return 0;
        const qty = typeof purchaseRecord.quantity === 'number' ? purchaseRecord.quantity : 0;
        return Math.max(0, qty);
    };

    // 각 아이템의 구매 가능 여부 및 최대 구매 가능 개수 계산
    const getItemPurchaseInfo = (item: TowerItem) => {
        const currentOwned = getCurrentOwned(item.itemId);
        const todayPurchased = getTodayPurchased(item.itemId);
        const cartQuantity = cart[item.itemId] || 0;
        const atMaxOwned = currentOwned >= item.maxOwned;
        const atDailyLimit = todayPurchased >= item.dailyPurchaseLimit;
        const canBuyMore = !atMaxOwned && !atDailyLimit;
        const maxCanBuy = atMaxOwned
            ? 0
            : Math.min(
                item.maxOwned - currentOwned,
                item.dailyPurchaseLimit - todayPurchased,
                item.price.gold ? Math.floor((currentUser.gold || 0) / item.price.gold) : Infinity,
                item.price.diamonds ? Math.floor((currentUser.diamonds || 0) / item.price.diamonds) : Infinity
            );
        return { canBuyMore, maxCanBuy, currentOwned, todayPurchased, cartQuantity, atMaxOwned, atDailyLimit };
    };

    const handleQuantityChange = (itemId: string, delta: number) => {
        const item = TOWER_ITEMS.find(i => i.itemId === itemId);
        if (!item) return;

        const { maxCanBuy, currentOwned, todayPurchased } = getItemPurchaseInfo(item);
        const currentCartQuantity = cart[itemId] || 0;
        const newQuantity = Math.max(0, Math.min(maxCanBuy, currentCartQuantity + delta));
        
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
        const newQuantity = Math.max(0, Math.min(maxCanBuy, quantity));
        
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
                // 서버 응답을 기다리기 위해 짧은 지연 추가 (상태 업데이트 대기)
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`[TowerItemShopModal] Failed to purchase ${itemId}:`, error);
                // 에러가 발생해도 다음 아이템 구매 계속 진행
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
                        aria-label="도전의 탑 아이템 구매 닫기"
                    >
                        닫기
                    </button>
                </div>

                <div className={`flex-1 min-h-0 overflow-hidden ${isNativeMobile ? 'mb-2 overflow-y-auto pr-0.5' : 'mb-4'}`}>
                    {selectedItem && selectedInfo && isNativeMobile && (
                        <div className="mb-2 rounded-lg border border-amber-700/35 bg-gray-800/40 p-2">
                            <div className="flex items-start gap-2">
                                <img src={selectedItem.icon} alt={selectedItem.name} className="h-14 w-14 shrink-0 object-contain" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-bold text-amber-200">{selectedItem.name}</p>
                                    <p className="text-xs text-amber-300/85">보유제한 {selectedItem.maxOwned}개</p>
                                    <p className="text-xs text-amber-300/85">구매제한 일일 {selectedItem.dailyPurchaseLimit}개</p>
                                </div>
                            </div>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-amber-100/85">{selectedItem.description}</p>
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
                                                {item.price.gold && <img src="/images/icon/Gold.png" alt="골드" className="h-3 w-3" />}
                                                {item.price.diamonds && <img src="/images/icon/Zem.png" alt="다이아" className="h-3 w-3" />}
                                                <span className="text-[10px] font-semibold text-amber-100">{(item.price.gold || item.price.diamonds || 0).toLocaleString()}</span>
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
                                            <label className="text-xs font-semibold text-amber-200">수량 선택</label>
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
                                                    max={maxCanBuy}
                                                    value={cartQuantity || 0}
                                                    onChange={(e) => handleSetQuantity(selectedItem.itemId, parseInt(e.target.value) || 0)}
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
                                                {atMaxOwned ? '보유 한도 도달' : '일일 구매 한도 도달'}
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
                                                                <img src="/images/icon/Gold.png" alt="골드" className="w-3 h-3" />
                                                                <span className="text-xs text-yellow-300 font-semibold">{item.price.gold}</span>
                                                            </div>
                                                        )}
                                                        {item.price.diamonds && (
                                                            <div className="flex items-center gap-1">
                                                                <img src="/images/icon/Zem.png" alt="다이아" className="w-3 h-3" />
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
                            {selectedItem && (
                                <div className="flex-1 flex flex-col bg-gray-800/40 rounded-lg p-4 border border-amber-700/30">
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="relative w-20 h-20 flex-shrink-0">
                                            <img src={selectedItem.icon} alt={selectedItem.name} className="w-full h-full object-contain" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-lg font-bold text-amber-200 mb-2">{selectedItem.name}</h3>
                                            <p className="text-sm text-amber-100/80 leading-relaxed mb-3">{selectedItem.description}</p>
                                            <div className="space-y-2 text-xs text-amber-300/80">
                                                <div className="flex items-center gap-2"><span className="font-semibold">보유 제한:</span><span>최대 {selectedItem.maxOwned}개 보유 가능</span></div>
                                                <div className="flex items-center gap-2"><span className="font-semibold">구매 제한:</span><span>하루 최대 {selectedItem.dailyPurchaseLimit}개 구매 가능</span></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="border-t border-amber-700/40 pt-4">
                                        {(() => {
                                            const { canBuyMore, maxCanBuy, currentOwned, todayPurchased, cartQuantity, atMaxOwned, atDailyLimit } = getItemPurchaseInfo(selectedItem);
                                            return (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-sm text-amber-200 font-semibold">수량 선택:</label>
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => handleQuantityChange(selectedItem.itemId, -1)} disabled={!canBuyMore || (cartQuantity || 0) <= 0} className="w-8 h-8 rounded bg-amber-900/40 border border-amber-700/30 hover:bg-amber-800/60 text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed">-</button>
                                                            <input type="number" min={0} max={maxCanBuy} value={cartQuantity || 0} onChange={(e) => handleSetQuantity(selectedItem.itemId, parseInt(e.target.value) || 0)} className="w-16 text-center bg-gray-800/40 border border-amber-700/30 rounded text-amber-200" />
                                                            <button onClick={() => handleQuantityChange(selectedItem.itemId, 1)} disabled={!canBuyMore || (cartQuantity || 0) >= maxCanBuy} className="w-8 h-8 rounded bg-amber-900/40 border border-amber-700/30 hover:bg-amber-800/60 text-amber-200 disabled:opacity-50 disabled:cursor-not-allowed">+</button>
                                                        </div>
                                                    </div>
                                                    <div className="text-xs text-amber-300/80 space-y-1">
                                                        <p>현재 보유: {currentOwned}/{selectedItem.maxOwned}개</p>
                                                        <p>오늘 구매: {atMaxOwned ? selectedItem.dailyPurchaseLimit : todayPurchased}/{selectedItem.dailyPurchaseLimit}개</p>
                                                        <p>최대 구매 가능: {maxCanBuy}개</p>
                                                    </div>
                                                    {atMaxOwned && <p className="text-xs text-red-400 text-center">보유 개수가 최대치여서 구매할 수 없습니다.</p>}
                                                    {!atMaxOwned && atDailyLimit && <p className="text-xs text-red-400 text-center">오늘 구매 한도에 도달했습니다.</p>}
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
                            <span className={`${isNativeMobile ? 'text-sm' : 'text-xs'} font-bold text-amber-200`}>총 가격</span>
                            <div className="flex items-center gap-2">
                                {totalGold > 0 ? (
                                    <div className="flex items-center gap-1">
                                        <img src="/images/icon/Gold.png" alt="골드" className={`${isNativeMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
                                        <span className={`${isNativeMobile ? 'text-sm' : 'text-xs'} font-bold ${canAfford ? 'text-yellow-300' : 'text-red-400'}`}>
                                            {totalGold.toLocaleString()}
                                        </span>
                                    </div>
                                ) : totalDiamonds > 0 ? (
                                    <div className="flex items-center gap-1">
                                        <img src="/images/icon/Zem.png" alt="다이아" className={`${isNativeMobile ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} />
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
