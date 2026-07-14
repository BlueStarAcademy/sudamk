import React, { useEffect } from 'react';
import { useLocalizedItemGrade } from '../shared/i18n/localizedCatalog.js';
import { useTranslation } from 'react-i18next';
import DraggableWindow, {
    ITEM_OBTAIN_MODAL_CONFIRM_BUTTON_CLASS,
    ITEM_OBTAIN_MODAL_FOOTER_ROW_CLASS,
    ITEM_OBTAINED_MODAL_WINDOW_ID,
} from './DraggableWindow.js';
import { InventoryItem } from '../types.js';
import { ItemGrade } from '../types/enums.js';
import { audioService } from '../services/audioService.js';
import { MATERIAL_ITEMS } from '../constants/items';
import { itemSlotIconStyleForGrade, GRADE_SLOT_SCRIM_CLASS } from '../shared/constants/itemSlotIconLayout.js';
import { RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS, RESULT_MODAL_BOX_GOLD_CLASS } from './game/ResultModalRewardSlot.js';
import { ITEM_OBTAIN_COUNT_BADGE_CLASS } from './game/ItemObtainModalShared.js';
import { isPairPetMaterial, isPairSoulStoneItem } from '../shared/constants/petLobby.js';

interface BulkItemObtainedModalProps {
    items: InventoryItem[];
    onClose: () => void;
    isTopmost?: boolean;
    tournamentScoreChange?: { oldScore: number; newScore: number; scoreReward: number } | null;
}

const gradeStyles: Record<ItemGrade, { bg: string, text: string, shadow: string, name: string, background: string }> = {
    normal: { bg: 'bg-gray-700', text: 'text-white', shadow: 'shadow-gray-900/50', background: '/images/equipments/normalbgi.webp' },
    uncommon: { bg: 'bg-green-700', text: 'text-green-200', shadow: 'shadow-green-500/50', background: '/images/equipments/uncommonbgi.webp' },
    rare: { bg: 'bg-blue-700', text: 'text-blue-200', shadow: 'shadow-blue-500/50', background: '/images/equipments/rarebgi.webp' },
    epic: { bg: 'bg-purple-700', text: 'text-purple-200', shadow: 'shadow-purple-500/50', background: '/images/equipments/epicbgi.webp' },
    legendary: { bg: 'bg-red-800', text: 'text-red-200', shadow: 'shadow-red-500/50', background: '/images/equipments/legendarybgi.webp' },
    mythic: { bg: 'bg-amber-700', text: 'text-amber-200', shadow: 'shadow-amber-400/50', background: '/images/equipments/mythicbgi.webp' },
    transcendent: { bg: 'bg-cyan-900', text: 'text-cyan-200', shadow: 'shadow-cyan-500/50', background: '/images/equipments/transcendentbgi.webp' },
};

/** 일괄 그리드: 펄스·글로우 애니메이션 없이 인접 타일과 겹치지 않도록 고정 테두리만 사용 */
const BULK_TILE_STATIC_BORDER: Partial<Record<ItemGrade, string>> = {
    [ItemGrade.Normal]: 'border border-slate-600/50',
    [ItemGrade.Uncommon]: 'border-2 border-emerald-500/45',
    [ItemGrade.Rare]: 'border-2 border-sky-500/55',
    [ItemGrade.Epic]: 'border-2 border-violet-500/55',
    [ItemGrade.Legendary]: 'border-2 border-rose-500/55',
    [ItemGrade.Mythic]: 'border-2 border-amber-500/55',
};

