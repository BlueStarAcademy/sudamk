
import { useLocalizedItemGrade, useLocalizedEquipmentSlot } from '../../shared/i18n/localizedCatalog.js';
import { useTranslation } from 'react-i18next';
import React, { useState, useMemo } from 'react';
import { InventoryItem, ServerAction, ItemGrade, EquipmentSlot, UserWithStatus } from '../../types.js';
import ResourceActionButton from '../ui/ResourceActionButton.js';
import { BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES } from '../../constants/rules.js';
import { formatBlacksmithPercentInt } from '../../shared/utils/formatBlacksmithPercentInt.js';
import { getBlacksmithViewerTypography, BLACKSMITH_MOBILE_WORK_ROOT_CLASS } from '../../shared/constants/blacksmithViewerTypography.js';
import { itemSlotIconStyleForGrade } from '../../shared/constants/itemSlotIconLayout.js';

const gradeStyles: Record<ItemGrade, { color: string; background: string; }> = {
    normal: { color: 'text-gray-300', background: '/images/equipments/normalbgi.webp' },
    uncommon: { color: 'text-green-400', background: '/images/equipments/uncommonbgi.webp' },
    rare: { color: 'text-blue-400', background: '/images/equipments/rarebgi.webp' },
    epic: { color: 'text-purple-400', background: '/images/equipments/epicbgi.webp' },
    legendary: { color: 'text-red-500', background: '/images/equipments/legendarybgi.webp' },
    mythic: { color: 'text-amber-400', background: '/images/equipments/mythicbgi.webp' },
    transcendent: { color: 'text-cyan-300', background: '/images/equipments/transcendentbgi.webp' },
};

const ALL_SLOTS: EquipmentSlot[] = ['fan', 'board', 'top', 'bottom', 'bowl', 'stones'];


const getProbabilityPanelTypography = (pcViewer: boolean, mobileWork = false) => {
    const typo = getBlacksmithViewerTypography(pcViewer, { mobileWork });
    if (pcViewer) {
        return {
            heading: `${typo.headingLg} mb-2`,
            list: 'mx-auto flex w-full max-w-[13rem] flex-col gap-1.5 text-lg leading-snug',
            row: 'flex items-baseline justify-between gap-8',
            label: 'text-slate-400',
            value: 'min-w-[3.25rem] text-right font-bold tabular-nums',
        };
    }
    if (mobileWork) {
        return {
            heading: `${typo.headingLg} mb-1.5`,
            list: 'mx-auto flex w-full max-w-[11rem] flex-col gap-1.5 text-sm leading-snug',
            row: 'flex items-baseline justify-between gap-5',
            label: 'text-slate-400',
            value: 'min-w-[2.75rem] text-right font-semibold tabular-nums',
        };
    }
    return {
        heading: `${typo.heading} mb-1.5`,
        list: 'mx-auto flex w-full max-w-[10rem] flex-col gap-1 text-xs leading-snug',
        row: 'flex items-baseline justify-between gap-4',
        label: 'text-slate-400',
        value: 'min-w-[2.25rem] text-right font-semibold tabular-nums',
    };
};

const getMaterialSlotHeightClass = (isCompact: boolean) =>
    isCompact ? 'h-[6.25rem] w-full' : 'h-[8.25rem] w-1/3';

