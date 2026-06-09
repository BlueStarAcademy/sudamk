import React, { useMemo, useState } from 'react';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import UseQuantityModal from './UseQuantityModal.js';
import { UserWithStatus, InventoryItem, ServerAction } from '../types.js';
import { isActionPointConsumable } from '../constants/items.js';
import { ACTION_POINT_PURCHASE_COSTS_DIAMONDS, MAX_ACTION_POINT_PURCHASES_PER_DAY, ACTION_POINT_PURCHASE_REFILL_AMOUNT } from '../constants';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';

interface ActionPointModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => Promise<unknown> | void;
    isTopmost?: boolean;
    embedded?: boolean;
}

const ActionPointModal: React.FC<ActionPointModalProps> = ({ currentUser, onClose, onAction, isTopmost, embedded = false }) => {
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

    const actionPointBody = (
                <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-950/90">
                    <div className="shrink-0 border-b border-slate-700/80 p-3 sm:p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 text-2xl">⚡</span>
                                <div className="min-w-0 flex flex-col">
                                    <span className="text-xs text-slate-400 sm:text-sm sm:text-slate-300">현재 행동력</span>
                                    <span className="text-base font-bold text-cyan-300 sm:text-lg">
                                        {currentUser.actionPoints ? `${currentUser.actionPoints.current}/${currentUser.actionPoints.max}` : '정보 없음'}
                                    </span>
                                </div>
                            </div>
                            <p className="max-w-[min(100%,20rem)] shrink-0 text-right text-[11px] leading-snug text-slate-400 sm:text-xs">
                                회복제 사용 또는 다이아로 즉시 충전할 수 있습니다.
                            </p>
                        </div>
                    </div>

                    <div className="flex min-h-0 flex-1 flex-col divide-y divide-slate-800/80 overflow-hidden md:flex-row md:divide-x md:divide-y-0">
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4 md:w-1/2">
                            <h3 className="mb-2 shrink-0 text-sm font-semibold text-slate-200">보유 행동력 회복제</h3>
                            {actionPointGroups.length === 0 ? (
                                <p className="text-xs text-slate-400">가방에 행동력 회복제가 없습니다.</p>
                            ) : (
                                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-600/80">
                                    {actionPointGroups.map(group => (
                                        <div
                                            key={group.name}
                                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-700/60 bg-slate-900/70 px-2.5 py-2 sm:gap-3 sm:px-3"
                                        >
                                            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                                                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-900/80 sm:h-10 sm:w-10">
                                                    <span className="text-xl sm:text-2xl">⚡</span>
                                                    <span className="absolute -bottom-0.5 right-0.5 text-[9px] font-bold text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.8)] sm:text-[10px]">
                                                        {renderActionPointValue(group.name)}
                                                    </span>
                                                </div>
                                                <div className="min-w-0 flex flex-col">
                                                    <span className="truncate text-[11px] font-semibold text-slate-100 sm:text-xs">{group.name}</span>
                                                    <span className="text-[10px] text-slate-400 sm:text-[11px]">보유: {group.total.toLocaleString()}개</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenUseQuantity(group.sampleItem)}
                                                className="group relative shrink-0 overflow-hidden rounded-lg border border-cyan-400/40 bg-gradient-to-b from-cyan-500/30 via-cyan-600/12 to-slate-950/90 px-2.5 py-1.5 text-[10px] font-semibold tracking-wide text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_6px_18px_-8px_rgba(34,211,238,0.5)] transition-[transform,box-shadow,border-color] hover:border-cyan-300/55 hover:from-cyan-400/40 hover:shadow-[0_10px_26px_-10px_rgba(34,211,238,0.55)] active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45 sm:px-3 sm:text-[11px]"
                                            >
                                                <span className="relative z-10">사용하기</span>
                                                <span
                                                    className="pointer-events-none absolute inset-0 translate-x-[-100%] bg-gradient-to-r from-transparent via-white/18 to-transparent opacity-0 transition-[transform,opacity] duration-500 group-hover:translate-x-[100%] group-hover:opacity-100"
                                                    aria-hidden
                                                />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4 md:w-1/2">
                            <h3 className="mb-2 shrink-0 text-sm font-semibold text-slate-200">다이아로 행동력 충전</h3>
                            <div className="flex min-h-0 flex-1 items-center justify-center py-1">
                                <div className="group relative flex w-full max-w-xs flex-col items-center overflow-hidden rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-[#1c1f3e]/95 via-[#0f172a]/95 to-[#060b15]/95 p-4 text-center shadow-[0_25px_60px_-25px_rgba(34,211,238,0.55)] sm:p-5">
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
                                    <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.3),transparent_55%)]" />
                                    <div className="relative mb-3 flex h-20 w-20 items-center justify-center rounded-xl bg-gradient-to-br from-[#14b8a6]/30 via-[#06b6d4]/20 to-transparent sm:mb-4 sm:h-24 sm:w-24">
                                        <span className="text-4xl text-cyan-300 drop-shadow-[0_0_18px_rgba(14,165,233,0.35)] sm:text-5xl">⚡</span>
                                        <span className="absolute bottom-1.5 right-1.5 text-xl font-bold text-cyan-200 drop-shadow-[0_0_8px_rgba(14,165,233,0.5)] sm:bottom-2 sm:right-2 sm:text-2xl">
                                            {ACTION_POINT_PURCHASE_REFILL_AMOUNT}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-bold tracking-wide text-white drop-shadow-lg sm:text-base">행동력 충전</h4>
                                    <p className="mt-1 shrink-0 text-[11px] leading-relaxed text-slate-200/85 sm:text-xs">
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
                                                    <img src="/images/icon/Zem.webp" alt="다이아" className="w-5 h-5 drop-shadow-md" />
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
    );

    const quantityModal = showUseQuantityModal && itemToUse ? (
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
    ) : null;

    if (embedded) {
        return (
            <>
                <div className={PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS}>{actionPointBody}</div>
                {quantityModal}
            </>
        );
    }

    return (
        <>
            <DraggableWindow
                title="행동력 관리"
                windowId="action-point-modal"
                onClose={onClose}
                initialWidth={700}
                initialHeight={500}
                isTopmost={isTopmost}
                hideFooter
                bodyNoScroll
            >
                {actionPointBody}
            </DraggableWindow>
            {quantityModal}
        </>
    );
};

export default ActionPointModal;

