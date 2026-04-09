import React, { useMemo, useState, useEffect, useRef } from 'react';
import { User } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import { useAppContext } from '../hooks/useAppContext.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

type PotionType = 'small' | 'medium' | 'large';

interface PotionInfo {
    name: string;
    image: string;
    minRecovery: number;
    maxRecovery: number;
    price: number;
    grade: 'normal' | 'uncommon' | 'rare';
}

const POTION_TYPES: Record<PotionType, PotionInfo> = {
    small: {
        name: '컨디션회복제(소)',
        image: '/images/use/con1.png',
        minRecovery: 1,
        maxRecovery: 10,
        price: 100,
        grade: 'normal'
    },
    medium: {
        name: '컨디션회복제(중)',
        image: '/images/use/con2.png',
        minRecovery: 10,
        maxRecovery: 20,
        price: 150,
        grade: 'uncommon'
    },
    large: {
        name: '컨디션회복제(대)',
        image: '/images/use/con3.png',
        minRecovery: 20,
        maxRecovery: 30,
        price: 200,
        grade: 'rare'
    }
};

interface ConditionPotionModalProps {
    currentUser?: User; // Optional: useAppContext에서 가져올 수 있도록
    currentCondition: number;
    onClose: () => void;
    onConfirm: (potionType: PotionType) => void;
    onAction?: (action: any) => void;
    isTopmost?: boolean;
}

