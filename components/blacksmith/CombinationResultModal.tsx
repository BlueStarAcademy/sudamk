
import { useLocalizedItemGrade, useLocalizedEquipmentSlot } from '../../shared/i18n/localizedCatalog.js';
import { useTranslation } from 'react-i18next';
import React from 'react';
import { MythicSubsPartitioned } from '../MythicSubsPartitioned.js';
import { formatSpecialSubLineForPanel } from '../../shared/utils/specialStatMilestones.js';
import DraggableWindow from '../DraggableWindow';
import { InventoryItem, ItemGrade } from '../../types';
import ResourceActionButton from '../ui/ResourceActionButton';
import { itemSlotIconStyle, ITEM_SLOT_ICON_SIZE_PCT } from '../../shared/constants/itemSlotIconLayout.js';

// This is the same detailed item display used in the EnhancementView
const gradeStyles: Record<ItemGrade, { color: string; background: string; }> = {
    normal: { color: 'text-gray-300', background: '/images/equipments/normalbgi.webp' },
    uncommon: { color: 'text-green-400', background: '/images/equipments/uncommonbgi.webp' },
    rare: { color: 'text-blue-400', background: '/images/equipments/rarebgi.webp' },
    epic: { color: 'text-purple-400', background: '/images/equipments/epicbgi.webp' },
    legendary: { color: 'text-red-500', background: '/images/equipments/legendarybgi.webp' },
    mythic: { color: 'text-amber-400', background: '/images/equipments/mythicbgi.webp' },
    transcendent: { color: 'text-cyan-300', background: '/images/equipments/transcendentbgi.webp' },
};

const renderStarDisplay = (stars: number) => {
    if (stars === 0) return null;
    let starImage = '';
    if (stars >= 10) starImage = '/images/equipments/Star4.webp';
    else if (stars >= 7) starImage = '/images/equipments/Star3.webp';
    else if (stars >= 4) starImage = '/images/equipments/Star2.webp';
    else if (stars >= 1) starImage = '/images/equipments/Star1.webp';

    return (
        <div
            className="absolute right-1.5 top-0.5 z-10 flex items-center gap-0.5 rounded-bl-md bg-black/45 px-1 py-0.5 backdrop-blur-[2px]"
            style={{ textShadow: '1px 1px 2px black' }}
        >
            <img src={starImage} alt="star" className="w-3 h-3" />
            <span className={`font-bold text-xs leading-none`}>{stars}</span>
        </div>
    );
};

const ItemDisplay: React.FC<{ item: InventoryItem }> = ({ item }) => {
    const { t } = useTranslation('blacksmith');
    const styles = gradeStyles[item.grade];
    return (
        <div className="flex flex-col w-full h-full p-1 bg-black/20 rounded-lg">
            <div className="flex mb-2">
                <div className={`relative w-20 h-20 rounded-lg flex-shrink-0 mr-3 ${item.grade === ItemGrade.Transcendent ? 'transcendent-grade-slot' : ''}`}>
                    <img src={styles.background} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-lg" />
                    {item.image && (
                        <img
                            src={item.image}
                            alt={item.name}
                            className="absolute object-contain"
                            style={itemSlotIconStyle(ITEM_SLOT_ICON_SIZE_PCT)}
                        />
                    )}
                    {renderStarDisplay(item.stars)}
                </div>
                <div className="flex-grow pt-2 min-w-0">
                    <h3 className={`text-base font-bold whitespace-nowrap overflow-hidden text-ellipsis ${styles.color}`} title={item.name}>{item.name}</h3>
                    {item.options?.main && (
                        <p className="font-semibold text-yellow-300 text-xs whitespace-nowrap overflow-hidden text-ellipsis" title={item.options.main.display}>{item.options.main.display}</p>
                    )}
                    {/* 제련 가능 횟수 표시 */}
                    <p className={`text-xs font-semibold mt-1 ${(item as any).refinementCount > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                        {t('combinationResult.refinementPrefix')} {(item as any).refinementCount > 0 ? t('combinationResult.refinementCount', { value: t('combinationResult.refinementTimes', { count: (item as any).refinementCount }) }) : t('combinationResult.refinementUnavailable')}
                    </p>
                </div>
            </div>
            <div className="w-full text-sm text-left space-y-1 bg-black/30 p-2 rounded-lg flex-grow overflow-y-auto">
                {item.options?.combatSubs && item.options.combatSubs.length > 0 && (
                    <div className="space-y-0.5">
                        {item.options.combatSubs.map((opt, i) => <p key={`c-${i}`} className="text-blue-300">{opt.display}</p>)}
                    </div>
                )}
                {item.options?.specialSubs && item.options.specialSubs.length > 0 && (
                     <div className="space-y-0.5">
                        {item.options.specialSubs.map((opt, i) => (
                            <p key={`s-${i}`} className="text-green-300">
                                {formatSpecialSubLineForPanel(opt, item.stars ?? 0)}
                            </p>
                        ))}
                    </div>
                )}
                {item.options?.mythicSubs && item.options.mythicSubs.length > 0 ? (
                    <MythicSubsPartitioned subs={item.options.mythicSubs} />
                ) : null}
            </div>
        </div>
    );
};

interface CombinationResultModalProps {
    result: {
        item: InventoryItem;
        xpGained: number;
        isGreatSuccess: boolean;
    };
    onClose: () => void;
    isTopmost?: boolean;
}

const CombinationResultModal: React.FC<CombinationResultModalProps> = ({ result, onClose }) => {
    const { t } = useTranslation('blacksmith');
    const localizedGrade = useLocalizedItemGrade();
    const { item, xpGained, isGreatSuccess } = result;

    return (
        <DraggableWindow 
            title={isGreatSuccess ? t('combinationResult.greatSuccess') : t('combinationResult.success')} 
            onClose={onClose} 
            windowId="combination-result"
            initialWidth={400}
            variant="store"
        >
            <div className="text-center flex flex-col items-center">
                <div className="w-full max-w-xs">
                    <ItemDisplay item={item} />
                </div>
                
                <div className="mt-4 bg-gray-900/50 p-4 rounded-lg text-lg w-full max-w-xs">
                    <div className="flex justify-between items-center">
                        <span className="flex items-center gap-1"><img src="/images/equipments/moru.webp" alt={t('combinationResult.expGain')} className="w-5 h-5" /> {t('combinationResult.expGainLabel')}</span>
                        <span className="font-bold text-orange-400">+{xpGained.toLocaleString()}</span>
                    </div>
                </div>

                <ResourceActionButton onClick={onClose} className="w-full mt-6 py-2.5 max-w-xs" variant="materials">{t('actions.ok', { ns: 'common' })}</ResourceActionButton>
            </div>
        </DraggableWindow>
    );
};

export default CombinationResultModal;
