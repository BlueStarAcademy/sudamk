import React, { useEffect } from 'react';
import DraggableWindow, {
    ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS,
    ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS,
} from './DraggableWindow.js';
import { InventoryItem } from '../types.js';
import { ItemGrade } from '../types/enums.js';
import { audioService } from '../services/audioService.js';
import { GRADE_LEVEL_REQUIREMENTS, MATERIAL_ITEMS, isActionPointConsumable } from '../constants/items';
import {
    ITEM_OBTAIN_UNDER_ICON_AMOUNT_AMBER,
    ITEM_OBTAIN_UNDER_ICON_AMOUNT_SKY,
    ITEM_OBTAIN_UNDER_ICON_AMOUNT_SLATE,
    RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS,
    RESULT_MODAL_BOX_GOLD_CLASS,
    RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS,
} from './game/ResultModalRewardSlot.js';

interface BulkItemObtainedModalProps {
    items: InventoryItem[];
    onClose: () => void;
    isTopmost?: boolean;
    tournamentScoreChange?: { oldScore: number; newScore: number; scoreReward: number } | null;
}

const gradeStyles: Record<ItemGrade, { bg: string, text: string, shadow: string, name: string, background: string }> = {
    normal: { bg: 'bg-gray-700', text: 'text-white', shadow: 'shadow-gray-900/50', name: '일반', background: '/images/equipments/normalbgi.png' },
    uncommon: { bg: 'bg-green-700', text: 'text-green-200', shadow: 'shadow-green-500/50', name: '고급', background: '/images/equipments/uncommonbgi.png' },
    rare: { bg: 'bg-blue-700', text: 'text-blue-200', shadow: 'shadow-blue-500/50', name: '희귀', background: '/images/equipments/rarebgi.png' },
    epic: { bg: 'bg-purple-700', text: 'text-purple-200', shadow: 'shadow-purple-500/50', name: '에픽', background: '/images/equipments/epicbgi.png' },
    legendary: { bg: 'bg-red-800', text: 'text-red-200', shadow: 'shadow-red-500/50', name: '전설', background: '/images/equipments/legendarybgi.png' },
    mythic: { bg: 'bg-orange-700', text: 'text-orange-200', shadow: 'shadow-orange-500/50', name: '신화', background: '/images/equipments/mythicbgi.png' },
    transcendent: { bg: 'bg-cyan-900', text: 'text-cyan-200', shadow: 'shadow-cyan-500/50', name: '초월', background: '/images/equipments/transcendentbgi.webp' },
};

const gradeBorderStyles: Partial<Record<ItemGrade, string>> = {
    rare: 'border-pulse-rare',
    epic: 'border-pulse-epic',
    legendary: 'border-pulse-legendary',
    mythic: 'border-pulse-mythic',
};

