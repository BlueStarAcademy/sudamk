import React from 'react';
import DraggableWindow from './DraggableWindow.js';
import { InventoryItem } from '../types.js';
import { ItemGrade } from '../types/enums.js';
import {
    ITEM_SELL_PRICES,
    MATERIAL_SELL_PRICES,
    CONSUMABLE_SELL_PRICES,
    gradeBackgrounds,
    gradeStyles,
} from '../constants/items.js';

interface SellItemConfirmModalProps {
    item: InventoryItem;
    onClose: () => void;
    onConfirm: () => void;
    isTopmost?: boolean;
}

const SellItemConfirmModal: React.FC<SellItemConfirmModalProps> = ({ item, onClose, onConfirm, isTopmost }) => {
    const calculateSellPrice = (): number => {
        if (item.type === 'equipment') {
            const basePrice = ITEM_SELL_PRICES[item.grade] || 0;
            const enhancementMultiplier = Math.pow(1.2, item.stars);
            return Math.floor(basePrice * enhancementMultiplier);
        } else if (item.type === 'material') {
            const pricePerUnit = MATERIAL_SELL_PRICES[item.name] || 1;
            return pricePerUnit;
        } else if (item.type === 'consumable') {
            const pricePerUnit =
                CONSUMABLE_SELL_PRICES[item.name] ??
                CONSUMABLE_SELL_PRICES[item.name?.replace('골드꾸러미', '골드 꾸러미')] ??
                CONSUMABLE_SELL_PRICES[item.name?.replace('골드 꾸러미', '골드꾸러미')] ??
                0;
            const quantity = item.quantity || 1;
            return pricePerUnit * quantity;
        }
        return 0;
    };

    const sellPrice = calculateSellPrice();
    const isDeleteOnly = sellPrice === 0;
    const resolvedGrade = (item.grade ?? ItemGrade.Normal) as ItemGrade;
    const tierBg = gradeBackgrounds[resolvedGrade] ?? gradeBackgrounds[ItemGrade.Normal];
    const tierStyle = gradeStyles[resolvedGrade] ?? gradeStyles[ItemGrade.Normal];
    const isTranscendent = resolvedGrade === ItemGrade.Transcendent;

    return (
        <DraggableWindow
            title="아이템 판매"
            onClose={onClose}
            windowId="sellItemConfirm"
            isTopmost={isTopmost}
            variant="store"
            initialWidth={440}
            initialHeight={520}
            skipSavedPosition
            hideFooter
        >
            <div className="flex min-h-0 flex-col gap-4 p-4 text-slate-100 sm:p-5">
                <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/95 via-slate-950/90 to-zinc-950/95 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200/70">Trade confirm</p>
                    <h3 className="mt-1 text-center text-lg font-black tracking-tight text-slate-50">이 아이템을 판매할까요?</h3>
                    <p className="mt-1 text-center text-xs leading-relaxed text-slate-400">확인 시 가방에서 제거되며 골드로 정산됩니다.</p>

                    <div className="mt-5 flex items-center gap-4 rounded-xl border border-white/[0.06] bg-black/25 p-3 sm:p-4">
                        <div
                            className={`relative flex h-[6.75rem] w-[6.75rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-black/30 sm:h-[7.25rem] sm:w-[7.25rem] ${
                                isTranscendent ? 'transcendent-grade-slot' : ''
                            }`}
                        >
                            <img
                                src={tierBg}
                                alt=""
                                className="absolute inset-0 z-0 h-full w-full object-cover"
                                aria-hidden
                            />
                            {item.image ? (
                                <img
                                    src={item.image}
                                    alt=""
                                    className="relative z-[1] m-auto max-h-[72%] max-w-[72%] object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.75)]"
                                />
                            ) : (
                                <span className="relative z-[1] m-auto text-2xl opacity-50" aria-hidden>
                                    ?
                                </span>
                            )}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                            <p className={`text-xs font-bold ${tierStyle.color}`}>[{tierStyle.name}]</p>
                            <p className="truncate text-base font-bold text-slate-50">{item.name}</p>
                            {item.type === 'equipment' && item.stars > 0 && (
                                <p className="mt-0.5 text-xs font-medium text-amber-200/80">강화 {item.stars}성</p>
                            )}
                            {(item.type === 'material' || item.type === 'consumable') && item.quantity != null && (
                                <p className="mt-1 text-xs text-slate-400">
                                    보유 <span className="font-semibold text-slate-200">{item.quantity.toLocaleString()}</span>개
                                    {item.type === 'material' ? (
                                        <span className="text-slate-500"> · 이번에 1개</span>
                                    ) : (
                                        <span className="text-slate-500"> · 전량</span>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-950/50 via-yellow-950/35 to-amber-950/50 p-4 shadow-[0_0_32px_-12px_rgba(245,158,11,0.35)]">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-900/40 shadow-inner">
                                <img src="/images/icon/Gold.png" alt="" className="h-7 w-7 object-contain opacity-95" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/60">
                                    {isDeleteOnly ? '정산' : '예상 수령'}
                                </p>
                                <p className="text-xs text-amber-100/50">{isDeleteOnly ? '골드 없음 (삭제)' : '골드'}</p>
                            </div>
                        </div>
                        <p
                            className={`text-right text-2xl font-black tabular-nums tracking-tight sm:text-3xl ${
                                isDeleteOnly ? 'text-slate-500' : 'text-amber-200 [text-shadow:0_0_24px_rgba(251,191,36,0.35)]'
                            }`}
                        >
                            {isDeleteOnly ? '0' : sellPrice.toLocaleString()}
                        </p>
                    </div>
                    {isDeleteOnly && (
                        <p className="mt-3 border-t border-amber-500/15 pt-3 text-center text-xs text-slate-500">이 아이템은 0골드로 처리·삭제됩니다.</p>
                    )}
                </div>

                <div className="mt-auto flex gap-3 pt-1">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-xl border border-white/12 bg-slate-800/70 px-4 py-3.5 text-sm font-bold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-slate-500/40 hover:bg-slate-700/80 active:scale-[0.98]"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="group flex-1 rounded-xl border border-rose-400/40 bg-gradient-to-b from-rose-500/95 via-rose-600 to-rose-950 px-4 py-3.5 text-sm font-black text-rose-50 shadow-[0_6px_24px_-6px_rgba(244,63,94,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:border-rose-300/50 hover:from-rose-400 hover:via-rose-500 hover:shadow-[0_8px_28px_-6px_rgba(244,63,94,0.6)] active:scale-[0.98]"
                    >
                        판매 확정
                    </button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default SellItemConfirmModal;
