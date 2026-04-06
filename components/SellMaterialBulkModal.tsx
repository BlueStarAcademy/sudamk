import React, { useState, useMemo, useEffect } from 'react';
import DraggableWindow from './DraggableWindow.js';
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
            initialHeight={580}
            skipSavedPosition
            hideFooter
        >
            <div className="flex min-h-0 flex-col gap-4 p-4 text-slate-100 sm:p-5">
                <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/95 via-slate-950/90 to-zinc-950/95 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/60">Bulk trade</p>
                    <h3 className="mt-1 text-center text-lg font-black tracking-tight text-slate-50">판매할 수량을 정하세요</h3>
                    <p className="mt-1 text-center text-xs text-slate-400">
                        {label} · 보유 <span className="font-semibold text-slate-200">{totalQuantity.toLocaleString()}</span>개
                    </p>

                    <div className="mt-4 flex items-center gap-4 rounded-xl border border-white/[0.06] bg-black/25 p-3 sm:p-4">
                        <div
                            className={`relative flex h-[6.75rem] w-[6.75rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-black/30 sm:h-[7.25rem] sm:w-[7.25rem] ${
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
                        <div className="min-w-0 flex-1">
                            <p className={`text-xs font-bold ${tierStyle.color}`}>[{tierStyle.name}]</p>
                            <p className="truncate text-base font-bold text-slate-50">{item.name}</p>
                            <p className="mt-1 text-xs text-slate-500">슬라이더 또는 숫자로 조절</p>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-center gap-2">
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
                                className="rounded-lg border border-white/10 bg-slate-800/60 px-3 py-1.5 text-xs font-bold text-slate-200 transition-all hover:border-cyan-400/35 hover:bg-slate-700/70 disabled:opacity-40"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-white/[0.07] bg-slate-950/40 p-4">
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">수량</span>
                        <span className="font-mono text-sm font-black tabular-nums text-cyan-100">
                            {quantity.toLocaleString()} <span className="text-slate-500">/</span> {totalQuantity.toLocaleString()}
                        </span>
                    </div>
                    <input
                        type="range"
                        min={1}
                        max={Math.max(1, totalQuantity)}
                        value={Math.min(quantity, Math.max(1, totalQuantity))}
                        onChange={handleQuantityChange}
                        disabled={totalQuantity === 0}
                        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-800 disabled:opacity-40 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-gradient-to-b [&::-moz-range-thumb]:from-amber-300 [&::-moz-range-thumb]:to-amber-600 [&::-moz-range-thumb]:shadow-[0_0_12px_rgba(251,191,36,0.5)] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-amber-200/80 [&::-webkit-slider-thumb]:bg-gradient-to-b [&::-webkit-slider-thumb]:from-amber-300 [&::-webkit-slider-thumb]:to-amber-600 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(251,191,36,0.45)]"
                    />
                    <input
                        type="number"
                        min={1}
                        max={totalQuantity}
                        value={quantity}
                        onChange={handleQuantityChange}
                        className="w-full rounded-xl border border-white/10 bg-slate-900/80 py-2.5 text-center font-mono text-sm font-bold text-slate-100 shadow-inner outline-none transition-colors focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/20"
                    />
                </div>

                <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-950/50 via-yellow-950/35 to-amber-950/50 p-4 shadow-[0_0_32px_-12px_rgba(245,158,11,0.35)]">
                    <div className="flex justify-between gap-3 text-sm">
                        <span className="text-slate-400">단가</span>
                        <span className={`font-bold tabular-nums ${isDeleteOnly ? 'text-slate-500' : 'text-amber-200/90'}`}>
                            {isDeleteOnly ? '0 (삭제)' : `${pricePerUnit.toLocaleString()} G`}
                        </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-amber-500/15 pt-3">
                        <div className="flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-900/40">
                                <img src="/images/icon/Gold.png" alt="" className="h-6 w-6 object-contain" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-amber-200/60">
                                {isDeleteOnly ? '합계 (삭제)' : '총 골드'}
                            </span>
                        </div>
                        <span
                            className={`text-xl font-black tabular-nums sm:text-2xl ${
                                isDeleteOnly ? 'text-slate-500' : 'text-amber-200 [text-shadow:0_0_20px_rgba(251,191,36,0.3)]'
                            }`}
                        >
                            {isDeleteOnly ? '0' : totalPrice.toLocaleString()}
                        </span>
                    </div>
                    {isDeleteOnly && <p className="mt-2 text-center text-[11px] text-slate-500">0골드 처리로 인벤토리에서 제거됩니다.</p>}
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
                        onClick={() => onConfirm(quantity)}
                        disabled={quantity === 0 || quantity > totalQuantity || totalQuantity === 0}
                        className="flex-1 rounded-xl border border-rose-400/40 bg-gradient-to-b from-rose-500/95 via-rose-600 to-rose-950 px-4 py-3.5 text-sm font-black text-rose-50 shadow-[0_6px_24px_-6px_rgba(244,63,94,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:border-rose-300/50 hover:from-rose-400 hover:via-rose-500 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none active:scale-[0.98]"
                    >
                        {quantity.toLocaleString()}개 판매
                    </button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default SellMaterialBulkModal;
