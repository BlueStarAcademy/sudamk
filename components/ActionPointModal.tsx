import React, { useMemo, useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import UseQuantityModal from './UseQuantityModal.js';
import { UserWithStatus, InventoryItem, ServerAction } from '../types.js';
import { isActionPointConsumable } from '../constants/items.js';
import { ACTION_POINT_PURCHASE_COSTS_DIAMONDS, MAX_ACTION_POINT_PURCHASES_PER_DAY, ACTION_POINT_PURCHASE_REFILL_AMOUNT } from '../constants';

interface ActionPointModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => Promise<unknown> | void;
    isTopmost?: boolean;
}

const ActionPointModal: React.FC<ActionPointModalProps> = ({ currentUser, onClose, onAction, isTopmost }) => {
    const [itemToUse, setItemToUse] = useState<InventoryItem | null>(null);
    const [showUseQuantityModal, setShowUseQuantityModal] = useState(false);

    const actionPointGroups = useMemo(() => {
        const groups: Record<string, { name: string; total: number; sampleItem: InventoryItem }> = {};
        (currentUser.inventory || [])
            .filter(i => i.type === 'consumable' && isActionPointConsumable(i.name))
            .forEach(i => {
                const key = i.name;
                if (!groups[key]) {
                    groups[key] = { name: i.name, total: 0, sampleItem: i };
                }
                groups[key].total += i.quantity || 0;
            });
        return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }, [currentUser.inventory]);

    const now = Date.now();
    const isSameDayKST = (ts1: number, ts2: number): boolean => {
        if (!ts1 || !ts2) return false;
        const KST_OFFSET = 9 * 60 * 60 * 1000;
        const d1 = new Date(ts1 + KST_OFFSET);
        const d2 = new Date(ts2 + KST_OFFSET);
        return d1.getUTCFullYear() === d2.getUTCFullYear() &&
               d1.getUTCMonth() === d2.getUTCMonth() &&
               d1.getUTCDate() === d2.getUTCDate();
    };

    const purchasesToday = isSameDayKST(currentUser.lastActionPointPurchaseDate || 0, now)
        ? (currentUser.actionPointPurchasesToday || 0)
        : 0;
    const costIndex = Math.min(purchasesToday, ACTION_POINT_PURCHASE_COSTS_DIAMONDS.length - 1);
    const currentCost = ACTION_POINT_PURCHASE_COSTS_DIAMONDS[costIndex] ?? ACTION_POINT_PURCHASE_COSTS_DIAMONDS[ACTION_POINT_PURCHASE_COSTS_DIAMONDS.length - 1];
    const canPurchaseByLimit = purchasesToday < MAX_ACTION_POINT_PURCHASES_PER_DAY;
    const diamondBalance = Number(currentUser.diamonds ?? 0);
    const canAfford = Number.isFinite(diamondBalance) && diamondBalance >= currentCost;

    const handleOpenUseQuantity = (sample: InventoryItem) => {
        setItemToUse(sample);
        setShowUseQuantityModal(true);
    };

    const handlePurchaseActionPoints = async () => {
        if (!canPurchaseByLimit || !canAfford) return;
        await onAction({ type: 'PURCHASE_ACTION_POINTS' });
    };

    const renderActionPointValue = (name: string) => {
        const match = name.match(/\+(\d+)/);
        return match ? `+${match[1]}` : '';
    };

    return (
        <>
            <DraggableWindow
                title="행동력 관리"
                windowId="action-point-modal"
                onClose={onClose}
                initialWidth={700}
                initialHeight={520}
                isTopmost={isTopmost}
            >
                <div className="h-full flex flex-col bg-slate-950/90">
                    <div className="p-4 border-b border-slate-700/80 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">⚡</span>
                                <div className="flex flex-col">
                                    <span className="text-sm text-slate-300">현재 행동력</span>
                                    <span className="text-lg font-bold text-cyan-300">
                                        {currentUser.actionPoints ? `${currentUser.actionPoints.current}/${currentUser.actionPoints.max}` : '정보 없음'}
                                    </span>
                                </div>
                            </div>
                            <div className="text-xs text-slate-400 text-right">
                                <p>행동력 회복제 사용 또는 다이아로 즉시 충전할 수 있습니다.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-800/80">
                        <div className="md:w-1/2 p-4 flex flex-col">
                            <h3 className="text-sm font-semibold text-slate-200 mb-2">보유 행동력 회복제</h3>
                            {actionPointGroups.length === 0 ? (
                                <p className="text-xs text-slate-400">가방에 행동력 회복제가 없습니다.</p>
                            ) : (
                                <div className="space-y-2 overflow-y-auto pr-1">
                                    {actionPointGroups.map(group => (
                                        <div
                                            key={group.name}
                                            className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-slate-900/70 border border-slate-700/60"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-10 h-10 rounded-md bg-slate-900/80 flex items-center justify-center">
                                                    <span className="text-2xl">⚡</span>
                                                    <span className="absolute -bottom-1 right-1 text-[10px] font-bold text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]">
                                                        {renderActionPointValue(group.name)}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-semibold text-slate-100">{group.name}</span>
                                                    <span className="text-[11px] text-slate-400">보유: {group.total.toLocaleString()}개</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <Button
                                                    colorScheme="accent"
                                                    className="!px-2 !py-1 text-[11px]"
                                                    onClick={() => handleOpenUseQuantity(group.sampleItem)}
                                                >
                                                    사용하기
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="md:w-1/2 p-4 flex flex-col">
                            <h3 className="text-sm font-semibold text-slate-200 mb-2">다이아로 행동력 충전</h3>
                            <div className="flex-1 flex items-center justify-center">
                                <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1c1f3e]/95 via-[#0f172a]/95 to-[#060b15]/95 border border-cyan-400/30 shadow-[0_25px_60px_-25px_rgba(34,211,238,0.55)] p-5 flex flex-col items-center text-center w-full max-w-xs">
                                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent pointer-events-none" />
                                    <div className="absolute inset-0 opacity-0 pointer-events-none transition-opacity duration-500 group-hover:opacity-20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.3),transparent_55%)]" />
                                    <div className="w-24 h-24 bg-gradient-to-br from-[#14b8a6]/30 via-[#06b6d4]/20 to-transparent rounded-xl mb-4 flex items-center justify-center relative">
                                        <span className="text-5xl text-cyan-300 drop-shadow-[0_0_18px_rgba(14,165,233,0.35)]">⚡</span>
                                        <span className="absolute bottom-2 right-2 text-2xl font-bold text-cyan-200 drop-shadow-[0_0_8px_rgba(14,165,233,0.5)]">
                                            {ACTION_POINT_PURCHASE_REFILL_AMOUNT}
                                        </span>
                                    </div>
                                    <h4 className="text-base font-bold tracking-wide text-white drop-shadow-lg">행동력 충전</h4>
                                    <p className="text-xs text-slate-200/85 mt-1 leading-relaxed flex-grow">
                                        최대치를 초과해서도 바로 충전됩니다.
                                    </p>
                                    <div className="mt-3 flex flex-col items-center justify-center gap-1 w-full">
                                        <Button
                                            onClick={handlePurchaseActionPoints}
                                            disabled={!canPurchaseByLimit || !canAfford}
                                            colorScheme="none"
                                            className={`w-full justify-center rounded-xl border border-cyan-400/60 bg-gradient-to-r from-cyan-400/90 via-sky-400/90 to-blue-500/90 text-slate-900 font-semibold tracking-wide shadow-[0_10px_30px_-12px_rgba(14,165,233,0.65)] hover:from-cyan-300 hover:to-blue-400 ${canPurchaseByLimit && canAfford ? '' : 'opacity-50 cursor-not-allowed'}`}
                                        >
                                            <div className="flex flex-col items-center justify-center gap-0.5">
                                                <div className="flex items-center justify-center gap-2 text-sm">
                                                    <img src="/images/icon/Zem.png" alt="다이아" className="w-5 h-5 drop-shadow-md" />
                                                    <span>{currentCost.toLocaleString()}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-700/90 tracking-wide">
                                                    오늘 구매 {purchasesToday}/{MAX_ACTION_POINT_PURCHASES_PER_DAY}
                                                </span>
                                            </div>
                                        </Button>
                                        {!canPurchaseByLimit && (
                                            <span className="text-[11px] text-cyan-100/80 italic mt-1">오늘 구매 한도에 도달했습니다.</span>
                                        )}
                                        {canPurchaseByLimit && !canAfford && (
                                            <span className="text-[11px] text-rose-200/90 mt-1">다이아가 부족합니다.</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </DraggableWindow>

            {showUseQuantityModal && itemToUse && (
                <UseQuantityModal
                    item={itemToUse}
                    currentUser={currentUser}
                    onClose={() => {
                        setShowUseQuantityModal(false);
                        setItemToUse(null);
                    }}
                    onConfirm={async (itemId, quantity, itemName) => {
                        try {
                            await onAction({ type: 'USE_ITEM', payload: { itemId, quantity, itemName } });
                        } catch (error) {
                            console.error('[ActionPointModal] Failed to use item:', error);
                        } finally {
                            setShowUseQuantityModal(false);
                            setItemToUse(null);
                        }
                    }}
                    isTopmost={!!isTopmost}
                />
            )}
        </>
    );
};

export default ActionPointModal;

