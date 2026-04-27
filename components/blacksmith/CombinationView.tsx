
import React, { useState, useMemo, useEffect } from 'react';
import { InventoryItem, ServerAction, ItemGrade, EquipmentSlot, UserWithStatus } from '../../types.js';
import ResourceActionButton from '../ui/ResourceActionButton.js';
import { BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES } from '../../constants/rules.js';

const gradeStyles: Record<ItemGrade, { name: string; color: string; background: string; }> = {
    normal: { name: '일반', color: 'text-gray-300', background: '/images/equipments/normalbgi.png' },
    uncommon: { name: '고급', color: 'text-green-400', background: '/images/equipments/uncommonbgi.png' },
    rare: { name: '희귀', color: 'text-blue-400', background: '/images/equipments/rarebgi.png' },
    epic: { name: '에픽', color: 'text-purple-400', background: '/images/equipments/epicbgi.png' },
    legendary: { name: '전설', color: 'text-red-500', background: '/images/equipments/legendarybgi.png' },
    mythic: { name: '신화', color: 'text-orange-400', background: '/images/equipments/mythicbgi.png' },
    transcendent: { name: '초월', color: 'text-cyan-300', background: '/images/equipments/transcendentbgi.webp' },
};

const ALL_SLOTS: EquipmentSlot[] = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];
const SLOT_NAMES_KO: Record<EquipmentSlot, string> = {
    fan: '부채',
    board: '바둑판',
    top: '상의',
    bottom: '하의',
    bowl: '바둑통',
    stones: '바둑돌',
};

const ItemSlot: React.FC<{ item: InventoryItem | null; onRemove: () => void; isCompact?: boolean; }> = ({
    item,
    onRemove,
    isCompact = false,
}) => {
    if (!item) {
        return (
            <div className={`${isCompact ? 'h-24 w-full' : 'h-28 w-1/3'} rounded-lg border-2 border-dashed border-amber-500/30 bg-black/35 text-xs text-amber-100/70 flex items-center justify-center`}>
                재료
            </div>
        );
    }

    const styles = gradeStyles[item.grade];
    const isTranscendent = item.grade === ItemGrade.Transcendent;

    return (
        <button
            type="button"
            onClick={onRemove}
            title="재료 해제"
            aria-label={`${item.name} 재료 해제`}
            className={`${isCompact ? 'h-24 w-full p-1.5' : 'h-28 w-1/3 p-2'} relative cursor-pointer rounded-lg border border-amber-400/20 bg-gradient-to-b from-[#191e2b]/80 via-[#121724]/90 to-[#0c1018]/95 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] flex flex-col items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70`}
        >
            <div
                className={`relative ${isCompact ? 'h-12 w-12' : 'h-14 w-14'} flex-shrink-0 overflow-hidden rounded-lg border border-slate-500/50 bg-transparent ${isTranscendent ? 'transcendent-grade-slot' : ''}`}
            >
                <img src={styles.background} alt="" className="absolute inset-0 h-full w-full rounded-lg object-cover" />
                {item.image && (
                    <img src={item.image} alt="" className="pointer-events-none absolute object-contain p-1" style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />
                )}
            </div>
            <p className={`${isCompact ? 'text-[10px]' : 'text-xs'} font-bold ${styles.color} whitespace-nowrap overflow-hidden text-ellipsis w-full`} title={item.name}>{item.name}</p>
            <p className={`${isCompact ? 'text-[10px]' : 'text-[11px]'} text-slate-400`}>{SLOT_NAMES_KO[item.slot!] || '기타'}</p>
        </button>
    );
};

