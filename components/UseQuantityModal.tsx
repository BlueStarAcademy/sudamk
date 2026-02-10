import React, { useState, useMemo, useEffect } from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { InventoryItem, UserWithStatus } from '../types.js';

interface UseQuantityModalProps {
    item: InventoryItem;
    currentUser: UserWithStatus;
    onClose: () => void;
    onConfirm: (itemId: string, quantity: number, itemName?: string) => Promise<void> | void;
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

    // totalQuantity가 변경되면 quantity를 조정 (초기 로드 시 또는 수량이 부족해진 경우)
    useEffect(() => {
        if (totalQuantity > 0 && quantity > totalQuantity) {
            setQuantity(totalQuantity);
        } else if (totalQuantity === 0) {
            setQuantity(0);
        }
    }, [totalQuantity]); // quantity는 의존성에 포함하지 않음 (무한 루프 방지)

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // 빈 문자열이면 1로 설정하지 않고 그대로 둠 (사용자가 입력 중일 수 있음)
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
        const value = Number(e.target.value);
        setQuantity(value);
    };
    
    // 입력 필드가 blur될 때 유효성 검사
    const handleQuantityBlur = () => {
        if (quantity < 1) {
            setQuantity(1);
        } else if (quantity > totalQuantity) {
            setQuantity(totalQuantity);
        }
    };

    return (
        <DraggableWindow 
            title="일괄 사용" 
            onClose={onClose} 
            windowId="useQuantity" 
            isTopmost={isTopmost}
        >
            <div 
                className="p-4 text-on-panel flex flex-col items-center"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
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
                    <div>
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
                                value={quantity || ''}
                                onChange={handleQuantityChange}
                                onBlur={handleQuantityBlur}
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
                            // onConfirm을 먼저 호출하여 액션이 실행되도록 함
                            if (quantity > 0 && quantity <= totalQuantity) {
                                try {
                                    await onConfirm(item.id, quantity, item.name);
                                } catch (error) {
                                    console.error('[UseQuantityModal] Failed to confirm:', error);
                                }
                                // 모달 닫기는 onConfirm이 완료된 후에 실행되도록 함
                                // InventoryModal에서도 모달을 닫지만, 여기서도 닫아서 확실히 처리
                                onClose();
                            }
                        }} 
                        colorScheme="purple" 
                        className="flex-1"
                        disabled={quantity === 0 || quantity > totalQuantity || totalQuantity === 0}
                    >
                        {quantity.toLocaleString()}개 사용
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default UseQuantityModal;

