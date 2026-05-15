import React, { useState, useMemo, useEffect, useCallback } from 'react';
import DraggableWindow, { SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS } from './DraggableWindow.js';
import { InventoryItem, UserWithStatus } from '../types.js';
import { ItemGrade } from '../types/enums.js';
import { isActionPointConsumable, gradeBackgrounds, gradeStyles } from '../constants/items.js';
import { inventoryStacksMatchConsumableBulkAnchor } from '../utils/itemTemplateLookup.js';
import { resolveCurrencyBundleConsumableKey } from '../shared/utils/currencyBundleConsumable.js';
import { MAX_GAME_INTEGER_INPUT } from '../shared/constants/numericLimits.js';
import { clampGameInt } from '../shared/utils/gameIntegerField.js';

interface UseQuantityModalProps {
    item: InventoryItem;
    currentUser: UserWithStatus;
    onClose: () => void;
    onConfirm: (itemId: string, quantity: number, itemName?: string) => Promise<void> | void;
    isTopmost?: boolean;
    /** 가방 등 부모가 `viewportPortal`일 때 동일 타깃에 두어 z-index·캔버스 밖 렌더 불일치 방지 */
    viewportPortal?: boolean;
}

function readViewportShort(): boolean {
    if (typeof window === 'undefined') return false;
    const vv = window.visualViewport;
    const h = vv?.height ?? window.innerHeight;
    const w = vv?.width ?? window.innerWidth;
    /** 짧은 창·좁은 창·작은 면적에서 컴팩트 UI */
    return h < 720 || w < 440 || Math.min(h, w) < 520;
}

/** 슬라이더 트랙·썸 — `dense`일 때 더 낮은 트랙·작은 썸 */
function useQuantityRangeClass(dense: boolean): string {
    if (dense) {
        return 'h-2 w-full flex-1 cursor-pointer appearance-none rounded-full bg-slate-800/90 disabled:opacity-40 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-gradient-to-b [&::-moz-range-thumb]:from-violet-300 [&::-moz-range-thumb]:to-violet-600 [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(167,139,250,0.45)] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-200/85 [&::-webkit-slider-thumb]:bg-gradient-to-b [&::-webkit-slider-thumb]:from-violet-300 [&::-webkit-slider-thumb]:to-violet-600 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(167,139,250,0.45)]';
    }
    return 'h-2.5 w-full flex-1 cursor-pointer appearance-none rounded-full bg-slate-800/90 disabled:opacity-40 sm:h-2 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-gradient-to-b [&::-moz-range-thumb]:from-violet-300 [&::-moz-range-thumb]:to-violet-600 [&::-moz-range-thumb]:shadow-[0_0_12px_rgba(167,139,250,0.5)] sm:[&::-moz-range-thumb]:h-4 sm:[&::-moz-range-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-200/85 [&::-webkit-slider-thumb]:bg-gradient-to-b [&::-webkit-slider-thumb]:from-violet-300 [&::-webkit-slider-thumb]:to-violet-600 [&::-webkit-slider-thumb]:shadow-[0_0_12px_rgba(167,139,250,0.45)] sm:[&::-webkit-slider-thumb]:h-4 sm:[&::-webkit-slider-thumb]:w-4';
}

