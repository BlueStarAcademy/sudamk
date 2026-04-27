import React, { useState, useMemo, useEffect } from 'react';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import { InventoryItem, UserWithStatus } from '../types.js';
import { ItemGrade } from '../types/enums.js';
import { MATERIAL_SELL_PRICES, CONSUMABLE_SELL_PRICES, gradeBackgrounds, gradeStyles } from '../constants/items.js';

interface SellMaterialBulkModalProps {
    item: InventoryItem;
    currentUser: UserWithStatus;
    onClose: () => void;
    onConfirm: (quantity: number) => void;
    isTopmost?: boolean;
}

const SellMaterialBulkModal: React.FC<SellMaterialBulkModalProps> = ({ item, currentUser, onClose, onConfirm, isTopmost }) => {
    const totalQuantity = useMemo(() => {
        return currentUser.inventory
            .filter((i) => i.type === item.type && i.name === item.name)
            .reduce((sum, i) => sum + (i.quantity || 0), 0);
    }, [currentUser.inventory, item.name, item.type]);

    const pricePerUnit =
        item.type === 'consumable'
            ? CONSUMABLE_SELL_PRICES[item.name] ??
              CONSUMABLE_SELL_PRICES[item.name?.replace('골드꾸러미', '골드 꾸러미')] ??
              CONSUMABLE_SELL_PRICES[item.name?.replace('골드 꾸러미', '골드꾸러미')] ??
              0
            : MATERIAL_SELL_PRICES[item.name] || 1;

    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        setQuantity((q) => Math.min(Math.max(1, q), Math.max(1, totalQuantity)));
    }, [totalQuantity]);

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        if (!isNaN(value)) {
            setQuantity(Math.max(1, Math.min(totalQuantity, value)));
        } else {
            setQuantity(1);
        }
    };

    const setPreset = (q: number) => {
        setQuantity(Math.max(1, Math.min(totalQuantity, q)));
    };
    const adjustQuantity = (delta: number) => {
        setQuantity((q) => Math.max(1, Math.min(totalQuantity, q + delta)));
    };

    const totalPrice = pricePerUnit * quantity;
    const isDeleteOnly = pricePerUnit === 0;
    const label = item.type === 'consumable' ? '소모품' : '재료';
    const resolvedGrade = (item.grade ?? ItemGrade.Normal) as ItemGrade;
    const tierBg = gradeBackgrounds[resolvedGrade] ?? gradeBackgrounds[ItemGrade.Normal];
    const tierStyle = gradeStyles[resolvedGrade] ?? gradeStyles[ItemGrade.Normal];
    const isTranscendent = resolvedGrade === ItemGrade.Transcendent;

    return (
        <DraggableWindow
            title={item.type === 'consumable' ? '소모품 일괄 판매' : '재료 일괄 판매'}
            onClose={onClose}
            windowId="sellMaterialBulk"
            isTopmost={isTopmost}
            variant="store"
            initialWidth={460}
            initialHeight={700}
            mobileViewportFit
            mobileViewportMaxHeightVh={98}
            bodyPaddingClassName="p-0 sm:p-0"
        >
            <>
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3 pb-2 text-slate-100 sm:gap-2.5 sm:p-3 sm:pb-2">
                <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/95 via-slate-950/90 to-zinc-950/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-4">
                    <p className="text-center text-xs font-bold tracking-wide text-cyan-200/85 sm:text-[11px] sm:font-semibold sm:uppercase sm:tracking-[0.2em] sm:text-cyan-200/60">
                        일괄 판매
                    </p>
                    <h3 className="mt-1 text-center text-xl font-black leading-snug tracking-tight text-slate-50 sm:mt-1 sm:text-lg">
                        판매할 수량을 정하세요
                    </h3>
                    <p className="mt-1 text-center text-sm text-slate-300 sm:mt-1 sm:text-xs sm:text-slate-400">
                        {label} · 합계{' '}
                        <span className="font-semibold text-slate-100">{totalQuantity.toLocaleString()}</span>개 보유
                    </p>

                    <div className="mt-2 flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-black/25 p-2.5 sm:flex-row sm:items-center sm:gap-3 sm:p-3">
                        <div
                            className={`relative flex h-[6rem] w-[6rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-black/30 sm:h-[6.5rem] sm:w-[6.5rem] ${
                                isTranscendent ? 'transcendent-grade-slot' : ''
                            }`}
                        >
                            <img src={tierBg} alt="" className="absolute inset-0 z-0 h-full w-full object-cover" aria-hidden />
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
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                        {[
                            { label: '1개', q: 1 },
                            { label: '절반', q: Math.max(1, Math.floor(totalQuantity / 2)) },
                            { label: '전부', q: totalQuantity },
                        ].map((p) => (
                            <button
                                key={p.label}
                                type="button"
                                disabled={totalQuantity === 0}
                                onClick={() => setPreset(p.q)}
                                className="min-h-[44px] min-w-[4.5rem] rounded-lg border border-white/10 bg-slate-800/60 px-4 py-2 text-sm font-bold text-slate-200 transition-all hover:border-cyan-400/35 hover:bg-slate-700/70 disabled:opacity-40 sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2.5 rounded-2xl border border-white/[0.07] bg-slate-950/40 p-3 sm:p-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-bold text-slate-300 sm:text-xs sm:uppercase sm:tracking-wider sm:text-slate-500">판매 수량</span>
                        <span className="font-mono text-base font-black tabular-nums text-cyan-100 sm:text-sm">
                            {quantity.toLocaleString()} <span className="text-slate-500">/</span> {totalQuantity.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="range"
                            min={1}
                            max={Math.max(1, totalQuantity)}
                            value={Math.min(quantity, Math.max(1, totalQuantity))}
                            onChange={handleQuantityChange}
                            disabled={totalQuantity === 0}
                            className="h-3 w-full flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 disabled:opacity-40 sm:h-2 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-gradient-to-b [&::-moz-range-thumb]:from-amber-300 [&::-moz-range-thumb]:to-amber-600 [&::-moz-range-thumb]:shadow-[0_0_12px_rgba(251,191,36,0.5)] sm:[&::-moz-range-thumb]:h-4 sm:[&::-moz-range-thumb]:w-4 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-amber-200/80 [&::-webkit-slider-thumb]:bg-gradient-to-b [&::-webkit-slider-thumb]:from-amber-300 [&::-webkit-slider-thumb]:to-amber-600 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(251,191,36,0.45)] sm:[&::-webkit-slider-thumb]:h-4 sm:[&::-webkit-slider-thumb]:w-4"
                        />
                        <div className="flex shrink-0 items-center gap-1">
                            <button
                                type="button"
                                onClick={() => adjustQuantity(-1)}
                                disabled={totalQuantity === 0 || quantity <= 1}
                                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-slate-800/70 text-sm font-black text-slate-100 transition-colors hover:bg-slate-700/80 disabled:opacity-40 sm:h-7 sm:w-7"
                            >
                                -
                            </button>
                            <button
                                type="button"
                                onClick={() => adjustQuantity(1)}
                                disabled={totalQuantity === 0 || quantity >= totalQuantity}
                                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-slate-800/70 text-sm font-black text-slate-100 transition-colors hover:bg-slate-700/80 disabled:opacity-40 sm:h-7 sm:w-7"
                            >
                                +
                            </button>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-950/50 via-yellow-950/35 to-amber-950/50 p-3 shadow-[0_0_32px_-12px_rgba(245,158,11,0.35)] sm:p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <span className="text-sm font-semibold text-slate-300 sm:text-slate-400">개당 판매가</span>
                        <span className={`text-right text-base font-bold tabular-nums sm:text-sm ${isDeleteOnly ? 'text-slate-500' : 'text-amber-200/90'}`}>
                            {isDeleteOnly ? '0 (삭제만)' : `${pricePerUnit.toLocaleString()} 골드`}
                        </span>
                    </div>
                    <div className="mt-2 flex flex-col gap-2 border-t border-amber-500/15 pt-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="flex items-center justify-center gap-2 sm:justify-start">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-900/40 sm:h-9 sm:w-9">
                                <img src="/images/icon/Gold.png" alt="" className="h-7 w-7 object-contain sm:h-6 sm:w-6" />
                            </div>
                            <span className="text-sm font-bold text-amber-200/85 sm:text-xs sm:uppercase sm:tracking-wider sm:text-amber-200/60">
                                {isDeleteOnly ? '합계 (삭제)' : '총 받을 골드'}
                            </span>
                        </div>
                        <span
                            className={`text-center text-2xl font-black tabular-nums sm:text-right sm:text-xl md:text-2xl ${
                                isDeleteOnly ? 'text-slate-500' : 'text-amber-200 [text-shadow:0_0_20px_rgba(251,191,36,0.3)]'
                            }`}
                        >
                            {isDeleteOnly ? '0' : totalPrice.toLocaleString()}
                        </span>
                    </div>
                    {isDeleteOnly && (
                        <p className="mt-2 text-center text-sm text-slate-400 sm:text-[11px] sm:text-slate-500">골드는 들어오지 않고, 선택한 개수만큼만 사라집니다.</p>
                    )}
                </div>
            </div>
                <div className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} flex gap-2 border-t border-white/[0.08] bg-slate-950/95 p-2.5 sm:p-3`}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-[42px] flex-1 rounded-xl border border-white/12 bg-slate-800/70 px-3 py-2.5 text-sm font-bold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-slate-500/40 hover:bg-slate-700/80 active:scale-[0.98]"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={() => onConfirm(quantity)}
                        disabled={quantity === 0 || quantity > totalQuantity || totalQuantity === 0}
                        className="min-h-[42px] flex-1 rounded-xl border border-rose-400/40 bg-gradient-to-b from-rose-500/95 via-rose-600 to-rose-950 px-3 py-2.5 text-sm font-black text-rose-50 shadow-[0_6px_24px_-6px_rgba(244,63,94,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:border-rose-300/50 hover:from-rose-400 hover:via-rose-500 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none active:scale-[0.98]"
                    >
                        {quantity.toLocaleString()}개 판매
                    </button>
                </div>
            </>
        </DraggableWindow>
    );
};

export default SellMaterialBulkModal;
