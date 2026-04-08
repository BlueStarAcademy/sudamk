import React, { useMemo } from 'react';
import { User } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import { getMannerScore, getMannerRank, getMannerStyle, MANNER_RANKS } from '../services/manner.js';
import { getMannerEffects } from '../services/effectService.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

interface MannerRankModalProps {
    user: User;
    onClose: () => void;
    isTopmost?: boolean;
}

const MannerRankModal: React.FC<MannerRankModalProps> = ({ user, onClose, isTopmost }) => {
    const { isNativeMobile } = useNativeMobileShell();
    const totalMannerScore = getMannerScore(user);
    const mannerRank = getMannerRank(totalMannerScore);
    const mannerStyle = getMannerStyle(totalMannerScore);
    const currentEffects = getMannerEffects(user);

    // 현재 등급 정보
    const currentRankInfo = useMemo(() => {
        return MANNER_RANKS.find(rank => totalMannerScore >= rank.min && totalMannerScore <= rank.max) || MANNER_RANKS[0];
    }, [totalMannerScore]);

    // 다음 등급 정보
    const nextRankInfo = useMemo(() => {
        const currentIndex = MANNER_RANKS.findIndex(rank => rank.name === currentRankInfo.name);
        if (currentIndex < MANNER_RANKS.length - 1) {
            return MANNER_RANKS[currentIndex + 1];
        }
        return null;
    }, [currentRankInfo]);


    // 현재 적용 중인 효과 요약
    const activeEffects = useMemo(() => {
        const active: string[] = [];

        if (currentEffects.maxActionPoints > 30) {
            active.push(`최대 행동력: ${currentEffects.maxActionPoints} (기본 30 + ${currentEffects.maxActionPoints - 30})`);
        } else if (currentEffects.maxActionPoints < 30) {
            active.push(`최대 행동력: ${currentEffects.maxActionPoints} (기본 30 ${currentEffects.maxActionPoints - 30})`);
        }

        if (currentEffects.winGoldBonusPercent > 0) {
            active.push(`승리 골드 확률: +${currentEffects.winGoldBonusPercent}%`);
        }

        if (currentEffects.winDropBonusPercent > 0) {
            active.push(`승리 아이템 확률: +${currentEffects.winDropBonusPercent}%`);
        }

        if (currentEffects.disassemblyJackpotBonusPercent > 0) {
            active.push(`분해 대박 확률: +${currentEffects.disassemblyJackpotBonusPercent}%`);
        }

        if (currentEffects.allStatsFlatBonus > 0) {
            active.push(`모든 능력치 보너스: +${currentEffects.allStatsFlatBonus}`);
        }

        if (currentEffects.goldRewardMultiplier < 1) {
            active.push(`골드 보상: ${Math.round(currentEffects.goldRewardMultiplier * 100)}%`);
        }

        if (currentEffects.dropChanceMultiplier < 1) {
            active.push(`드롭 확률: ${Math.round(currentEffects.dropChanceMultiplier * 100)}%`);
        }

        if (currentEffects.actionPointRegenInterval > 300000) { // 5분보다 길면
            const minutes = Math.round(currentEffects.actionPointRegenInterval / 60000);
            active.push(`행동력 회복 시간 증가: ${minutes}분`);
        }

        return active;
    }, [currentEffects]);

    return (
        <DraggableWindow title="매너 등급 정보" onClose={onClose} windowId="manner-rank" initialWidth={600} isTopmost={isTopmost}>
            <div className={`flex flex-col ${isNativeMobile ? 'gap-2.5 p-2.5' : 'gap-4 p-4'}`}>
                {/* 현재 등급 정보 */}
                <div className={`bg-gray-800/50 rounded-lg border border-gray-700 ${isNativeMobile ? 'p-2.5' : 'p-4'}`}>
                    <div className={`flex items-center justify-between ${isNativeMobile ? 'mb-1.5' : 'mb-2'}`}>
                        <h3 className={`${isNativeMobile ? 'text-base' : 'text-lg'} font-bold text-gray-200`}>현재 등급</h3>
                        <span className={`${isNativeMobile ? 'text-lg' : 'text-xl'} font-bold ${mannerRank.color}`}>{mannerRank.rank}</span>
                    </div>
                    <div className={`flex items-center justify-between ${isNativeMobile ? 'mb-1.5 text-sm' : 'mb-2'}`}>
                        <span className="text-gray-400">매너 점수</span>
                        <span className="text-gray-200 font-semibold">{totalMannerScore}점</span>
                    </div>
                    <div className={`w-full bg-gray-700 rounded-full ${isNativeMobile ? 'mb-1.5 h-2.5' : 'mb-2 h-3'}`}>
                        <div className={`${mannerStyle.colorClass} h-full rounded-full transition-all`} style={{ width: `${mannerStyle.percentage}%` }}></div>
                    </div>
                    {nextRankInfo && (
                        <div className={`${isNativeMobile ? 'text-xs' : 'text-sm'} text-gray-400`}>
                            다음 등급까지: <span className="text-gray-200 font-semibold">{nextRankInfo.min - totalMannerScore}점</span>
                        </div>
                    )}
                </div>

                {/* 등급별 효과 정보 */}
                <div className={`bg-gray-800/50 rounded-lg border border-gray-700 ${isNativeMobile ? 'p-2.5' : 'p-4'}`}>
                    <h3 className={`${isNativeMobile ? 'mb-2 text-base' : 'mb-3 text-lg'} font-bold text-gray-200`}>등급별 효과</h3>
                    <div className={`overflow-y-auto ${isNativeMobile ? 'max-h-[42dvh] space-y-2 pr-1 pb-1' : 'max-h-96 space-y-3 pr-3 pb-4'}`}>
                        {MANNER_RANKS.slice().reverse().map((rank, index) => {
                            const isActive = totalMannerScore >= rank.min && totalMannerScore <= rank.max;
                            const rankColor = getMannerRank(rank.min === 0 ? 0 : rank.min).color;
                            const effects: string[] = [];
                            
                            // 긍정 효과 (누적)
                            if (rank.min >= 2000) {
                                effects.push('모든 능력치 +10');
                            }
                            if (rank.min >= 1600) {
                                effects.push('분해 대박 확률 +20%');
                            }
                            if (rank.min >= 1200) {
                                effects.push('승리 아이템 확률 +20%');
                            }
                            if (rank.min >= 800) {
                                effects.push('승리 골드 확률 +20%');
                            }
                            if (rank.min >= 400) {
                                effects.push('최대 행동력 +10');
                            }
                            
                            // 부정 효과
                            if (rank.max <= 0) {
                                effects.push('최대 행동력 -20');
                            }
                            if (rank.max <= 49 && rank.max > 0) {
                                effects.push('행동력 회복 시간 증가');
                            }
                            if (rank.max <= 99 && rank.max > 0) {
                                effects.push('승리 골드 보상 -50%');
                            }
                            if (rank.max <= 199 && rank.max > 0) {
                                effects.push('승리 아이템 확률 -50%');
                            }
                            
                            // 기본 등급
                            if (rank.min >= 200 && rank.max <= 399) {
                                effects.push('기본 효과 (효과 없음)');
                            }
                            
                            return (
                                <div
                                    key={index}
                                    className={`${isNativeMobile ? 'p-2' : 'p-3'} rounded-lg border ${isActive ? 'border-amber-400 bg-amber-900/20' : 'border-gray-700 bg-gray-900/30'}`}
                                >
                                    <div className={`flex items-center justify-between ${isNativeMobile ? 'mb-1.5' : 'mb-2'}`}>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold ${rankColor}`}>{rank.name}</span>
                                            {isActive && (
                                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/50 rounded">
                                                    나의 등급
                                                </span>
                                            )}
                                        </div>
                                        <span className={`${isNativeMobile ? 'text-[11px]' : 'text-xs'} text-gray-400`}>
                                            {rank.min === 0 && rank.max === 0 ? '0점' : 
                                             rank.max === Infinity ? `${rank.min}점 이상` : 
                                             `${rank.min}~${rank.max}점`}
                                        </span>
                                    </div>
                                    {effects.length > 0 && (
                                        <div className={`${isNativeMobile ? 'text-xs' : 'text-sm'} text-gray-300 space-y-1`}>
                                            {effects.map((effect, i) => (
                                                <div key={i}>• {effect}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </DraggableWindow>
    );
};

export default MannerRankModal;