const BulkItemObtainedModal: React.FC<BulkItemObtainedModalProps> = ({ items, onClose, isTopmost, tournamentScoreChange }) => {
    const { t } = useTranslation('inventory');
    const localizedGrade = useLocalizedItemGrade();
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
            title={t('bulkObtained.rewardClaim')}
            onClose={onClose}
            windowId={ITEM_OBTAINED_MODAL_WINDOW_ID}
            initialWidth={520}
            shrinkHeightToContent
            closeOnOutsideClick={false}
            isTopmost={isTopmost}
            zIndex={70}
            viewportPortal
            variant="store"
            mobileViewportFit
            mobileViewportMaxHeightCss="min(92dvh, calc(100dvh - 16px))"
        >
            <>
                <div className="mx-auto flex w-full max-w-[min(100vw-1rem,36rem)] flex-col gap-2 px-2 pb-1 pt-1 sm:max-w-[38rem] sm:gap-2.5 sm:px-3 sm:pb-2 sm:pt-2">
                    {hasItems && (
                        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-b from-[#1a2233]/95 via-[#121826] to-[#0a0d14] px-3 py-2.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_12px_40px_-18px_rgba(0,0,0,0.75)] sm:py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/75">Reward</p>
                            <h2 className="mt-0.5 text-sm font-black tracking-tight text-amber-50 sm:text-base">{t('bulkObtained.itemsObtained')}</h2>
                        </div>
                    )}
                    {tournamentScoreChange && (
                        <div className="rounded-2xl border border-emerald-500/45 bg-gradient-to-r from-emerald-950/55 via-emerald-900/40 to-green-950/50 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-4">
                            <div className="flex flex-col items-center gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xl sm:text-2xl">🏆</span>
                                    <span className="text-sm font-bold text-emerald-200 sm:text-base">{t('bulkObtained.rankScoreDelta')}</span>
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-2 text-sm tabular-nums sm:gap-3 sm:text-base">
                                    <span className="font-mono text-slate-300">{tournamentScoreChange.oldScore.toLocaleString()}</span>
                                    <span className="text-slate-500">→</span>
                                    <span className="font-mono font-bold text-emerald-300">{tournamentScoreChange.newScore.toLocaleString()}</span>
                                    <span className="font-semibold text-emerald-400/95">(+{tournamentScoreChange.scoreReward.toLocaleString()})</span>
                                </div>
                                {tournamentScoreChange.scoreReward > 0 && tournamentScoreChange.oldScore > 0 && (
                                    <div className="text-[11px] text-emerald-400/75">
                                        {t('bulkObtained.percentIncrease', { percent: ((tournamentScoreChange.scoreReward / tournamentScoreChange.oldScore) * 100).toFixed(1) })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {hasItems ? (
                        <div
                            className="grid max-h-[min(52dvh,24rem)] grid-cols-3 gap-2.5 overflow-y-auto overflow-x-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-b from-[#151b29]/95 via-[#0f141f] to-[#080b12] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] [scrollbar-width:thin] min-[400px]:grid-cols-4 sm:max-h-[min(58vh,28rem)] sm:gap-3 sm:p-3 md:grid-cols-5"
                            style={{ scrollbarColor: 'rgba(251,191,36,0.35) transparent' }}
                        >
                            {items.map((item, index) => {
                                const itemGrade = item.grade || 'normal';
                                const styles = gradeStyles[itemGrade] || gradeStyles.normal;
                                const staticBorderClass =
                                    itemGrade === ItemGrade.Transcendent
                                        ? ''
                                        : BULK_TILE_STATIC_BORDER[itemGrade] ?? BULK_TILE_STATIC_BORDER[ItemGrade.Normal];
                                const isCurrency = item.image === '/images/icon/Gold.webp' || item.image === '/images/icon/Zem.webp';
                                const isGoldIcon = item.image === '/images/icon/Gold.webp';
                                const currencyQty =
                                    typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 0;
                                const grantQty =
                                    typeof item.quantity === 'number' && Number.isFinite(item.quantity)
                                        ? Math.max(0, Math.floor(item.quantity))
                                        : 0;
                                const tileWrapClass =
                                    'group relative aspect-square w-full min-w-0 max-w-[4.85rem] justify-self-center overflow-hidden rounded-2xl min-[400px]:max-w-[5.15rem] sm:max-w-[5.35rem]';

                                let imagePath = item.image;
                                if (!imagePath && item.name && MATERIAL_ITEMS[item.name]) {
                                    imagePath = MATERIAL_ITEMS[item.name].image;
                                }

                                if (isCurrency && isGoldIcon) {
                                    return (
                                        <div key={item.id ?? `${item.name}-${index}`} className={tileWrapClass}>
                                            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-amber-400/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                            <div
                                                className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl ring-1 ring-amber-400/30 ${RESULT_MODAL_BOX_GOLD_CLASS}`}
                                            >
                                                <img
                                                    src="/images/icon/Gold.webp"
                                                    alt=""
                                                    className="relative z-[1] h-[48%] w-[48%] object-contain p-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:h-[46%] sm:w-[46%]"
                                                />
                                                <span className={ITEM_OBTAIN_COUNT_BADGE_CLASS}>+{currencyQty.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    );
                                }

                                if (isCurrency && !isGoldIcon) {
                                    return (
                                        <div key={item.id ?? `${item.name}-${index}`} className={tileWrapClass}>
                                            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-sky-400/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                            <div
                                                className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl ring-1 ring-sky-400/25 ${RESULT_MODAL_ADVENTURE_UNIFIED_SLOT_CLASS}`}
                                            >
                                                <img
                                                    src="/images/icon/Zem.webp"
                                                    alt=""
                                                    className="relative z-[1] h-[48%] w-[48%] object-contain p-0.5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:h-[46%] sm:w-[46%]"
                                                />
                                                <span className={ITEM_OBTAIN_COUNT_BADGE_CLASS}>+{currencyQty.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    );
                                }

                                /** 페어 영혼석: 획득 스냅샷 — 골드/다이아와 동일하게 +N으로 이번 지급 분만 표시 */
                                if (isPairSoulStoneItem(item)) {
                                    return (
                                        <div key={item.id ?? `${item.name}-${index}`} className={tileWrapClass}>
                                            <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-violet-400/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                            <div
                                                className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl ring-1 ring-violet-400/30 ${staticBorderClass}`}
                                            >
                                                <img src={styles.background} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                                {imagePath ? (
                                                    <img
                                                        src={imagePath}
                                                        alt=""
                                                        className="absolute z-[1] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                                                        style={itemSlotIconStyleForGrade(item.grade)}
                                                    />
                                                ) : null}
                                                <span className={ITEM_OBTAIN_COUNT_BADGE_CLASS}>
                                                    +{grantQty.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={item.id ?? `${item.name}-${index}`} className={tileWrapClass}>
                                        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-amber-400/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                                        <div
                                            className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl ${
                                                itemGrade === ItemGrade.Transcendent
                                                    ? 'transcendent-grade-slot'
                                                    : `ring-1 ring-slate-500/30 ${staticBorderClass}`
                                            }`}
                                        >
                                            <img src={styles.background} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                            <div className={GRADE_SLOT_SCRIM_CLASS} aria-hidden />
                                            {imagePath ? (
                                                <img
                                                    src={imagePath}
                                                    alt=""
                                                    className="absolute z-[1] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
                                                    style={itemSlotIconStyleForGrade(item.grade)}
                                                />
                                            ) : null}
                                            {!isPairPetMaterial(item) ? (
                                                <span className={ITEM_OBTAIN_COUNT_BADGE_CLASS}>
                                                    ×{(item.quantity != null && item.quantity > 0 ? item.quantity : 1).toLocaleString()}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-slate-600/45 bg-slate-900/40 px-4 py-8 text-center">
                            <p className="text-sm text-slate-400">{t('bulkObtained.noItems')}</p>
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
