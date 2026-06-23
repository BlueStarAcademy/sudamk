
import { useLocalizedItemGrade, useLocalizedInventoryItemMeta, useLocalizedInventoryItemName } from '../shared/i18n/localizedCatalog.js';
import { useTranslation } from 'react-i18next';
import React, { useEffect } from 'react';
import DraggableWindow, {
    ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS,
    ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS,
    ITEM_OBTAINED_MODAL_WINDOW_ID,
} from './DraggableWindow.js';
import { InventoryItem, ItemGrade } from '../types.js';
import { audioService } from '../services/audioService.js';
import { isActionPointConsumable, MATERIAL_ITEMS } from '../constants/items.js';
import { EquipmentDetailPanel } from './EquipmentDetailPanel.js';
import { RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS, RESULT_MODAL_BOX_GOLD_CLASS, RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS } from './game/ResultModalRewardSlot.js';
import { ITEM_OBTAIN_COUNT_BADGE_CLASS, SingleItemObtainCard } from './game/ItemObtainModalShared.js';
import { isPairPetMaterial } from '../shared/constants/petLobby.js';
import {
    MOBILE_EQUIPMENT_DETAIL_BODY_PADDING_CLASS,
    MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS,
    MOBILE_EQUIPMENT_DETAIL_MODAL_WIDTH,
} from '../shared/constants/mobileEquipmentDetailModal.js';
import { formatGoldAmountKoG, formatWalletDiamonds } from '../shared/utils/walletAmountDisplay.js';

interface ItemObtainedModalProps {
    item: InventoryItem;
    onClose: () => void;
    isTopmost?: boolean;
}