const OutcomeProbability: React.FC<{ items: (InventoryItem | null)[], isRandom: boolean }> = ({ items, isRandom }) => {
    const probabilities = useMemo(() => {
        const validItems = items.filter((i): i is InventoryItem => i !== null);
        if (validItems.length !== 3) return [];

        const probs = new Map<EquipmentSlot, number>();

        if (isRandom) {
            const prob = 1 / ALL_SLOTS.length;
            for (const slot of ALL_SLOTS) {
                probs.set(slot, prob);
            }
        } else {
            const slotCounts = new Map<EquipmentSlot, number>();
            for (const item of validItems) {
                if (item.slot) {
                    slotCounts.set(item.slot, (slotCounts.get(item.slot) || 0) + 1);
                }
            }
            for (const [slot, count] of slotCounts.entries()) {
                probs.set(slot, count / 3);
            }
        }
        return Array.from(probs.entries()).sort((a, b) => b[1] - a[1]);
    }, [items, isRandom]);

    if (probabilities.length === 0) return null;

    return (
        <div className="mt-3 w-full rounded-xl border border-amber-400/20 bg-gradient-to-b from-[#171c29]/75 via-black/35 to-black/45 p-3">
            <h4 className="mb-2 text-center text-xs font-bold text-amber-100">결과물 종류 확률</h4>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[11px]">
                {probabilities.map(([slot, prob]) => (
                    <div key={slot} className="flex justify-between">
                        <span className="text-slate-400">{SLOT_NAMES_KO[slot]}:</span>
                        <span className="font-semibold text-emerald-200">{(prob * 100).toFixed(1)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const GradeProbability: React.FC<{ items: (InventoryItem | null)[], currentUser: UserWithStatus }> = ({ items, currentUser }) => {
    const { blacksmithLevel } = currentUser;
    const probabilities = useMemo(() => {
        const validItems = items.filter((i): i is InventoryItem => i !== null);
        if (validItems.length !== 3 || new Set(validItems.map(i => i.grade)).size !== 1) return null;

        const grade = validItems[0].grade;
        const levelIndex = (blacksmithLevel ?? 1) - 1;
        const greatSuccessRate = BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES[levelIndex]?.[grade] ?? 0;
        const successRate = 100 - greatSuccessRate;

        return { successRate, greatSuccessRate };
    }, [items, blacksmithLevel]);

    if (!probabilities) return null;

    return (
        <div className="mt-2 w-full rounded-xl border border-amber-400/20 bg-gradient-to-b from-[#171c29]/75 via-black/35 to-black/45 p-3">
            <h4 className="mb-2 text-center text-xs font-bold text-amber-100">결과물 등급 확률</h4>
            <div className="grid grid-cols-2 gap-x-4 text-[11px]">
                <div className="flex justify-between">
                    <span className="text-slate-400">성공:</span>
                    <span className="font-semibold text-emerald-200">{probabilities.successRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-yellow-400">대성공:</span>
                    <span className="font-semibold text-amber-200">{probabilities.greatSuccessRate.toFixed(1)}%</span>
                </div>
            </div>
        </div>
    );
}

interface CombinationViewProps {
    items: (InventoryItem | null)[];
    onRemoveItem: (index: number) => void;
    onAction: (action: ServerAction) => Promise<void>;
    currentUser: UserWithStatus;
    stackedViewport?: boolean;
}

const CombinationView: React.FC<CombinationViewProps> = ({
    items,
    onRemoveItem,
    onAction,
    currentUser,
    stackedViewport = false,
}) => {
    const isMobile = stackedViewport;
    const [isRandom, setIsRandom] = useState(false);

    const handleCombine = () => {
        const itemIds = items.map(i => i?.id).filter((id): id is string => !!id);
        if (itemIds.length === 3) {
            onAction({ type: 'COMBINE_ITEMS', payload: { itemIds, isRandom } });
        }
    };
    
    const canCombine = items.every(item => item !== null) && new Set(items.map(i => i?.grade)).size === 1;

    return (
        <div className={`${isMobile ? 'h-auto' : 'h-full'} flex flex-col items-center ${isMobile ? 'justify-start gap-2' : 'justify-between gap-3'}`}>
            <div className={`w-full ${isMobile ? 'grid grid-cols-3 gap-1' : 'flex justify-around items-stretch gap-2'}`}>
                {items.map((item, index) => (
                    <ItemSlot
                        key={index}
                        item={item}
                        onRemove={() => onRemoveItem(index)}
                        isCompact={isMobile}
                    />
                ))}
            </div>

            <div className={`w-full ${isMobile ? 'space-y-1' : 'space-y-2'}`}>
                <OutcomeProbability items={items} isRandom={isRandom} />
                <GradeProbability items={items} currentUser={currentUser} />
            </div>

            <div className={`w-full ${isMobile ? 'space-y-2' : 'space-y-3'} ${isMobile ? 'mt-1' : 'mt-2'}`}>
                <div className={`flex items-center justify-center gap-2 ${isMobile ? 'text-[10px]' : 'text-xs'} text-slate-300`}>
                    <input 
                        type="checkbox" 
                        id="random-combine" 
                        checked={isRandom} 
                        onChange={(e) => setIsRandom(e.target.checked)} 
                        className={`${isMobile ? 'h-3 w-3' : 'h-4 w-4'} rounded text-accent bg-slate-800 border-slate-600 focus:ring-accent`}
                    />
                    <label htmlFor="random-combine" className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-slate-200`}>완전 랜덤 종류로 받기</label>
                </div>

                <ResourceActionButton onClick={handleCombine} disabled={!canCombine} variant="materials" className={`mx-auto w-auto min-w-[8.5rem] ${isMobile ? 'text-[10px] py-1 px-3' : 'text-sm py-2 px-5'}`}>
                    합성
                </ResourceActionButton>
            </div>
        </div>
    );
};

export default CombinationView;
