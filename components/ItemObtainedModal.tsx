
import React, { useEffect } from 'react';
import DraggableWindow, {
    ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS,
    ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS,
} from './DraggableWindow.js';
import { InventoryItem, ItemGrade } from '../types.js';
import { audioService } from '../services/audioService.js';
import { GRADE_LEVEL_REQUIREMENTS } from '../constants';
import { isActionPointConsumable, MATERIAL_ITEMS } from '../constants/items';
import { EquipmentDetailPanel } from './EquipmentDetailPanel.js';
import {
    formatRewardItemDisplayName,
    ITEM_OBTAIN_UNDER_ICON_AMOUNT_AMBER,
    ITEM_OBTAIN_UNDER_ICON_AMOUNT_SKY,
    ITEM_OBTAIN_UNDER_ICON_AMOUNT_SLATE,
    RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS,
    RESULT_MODAL_BOX_GOLD_CLASS,
    RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS,
} from './game/ResultModalRewardSlot.js';

interface ItemObtainedModalProps {
    item: InventoryItem;
    onClose: () => void;
    isTopmost?: boolean;
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

const getStarDisplayInfo = (stars: number) => {
    if (stars >= 10) {
        return { text: `(★${stars})`, colorClass: "prism-text-effect" };
    } else if (stars >= 7) {
        return { text: `(★${stars})`, colorClass: "text-blue-400" };
    } else if (stars >= 4) {
        return { text: `(★${stars})`, colorClass: "text-amber-400" };
    } else if (stars >= 1) {
        return { text: `(★${stars})`, colorClass: "text-white" };
    }
    return { text: "", colorClass: "text-white" };
};

const ItemObtainedModal: React.FC<ItemObtainedModalProps> = ({ item, onClose, isTopmost }) => {
    const styles = gradeStyles[item.grade];
    const requiredLevel = item.type === 'equipment' ? GRADE_LEVEL_REQUIREMENTS[item.grade] : null;
    const starInfo = getStarDisplayInfo(item.stars);
    const borderClass = item.grade === ItemGrade.Transcendent ? undefined : gradeBorderStyles[item.grade];
    const isCurrency = item.image === '/images/icon/Gold.png' || item.image === '/images/icon/Zem.png';
    
    const getGlowClass = (grade: ItemGrade) => {
        switch (grade) {
            case 'rare': return 'item-glow-rare';
            case 'epic': return 'item-glow-epic';
            case 'legendary': return 'item-glow-legendary';
            case 'mythic': return 'item-glow-mythic';
            case 'transcendent': return 'item-glow-transcendent';
            default: return '';
        }
    };
    
    const getTextGlowClass = (grade: ItemGrade) => {
        switch (grade) {
            case 'rare': return 'text-glow-rare';
            case 'epic': return 'text-glow-epic';
            case 'legendary': return 'text-glow-legendary';
            case 'mythic': return 'text-glow-mythic';
            case 'transcendent': return 'text-glow-transcendent';
            default: return '';
        }
    };
    
    const isHighGrade = ['rare', 'epic', 'legendary', 'mythic', 'transcendent'].includes(item.grade);
    const glowClass = getGlowClass(item.grade);
    const textGlowClass = getTextGlowClass(item.grade);

    useEffect(() => {
        void audioService.initialize();
        if (['epic', 'legendary', 'mythic', 'transcendent'].includes(item.grade)) {
            audioService.gachaEpicOrHigher();
        } else {
            audioService.claimReward();
        }
    }, [item.grade]);

    if (item.type === 'equipment') {
        return (
            <DraggableWindow
                title="장비 상세 정보"
                onClose={onClose}
                windowId="item-obtained-equipment"
                initialWidth={350}
                shrinkHeightToContent
                isTopmost={isTopmost}
                zIndex={70}
                skipSavedPosition
                hideFooter
                mobileViewportFit
                mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
            >
                <>
                    <div className="min-h-0 shrink-0 px-2 pt-2">
                        <EquipmentDetailPanel item={item} optionsScrollable={false} />
                    </div>
                    <div className={ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS}>
                        <button type="button" onClick={onClose} className={ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS}>
                            확인
                        </button>
                    </div>
                </>
            </DraggableWindow>
        );
    }

    const currencyAmount =
        typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 0;
    const isGoldIcon = item.image === '/images/icon/Gold.png';
    const isZemIcon = item.image === '/images/icon/Zem.png';
    const materialAmount =
        typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 0;
    const isMaterialObtainLayout =
        !isCurrency &&
        !isActionPointConsumable(item.name) &&
        (item.type === 'material' || !!MATERIAL_ITEMS[item.name]);

    const COMPACT_CURRENCY_IMG_CLASS =
        'h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 min-[400px]:h-9 min-[400px]:w-9 object-contain p-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] sm:h-9 sm:w-9';

    /** 골드·다이아 꾸러미: compact 슬롯 + 하단 수치(모험 결과와 동일 크기, 별도 라벨 없음) */
    if (isCurrency && isGoldIcon) {
        return (
            <DraggableWindow
                title="아이템 획득"
                onClose={onClose}
                windowId="item-obtained-gold"
                initialWidth={360}
                shrinkHeightToContent
                skipSavedPosition
                isTopmost={isTopmost}
                zIndex={70}
                variant="store"
                mobileViewportFit
                mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
            >
                <>
                    <div className="flex min-h-0 w-full max-w-[min(100vw-1.5rem,22rem)] flex-col self-center px-2 pt-1 sm:max-w-[22rem] sm:px-3 sm:pt-2">
                        <div
                            className="relative overflow-hidden rounded-2xl border border-amber-500/45 bg-gradient-to-b from-[#1a1510] via-[#120e0a] to-[#080604] shadow-[0_0_0_1px_rgba(251,191,36,0.12),0_32px_64px_-28px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]"
                            role="region"
                            aria-label="획득"
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.2]"
                                style={{
                                    background:
                                        'radial-gradient(ellipse 95% 55% at 50% 0%, rgba(251, 191, 36, 0.5), transparent 55%), radial-gradient(ellipse 60% 50% at 50% 110%, rgba(234, 179, 8, 0.12), transparent 52%)',
                                }}
                                aria-hidden
                            />
                            <div className="relative flex flex-col items-center px-6 pb-2 pt-6 sm:px-8 sm:pb-3 sm:pt-8">
                                <div
                                    className="pointer-events-none absolute left-1/2 top-[30%] h-28 w-28 -translate-x-1/2 rounded-full bg-amber-400/22 blur-3xl sm:h-32 sm:w-32"
                                    aria-hidden
                                />
                                <div
                                    className={`relative z-[1] flex shrink-0 items-center justify-center ${RESULT_MODAL_BOX_GOLD_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} shadow-[0_12px_28px_-12px_rgba(245,158,11,0.32)]`}
                                >
                                    <img src="/images/icon/Gold.png" alt="" className={COMPACT_CURRENCY_IMG_CLASS} />
                                </div>
                                <span className={`relative z-[1] mt-3 ${ITEM_OBTAIN_UNDER_ICON_AMOUNT_AMBER}`}>
                                    +{currencyAmount.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className={ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS}>
                        <button type="button" onClick={onClose} className={ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS}>
                            확인
                        </button>
                    </div>
                </>
            </DraggableWindow>
        );
    }

    if (isCurrency && isZemIcon) {
        return (
            <DraggableWindow
                title="아이템 획득"
                onClose={onClose}
                windowId="item-obtained-zem"
                initialWidth={360}
                shrinkHeightToContent
                skipSavedPosition
                isTopmost={isTopmost}
                zIndex={70}
                variant="store"
                mobileViewportFit
                mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
            >
                <>
                    <div className="flex min-h-0 w-full max-w-[min(100vw-1.5rem,22rem)] flex-col self-center px-2 pt-1 sm:max-w-[22rem] sm:px-3 sm:pt-2">
                        <div
                            className="relative overflow-hidden rounded-2xl border border-sky-500/45 bg-gradient-to-b from-[#0f172a] via-[#0b1220] to-[#060a12] shadow-[0_0_0_1px_rgba(56,189,248,0.12),0_32px_64px_-28px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]"
                            role="region"
                            aria-label="획득"
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.18]"
                                style={{
                                    background:
                                        'radial-gradient(ellipse 95% 55% at 50% 0%, rgba(56, 189, 248, 0.35), transparent 55%), radial-gradient(ellipse 60% 50% at 50% 110%, rgba(14, 165, 233, 0.1), transparent 52%)',
                                }}
                                aria-hidden
                            />
                            <div className="relative flex flex-col items-center px-6 pb-2 pt-6 sm:px-8 sm:pb-3 sm:pt-8">
                                <div
                                    className="pointer-events-none absolute left-1/2 top-[30%] h-28 w-28 -translate-x-1/2 rounded-full bg-sky-400/18 blur-3xl sm:h-32 sm:w-32"
                                    aria-hidden
                                />
                                <div
                                    className={`relative z-[1] flex shrink-0 items-center justify-center ${RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} shadow-[0_12px_28px_-12px_rgba(14,165,233,0.28)] ring-1 ring-sky-400/25`}
                                >
                                    <img src="/images/icon/Zem.png" alt="" className={COMPACT_CURRENCY_IMG_CLASS} />
                                </div>
                                <span className={`relative z-[1] mt-3 ${ITEM_OBTAIN_UNDER_ICON_AMOUNT_SKY}`}>
                                    +{currencyAmount.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className={ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS}>
                        <button type="button" onClick={onClose} className={ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS}>
                            확인
                        </button>
                    </div>
                </>
            </DraggableWindow>
        );
    }

    if (isMaterialObtainLayout) {
        const matImage = item.image || MATERIAL_ITEMS[item.name]?.image || '';
        const matLabel = formatRewardItemDisplayName(item.name);
        return (
            <DraggableWindow
                title="아이템 획득"
                onClose={onClose}
                windowId="item-obtained-material"
                initialWidth={360}
                shrinkHeightToContent
                skipSavedPosition
                isTopmost={isTopmost}
                zIndex={70}
                variant="store"
                mobileViewportFit
                mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
            >
                <>
                    <div className="flex min-h-0 w-full max-w-[min(100vw-1.5rem,22rem)] flex-col self-center px-2 pt-1 sm:max-w-[22rem] sm:px-3 sm:pt-2">
                        <div
                            className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-b from-[#161d2e] via-[#0e131f] to-[#070a10] shadow-[0_0_0_1px_rgba(251,191,36,0.1),0_28px_56px_-24px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.07)]"
                            role="region"
                            aria-label="획득"
                        >
                            <div
                                className="pointer-events-none absolute inset-0 opacity-[0.14]"
                                style={{
                                    background:
                                        'radial-gradient(ellipse 90% 50% at 50% -8%, rgba(251, 191, 36, 0.42), transparent 60%), radial-gradient(ellipse 65% 40% at 80% 100%, rgba(56, 189, 248, 0.1), transparent 50%)',
                                }}
                                aria-hidden
                            />
                            <div className="relative flex flex-col items-center px-6 pb-2 pt-6 sm:px-8 sm:pb-3 sm:pt-8">
                                <div
                                    className="pointer-events-none absolute left-1/2 top-[30%] h-28 w-28 -translate-x-1/2 rounded-full bg-slate-400/12 blur-3xl sm:h-32 sm:w-32"
                                    aria-hidden
                                />
                                <div
                                    className={`relative z-[1] flex shrink-0 items-center justify-center ${RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} ring-1 ring-slate-500/30`}
                                >
                                    {matImage ? (
                                        <img src={matImage} alt="" className={COMPACT_CURRENCY_IMG_CLASS} />
                                    ) : null}
                                </div>
                                <span className={`relative z-[1] mt-3 ${ITEM_OBTAIN_UNDER_ICON_AMOUNT_SLATE}`}>
                                    +{materialAmount.toLocaleString()}
                                </span>
                                <p className="relative z-[1] mt-2 max-w-full truncate px-1 text-center text-[11px] font-medium text-slate-400/95 sm:text-xs">
                                    {matLabel}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className={ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS}>
                        <button type="button" onClick={onClose} className={ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS}>
                            확인
                        </button>
                    </div>
                </>
            </DraggableWindow>
        );
    }

    return (
        <DraggableWindow
            title="아이템 획득"
            onClose={onClose}
            windowId="item-obtained"
            initialWidth={400}
            shrinkHeightToContent
            skipSavedPosition
            isTopmost={isTopmost}
            zIndex={70}
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
        >
            <>
                <div className="flex min-h-0 w-full max-w-[min(100vw-1.5rem,26rem)] flex-col gap-2 self-center px-1.5 pt-1 sm:max-w-[26rem] sm:px-3 sm:pt-2">
                    <div
                        className="relative overflow-hidden rounded-2xl border border-amber-500/40 bg-gradient-to-b from-[#161d2e] via-[#0e131f] to-[#070a10] shadow-[0_0_0_1px_rgba(251,191,36,0.1),0_28px_56px_-24px_rgba(0,0,0,0.88),inset_0_1px_0_rgba(255,255,255,0.07)]"
                        role="region"
                        aria-label="획득 아이템"
                    >
                        <div
                            className="pointer-events-none absolute inset-0 opacity-[0.14]"
                            style={{
                                background:
                                    'radial-gradient(ellipse 90% 50% at 50% -8%, rgba(251, 191, 36, 0.42), transparent 60%), radial-gradient(ellipse 65% 40% at 80% 100%, rgba(56, 189, 248, 0.1), transparent 50%)',
                            }}
                            aria-hidden
                        />
                        <div className="relative flex min-h-0 flex-col gap-3 p-3 max-[360px]:gap-2.5 max-[360px]:p-2.5 sm:gap-4 sm:px-6 sm:pb-6 sm:pt-7">
                            <div className="flex min-w-0 flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
                                <div className="relative aspect-square w-[clamp(5.75rem,42vw,7.5rem)] shrink-0 sm:w-[min(9.5rem,32vw)]">
                                    <div
                                        className="absolute inset-[-12%] rounded-[1.35rem] opacity-45 blur-2xl"
                                        style={{
                                            background:
                                                item.grade === ItemGrade.Transcendent
                                                    ? 'conic-gradient(from 200deg, rgba(34,211,238,0.4), rgba(168,85,247,0.28), rgba(251,191,36,0.32), rgba(34,211,238,0.4))'
                                                    : 'radial-gradient(circle at 50% 38%, rgba(251,191,36,0.32), transparent 68%)',
                                        }}
                                        aria-hidden
                                    />
                                    <div className="relative flex h-full w-full items-center justify-center rounded-2xl p-0.5 ring-1 ring-amber-400/30 ring-offset-2 ring-offset-[#0e131f]">
                                        <div
                                            className={`relative h-full w-full overflow-hidden rounded-[0.85rem] ${borderClass || 'border border-slate-500/50'} ${item.grade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''} ${isHighGrade ? 'item-reveal-animation' : ''} ${glowClass}`}
                                        >
                                            <img src={styles.background} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                            {isActionPointConsumable(item.name) ? (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-1">
                                                    <span className="text-[clamp(1.35rem,5.5vw,2rem)] leading-none sm:text-[2.15rem]" aria-hidden>
                                                        ⚡
                                                    </span>
                                                    <span className="mt-1 max-w-full truncate text-center text-[clamp(0.65rem,2.8vw,0.8rem)] font-extrabold tracking-wide text-amber-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:text-sm">
                                                        +{item.name.replace(/.*\(\+(\d+)\)/, '$1')}
                                                    </span>
                                                </div>
                                            ) : item.image ? (
                                                <img
                                                    src={item.image}
                                                    alt=""
                                                    className="absolute object-contain p-[12%] sm:p-[14%]"
                                                    style={{ width: '82%', height: '82%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                                                />
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex min-w-0 flex-1 flex-col items-center text-center sm:items-start sm:text-left">
                                    <span
                                        className={`inline-flex items-center justify-center rounded-full border px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] sm:text-[11px] ${styles.bg} ${styles.text} border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ${textGlowClass}`}
                                    >
                                        [{styles.name}]
                                    </span>
                                    <div className="mt-2 flex min-w-0 flex-wrap items-baseline justify-center gap-x-1.5 gap-y-0 sm:justify-start">
                                        <h2
                                            className={`max-w-full break-words text-[clamp(0.8rem,3.6vw,0.95rem)] font-black leading-snug tracking-tight sm:text-base ${starInfo.colorClass} ${textGlowClass}`}
                                            style={{ wordBreak: 'keep-all' }}
                                        >
                                            {item.name}
                                        </h2>
                                        {item.stars > 0 && (
                                            <span className={`text-xs font-bold sm:text-sm ${starInfo.colorClass} ${textGlowClass}`}>{starInfo.text}</span>
                                        )}
                                    </div>
                                    {requiredLevel && (
                                        <p className="mt-1.5 text-[10px] text-amber-200/80 sm:text-[11px]">착용 레벨 합 {requiredLevel}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
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

export default ItemObtainedModal;