const gradeStyles: Record<ItemGrade, { bg: string, text: string, shadow: string, name: string, background: string }> = {
    normal: { bg: 'bg-gray-700', text: 'text-white', shadow: 'shadow-gray-900/50', background: '/images/equipments/normalbgi.webp' },
    uncommon: { bg: 'bg-green-700', text: 'text-green-200', shadow: 'shadow-green-500/50', background: '/images/equipments/uncommonbgi.webp' },
    rare: { bg: 'bg-blue-700', text: 'text-blue-200', shadow: 'shadow-blue-500/50', background: '/images/equipments/rarebgi.webp' },
    epic: { bg: 'bg-purple-700', text: 'text-purple-200', shadow: 'shadow-purple-500/50', background: '/images/equipments/epicbgi.webp' },
    legendary: { bg: 'bg-red-800', text: 'text-red-200', shadow: 'shadow-red-500/50', background: '/images/equipments/legendarybgi.webp' },
    mythic: { bg: 'bg-orange-700', text: 'text-orange-200', shadow: 'shadow-orange-500/50', background: '/images/equipments/mythicbgi.webp' },
    transcendent: { bg: 'bg-cyan-900', text: 'text-cyan-200', shadow: 'shadow-cyan-500/50', background: '/images/equipments/transcendentbgi.webp' },
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
    const { t } = useTranslation('inventory');
    const localizedGrade = useLocalizedItemGrade();
    const localizedItemName = useLocalizedInventoryItemName();
    const itemMeta = useLocalizedInventoryItemMeta();
    const displayItemName = localizedItemName(item.name);
    const styles = gradeStyles[item.grade];
    const starInfo = getStarDisplayInfo(item.stars);
    const borderClass = item.grade === ItemGrade.Transcendent ? undefined : gradeBorderStyles[item.grade];
    const isCurrency = item.image === '/images/icon/Gold.webp' || item.image === '/images/icon/Zem.webp';
    
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
                title={t('obtained.equipmentDetail')}
                onClose={onClose}
                windowId={ITEM_OBTAINED_MODAL_WINDOW_ID}
                initialWidth={MOBILE_EQUIPMENT_DETAIL_MODAL_WIDTH}
                shrinkHeightToContent
                isTopmost={isTopmost}
                zIndex={70}
                viewportPortal
                variant="store"
                hideFooter
                mobileViewportFit
                mobileViewportMaxHeightVh={98}
                mobileViewportMaxHeightCss={MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS}
                mobileViewportDvhBottomGapPx={8}
                bodyScrollable
                bodyPaddingClassName={MOBILE_EQUIPMENT_DETAIL_BODY_PADDING_CLASS}
            >
                <div className="flex min-h-0 w-full min-w-0 flex-col gap-1.5">
                    <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
                        <EquipmentDetailPanel
                            item={item}
                            optionsScrollable={false}
                            comfortableTypography
                            optionRowsSingleLine
                            showTradeStatusUnderImage
                            showAcquireSources
                        />
                    </div>
                    <div className={`${ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS} shrink-0 border-t border-slate-700/50 pt-2`}>
                        <button type="button" onClick={onClose} className={`${ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS} !text-xs !leading-snug`}>
                            확인
                        </button>
                    </div>
                </div>
            </DraggableWindow>
        );
    }

    const currencyAmount =
        typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 0;
    const isGoldIcon = item.image === '/images/icon/Gold.webp';
    const isZemIcon = item.image === '/images/icon/Zem.webp';

    /** 통화(골드/다이아) 스냅샷은 `EquipmentDetailPanel` 레이아웃이 맞지 않음 — 통화 전용 카드 유지 */
    const useBagDetailPanel =
        !isCurrency &&
        (item.type === 'material' || item.type === 'consumable' || !!MATERIAL_ITEMS[item.name]);

    if (useBagDetailPanel) {
        return (
            <DraggableWindow
                title={t('obtained.itemObtained')}
                onClose={onClose}
                windowId={ITEM_OBTAINED_MODAL_WINDOW_ID}
                initialWidth={MOBILE_EQUIPMENT_DETAIL_MODAL_WIDTH}
                shrinkHeightToContent
                isTopmost={isTopmost}
                zIndex={70}
                viewportPortal
                variant="store"
                hideFooter
                mobileViewportFit
                mobileViewportMaxHeightVh={98}
                mobileViewportMaxHeightCss={MOBILE_EQUIPMENT_DETAIL_MAX_HEIGHT_CSS}
                mobileViewportDvhBottomGapPx={8}
                bodyScrollable
                bodyPaddingClassName={MOBILE_EQUIPMENT_DETAIL_BODY_PADDING_CLASS}
            >
                <div className="flex min-h-0 w-full min-w-0 flex-col gap-1.5">
                    <div className="min-h-0 w-full min-w-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]">
                        <EquipmentDetailPanel
                            item={item}
                            optionsScrollable={false}
                            comfortableTypography
                            showAcquireSources
                            materialQuantityCaption="obtained"
                        />
                    </div>
                    <div className={`${ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS} shrink-0 border-t border-slate-700/50 pt-2`}>
                        <button type="button" onClick={onClose} className={`${ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS} !text-xs !leading-snug`}>
                            확인
                        </button>
                    </div>
                </div>
            </DraggableWindow>
        );
    }

    const COMPACT_CURRENCY_IMG_CLASS =
        'h-7 w-7 min-[360px]:h-8 min-[360px]:w-8 min-[400px]:h-9 min-[400px]:w-9 object-contain p-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)] sm:h-9 sm:w-9';

    const obtainDescription = itemMeta.resolveDescription(item);
    const obtainUsageLines = itemMeta.resolveObtainUsageLines(item);
    const obtainAcquireLines = itemMeta.resolveAcquireLines(item);
    const stackQty =
        typeof item.quantity === 'number' && Number.isFinite(item.quantity) && item.quantity > 0 ? Math.floor(item.quantity) : 1;

    let singleCard: React.ReactNode;

    if (isCurrency && isGoldIcon) {
        singleCard = (
            <SingleItemObtainCard
                leftVisual={
                    <div className="relative shrink-0">
                        <div
                            className={`relative flex items-center justify-center ${RESULT_MODAL_BOX_GOLD_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} shadow-[0_12px_28px_-12px_rgba(245,158,11,0.32)]`}
                        >
                            <img src="/images/icon/Gold.webp" alt="" className={COMPACT_CURRENCY_IMG_CLASS} />
                        </div>
                        <span className={ITEM_OBTAIN_COUNT_BADGE_CLASS}>+{formatGoldAmountKoG(currencyAmount)}</span>
                    </div>
                }
                name={t('obtained.goldName')}
                description={obtainDescription}
                usageLines={obtainUsageLines}
                acquireLines={obtainAcquireLines}
            />
        );
    } else if (isCurrency && isZemIcon) {
        singleCard = (
            <SingleItemObtainCard
                leftVisual={
                    <div className="relative shrink-0">
                        <div
                            className={`relative flex items-center justify-center ${RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS} ${RESULT_MODAL_REWARD_ROW_BOX_COMPACT_CLASS} shadow-[0_12px_28px_-12px_rgba(14,165,233,0.28)] ring-1 ring-sky-400/25`}
                        >
                            <img src="/images/icon/Zem.webp" alt="" className={COMPACT_CURRENCY_IMG_CLASS} />
                        </div>
                        <span className={ITEM_OBTAIN_COUNT_BADGE_CLASS}>+{formatWalletDiamonds(currencyAmount)}</span>
                    </div>
                }
                name={t('obtained.diamondsName')}
                description={obtainDescription}
                usageLines={obtainUsageLines}
                acquireLines={obtainAcquireLines}
            />
        );
    } else {
        const gradePrefix = item.grade && item.grade !== ItemGrade.Normal ? `[${localizedGrade(item.grade)}] ` : '';
        const combinedDesc = `${gradePrefix}${obtainDescription}`.trim();
        singleCard = (
            <SingleItemObtainCard
                leftVisual={
                    <div className="relative h-[4.75rem] w-[4.75rem] shrink-0 sm:h-[5.1rem] sm:w-[5.1rem]">
                        <div
                            className="absolute inset-[-10%] rounded-[1.1rem] opacity-45 blur-xl"
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
                                        <span className="text-[clamp(1.1rem,5vw,1.65rem)] leading-none sm:text-[1.75rem]" aria-hidden>
                                            ⚡
                                        </span>
                                        <span className="mt-0.5 max-w-full text-center text-[clamp(0.6rem,2.6vw,0.72rem)] font-extrabold tracking-wide text-amber-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] sm:text-xs">
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
                                {stackQty > 1 && !isPairPetMaterial(item) ? (
                                    <span className={ITEM_OBTAIN_COUNT_BADGE_CLASS}>×{stackQty.toLocaleString()}</span>
                                ) : null}
                            </div>
                        </div>
                    </div>
                }
                name={
                    <span className={`font-black tracking-tight ${starInfo.colorClass} ${textGlowClass}`}>
                        {displayItemName}
                        {item.stars > 0 ? (
                            <span className={`font-bold ${starInfo.colorClass} ${textGlowClass}`}> {starInfo.text}</span>
                        ) : null}
                    </span>
                }
                description={combinedDesc}
                usageLines={obtainUsageLines}
                acquireLines={obtainAcquireLines}
            />
        );
    }

    return (
        <DraggableWindow
            title={t('obtained.itemObtained')}
            onClose={onClose}
            windowId={ITEM_OBTAINED_MODAL_WINDOW_ID}
            initialWidth={440}
            shrinkHeightToContent
            isTopmost={isTopmost}
            zIndex={70}
            viewportPortal
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
        >
            <>
                <div className="flex min-h-0 w-full max-w-[min(100vw-1.5rem,28rem)] flex-col self-center px-1.5 pt-1 sm:max-w-[28rem] sm:px-3 sm:pt-2">
                    {singleCard}
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
