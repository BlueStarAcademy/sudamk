import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, ServerAction } from '../../types.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import ResourceActionButton from '../ui/ResourceActionButton.js';
import DraggableWindow from '../DraggableWindow.js';
import { MATERIAL_ITEMS } from '../../constants';
import { BLACKSMITH_DISASSEMBLY_JACKPOT_RATES } from '../../constants/rules.js';

const CraftingDetailModal: React.FC<{
    details: { materialName: string, craftType: 'upgrade' | 'downgrade' };
    inventory: InventoryItem[];
    blacksmithLevel: number;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
}> = ({ details, inventory, blacksmithLevel, onClose, onAction }) => {
    const { materialName, craftType } = details;
    const isUpgrade = craftType === 'upgrade';
    
    const materialTiers = ['하급 강화석', '중급 강화석', '상급 강화석', '최상급 강화석', '신비의 강화석'];
    const tierIndex = materialTiers.indexOf(materialName);

    // tierIndex가 유효하지 않은 경우 처리
    if (tierIndex === -1) {
        return null;
    }

    const sourceMaterialName = materialName;
    const targetMaterialName = isUpgrade ? materialTiers[tierIndex + 1] : materialTiers[tierIndex - 1];

    // targetMaterialName이 유효하지 않은 경우 처리
    if (!targetMaterialName) {
        return null;
    }

    const sourceTemplate = MATERIAL_ITEMS[sourceMaterialName];
    const targetTemplate = MATERIAL_ITEMS[targetMaterialName];

    const conversionRate = isUpgrade ? 10 : 1;
    // 재료 합성: 기본 1개 (대박 시 2배)
    // 재료 분해: 기본 3~5개 랜덤 (대박 시 2배)
    const yieldMin = isUpgrade ? 1 : 3;
    const yieldMax = isUpgrade ? 1 : 5;

    const sourceMaterialCount = useMemo(() => {
        return inventory
            .filter(i => i.name === sourceMaterialName)
            .reduce((sum, i) => sum + (i.quantity || 0), 0);
    }, [inventory, sourceMaterialName]);

    const maxQuantity = Math.floor(sourceMaterialCount / conversionRate);
    const [quantity, setQuantity] = useState(maxQuantity > 0 ? 1 : 0);

    // Update quantity when inventory changes
    useEffect(() => {
        const newMaxQuantity = Math.floor(sourceMaterialCount / conversionRate);
        setQuantity(prev => Math.min(prev, newMaxQuantity));
    }, [sourceMaterialCount, conversionRate]);

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value)) {
            setQuantity(Math.max(0, Math.min(maxQuantity, value)));
        } else {
            setQuantity(0);
        }
    };
    
    const handleConfirm = async () => {
        if (quantity > 0) {
            await onAction({ type: 'CRAFT_MATERIAL', payload: { materialName, craftType, quantity } });
        }
        onClose();
    };

    return (
        <DraggableWindow 
            title={isUpgrade ? '재료 합성' : '재료 분해'} 
            onClose={onClose} 
            windowId={`crafting-${materialName}-${craftType}`}
            initialWidth={480}
            initialHeight={600}
            isTopmost
            variant="store"
        >
            <div className="flex flex-col h-full min-h-0 text-slate-100">
                <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-2">
                    <div className="grid gap-3">
                        <div className="grid grid-cols-2 gap-2 bg-gradient-to-br from-[#1c2642] via-[#141f35] to-[#0c1424] border border-cyan-300/20 rounded-xl p-3">
                            <div className="flex flex-col items-center gap-1.5">
                                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-slate-900/40 border border-slate-500/40 shadow-inner">
                                    {sourceTemplate?.image && <img src={sourceTemplate.image} alt={sourceMaterialName} className="absolute inset-0 w-full h-full object-contain" />}
                                </div>
                                <span className="text-xs font-semibold text-center leading-tight">{sourceMaterialName}</span>
                                <span className="text-[10px] text-cyan-200/80 text-center">보유 {sourceMaterialCount.toLocaleString()}개</span>
                            </div>
                            <div className="flex flex-col items-center gap-1.5">
                                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-emerald-900/30 border border-emerald-400/40 shadow-[0_0_20px_-10px_rgba(16,185,129,0.85)]">
                                    {targetTemplate?.image && <img src={targetTemplate.image} alt={targetMaterialName} className="absolute inset-0 w-full h-full object-contain" />}
                                </div>
                                <span className="text-xs font-semibold text-emerald-200 text-center leading-tight">{targetMaterialName}</span>
                                <span className="text-[10px] text-emerald-300/90 text-center">
                                    예상 획득{' '}
                                    {yieldMin === yieldMax
                                        ? `${(quantity * yieldMin).toLocaleString()}개`
                                        : `${(quantity * yieldMin).toLocaleString()}~${(quantity * yieldMax).toLocaleString()}개`}
                                </span>
                            </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-[#141f33] via-[#10192a] to-[#0b1221] border border-slate-500/30 rounded-xl p-3 space-y-2">
                            <p className="text-xs text-center text-cyan-200">
                                {isUpgrade ? '합성' : '분해'}에 사용될 수량을 조절하세요.
                            </p>
                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="quantity-slider" className="text-[10px] font-medium text-slate-200 text-center">
                                    {sourceMaterialName} 소비{' '}
                                    <span className="text-amber-200 font-semibold">
                                        {(quantity * conversionRate).toLocaleString()}
                                    </span>
                                    <span className="text-slate-400"> / {sourceMaterialCount.toLocaleString()}개</span>
                                </label>
                                <input
                                    id="quantity-slider"
                                    type="range"
                                    min="0"
                                    max={maxQuantity}
                                    value={quantity}
                                    onChange={handleQuantityChange}
                                    disabled={maxQuantity === 0}
                                    className="w-full h-1.5 rounded-full appearance-none bg-slate-800 accent-cyan-300"
                                />
                                <div className="flex justify-between text-[10px] text-slate-400 px-1">
                                    <span>0회</span>
                                    <span>{maxQuantity}회</span>
                                </div>
                                <div className="flex justify-between text-[10px] px-1 text-slate-200/90">
                                    <span>총 시도</span>
                                    <span className="font-semibold text-cyan-200">{quantity.toLocaleString()}회</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-[#101a2f] via-[#0c1527] to-[#09101d] border border-cyan-300/20 rounded-xl p-3 text-center text-[10px] text-cyan-200/90 leading-relaxed">
                        {isUpgrade ? '합성' : '분해'} 시{' '}
                        <span className="text-emerald-300 font-semibold">
                            {BLACKSMITH_DISASSEMBLY_JACKPOT_RATES[Math.max(0, blacksmithLevel - 1)]}%
                        </span>
                        의 확률로 <span className="text-amber-200 font-semibold">'대박'</span>이 발생하여 보상이 2배가 됩니다.
                    </div>
                </div>

                <div className="flex-shrink-0 flex justify-end gap-2 pt-3 border-t border-gray-700/50 mt-3">
                    <ResourceActionButton onClick={onClose} variant="neutral" className="!w-auto !px-4 !py-1.5 text-xs">
                        취소
                    </ResourceActionButton>
                    <ResourceActionButton
                        onClick={handleConfirm}
                        variant="materials"
                        disabled={quantity === 0}
                        className="!w-auto !px-5 !py-1.5 text-xs"
                    >
                        {quantity}회 {isUpgrade ? '합성' : '분해'}
                    </ResourceActionButton>
                </div>
            </div>
        </DraggableWindow>
    );
};

interface ConversionViewProps {
    onAction: (action: ServerAction) => Promise<void>;
}

const MOBILE_CONVERSION_BREAKPOINT_PX = 1025;

const ConversionView: React.FC<ConversionViewProps> = ({ onAction }) => {
    const { currentUserWithStatus } = useAppContext();
    const [craftingDetails, setCraftingDetails] = useState<{ materialName: string, craftType: 'upgrade' | 'downgrade' } | null>(null);
    const [useMobileConversionRow, setUseMobileConversionRow] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < MOBILE_CONVERSION_BREAKPOINT_PX
    );

    useEffect(() => {
        const sync = () => setUseMobileConversionRow(window.innerWidth < MOBILE_CONVERSION_BREAKPOINT_PX);
        sync();
        window.addEventListener('resize', sync);
        return () => window.removeEventListener('resize', sync);
    }, []);

    if (!currentUserWithStatus) return null;

    const { inventory } = currentUserWithStatus;

    const materialCategories = useMemo(() => {
        const categories: Record<string, InventoryItem[]> = {};
        inventory
            .filter(item => item.type === 'material')
            .forEach(item => {
                if (!categories[item.name]) {
                    categories[item.name] = [];
                }
                categories[item.name].push(item);
            });
        return categories;
    }, [inventory]);

    const materialTiers = ['하급 강화석', '중급 강화석', '상급 강화석', '최상급 강화석', '신비의 강화석'];

    const renderStoneCard = (materialName: string) => {
        const quantity = materialCategories[materialName]
            ? materialCategories[materialName].reduce((sum, item) => sum + (item.quantity || 0), 0)
            : 0;
        const materialData = MATERIAL_ITEMS[materialName];
        return (
            <div
                className={`flex shrink-0 flex-col items-center justify-center rounded-lg border border-white/10 bg-gradient-to-b from-slate-900/80 to-black/55 p-2 ${
                    useMobileConversionRow ? 'w-[5.5rem] min-w-[5.5rem]' : 'min-w-[100px] sm:min-w-[120px] sm:p-2.5'
                }`}
            >
                <img
                    src={materialData.image as string | undefined}
                    alt={materialName}
                    className={`mb-1 object-contain ${useMobileConversionRow ? 'h-9 w-9' : 'h-10 w-10 sm:mb-1.5 sm:h-12 sm:w-12'}`}
                />
                <h4
                    className={`mb-0.5 text-center font-bold text-secondary sm:mb-1 sm:text-xs ${
                        useMobileConversionRow ? 'max-w-[5rem] text-[10px] leading-tight' : 'text-[11px] whitespace-nowrap'
                    }`}
                >
                    {materialName}
                </h4>
                <p className={`text-center text-tertiary ${useMobileConversionRow ? 'text-[9px]' : 'mb-1 text-[10px] sm:mb-1.5 sm:text-[11px]'}`}>
                    보유 {quantity.toLocaleString()}
                </p>
            </div>
        );
    };

    const renderConversionBridge = (leftTierName: string, leftTierIndex: number) => {
        const higherName = materialTiers[leftTierIndex + 1];
        const leftQty =
            materialCategories[leftTierName]?.reduce((sum, item) => sum + (item.quantity || 0), 0) ?? 0;
        const materialExists = materialCategories[leftTierName] && materialCategories[leftTierName].length > 0;
        return (
            <div
                key={`bridge-${leftTierName}`}
                className={`flex shrink-0 flex-col items-center justify-center gap-0.5 ${
                    useMobileConversionRow ? 'px-0.5' : 'gap-1'
                }`}
            >
                <span className={`font-medium text-secondary ${useMobileConversionRow ? 'text-[9px]' : 'text-[10px] sm:text-[11px]'}`}>합성</span>
                <ResourceActionButton
                    onClick={() => setCraftingDetails({ materialName: leftTierName, craftType: 'upgrade' })}
                    variant="accent"
                    className={`!w-auto whitespace-nowrap ${
                        useMobileConversionRow ? '!px-2 !py-1 text-[11px]' : '!px-2.5 !py-1 text-[11px] sm:!px-3 sm:!py-1.5 sm:text-xs'
                    }`}
                    disabled={!materialExists || leftQty < 10}
                    title={`${leftTierName} 10개 → ${higherName} 합성`}
                >
                    →
                </ResourceActionButton>
                <ResourceActionButton
                    onClick={() => setCraftingDetails({ materialName: higherName, craftType: 'downgrade' })}
                    variant="neutral"
                    className={`!w-auto whitespace-nowrap ${
                        useMobileConversionRow ? '!px-2 !py-1 text-[11px]' : '!px-2.5 !py-1 text-[11px] sm:!px-3 sm:!py-1.5 sm:text-xs'
                    }`}
                    disabled={
                        !materialCategories[higherName] ||
                        (materialCategories[higherName]?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0) < 1
                    }
                    title={`${higherName} → ${leftTierName} 분해`}
                >
                    ←
                </ResourceActionButton>
                <span className={`font-medium text-secondary ${useMobileConversionRow ? 'text-[9px]' : 'text-[10px] sm:text-[11px]'}`}>분해</span>
            </div>
        );
    };

    return (
        <div className="flex h-full min-h-0 w-full flex-col">
            {craftingDetails && (
                <CraftingDetailModal 
                    details={craftingDetails} 
                    inventory={inventory} 
                    blacksmithLevel={currentUserWithStatus.blacksmithLevel ?? 1}
                    onClose={() => setCraftingDetails(null)} 
                    onAction={onAction} 
                />
            )}

            <div
                className={`flex min-h-0 flex-1 rounded-xl border border-amber-400/20 bg-gradient-to-b from-[#171c2a]/70 via-[#101522]/88 to-[#0b1018]/92 p-2.5 sm:p-3 ${
                    useMobileConversionRow
                        ? 'flex-col justify-start overflow-x-hidden overflow-y-hidden py-2'
                        : 'flex-col items-center justify-center gap-4 overflow-y-auto overflow-x-hidden'
                }`}
            >
                {useMobileConversionRow ? (
                    <div className="flex w-full min-w-0 flex-col gap-1.5">
                        <p className="shrink-0 px-0.5 text-center text-[10px] text-amber-200/75">
                            좌우로 스크롤하여 강화석 단계를 선택하세요
                        </p>
                        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
                            <div className="inline-flex min-h-[7.5rem] flex-nowrap items-stretch gap-1.5 px-1 py-0.5">
                                {materialTiers.map((materialName, index) => (
                                    <React.Fragment key={materialName}>
                                        {renderStoneCard(materialName)}
                                        {index < materialTiers.length - 1 && renderConversionBridge(materialName, index)}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* PC: 두 행 레이아웃 유지 */}
                        <div className="flex w-full min-w-0 justify-center overflow-x-auto pb-1 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
                            <div className="inline-flex max-w-none flex-nowrap items-start justify-center gap-2">
                                {['하급 강화석', '중급 강화석', '상급 강화석'].map((materialName, index, row) => {
                                    const tierIndex = materialTiers.indexOf(materialName);
                                    return (
                                        <React.Fragment key={materialName}>
                                            {renderStoneCard(materialName)}
                                            {index < row.length - 1 && renderConversionBridge(materialName, tierIndex)}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex w-full min-w-0 justify-center overflow-x-auto pb-1 [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
                            <div className="inline-flex max-w-none flex-nowrap items-start justify-center gap-2">
                                {['상급 강화석', '최상급 강화석', '신비의 강화석'].map((materialName, index, row) => {
                                    const tierIndex = materialTiers.indexOf(materialName);
                                    return (
                                        <React.Fragment key={materialName}>
                                            {renderStoneCard(materialName)}
                                            {index < row.length - 1 && renderConversionBridge(materialName, tierIndex)}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ConversionView;
