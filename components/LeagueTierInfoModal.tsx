import React from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../shared/i18n/config.js';
import DraggableWindow from './DraggableWindow.js';
import { LEAGUE_DATA, LEAGUE_WEEKLY_REWARDS } from '../constants';
import { LeagueRewardTier, LeagueTier } from '../types.js';

interface LeagueTierInfoModalProps {
    onClose: () => void;
    isTopmost?: boolean;
}

const lt = (key: string, opts?: Record<string, unknown>) => i18n.t(`inventory:${key}`, opts);

const formatRankRange = (start: number, end: number) => {
    return start === end ? lt('leagueTier.rankPlace', { rank: start }) : lt('leagueTier.rankRange', { start, end });
};

const getOutcomeLabel = (tier: LeagueTier, outcome: LeagueRewardTier['outcome']) => {
    // 챌린저 리그는 최상위 티어이므로 promote outcome도 잔류로 표시
    if (outcome === 'promote' && tier === LeagueTier.Challenger) {
        return lt('leagueTier.stay');
    }
    switch (outcome) {
        case 'promote':
            return lt('leagueTier.promote');
        case 'maintain':
            return lt('leagueTier.stay');
        case 'demote':
            return lt('leagueTier.demote');
        default:
            return '';
    }
};

const buildOutcomeSummary = (tier: LeagueTier, rewards: LeagueRewardTier[]) => {
    // 챌린저 리그의 경우 promote와 maintain를 모두 잔류로 표시하므로 합쳐서 처리
    const isChallenger = tier === LeagueTier.Challenger;
    
    // outcome별로 rank 범위 수집
    const outcomeRanges: Record<'promote' | 'maintain' | 'demote', { start: number; end: number }[]> = {
        promote: [],
        maintain: [],
        demote: [],
    };

    rewards.forEach(reward => {
        outcomeRanges[reward.outcome].push({ start: reward.rankStart, end: reward.rankEnd });
    });

    // 챌린저 리그의 경우 promote와 maintain를 합쳐서 잔류로 표시
    if (isChallenger) {
        const allMaintainRanges = [...outcomeRanges.promote, ...outcomeRanges.maintain];
        // 범위를 정렬하고 합치기
        allMaintainRanges.sort((a, b) => a.start - b.start);
        
        // 연속된 범위 합치기
        const mergedRanges: { start: number; end: number }[] = [];
        for (const range of allMaintainRanges) {
            if (mergedRanges.length === 0) {
                mergedRanges.push({ ...range });
            } else {
                const last = mergedRanges[mergedRanges.length - 1];
                if (range.start <= last.end + 1) {
                    // 연속되거나 겹치는 경우 합치기
                    last.end = Math.max(last.end, range.end);
                } else {
                    mergedRanges.push({ ...range });
                }
            }
        }
        
        const parts: string[] = [];
        if (mergedRanges.length > 0) {
            const rangeTexts = mergedRanges.map(r => formatRankRange(r.start, r.end));
            parts.push(lt('leagueTier.stayLine', { ranges: rangeTexts.join(', ') }));
        }
        if (outcomeRanges.demote.length > 0) {
            const demoteTexts = outcomeRanges.demote.map(r => formatRankRange(r.start, r.end));
            parts.push(lt('leagueTier.demoteLine', { ranges: demoteTexts.join(', ') }));
        }
        return parts.join(' / ');
    }

    // 일반 티어의 경우 기존 로직 사용
    const parts: string[] = [];
    (['promote', 'maintain', 'demote'] as const).forEach(outcome => {
        if (outcomeRanges[outcome].length > 0) {
            const label = getOutcomeLabel(tier, outcome);
            // 연속된 범위 합치기
            const sortedRanges = [...outcomeRanges[outcome]].sort((a, b) => a.start - b.start);
            const mergedRanges: { start: number; end: number }[] = [];
            for (const range of sortedRanges) {
                if (mergedRanges.length === 0) {
                    mergedRanges.push({ ...range });
                } else {
                    const last = mergedRanges[mergedRanges.length - 1];
                    if (range.start <= last.end + 1) {
                        last.end = Math.max(last.end, range.end);
                    } else {
                        mergedRanges.push({ ...range });
                    }
                }
            }
            const rangeTexts = mergedRanges.map(r => formatRankRange(r.start, r.end));
            parts.push(`${label}: ${rangeTexts.join(', ')}`);
        }
    });

    return parts.join(' / ');
};