const ConditionPotionModal: React.FC<ConditionPotionModalProps> = ({ 
    currentUser: propCurrentUser, 
    currentCondition, 
    onClose, 
    onConfirm,
    isTopmost 
}) => {
    const { handlers, currentUserWithStatus, updateTrigger } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    // prop으로 받은 currentUser가 있으면 사용하고, 없으면 context에서 가져옴
    const currentUser = currentUserWithStatus || propCurrentUser;
    const [selectedPotionType, setSelectedPotionType] = useState<PotionType | null>(null);
    const [previousCondition, setPreviousCondition] = useState<number | undefined>(currentCondition);
    const [showConditionIncrease, setShowConditionIncrease] = useState(false);
    const [conditionIncreaseAmount, setConditionIncreaseAmount] = useState(0);
    const prevConditionRef = useRef<number>(currentCondition);

    // 컨디션 변화 감지 및 애니메이션 트리거
    useEffect(() => {
        if (prevConditionRef.current !== undefined && currentCondition !== 1000 && prevConditionRef.current !== 1000) {
            const increase = currentCondition - prevConditionRef.current;
            if (increase > 0) {
                setConditionIncreaseAmount(increase);
                setShowConditionIncrease(true);
                setTimeout(() => {
                    setShowConditionIncrease(false);
                }, 2000);
            }
        }
        prevConditionRef.current = currentCondition;
        setPreviousCondition(currentCondition);
    }, [currentCondition]);

    if (!currentUser) {
        return null;
    }

    // 보유 중인 각 컨디션 회복제 개수 계산
    // inventory 변경을 확실히 감지하기 위해 inventory를 직접 의존성으로 사용하고 updateTrigger도 함께 사용
    const potionCounts = useMemo(() => {
        const counts: Record<PotionType, number> = { small: 0, medium: 0, large: 0 };
        if (!currentUser?.inventory) return counts;
        currentUser.inventory
            .filter(item => item.type === 'consumable' && item.name.startsWith('컨디션회복제'))
            .forEach(item => {
                if (item.name === '컨디션회복제(소)') {
                    counts.small += item.quantity || 1;
                } else if (item.name === '컨디션회복제(중)') {
                    counts.medium += item.quantity || 1;
                } else if (item.name === '컨디션회복제(대)') {
                    counts.large += item.quantity || 1;
                }
            });
        return counts;
    }, [currentUser?.inventory, updateTrigger]);

    // 선택한 회복제의 예상 회복량 계산
    const expectedRecovery = useMemo(() => {
        if (!selectedPotionType) return null;
        const potion = POTION_TYPES[selectedPotionType];
        const minAfter = Math.min(100, currentCondition + potion.minRecovery);
        const maxAfter = Math.min(100, currentCondition + potion.maxRecovery);
        return { min: minAfter, max: maxAfter, avg: Math.floor((minAfter + maxAfter) / 2) };
    }, [selectedPotionType, currentCondition]);

    const canAfford = useMemo(() => {
        if (!selectedPotionType) return false;
        return currentUser.gold >= POTION_TYPES[selectedPotionType].price;
    }, [selectedPotionType, currentUser.gold]);

    const hasPotion = useMemo(() => {
        if (!selectedPotionType) return false;
        return potionCounts[selectedPotionType] > 0;
    }, [selectedPotionType, potionCounts]);

    const handleConfirm = () => {
        if (!selectedPotionType) return;
        
        // 0개인 아이템을 선택한 경우 상점 열기
        if (!hasPotion) {
            handlers.openShop('consumables');
            // 창을 닫지 않음 (구매 후 돌아올 수 있도록)
            return;
        }
        
        // 보유하고 있고 골드가 충분한 경우 사용
        if (canAfford) {
            onConfirm(selectedPotionType);
            // 창을 닫지 않음 (여러 개 사용할 수 있도록)
        }
    };

    return (
        <DraggableWindow 
            title="컨디션 회복제 사용" 
            initialWidth={isNativeMobile ? 340 : 600} 
            initialHeight={isNativeMobile ? 520 : 650}
            onClose={onClose}
            isTopmost={isTopmost}
            windowId="condition-potion-modal"
            mobileViewportFit={isNativeMobile}
            mobileViewportMaxHeightVh={94}
            bodyPaddingClassName={isNativeMobile ? 'p-2' : undefined}
        >
            <div className={`text-white flex flex-col min-h-0 ${isNativeMobile ? 'h-full gap-2' : 'h-full gap-4'}`}>
                <div className={`flex-1 flex flex-col min-h-0 overflow-y-auto ${isNativeMobile ? 'gap-2 pr-0.5' : 'gap-4'}`}>
                    <div className={isNativeMobile ? 'flex flex-col gap-2' : 'grid grid-cols-3 gap-3'}>
                        {(Object.keys(POTION_TYPES) as PotionType[]).map((type) => {
                            const potion = POTION_TYPES[type];
                            const count = potionCounts[type];
                            const isSelected = selectedPotionType === type;

                            return (
                                <button
                                    type="button"
                                    key={type}
                                    onClick={() => setSelectedPotionType(type)}
                                    className={`text-left rounded-xl border-2 transition-all w-full ${
                                        isNativeMobile ? 'p-2.5 active:scale-[0.99]' : 'p-3 rounded-lg cursor-pointer'
                                    } ${
                                        isSelected ? 'border-yellow-400 bg-gray-700/60 ring-1 ring-yellow-400/30' : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                                    }`}
                                >
                                    {isNativeMobile ? (
                                        <div className="flex items-center gap-3">
                                            <img src={potion.image} alt="" className="w-12 h-12 object-contain flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-[13px] text-white leading-tight">{potion.name}</h3>
                                                <p className="text-[11px] text-gray-400 mt-0.5">
                                                    {potion.minRecovery}~{potion.maxRecovery} 회복
                                                </p>
                                                <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[11px]">
                                                    <span className="inline-flex items-center gap-0.5">
                                                        <img src="/images/icon/Gold.png" alt="" className="w-3.5 h-3.5" />
                                                        <span className={currentUser.gold >= potion.price ? 'text-green-400' : 'text-red-400'}>
                                                            {potion.price}
                                                        </span>
                                                    </span>
                                                    <span className={count > 0 ? 'text-blue-300' : 'text-red-400'}>
                                                        보유 {count}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <img src={potion.image} alt={potion.name} className="w-16 h-16 object-contain" />
                                            <h3 className="font-bold text-sm text-center">{potion.name}</h3>
                                            <p className="text-xs text-gray-400 text-center">
                                                {potion.minRecovery}~{potion.maxRecovery} 회복
                                            </p>
                                            <div className="flex items-center gap-1 text-xs">
                                                <img src="/images/icon/Gold.png" alt="골드" className="w-4 h-4" />
                                                <span className={currentUser.gold >= potion.price ? 'text-green-400' : 'text-red-400'}>
                                                    {potion.price}
                                                </span>
                                            </div>
                                            <p className={`text-xs ${count > 0 ? 'text-blue-300' : 'text-red-400'}`}>
                                                보유: {count}개
                                            </p>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {selectedPotionType && !hasPotion && (
                        <p className={`text-red-400 text-center leading-snug ${isNativeMobile ? 'text-[11px] px-1' : 'text-sm'}`}>
                            {POTION_TYPES[selectedPotionType].name} 없음. 상점에서 구매할 수 있습니다.
                        </p>
                    )}

                    {selectedPotionType && !canAfford && hasPotion && (
                        <p className={`text-red-400 text-center ${isNativeMobile ? 'text-[11px] px-1' : 'text-sm'}`}>
                            골드 부족 (필요 {POTION_TYPES[selectedPotionType].price})
                        </p>
                    )}
                </div>

                <div className={`w-full bg-gray-800/50 rounded-lg border border-gray-700 flex-shrink-0 ${isNativeMobile ? 'p-2.5' : 'p-4'}`}>
                    <div className={`flex justify-between items-center relative ${isNativeMobile ? 'mb-1.5' : 'mb-2'}`}>
                        <span className={`text-gray-300 ${isNativeMobile ? 'text-xs' : ''}`}>현재 컨디션</span>
                        <span className={`text-yellow-300 font-bold relative transition-all duration-300 tabular-nums ${
                            isNativeMobile ? 'text-base' : 'text-lg'
                        } ${showConditionIncrease ? 'scale-110 text-green-300' : ''}`}>
                            {currentCondition === 1000 ? '-' : currentCondition}
                        </span>
                        {showConditionIncrease && conditionIncreaseAmount > 0 && (
                            <span
                                className={`absolute font-bold text-green-400 pointer-events-none whitespace-nowrap ${
                                    isNativeMobile ? 'right-0 -top-5 text-sm' : 'right-0 top-[-24px] text-base'
                                }`}
                                style={{
                                    animation: 'fadeUp 2s ease-out forwards',
                                    textShadow: '0 0 8px rgba(34, 197, 94, 0.8)',
                                }}
                            >
                                +{conditionIncreaseAmount}
                            </span>
                        )}
                    </div>
                    <div className="flex justify-between items-center gap-2">
                        <span className={`text-gray-300 ${isNativeMobile ? 'text-xs leading-tight' : ''}`}>
                            {isNativeMobile ? '회복 후(예상)' : '예상 회복 후 컨디션:'}
                        </span>
                        <span className={`text-green-300 font-bold tabular-nums text-right ${isNativeMobile ? 'text-sm' : 'text-lg'}`}>
                            {expectedRecovery ? `${expectedRecovery.min}~${expectedRecovery.max}` : '—'}
                        </span>
                    </div>
                </div>

                <div className={`flex w-full flex-shrink-0 ${isNativeMobile ? 'gap-2 mt-2' : 'gap-4 mt-4'}`}>
                    <Button 
                        onClick={onClose} 
                        colorScheme="gray" 
                        className={`flex-1 ${isNativeMobile ? '!py-3 text-sm min-h-[44px]' : ''}`}
                    >
                        취소
                    </Button>
                    <Button 
                        onClick={handleConfirm} 
                        colorScheme="green" 
                        className={`flex-1 ${isNativeMobile ? '!py-3 text-sm min-h-[44px]' : ''}`}
                        disabled={!selectedPotionType}
                    >
                        {selectedPotionType && !hasPotion ? '상점 가기' : '사용'}
                    </Button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default ConditionPotionModal;

