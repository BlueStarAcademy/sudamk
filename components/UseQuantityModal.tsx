import React, { useState, useMemo, useEffect } from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { InventoryItem, UserWithStatus } from '../types.js';

interface UseQuantityModalProps {
    item: InventoryItem;
    currentUser: UserWithStatus;
    onClose: () => void;
    onConfirm: (itemId: string, quantity: number, itemName?: string) => Promise<void>;
    isTopmost?: boolean;
}

const UseQuantityModal: React.FC<UseQuantityModalProps> = ({ item, currentUser, onClose, onConfirm, isTopmost }) => {
    // 같은 이름의 소모품 전체 수량 계산
    const totalQuantity = useMemo(() => {
        return currentUser.inventory
            .filter(i => i.type === 'consumable' && i.name === item.name)
            .reduce((sum, i) => sum + (i.quantity || 0), 0);
    }, [currentUser.inventory, item.name]);

    const [quantity, setQuantity] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        setQuantity(Math.min(quantity, totalQuantity));
    }, [totalQuantity]);

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value)) {
            setQuantity(Math.max(1, Math.min(totalQuantity, value)));
        } else {
            setQuantity(1);
        }
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuantity(Number(e.target.value));
    };

    return (
        <DraggableWindow 
            title="일괄 사용" 
            onClose={onClose} 
            windowId="useQuantity" 
            isTopmost={isTopmost}
        >
            <div className="p-4 text-on-panel flex flex-col items-center">
                <div className="mb-4 text-center w-full">
                    <h3 className="text-lg font-bold mb-2">사용할 수량을 선택하세요</h3>
                    <div className="flex items-center justify-center gap-4 my-4">
                        {item.image && (
                            <div className="relative w-20 h-20 rounded-lg flex-shrink-0">
                                <img src={item.image} alt={item.name} className="absolute object-contain" style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
                            </div>
                        )}
                        <div className="text-left">
                            <p className="font-semibold text-lg">{item.name}</p>
                            <p className="text-sm text-gray-400">보유: {totalQuantity.toLocaleString()}개</p>
                        </div>
                    </div>
                </div>

                <div className="w-full space-y-4 mb-4">
                    <div
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <label htmlFor="quantity-slider" className="block text-sm font-medium text-secondary text-center mb-2">
                            사용 수량: <span className="font-bold text-highlight">{quantity.toLocaleString()} / {totalQuantity.toLocaleString()}</span>개
                        </label>
                        <input
                            id="quantity-slider"
                            type="range"
                            min="1"
                            max={totalQuantity}
                            value={quantity}
                            onChange={handleSliderChange}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            disabled={totalQuantity === 0}
                            className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-tertiary mt-1">
                            <span>1개</span>
                            <span>{totalQuantity.toLocaleString()}개</span>
                        </div>
                        <div className="mt-2">
                            <input
                                type="number"
                                min="1"
                                max={totalQuantity}
                                value={quantity}
                                onChange={handleQuantityChange}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                onFocus={(e) => e.stopPropagation()}
                                className="w-full bg-secondary border border-color text-on-panel text-sm rounded-md p-2 text-center"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 w-full">
                    <Button onClick={onClose} colorScheme="gray" className="flex-1">
                        취소
                    </Button>
                    <Button 
                        onClick={async () => {
                            if (isProcessing) return;
                            setIsProcessing(true);
                            try {
                                const result = await onConfirm(item.id, quantity, item.name);
                                // onConfirm이 성공적으로 완료되면 isProcessing을 false로 설정
                                // InventoryModal에서 obtainedItemsBulk를 확인하여 모달을 닫을지 결정함
                                // 여기서는 onConfirm이 완료되면 모달을 닫지 않고, InventoryModal에서 처리하도록 함
                                if (result && result.clientResponse?.obtainedItemsBulk) {
                                    // 성공적으로 처리되었고 결과가 있으면 모달 닫기 (InventoryModal에서도 처리하지만 여기서도 닫기)
                                    setIsProcessing(false);
                                } else if (result && !result.error) {
                                    // 응답이 있고 에러가 없으면 성공으로 간주
                                    setIsProcessing(false);
                                } else {
                                    // 에러가 있거나 응답이 없으면 isProcessing을 false로 설정하여 재시도 가능하도록 함
                                    setIsProcessing(false);
                                }
                            } catch (error) {
                                console.error('[UseQuantityModal] Error confirming:', error);
                                setIsProcessing(false);
                                // 에러 발생 시 모달은 열어둠
                            }
                        }} 
                        colorScheme="purple" 
                        className="flex-1"
                        disabled={quantity === 0 || quantity > totalQuantity || isProcessing}
                    >
                        {isProcessing ? '처리 중...' : `${quantity.toLocaleString()}개 사용`}
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default UseQuantityModal;