const BulkItemObtainedModal: React.FC<BulkItemObtainedModalProps> = ({ items, onClose, isTopmost, tournamentScoreChange }) => {
    const getGlowClass = (grade: ItemGrade | undefined) => {
        if (!grade) return '';
        switch (grade) {
            case 'rare': return 'item-glow-rare';
            case 'epic': return 'item-glow-epic';
            case 'legendary': return 'item-glow-legendary';
            case 'mythic': return 'item-glow-mythic';
            case 'transcendent': return 'item-glow-transcendent';
            default: return '';
        }
    };
    
    useEffect(() => {
        if (items && items.length > 0) {
            void audioService.initialize();
            const gradeOrder: ItemGrade[] = [ItemGrade.Normal, ItemGrade.Uncommon, ItemGrade.Rare, ItemGrade.Epic, ItemGrade.Legendary, ItemGrade.Mythic, ItemGrade.Transcendent];
            const bestItem = items.reduce((best, current) => {
                const bestGrade = best.grade || ItemGrade.Normal;
                const currentGrade = current.grade || ItemGrade.Normal;
                return gradeOrder.indexOf(currentGrade) > gradeOrder.indexOf(bestGrade) ? current : best;
            });
            if ([ItemGrade.Epic, ItemGrade.Legendary, ItemGrade.Mythic, ItemGrade.Transcendent].includes(bestItem.grade)) {
                audioService.gachaEpicOrHigher();
            } else {
                audioService.claimReward();
            }
        }
    }, [items]);

    const hasItems = items && items.length > 0;

    return (
        <DraggableWindow
            title="보상 수령"
            onClose={onClose}
            windowId="bulk-item-obtained"
            initialWidth={520}
            shrinkHeightToContent
            skipSavedPosition
            closeOnOutsideClick={false}
            isTopmost={isTopmost}
            zIndex={70}
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
        >
            <>
                <div className="mx-auto flex w-full max-w-[min(100vw-1rem,36rem)] flex-col gap-2 px-2 pb-1 pt-1 sm:max-w-[38rem] sm:gap-2.5 sm:px-3 sm:pb-2 sm:pt-2">
                    {hasItems && (
                        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-[#1a2233]/95 via-[#121826] to-[#0a0d14] px-3 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_40px_-18px_rgba(0,0,0,0.75)] sm:py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">Reward</p>
                            <h2 className="mt-0.5 text-sm font-black tracking-tight text-amber-50 sm:text-base">아이템을 획득했습니다</h2>
                        </div>
                    )}
                    {tournamentScoreChange && (
                        <div className="rounded-2xl border border-emerald-500/45 bg-gradient-to-r from-emerald-950/55 via-emerald-900/40 to-green-950/50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4">
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl sm:text-2xl">🏆</span>
                                    <span className="text-sm font-bold text-emerald-200 sm:text-base">랭킹 점수 변화</span>
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-2 text-sm tabular-nums sm:gap-3 sm:text-base">
                                    <span className="font-mono text-slate-300">{tournamentScoreChange.oldScore.toLocaleString()}</span>
                                    <span className="text-slate-500">→</span>
                                    <span className="font-mono font-bold text-emerald-300">{tournamentScoreChange.newScore.toLocaleString()}</span>
                                    <span className="font-semibold text-emerald-400/95">(+{tournamentScoreChange.scoreReward.toLocaleString()})</span>
                                </div>
                                {tournamentScoreChange.scoreReward > 0 && tournamentScoreChange.oldScore > 0 && (
                                    <div className="text-[11px] text-emerald-400/75">
                                        {((tournamentScoreChange.scoreReward / tournamentScoreChange.oldScore) * 100).toFixed(1)}% 증가
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {hasItems ? (
                        <div
                            className="grid max-h-[min(52dvh,22rem)] auto-rows-fr grid-cols-2 gap-2 overflow-y-auto overflow-x-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#151b29]/95 via-[#0f141f] to-[#080b12] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] [scrollbar-width:thin] sm:max-h-[min(58vh,26rem)] sm:grid-cols-3 sm:gap-2.5 sm:p-3 md:grid-cols-4"
                            style={{ scrollbarColor: 'rgba(251,191,36,0.35) transparent' }}
                        >
                            {items.map((item, index) => {
                                const itemGrade = item.grade || 'normal';
                                const styles = gradeStyles[itemGrade] || gradeStyles.normal;
                                const borderClass =
                                    itemGrade === ItemGrade.Transcendent ? undefined : itemGrade ? gradeBorderStyles[itemGrade] : undefined;
                                const isCurrency = item.image === '/images/icon/Gold.png' || item.image === '/images/icon/Zem.png';
                                const isGoldIcon = item.image === '/images/icon/Gold.png';
                                const isHighGrade = ['rare', 'epic', 'legendary', 'mythic', 'transcendent'].includes(itemGrade);
                                const glowClass = getGlowClass(itemGrade);
                                const currencyQty =
                                    typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 0;

                                let imagePath = item.image;
                                if (!imagePath && item.name && MATERIAL_ITEMS[item.name]) {
                                    imagePath = MATERIAL_ITEMS[item.name].image;
                                }

                                if (isCurrency && isGoldIcon) {
                                    return (
                                        <div
                                            key={index}
                                            className="group flex min-w-0 max-w-[6.75rem] flex-col items-center gap-0.5 justify-self-center sm:max-w-[7.25rem]"
                                        >
                                            <div
                                                className={`${RESULT_MODAL_BOX_GOLD_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} flex items-center justify-center shadow-[0_10px_24px_-12px_rgba(245,158,11,0.28)] ring-1 ring-amber-400/25 transition-transform duration-200 group-hover:scale-[1.03]`}
                                            >
                                                <img
                                                    src="/images/icon/Gold.png"
                                                    alt=""
                                                    className="h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 min-[400px]:h-9 min-[400px]:w-9 object-contain p-0.5 sm:h-9 sm:w-9"
                                                />
                                            </div>
                                            <span className={ITEM_OBTAIN_UNDER_ICON_AMOUNT_AMBER}>+{currencyQty.toLocaleString()}</span>
                                        </div>
                                    );
                                }

                                if (isCurrency && !isGoldIcon) {
                                    return (
                                        <div
                                            key={index}
                                            className="group flex min-w-0 max-w-[6.75rem] flex-col items-center gap-0.5 justify-self-center sm:max-w-[7.25rem]"
                                        >
                                            <div
                                                className={`${RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} flex items-center justify-center ring-1 ring-sky-400/20 transition-transform duration-200 group-hover:scale-[1.03]`}
                                            >
                                                <img
                                                    src="/images/icon/Zem.png"
                                                    alt=""
                                                    className="h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 min-[400px]:h-9 min-[400px]:w-9 object-contain p-0.5 sm:h-9 sm:w-9"
                                                />
                                            </div>
                                            <span className={ITEM_OBTAIN_UNDER_ICON_AMOUNT_SKY}>+{currencyQty.toLocaleString()}</span>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={index}
                                        className="group relative aspect-square w-full min-w-0 max-w-[6.75rem] justify-self-center sm:max-w-[7.25rem]"
                                    >
                                        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-amber-400/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                        <div
                                            className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl ring-1 ring-slate-500/35 ${borderClass || 'border border-slate-600/45'} ${itemGrade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''} ${isHighGrade ? 'item-reveal-animation' : ''} ${glowClass}`}
                                        >
                                            <img src={styles.background} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                            {isActionPointConsumable(item.name) ? (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-1">
                                                    <span className="text-[clamp(1.1rem,5.5vw,1.45rem)] leading-none" aria-hidden>
                                                        ⚡
                                                    </span>
                                                    <span className="mt-0.5 max-w-[95%] truncate text-center text-[9px] font-extrabold leading-tight text-amber-100 drop-shadow sm:text-[10px]">
                                                        +{item.name.replace(/.*\(\+(\d+)\)/, '$1')}
                                                    </span>
                                                </div>
                                            ) : imagePath ? (
                                                <img
                                                    src={imagePath}
                                                    alt=""
                                                    className="absolute object-contain p-[10%]"
                                                    style={{
                                                        width: '86%',
                                                        height: '86%',
                                                        left: '50%',
                                                        top: '50%',
                                                        transform: 'translate(-50%, -50%)',
                                                    }}
                                                />
                                            ) : null}
                                            {item.quantity != null && item.quantity > 1 && (
                                                <span
                                                    className={`absolute bottom-1 right-1 z-10 min-w-[1.35rem] rounded-full border border-white/15 bg-gradient-to-b from-zinc-800/95 to-zinc-950/95 px-1.5 py-0.5 text-center shadow-[0_4px_12px_-4px_rgba(0,0,0,0.65)] ${ITEM_OBTAIN_UNDER_ICON_AMOUNT_SLATE}`}
                                                >
                                                    ×{item.quantity.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-slate-600/45 bg-slate-900/40 px-4 py-8 text-center">
                            <p className="text-sm text-slate-400">획득한 아이템이 없습니다.</p>
                        </div>
                    )}
                </div>
                <div className={ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS}>
                    <button type="button" onClick={onClose} className={ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS}>
                        확인
                    </button>
                </div>
            </>
        </DraggableWindow>
    );
};

export default BulkItemObtainedModal;