const ItemSlot: React.FC<{ item: InventoryItem | null; onRemove: () => void; isCompact?: boolean; pcViewer?: boolean; mobileWork?: boolean }> = ({
    item,
    onRemove,
    isCompact = false,
    pcViewer = false,
    mobileWork = false,
}) => {
    const { t } = useTranslation('blacksmith');
    const localizedSlot = useLocalizedEquipmentSlot();
    const typo = getBlacksmithViewerTypography(pcViewer, { mobileWork });
    if (!item) {
        return (
            <div className={`${getMaterialSlotHeightClass(isCompact)} rounded-lg border-2 border-dashed border-amber-500/30 bg-black/35 ${typo.body} text-amber-100/70 flex items-center justify-center`}>
                {t('combine.emptyMaterial')}
            </div>
        );
    }

    const styles = gradeStyles[item.grade];
    const isTranscendent = item.grade === ItemGrade.Transcendent;

    return (
        <button
            type="button"
            onClick={onRemove}
            title={t('combine.removeMaterial')}
            aria-label={t('combine.removeMaterialAria', { name: item.name })}
            className={`${getMaterialSlotHeightClass(isCompact)} ${isCompact ? 'p-1.5' : 'p-2.5'} relative cursor-pointer rounded-lg border border-amber-400/20 bg-gradient-to-b from-[#191e2b]/80 via-[#121724]/90 to-[#0c1018]/95 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] flex flex-col items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70`}
        >
            <div
                className={`relative ${isCompact ? 'h-14 w-14' : 'h-16 w-16'} flex-shrink-0 overflow-hidden rounded-lg border border-slate-500/50 bg-transparent ${isTranscendent ? 'transcendent-grade-slot' : ''}`}
            >
                <img src={styles.background} alt="" className="absolute inset-0 h-full w-full rounded-lg object-cover" />
                {item.image && (
                    <img
                        src={item.image}
                        alt=""
                        className="pointer-events-none absolute object-contain"
                        style={itemSlotIconStyleForGrade(item.grade)}
                    />
                )}
            </div>
            <p className={`${isCompact ? typo.caption : typo.bodySemi} font-bold ${styles.color} whitespace-nowrap overflow-hidden text-ellipsis w-full`} title={item.name}>{item.name}</p>
            <p className={`${isCompact ? typo.caption : typo.body} text-slate-400`}>{item.slot ? localizedSlot(item.slot) : t('combine.slotFallback')}</p>
        </button>
    );
};