const LeagueTierInfoModal: React.FC<LeagueTierInfoModalProps> = ({ onClose, isTopmost }) => {
    const { t } = useTranslation('inventory');

    const renderReward = (rewardTier: LeagueRewardTier, tier: LeagueTier) => {
        const rankText = rewardTier.rankStart === rewardTier.rankEnd
            ? t('leagueTier.rankPlace', { rank: rewardTier.rankStart })
            : t('leagueTier.rankRange', { start: rewardTier.rankStart, end: rewardTier.rankEnd });

        let outcomeText = '';
        let outcomeColor = '';
        // 챌린저 리그는 최상위 티어이므로 promote outcome도 잔류로 표시
        if (tier === LeagueTier.Challenger && rewardTier.outcome === 'promote') {
            outcomeText = t('leagueTier.stay');
            outcomeColor = 'text-gray-400';
        } else {
            switch (rewardTier.outcome) {
                case 'promote':
                    outcomeText = t('leagueTier.promote');
                    outcomeColor = 'text-green-400';
                    break;
                case 'maintain':
                    outcomeText = t('leagueTier.stay');
                    outcomeColor = 'text-gray-400';
                    break;
                case 'demote':
                    outcomeText = t('leagueTier.demote');
                    outcomeColor = 'text-red-400';
                    break;
            }
        }

        return (
            <li key={rewardTier.rankStart} className="flex justify-between items-center bg-gray-700/50 px-3 py-1.5 rounded-md">
                <span className="font-semibold">{rankText}</span>
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-yellow-300">
                        <img src="/images/icon/Zem.webp" alt={t('leagueTier.diamondsAlt')} className="w-4 h-4" />
                        {rewardTier.diamonds}
                    </span>
                    <span className={`font-bold w-12 text-center ${outcomeColor}`}>{outcomeText}</span>
                </div>
            </li>
        );
    };

    return (
        <DraggableWindow title={t('leagueTier.titleRanking')} onClose={onClose} windowId="league-tier-info-modal" initialWidth={550} isTopmost={isTopmost}>
            <div className="space-y-4">
                <p className="text-sm text-gray-300 text-center">
                    {t('leagueTier.intro')}
                </p>

                <ul className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                    {LEAGUE_DATA.map(tierData => {
                        const rewards = LEAGUE_WEEKLY_REWARDS[tierData.tier];
                        return (
                            <li key={tierData.tier} className="p-3 bg-gray-900/50 rounded-lg">
                                <div className="flex items-center gap-4">
                                   <img src={tierData.icon} alt={tierData.name} className="w-12 h-12 flex-shrink-0" />
                                   <div>
                                     <h3 className="text-lg font-bold">{tierData.name}</h3>
                                     <p className="text-xs text-gray-400">{t('leagueTier.rankHintShort')}</p>
                                     <p className="text-[11px] text-gray-500 mt-1">
                                         {buildOutcomeSummary(tierData.tier, rewards)}
                                     </p>
                                   </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-700/50">
                                   <h4 className="text-sm font-semibold text-gray-400 mb-1.5">{t('leagueTier.weeklyReward')}</h4>
                                   <ul className="space-y-1 text-xs">
                                       {rewards.map(reward => renderReward(reward, tierData.tier))}
                                   </ul>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </DraggableWindow>
    );
};

export default LeagueTierInfoModal;