const UseQuantityModal: React.FC<UseQuantityModalProps> = ({ item, currentUser, onClose, onConfirm, isTopmost, viewportPortal }) => {
    const [denseUi, setDenseUi] = useState(readViewportShort);

    useEffect(() => {
        const sync = () => setDenseUi(readViewportShort());
        sync();
        window.addEventListener('resize', sync);
        window.addEventListener('orientationchange', sync);
        window.visualViewport?.addEventListener('resize', sync);
        return () => {
            window.removeEventListener('resize', sync);
            window.removeEventListener('orientationchange', sync);
            window.visualViewport?.removeEventListener('resize', sync);
        };
    }, []);

    const bundleKey = useMemo(() => resolveCurrencyBundleConsumableKey(item.name), [item.name]);

    const totalQuantity = useMemo(() => {
        if (bundleKey) {
            return currentUser.inventory
                .filter(i => i.type === 'consumable' && resolveCurrencyBundleConsumableKey(i.name) === bundleKey)
                .reduce((sum, i) => sum + (i.quantity || 1), 0);
        }
        return currentUser.inventory
            .filter((i) => i && inventoryStacksMatchConsumableBulkAnchor(item.name, i))
            .reduce((sum, i) => sum + (i.quantity || 1), 0);
    }, [currentUser.inventory, item.name, bundleKey]);

    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        setQuantity(q => {
            if (totalQuantity === 0) return 0;
            if (q > totalQuantity) return totalQuantity;
            if (q < 1) return 1;
            return q;
        });
    }, [totalQuantity]);

    const setPreset = useCallback(
        (q: number) => {
            setQuantity(Math.max(1, Math.min(totalQuantity, q)));
        },
        [totalQuantity]
    );

    const adjustQuantity = useCallback(
        (delta: number) => {
            setQuantity(q => Math.max(1, Math.min(totalQuantity, q + delta)));
        },
        [totalQuantity]
    );

    const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === '') {
            setQuantity(0);
            return;
        }
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
            const cap = Math.min(totalQuantity, MAX_GAME_INTEGER_INPUT);
            setQuantity(Math.max(1, Math.min(cap, numValue)));
        } else {
            setQuantity(1);
        }
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuantity(Number(e.target.value));
    };

    const handleQuantityBlur = () => {
        if (quantity < 1) setQuantity(1);
        else if (quantity > totalQuantity) setQuantity(totalQuantity);
    };

    const isActionPoint = isActionPointConsumable(item.name);
    const showImage = isActionPoint || item.image;

    const resolvedGrade = (item.grade ?? ItemGrade.Normal) as ItemGrade;
    const tierBg = gradeBackgrounds[resolvedGrade] ?? gradeBackgrounds[ItemGrade.Normal];
    const tierStyle = gradeStyles[resolvedGrade] ?? gradeStyles[ItemGrade.Normal];
    const isTranscendent = resolvedGrade === ItemGrade.Transcendent;

    const safeMax = Math.max(1, totalQuantity);
    const sliderValue = Math.min(quantity, safeMax);

    const d = denseUi;
    const rangeClass = useQuantityRangeClass(d);
    const padMain = d ? 'p-2 pb-1.5 gap-1.5' : 'p-2.5 pb-2 gap-2 sm:gap-2.5 sm:p-3 sm:pb-2.5';
    const padCard = d ? 'p-2 rounded-xl' : 'p-2.5 rounded-2xl sm:p-3';
    const slotBox = d
        ? `relative flex h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/30 ${isTranscendent ? 'transcendent-grade-slot' : ''}`
        : `relative flex h-[4.75rem] w-[4.75rem] shrink-0 overflow-hidden rounded-xl ring-1 ring-black/30 sm:h-[5.5rem] sm:w-[5.5rem] ${isTranscendent ? 'transcendent-grade-slot' : ''}`;

    return (
        <DraggableWindow
            title="일괄 사용"
            onClose={onClose}
            windowId="useQuantity"
            isTopmost={isTopmost}
            variant="store"
            initialWidth={400}
            shrinkHeightToContent
            mobileViewportFit
            mobileViewportMaxHeightVh={92}
            bodyPaddingClassName="p-0 sm:p-0"
            hideFooter
            viewportPortal={viewportPortal}
        >
            <>
                <div className={`flex flex-col text-slate-100 ${padMain}`}>
                    <div className={`border border-white/[0.08] bg-gradient-to-br from-slate-900/95 via-slate-950/90 to-zinc-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${padCard}`}>
                        <p
                            className={`text-center font-bold tracking-wide text-violet-200/90 ${d ? 'text-[10px]' : 'text-xs sm:text-[11px] sm:font-semibold sm:uppercase sm:tracking-[0.2em] sm:text-violet-200/70'}`}
                        >
                            소모품 사용
                        </p>
                        <h3
                            className={`mt-0.5 text-center font-black leading-tight tracking-tight text-slate-50 ${d ? 'text-sm' : 'text-base sm:text-lg'}`}
                        >
                            한 번에 사용할 개수를 정하세요
                        </h3>
                        <p className={`mt-0.5 text-center leading-snug text-slate-300 ${d ? 'text-[11px]' : 'text-xs sm:text-slate-400'}`}>
                            합계 <span className="font-semibold text-slate-100">{totalQuantity.toLocaleString()}</span>개 보유
                        </p>

                        <div
                            className={`mt-2 flex flex-col items-center rounded-lg border border-white/[0.06] bg-black/25 ${d ? 'gap-1.5 p-1.5' : 'gap-2.5 p-2.5 sm:mt-2.5 sm:flex-row sm:items-center sm:gap-3 sm:p-3'}`}
                        >
                            <div className={slotBox}>
                                <img src={tierBg} alt="" className="absolute inset-0 z-0 h-full w-full object-cover" aria-hidden />
                                {showImage ? (
                                    isActionPoint ? (
                                        <div className="relative z-[1] m-auto flex flex-col items-center justify-center text-amber-300">
                                            <span className={`leading-none ${d ? 'text-xl' : 'text-2xl sm:text-2xl'}`} aria-hidden>
                                                ⚡
                                            </span>
                                            <span className={`font-bold text-amber-200 ${d ? 'mt-0 text-[10px]' : 'mt-0.5 text-xs sm:text-[11px]'}`}>
                                                +{item.name.replace(/.*\(\+(\d+)\)/, '$1')}
                                            </span>
                                        </div>
                                    ) : (
                                        <img
                                            src={item.image!}
                                            alt=""
                                            className="relative z-[1] m-auto max-h-[70%] max-w-[70%] object-contain drop-shadow-[0_4px_14px_rgba(0,0,0,0.75)]"
                                        />
                                    )
                                ) : (
                                    <span className={`relative z-[1] m-auto opacity-50 ${d ? 'text-lg' : 'text-xl'}`} aria-hidden>
                                        ?
                                    </span>
                                )}
                            </div>
                            <div className={`min-w-0 w-full flex-1 text-center ${d ? '' : 'sm:text-left'}`}>
                                <p className={`font-bold ${tierStyle.color} ${d ? 'text-[11px]' : 'text-xs sm:text-xs'}`}>[{tierStyle.name}]</p>
                                <p className={`mt-0.5 line-clamp-2 font-bold leading-snug text-slate-50 ${d ? 'text-xs' : 'text-sm sm:text-base'}`}>{item.name}</p>
                            </div>
                        </div>

                        <div className={`mt-2 flex min-w-0 flex-wrap justify-center ${d ? 'gap-1.5' : 'gap-2'}`}>
                            {[
                                { label: '1개', q: 1 },
                                { label: '절반', q: Math.max(1, Math.floor(totalQuantity / 2)) },
                                { label: '전부', q: totalQuantity },
                            ].map(p => (
                                <button
                                    key={p.label}
                                    type="button"
                                    disabled={totalQuantity === 0}
                                    onClick={() => setPreset(p.q)}
                                    className={`shrink-0 rounded-lg border border-white/10 bg-slate-800/60 font-bold text-slate-200 transition-all hover:border-violet-400/40 hover:bg-slate-700/70 disabled:opacity-40 ${
                                        d
                                            ? 'min-h-9 min-w-[3.25rem] px-2.5 py-1 text-[11px]'
                                            : 'min-h-10 min-w-[3.75rem] px-2.5 py-1.5 text-xs sm:min-h-0 sm:min-w-[4rem] sm:px-3 sm:py-1.5 sm:text-xs'
                                    }`}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div
                        className={`relative overflow-hidden rounded-xl border border-violet-500/20 bg-gradient-to-br from-violet-950/35 via-slate-950/55 to-fuchsia-950/25 shadow-[0_0_40px_-18px_rgba(167,139,250,0.45)] ${d ? 'p-2' : 'p-2.5 sm:p-3'}`}
                    >
                        <div
                            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(167,139,250,0.18),transparent_55%)]"
                            aria-hidden
                        />
                        <div className={d ? 'relative space-y-2' : 'relative space-y-2.5 sm:space-y-3'}>
                            <div className="flex items-baseline justify-between gap-2">
                                <span
                                    className={`font-bold uppercase tracking-wider text-violet-200/80 ${d ? 'text-[10px]' : 'text-xs sm:text-violet-200/65'}`}
                                >
                                    사용 수량
                                </span>
                                <span className={`font-mono font-black tabular-nums text-violet-100 ${d ? 'text-xs' : 'text-sm sm:text-sm'}`}>
                                    {quantity.toLocaleString()} <span className="text-slate-500">/</span> {totalQuantity.toLocaleString()}
                                </span>
                            </div>

                            <div className={`flex flex-col items-stretch ${d ? 'gap-2' : 'gap-2.5 sm:flex-row sm:items-center sm:gap-3'}`}>
                                <div className="flex flex-1 items-center gap-1.5 sm:gap-2">
                                    <input
                                        type="range"
                                        min={1}
                                        max={safeMax}
                                        value={sliderValue}
                                        onChange={handleSliderChange}
                                        onMouseDown={e => e.stopPropagation()}
                                        onClick={e => e.stopPropagation()}
                                        disabled={totalQuantity === 0}
                                        className={rangeClass}
                                    />
                                    <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                                        <button
                                            type="button"
                                            onClick={() => adjustQuantity(-1)}
                                            disabled={totalQuantity === 0 || quantity <= 1}
                                            className={`flex items-center justify-center rounded-lg border border-violet-400/25 bg-slate-900/70 font-black text-violet-100 shadow-inner transition-colors hover:border-violet-300/45 hover:bg-slate-800/90 disabled:opacity-40 ${
                                                d ? 'h-8 w-8 text-sm' : 'h-8 w-8 text-sm sm:h-8 sm:w-8'
                                            }`}
                                        >
                                            −
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => adjustQuantity(1)}
                                            disabled={totalQuantity === 0 || quantity >= totalQuantity}
                                            className={`flex items-center justify-center rounded-lg border border-violet-400/25 bg-slate-900/70 font-black text-violet-100 shadow-inner transition-colors hover:border-violet-300/45 hover:bg-slate-800/90 disabled:opacity-40 ${
                                                d ? 'h-8 w-8 text-sm' : 'h-8 w-8 text-sm sm:h-8 sm:w-8'
                                            }`}
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>

                                <div className={`flex items-center justify-center ${d ? '' : 'sm:w-[7.5rem] sm:shrink-0'}`}>
                                    <input
                                        type="number"
                                        min={1}
                                        max={Math.min(totalQuantity, MAX_GAME_INTEGER_INPUT)}
                                        value={quantity || ''}
                                        onChange={handleQuantityChange}
                                        onBlur={handleQuantityBlur}
                                        onMouseDown={e => e.stopPropagation()}
                                        onClick={e => e.stopPropagation()}
                                        onFocus={e => e.stopPropagation()}
                                        className={`w-full max-w-[7.5rem] rounded-lg border border-violet-400/30 bg-slate-950/70 text-center font-mono font-black tabular-nums text-white shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)] outline-none ring-0 transition-[border-color,box-shadow] focus:border-violet-400/55 focus:shadow-[0_0_0_3px_rgba(167,139,250,0.22)] ${
                                            d ? 'h-9 text-sm' : 'h-10 text-base sm:h-10 sm:text-base'
                                        }`}
                                    />
                                </div>
                            </div>

                            <div className={`flex justify-between border-t border-violet-400/15 text-slate-400 ${d ? 'pt-1 text-[10px]' : 'pt-2 text-xs'}`}>
                                <span>1개</span>
                                <span>{totalQuantity.toLocaleString()}개</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div
                    className={`${SUDAMR_MOBILE_MODAL_STICKY_FOOTER_CLASS} flex gap-2 border-t border-white/[0.08] bg-slate-950/95 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] ${d ? 'p-2' : 'p-2.5 sm:gap-3 sm:p-3 sm:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]'}`}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className={`flex-1 rounded-xl border border-white/12 bg-slate-800/70 font-bold text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-slate-500/40 hover:bg-slate-700/80 active:scale-[0.98] ${
                            d ? 'min-h-10 px-2 py-2 text-xs' : 'min-h-11 px-3 py-2 text-sm sm:min-h-0 sm:py-2.5'
                        }`}
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={async () => {
                            if (quantity > 0 && quantity <= totalQuantity) {
                                try {
                                    await onConfirm(item.id, quantity, item.name);
                                } catch (err) {
                                    console.error('[UseQuantityModal] Failed to confirm:', err);
                                }
                                onClose();
                            }
                        }}
                        disabled={quantity === 0 || quantity > totalQuantity || totalQuantity === 0}
                        className={`flex-1 rounded-xl border border-violet-400/45 bg-gradient-to-b from-violet-500/95 via-violet-600 to-violet-950 font-black text-white shadow-[0_6px_24px_-6px_rgba(139,92,246,0.55),inset_0_1px_0_rgba(255,255,255,0.15)] transition-all hover:border-violet-300/55 hover:from-violet-400 hover:via-violet-500 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none active:scale-[0.98] ${
                            d ? 'min-h-10 px-2 py-2 text-xs' : 'min-h-11 px-3 py-2 text-sm sm:min-h-0 sm:py-2.5'
                        }`}
                    >
                        {quantity.toLocaleString()}개 사용
                    </button>
                </div>
            </>
        </DraggableWindow>
    );
};

export default UseQuantityModal;
