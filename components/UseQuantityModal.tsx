import React, { useState, useMemo, useEffect } from 'react';
import DraggableWindow from './DraggableWindow.js';
import { InventoryItem, UserWithStatus } from '../types.js';
import { isActionPointConsumable } from '../constants/items.js';

interface UseQuantityModalProps {
    item: InventoryItem;
    currentUser: UserWithStatus;
    onClose: () => void;
    onConfirm: (itemId: string, quantity: number, itemName?: string) => Promise<void> | void;
    isTopmost?: boolean;
}

const UseQuantityModal: React.FC<UseQuantityModalProps> = ({ item, currentUser, onClose, onConfirm, isTopmost }) => {
    const totalQuantity = useMemo(() => {
        return currentUser.inventory
            .filter(i => i.type === 'consumable' && i.name === item.name)
            .reduce((sum, i) => sum + (i.quantity || 0), 0);
    }, [currentUser.inventory, item.name]);

    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        if (totalQuantity > 0 && quantity > totalQuantity) {
            setQuantity(totalQuantity);
        } else if (totalQuantity === 0) {
            setQuantity(0);
        }
    }, [totalQuantity]);

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '') {
            setQuantity(0);
            return;
        }
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
            setQuantity(Math.max(1, Math.min(totalQuantity, numValue)));
        } else {
            setQuantity(1);
        }
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuantity(Number(e.target.value));
    };

    const handleQuantityBlur = () => {
        if (quantity < 1) setQuantity(1);
        else if (quantity > totalQuantity) setQuantity(totalQuantity);
    };

    const isActionPoint = isActionPointConsumable(item.name);
    const showImage = isActionPoint || item.image;

    return (
        <DraggableWindow
            title="일괄 사용"
            onClose={onClose}
            windowId="useQuantity"
            isTopmost={isTopmost}
            initialWidth={400}
        >
            <div
                className="flex flex-col p-1"
                onMouseDown={e => e.stopPropagation()}
                onClick={e => e.stopPropagation()}
            >
                {/* 상단: 아이템 이미지 + 이름 */}
                <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-slate-800/90 via-slate-900/95 to-slate-800/90 border border-slate-600/50 shadow-inner mb-4">
                    {showImage && (
                        <div className="relative w-20 h-20 flex-shrink-0 rounded-xl bg-slate-700/60 border border-slate-500/40 flex items-center justify-center overflow-hidden">
                            {isActionPoint ? (
                                <div className="flex flex-col items-center justify-center text-amber-300">
                                    <span className="text-3xl leading-none" aria-hidden>⚡</span>
                                    <span className="text-sm font-bold text-amber-200 mt-0.5">+{item.name.replace(/.*\(\+(\d+)\)/, '$1')}</span>
                                </div>
                            ) : (
                                <img src={item.image!} alt={item.name} className="w-full h-full object-contain p-1.5" />
                            )}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-white truncate">{item.name}</h3>
                        <p className="text-sm text-slate-400 mt-1">보유: {totalQuantity.toLocaleString()}개</p>
                    </div>
                </div>

                {/* 수량 조절 */}
                <div className="rounded-xl bg-slate-800/50 border border-slate-600/40 p-4 mb-4">
                    <p className="text-sm font-medium text-slate-300 mb-3">사용 수량</p>
                    <div className="flex items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                            disabled={quantity <= 1 || totalQuantity === 0}
                            className="w-11 h-11 rounded-xl bg-slate-600 hover:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-500/50 text-white font-bold text-xl flex items-center justify-center shadow-md transition-all active:scale-95"
                        >
                            −
                        </button>
                        <input
                            type="number"
                            min={1}
                            max={totalQuantity}
                            value={quantity || ''}
                            onChange={handleQuantityChange}
                            onBlur={handleQuantityBlur}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => e.stopPropagation()}
                            onFocus={e => e.stopPropagation()}
                            className="w-24 h-12 text-center text-2xl font-bold bg-slate-700/80 border border-slate-500/50 rounded-xl text-white focus:ring-2 focus:ring-amber-400/50 outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setQuantity(q => Math.min(totalQuantity, q + 1))}
                            disabled={quantity >= totalQuantity || totalQuantity === 0}
                            className="w-11 h-11 rounded-xl bg-slate-600 hover:bg-slate-500 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-500/50 text-white font-bold text-xl flex items-center justify-center shadow-md transition-all active:scale-95"
                        >
                            +
                        </button>
                        <button
                            type="button"
                            onClick={() => setQuantity(totalQuantity)}
                            disabled={totalQuantity === 0}
                            className="h-11 px-4 rounded-xl bg-gradient-to-r from-amber-500/90 to-amber-600/90 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-400/50 text-slate-900 font-bold text-sm shadow-md transition-all active:scale-95"
                        >
                            Max
                        </button>
                    </div>
                    <input
                        id="quantity-slider"
                        type="range"
                        min="1"
                        max={Math.max(1, totalQuantity)}
                        value={quantity}
                        onChange={handleSliderChange}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                        disabled={totalQuantity === 0}
                        className="w-full h-2 mt-3 rounded-full appearance-none bg-slate-600 accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>1개</span>
                        <span>{totalQuantity.toLocaleString()}개</span>
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
                        onClick={async () => {
                            if (quantity > 0 && quantity <= totalQuantity) {
                                try {
                                    await onConfirm(item.id, quantity, item.name);
                                } catch (err) {
                                    console.error('[UseQuantityModal] Failed to confirm:', err);
                                }
                                onClose();
                            }
                        }}
                        disabled={quantity === 0 || quantity > totalQuantity || totalQuantity === 0}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-500/90 to-purple-600/90 hover:from-violet-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed border border-violet-400/50 text-white font-semibold shadow-md transition-all active:scale-[0.98]"
                    >
                        {quantity.toLocaleString()}개 사용
                    </button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default UseQuantityModal;
