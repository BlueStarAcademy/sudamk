import React from 'react';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
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
            mobileViewportFit
            mobileViewportMaxHeightVh={92}
            bodyPaddingClassName="p-0 sm:p-0"
        >
            <>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain p-3 pb-2 text-slate-100 sm:p-5 sm:pb-4 [-webkit-overflow-scrolling:touch]">
                <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/95 via-slate-950/90 to-zinc-950/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-4">
                    <p className="text-center text-xs font-bold tracking-wide text-amber-200/90 sm:text-[11px] sm:font-semibold sm:uppercase sm:tracking-[0.2em] sm:text-amber-200/70">
                        판매 확인
                    </p>
                    <h3 className="mt-2 text-center text-xl font-black leading-snug tracking-tight text-slate-50 sm:mt-1 sm:text-lg">
                        이 아이템을 판매할까요?
                    </h3>
                    <p className="mt-2 text-center text-sm leading-relaxed text-slate-300 sm:mt-1 sm:text-xs sm:text-slate-400">
                        확인하면 가방에서 사라지고, 아래 금액만큼 골드를 받습니다.
                    </p>

                    <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-black/25 p-3 sm:mt-5 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
                        <div
                            className={`relative flex h-[7.25rem] w-[7.25rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-black/30 sm:h-[7.25rem] sm:w-[7.25rem] ${
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
                        <div className="min-w-0 w-full flex-1 text-center sm:text-left">
                            <p className={`text-sm font-bold sm:text-xs ${tierStyle.color}`}>[{tierStyle.name}]</p>
                            <p className="mt-0.5 line-clamp-2 text-base font-bold leading-snug text-slate-50 sm:truncate sm:text-base">{item.name}</p>
                            {item.type === 'equipment' && item.stars > 0 && (
                                <p className="mt-1 text-sm font-medium text-amber-200/90 sm:mt-0.5 sm:text-xs sm:text-amber-200/80">강화 {item.stars}성</p>
                            )}
                            {(item.type === 'material' || item.type === 'consumable') && item.quantity != null && (
                                <p className="mt-2 text-sm leading-snug text-slate-300 sm:mt-1 sm:text-xs sm:text-slate-400">
                                    보유{' '}
                                    <span className="font-semibold text-slate-100">{item.quantity.toLocaleString()}</span>개
                                    {item.type === 'material' ? (
                                        <span className="block text-slate-400 sm:inline sm:text-slate-500">이번 판매: 1개만 빠집니다</span>
                                    ) : (
                                        <span className="block text-slate-400 sm:inline sm:text-slate-500">소모품은 전부 판매됩니다</span>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-950/50 via-yellow-950/35 to-amber-950/50 p-3 shadow-[0_0_32px_-12px_rgba(245,158,11,0.35)] sm:p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="flex items-center justify-center gap-3 sm:justify-start">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-900/40 shadow-inner sm:h-10 sm:w-10">
                                <img src="/images/icon/Gold.png" alt="" className="h-8 w-8 object-contain opacity-95 sm:h-7 sm:w-7" />
                            </div>
                            <div className="min-w-0 text-left">
                                <p className="text-xs font-bold text-amber-200/85 sm:text-[10px] sm:uppercase sm:tracking-wider sm:text-amber-200/60">
                                    {isDeleteOnly ? '정산 안내' : '받을 골드'}
                                </p>
                                <p className="text-sm text-amber-100/80 sm:text-xs sm:text-amber-100/50">
                                    {isDeleteOnly ? '골드 0 — 인벤에서만 삭제됩니다' : '판매 후 지급'}
                                </p>
                            </div>
                        </div>
                        <p
                            className={`text-center text-3xl font-black tabular-nums tracking-tight sm:text-right ${
                                isDeleteOnly ? 'text-slate-500' : 'text-amber-200 [text-shadow:0_0_24px_rgba(251,191,36,0.35)]'
                            }`}
                        >
                            {isDeleteOnly ? '0' : sellPrice.toLocaleString()}
                        </p>
                    </div>
                    {isDeleteOnly && (
                        <p className="mt-3 border-t border-amber-500/15 pt-3 text-center text-sm text-slate-400 sm:text-xs sm:text-slate-500">
                            골드는 오르지 않고, 아이템만 사라집니다.
                        </p>
                    )}
                </div>
            </div>
                <div
                    className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} flex gap-3 border-t border-white/[0.08] bg-slate-950/95 p-3 pt-3 sm:p-5`}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-[48px] flex-1 rounded-xl border border-white/12 bg-slate-800/70 px-4 py-3.5 text-base font-bold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-slate-500/40 hover:bg-slate-700/80 active:scale-[0.98] sm:min-h-0 sm:text-sm"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="group min-h-[48px] flex-1 rounded-xl border border-rose-400/40 bg-gradient-to-b from-rose-500/95 via-rose-600 to-rose-950 px-4 py-3.5 text-base font-black text-rose-50 shadow-[0_6px_24px_-6px_rgba(244,63,94,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:border-rose-300/50 hover:from-rose-400 hover:via-rose-500 hover:shadow-[0_8px_28px_-6px_rgba(244,63,94,0.6)] active:scale-[0.98] sm:min-h-0 sm:text-sm"
                    >
                        판매 확정
                    </button>
                </div>
            </>
        </DraggableWindow>
    );
};

export default SellItemConfirmModal;
