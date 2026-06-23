import React from 'react';
import { useTranslation } from 'react-i18next';
import DraggableWindow from './DraggableWindow.js';
import { RANKING_TIERS, SEASONAL_TIER_REWARDS, CONSUMABLE_ITEMS } from '../constants';
import { QuestReward } from '../types.js';
import { RANKING_MODAL_SLIM_SCROLL_Y } from '../shared/constants/rankingModalScrollbar.js';
import { translateRankingTierName } from '../shared/i18n/rankingTierText.js';

interface TierInfoModalProps {
    onClose: () => void;
}

const TierInfoModal: React.FC<TierInfoModalProps> = ({ onClose }) => {
    const { t } = useTranslation('inventory');
    const tierKeyByName: Record<string, string> = {
        '챌린저': 'champion',
        '마스터': 'master',
        '다이아': 'diamond',
        '플래티넘': 'platinum',
        '골드': 'gold',
        '실버': 'silver',
        '브론즈': 'bronze',
        '루키': 'iron',
        '새싹': 'unranked',
    };
    const tierRequirement = (name: string) => {
        const key = tierKeyByName[name];
        return key ? t(`tierInfo.${key}`) : 'N/A';
    };

    const getItemImage = (itemName: string): string | null => {
        if (itemName.includes('다이아')) return '/images/icon/Zem.webp';
        const item = CONSUMABLE_ITEMS.find(i => i.name === itemName);
        return item?.image || null;
    };

    const renderReward = (tierName: string) => {
        const reward: QuestReward | undefined = SEASONAL_TIER_REWARDS[tierName];
        if (!reward) return <span className="text-gray-500">{t('tierInfo.noReward')}</span>;
        
        const rewardsToShow: { name: string, image: string | null }[] = [];
        if (reward.diamonds) {
            rewardsToShow.push({ name: `${reward.diamonds.toLocaleString()}`, image: '/images/icon/Zem.webp' });
        }
        if (reward.items) {
            reward.items.forEach(item => {
                const itemName = 'itemId' in item ? item.itemId : item.name;
                const itemImage = getItemImage(itemName);
                rewardsToShow.push({ name: `${itemName} x${item.quantity}`, image: itemImage });
            });
        }

        return (
            <div className="flex items-center gap-2 flex-wrap">
                {rewardsToShow.map((r, index) => (
                    r.image && (
                        <div key={index} className="flex items-center gap-1.5 bg-gray-700/50 px-2 py-1 rounded-md" title={r.name}>
                            <img src={r.image} alt={r.name} className="w-5 h-5 object-contain" />
                            <span className="text-gray-300 whitespace-nowrap text-xs">{r.name}</span>
                        </div>
                    )
                ))}
            </div>
        );
    };

    return (
        <DraggableWindow title={t('tierInfo.title')} onClose={onClose} windowId="ranking-tier-info-modal" initialWidth={600}>
            <div className="space-y-4">
                <p className="text-sm text-gray-300">
                    {t('tierInfo.intro')}
                </p>

                <div className="bg-gray-900/50 p-3 rounded-lg">
                    <h4 className="font-bold text-lg text-yellow-300 mb-2">{t('tierInfo.scheduleTitle')}</h4>
                    <ul className="text-sm text-gray-300 space-y-1">
                        <li>{t('tierInfo.season1')}</li>
                        <li>{t('tierInfo.season2')}</li>
                        <li>{t('tierInfo.season3')}</li>
                        <li>{t('tierInfo.season4')}</li>
                    </ul>
                    <p className="text-xs text-gray-400 mt-2">
                        {t('tierInfo.seasonResetDesc')}
                    </p>
                </div>

                <ul className={`space-y-2 max-h-[40vh] overflow-y-auto pr-2 ${RANKING_MODAL_SLIM_SCROLL_Y}`}>
                    {RANKING_TIERS.map(tier => (
                        <li key={tier.name} className="p-3 bg-gray-900/50 rounded-lg">
                            <div className="flex items-center">
                                <img src={tier.icon} alt={tier.name} className="w-12 h-12 mr-4 flex-shrink-0" />
                                <div className="flex-grow">
                                    <p className={`font-bold text-lg ${tier.color}`}>{translateRankingTierName(tier.name)}</p>
                                    <p className="text-sm text-gray-400">{tierRequirement(tier.name)}</p>
                                </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-700/50">
                                <h5 className="text-xs font-semibold text-gray-400 mb-1.5">{t('tierInfo.endReward')}</h5>
                                {renderReward(tier.name)}
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </DraggableWindow>
    );
};

export default TierInfoModal;