const OutcomeProbability: React.FC<{
    items: (InventoryItem | null)[];
    isRandom: boolean;
    className?: string;
    pcViewer?: boolean;
    mobileWork?: boolean;
}> = ({ items, isRandom, className = '', pcViewer = false, mobileWork = false }) => {
    const { t } = useTranslation('blacksmith');
    const localizedSlot = useLocalizedEquipmentSlot();
    const probTypo = getProbabilityPanelTypography(pcViewer, mobileWork);
    const probabilities = useMemo(() => {
        const probs = new Map<EquipmentSlot, number>();
        for (const slot of ALL_SLOTS) {
            probs.set(slot, 0);
        }

        const validItems = items.filter((i): i is InventoryItem => i !== null);
        if (validItems.length !== 3) {
            return probs;
        }

        if (isRandom) {
            const prob = 1 / ALL_SLOTS.length;
            for (const slot of ALL_SLOTS) {
                probs.set(slot, prob);
            }
        } else {
            const slotCounts = new Map<EquipmentSlot, number>();
            for (const item of validItems) {
                if (item.slot) {
                    slotCounts.set(item.slot, (slotCounts.get(item.slot) || 0) + 1);
                }
            }
            for (const slot of ALL_SLOTS) {
                probs.set(slot, (slotCounts.get(slot) ?? 0) / 3);
            }
        }
        return probs;
    }, [items, isRandom]);

    return (
        <div
            className={`w-full rounded-xl border border-amber-400/20 bg-gradient-to-b from-[#171c29]/75 via-black/35 to-black/45 p-2.5 ${className}`.trim()}
        >
            <h4 className={`text-center text-amber-100 ${probTypo.heading}`}>{t('combine.resultSlotProb')}</h4>
            <div className={probTypo.list}>
                {ALL_SLOTS.map((slot) => (
                    <div key={slot} className={probTypo.row}>
                        <span className={probTypo.label}>{localizedSlot(slot)}:</span>
                        <span className={`${probTypo.value} text-emerald-200`}>{formatBlacksmithPercentInt((probabilities.get(slot) ?? 0) * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const GradeProbability: React.FC<{
    items: (InventoryItem | null)[];
    currentUser: UserWithStatus;
    className?: string;
    pcViewer?: boolean;
    mobileWork?: boolean;
}> = ({ items, currentUser, className = '', pcViewer = false, mobileWork = false }) => {
    const { t } = useTranslation('blacksmith');
    const probTypo = getProbabilityPanelTypography(pcViewer, mobileWork);
    const { blacksmithLevel } = currentUser;
    const probabilities = useMemo(() => {
        const validItems = items.filter((i): i is InventoryItem => i !== null);
        if (validItems.length !== 3 || new Set(validItems.map(i => i.grade)).size !== 1) {
            return { successRate: 0, greatSuccessRate: 0 };
        }

        const grade = validItems[0].grade;
        const levelIndex = (blacksmithLevel ?? 1) - 1;
        const greatSuccessRate = BLACKSMITH_COMBINATION_GREAT_SUCCESS_RATES[levelIndex]?.[grade] ?? 0;
        const successRate = 100 - greatSuccessRate;

        return { successRate, greatSuccessRate };
    }, [items, blacksmithLevel]);

    return (
        <div
            className={`w-full rounded-xl border border-amber-400/20 bg-gradient-to-b from-[#171c29]/75 via-black/35 to-black/45 p-2.5 ${className}`.trim()}
        >
            <h4 className={`text-center text-amber-100 ${probTypo.heading}`}>{t('combine.resultGradeProb')}</h4>
            <div className={probTypo.list}>
                <div className={probTypo.row}>
                    <span className={probTypo.label}>{t('successLabel', { ns: 'common' })}</span>
                    <span className={`${probTypo.value} text-emerald-200`}>{formatBlacksmithPercentInt(probabilities.successRate)}%</span>
                </div>
                <div className={probTypo.row}>
                    <span className="text-yellow-400">{t('combine.greatSuccess')}</span>
                    <span className={`${probTypo.value} text-amber-200`}>{formatBlacksmithPercentInt(probabilities.greatSuccessRate)}%</span>
                </div>
            </div>
        </div>
    );
}

interface CombinationViewProps {
    items: (InventoryItem | null)[];
    onRemoveItem: (index: number) => void;
    onAction: (action: ServerAction) => Promise<void>;
    currentUser: UserWithStatus;
    stackedViewport?: boolean;
    isBlacksmithBusy?: boolean;
}

const CombinationView: React.FC<CombinationViewProps> = ({
    items,
    onRemoveItem,
    onAction,
    currentUser,
    stackedViewport = false,
    isBlacksmithBusy = false,
}) => {
    const { t } = useTranslation('blacksmith');
    const localizedGrade = useLocalizedItemGrade();
    const localizedSlot = useLocalizedEquipmentSlot();
    const isMobile = stackedViewport;
    const pcViewer = !isMobile;
    const typo = getBlacksmithViewerTypography(pcViewer, { mobileWork: isMobile });
    const [isRandom, setIsRandom] = useState(false);

    const handleCombine = () => {
        const itemIds = items.map(i => i?.id).filter((id): id is string => !!id);
        if (itemIds.length === 3) {
            void onAction({ type: 'COMBINE_ITEMS', payload: { itemIds, isRandom } });
        }
    };
    
    const canCombine = items.every(item => item !== null) && new Set(items.map(i => i?.grade)).size === 1;

    return (
        <div className={`${isMobile ? `${BLACKSMITH_MOBILE_WORK_ROOT_CLASS} min-h-[min(72dvh,100%)]` : 'h-full min-h-0'} flex w-full flex-col items-center gap-2.5`}>
            <div className={`w-full shrink-0 ${isMobile ? 'grid grid-cols-3 gap-1.5' : 'flex justify-around items-stretch gap-2'}`}>
                {items.map((item, index) => (
                    <ItemSlot
                        key={index}
                        item={item}
                        onRemove={() => onRemoveItem(index)}
                        isCompact={isMobile}
                        pcViewer={pcViewer}
                        mobileWork={isMobile}
                    />
                ))}
            </div>

            <div className="grid w-full shrink-0 flex-1 grid-cols-2 items-stretch gap-2">
                <OutcomeProbability items={items} isRandom={isRandom} pcViewer={pcViewer} mobileWork={isMobile} />
                <div className="flex min-h-0 flex-col gap-2">
                    <GradeProbability items={items} currentUser={currentUser} pcViewer={pcViewer} mobileWork={isMobile} className="flex-1" />
                    <div className={`mt-auto flex flex-col items-center ${isMobile ? 'space-y-2' : 'space-y-2 pt-1'}`}>
                        <div className={`flex w-full items-center justify-center gap-2 ${typo.body} text-slate-300`}>
                            <input
                                type="checkbox"
                                id="random-combine"
                                checked={isRandom}
                                onChange={(e) => setIsRandom(e.target.checked)}
                                className={`${isMobile ? 'h-4 w-4' : 'h-4 w-4'} rounded text-accent bg-slate-800 border-slate-600 focus:ring-accent`}
                            />
                            <label htmlFor="random-combine" className={`${typo.body} text-slate-200`}>{t('combine.randomCombine')}</label>
                        </div>

                        <ResourceActionButton
                            onClick={handleCombine}
                            disabled={!canCombine || isBlacksmithBusy}
                            variant="materials"
                            className={`shrink-0 w-full max-w-xs ${typo.bodySemi} py-2.5 px-6`}
                        >
                            {isBlacksmithBusy ? t('combine.combining') : t('combine.combineBtn')}
                        </ResourceActionButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CombinationView;
