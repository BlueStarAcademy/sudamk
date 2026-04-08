import React, { useState, useMemo, useEffect } from 'react';
import { UserWithStatus, CoreStat, ServerAction } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import RadarChart from './RadarChart.js';
import { CORE_STATS_DATA } from '../constants';

interface StatAllocationModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    isTopmost?: boolean;
}

const StatAllocationModal: React.FC<StatAllocationModalProps> = ({ currentUser, onClose, onAction, isTopmost }) => {
    const isMobile = false;
    
    // 모달이 열릴 때: 남은 보너스 포인트가 있으면 항상 편집 모드 활성화
    // 기존에 분배한 포인트는 초기화를 해야만 조절 가능하고, 현재 남아있는 보너스 포인트는 바로 조절 가능
    const [isEditing, setIsEditing] = useState(() => {
        // 남은 보너스 포인트가 있으면 항상 편집 모드
        const levelPoints = (currentUser.strategyLevel - 1) * 2 + (currentUser.playfulLevel - 1) * 2;
        const bonusPoints = currentUser.bonusStatPoints || 0;
        const totalBonusPoints = levelPoints + bonusPoints;
        const existingSpentPoints = currentUser.spentStatPoints || {};
        const existingTotalSpent = Object.values(existingSpentPoints).reduce((sum, points) => sum + points, 0);
        const availablePoints = totalBonusPoints - existingTotalSpent;
        
        // 남은 보너스 포인트가 있으면 편집 모드 활성화
        return availablePoints > 0;
    });
    const [tempPoints, setTempPoints] = useState<Record<CoreStat, number>>(() => {
        if (currentUser.spentStatPoints && Object.keys(currentUser.spentStatPoints).length > 0) {
            return currentUser.spentStatPoints;
        } else {
            return {
                [CoreStat.Concentration]: 0,
                [CoreStat.ThinkingSpeed]: 0,
                [CoreStat.Judgment]: 0,
                [CoreStat.Calculation]: 0,
                [CoreStat.CombatPower]: 0,
                [CoreStat.Stability]: 0,
            };
        }
    });

    const resetCost = 1000; // 골드로 변경 (서버와 일치)
    const maxDailyResets = 2;
    const currentDay = new Date().toDateString();
    const lastResetDate = currentUser.lastStatResetDate;
    const statResetCountToday = currentUser.statResetCountToday || 0;

    const canReset = useMemo(() => {
        // 골드 확인
        if ((currentUser.gold || 0) < resetCost) return false;
        if (lastResetDate === currentDay && statResetCountToday >= maxDailyResets) return false;
        return true;
    }, [currentUser.gold, lastResetDate, statResetCountToday, currentDay, resetCost]);

    const levelPoints = useMemo(() => {
        return (currentUser.strategyLevel - 1) * 2 + (currentUser.playfulLevel - 1) * 2;
    }, [currentUser.strategyLevel, currentUser.playfulLevel]);
    
    const bonusPoints = useMemo(() => {
        return currentUser.bonusStatPoints || 0;
    }, [currentUser.bonusStatPoints]);
    
    const totalBonusPoints = useMemo(() => {
        return levelPoints + bonusPoints;
    }, [levelPoints, bonusPoints]);

    const spentPoints = useMemo(() => {
        return Object.values(tempPoints).reduce((sum, points) => sum + points, 0);
    }, [tempPoints]);

    const availablePoints = useMemo(() => {
        // 항상 실제 사용 가능한 포인트를 계산하여 표시 (읽기 전용 모드에서도)
        return totalBonusPoints - spentPoints;
    }, [totalBonusPoints, spentPoints]);

    const handlePointChange = (stat: CoreStat, value: string) => {
        const newValue = Number(value) || 0;
        setTempPoints(prev => {
            // 기존에 분배한 포인트는 고정 (초기화 전까지 변경 불가)
            const existingSpentPoints = currentUser.spentStatPoints || {};
            const existingSpentOnThisStat = existingSpentPoints[stat] || 0;
            const existingTotalSpent = Object.values(existingSpentPoints).reduce((sum, points) => sum + points, 0);
            
            // 현재 tempPoints에서 다른 능력치에 추가로 분배한 포인트 계산
            const currentTotalSpent = Object.values(prev).reduce((sum, points) => sum + points, 0);
            const additionalSpentInOtherStats = currentTotalSpent - existingTotalSpent - (prev[stat] - existingSpentOnThisStat);
            
            // 실제 사용 가능한 포인트 = 전체 사용 가능 포인트 - 기존 분배 포인트 - 다른 능력치에 추가로 분배한 포인트
            const totalAvailablePoints = totalBonusPoints - existingTotalSpent;
            const actuallyAvailablePoints = totalAvailablePoints - additionalSpentInOtherStats;
            
            // 기존 분배 포인트는 최소값으로 유지하고, 남은 보너스 포인트만 추가 분배 가능
            // newValue는 전체 분배 값이므로, 기존 분배를 뺀 나머지가 실제 사용 가능한 포인트를 초과하지 않아야 함
            const additionalPoints = newValue - existingSpentOnThisStat;
            
            // 추가 분배할 수 있는 최대값은 실제 사용 가능한 포인트
            const maxAdditional = Math.max(0, Math.min(additionalPoints, actuallyAvailablePoints));
            const finalValue = existingSpentOnThisStat + maxAdditional;
            
            return { ...prev, [stat]: finalValue };
        });
    };

    // currentUser가 업데이트되면 tempPoints와 isEditing 업데이트
    useEffect(() => {
        // tempPoints 업데이트: 기존 분배 포인트를 유지
        if (currentUser.spentStatPoints && Object.keys(currentUser.spentStatPoints).length > 0) {
            setTempPoints(currentUser.spentStatPoints);
        } else {
            // spentStatPoints가 없으면 초기화
            setTempPoints({
                [CoreStat.Concentration]: 0,
                [CoreStat.ThinkingSpeed]: 0,
                [CoreStat.Judgment]: 0,
                [CoreStat.Calculation]: 0,
                [CoreStat.CombatPower]: 0,
                [CoreStat.Stability]: 0,
            });
        }
        
        // isEditing 업데이트: 남은 보너스 포인트가 있으면 편집 모드 활성화
        const levelPoints = (currentUser.strategyLevel - 1) * 2 + (currentUser.playfulLevel - 1) * 2;
        const bonusPoints = currentUser.bonusStatPoints || 0;
        const totalBonusPoints = levelPoints + bonusPoints;
        const existingSpentPoints = currentUser.spentStatPoints || {};
        const existingTotalSpent = Object.values(existingSpentPoints).reduce((sum, points) => sum + points, 0);
        const availablePoints = totalBonusPoints - existingTotalSpent;
        
        // 남은 보너스 포인트가 있으면 편집 모드 활성화
        setIsEditing(availablePoints > 0);
    }, [currentUser.spentStatPoints, currentUser.bonusStatPoints, currentUser.strategyLevel, currentUser.playfulLevel]);

    const handleReset = () => {
        if (!canReset) {
            alert("능력치 초기화 조건을 충족하지 못했습니다. 골드가 부족하거나 일일 초기화 횟수를 초과했습니다.");
            return;
        }
        if (window.confirm(`골드 ${resetCost.toLocaleString()}개를 사용하여 모든 보너스 포인트를 초기화하시겠습니까? (오늘 ${maxDailyResets - statResetCountToday}회 남음)`)) {
            // 서버 액션 실행 (비동기로 처리하되 모달은 유지)
            onAction({ type: 'RESET_STAT_POINTS' });
            // 초기화 후 즉시 편집 모드 활성화 및 tempPoints 초기화
            setTempPoints({
                [CoreStat.Concentration]: 0,
                [CoreStat.ThinkingSpeed]: 0,
                [CoreStat.Judgment]: 0,
                [CoreStat.Calculation]: 0,
                [CoreStat.CombatPower]: 0,
                [CoreStat.Stability]: 0,
            });
            // 초기화 후 바로 분배 가능하도록 편집 모드 활성화
            setIsEditing(true);
        }
    };
    
    const hasChanges = useMemo(() => {
        if (!currentUser.spentStatPoints) return spentPoints > 0; // If no points spent, any spent points means changes
        return Object.values(CoreStat).some(stat => tempPoints[stat] !== currentUser.spentStatPoints![stat]);
    }, [tempPoints, currentUser.spentStatPoints, spentPoints]);

    const handleConfirm = () => {
        // 서버 액션 실행 (모달은 유지)
        onAction({ type: 'CONFIRM_STAT_ALLOCATION', payload: { newStatPoints: tempPoints } });
        // 모달은 닫지 않고 유지
        // 서버 응답 후 currentUser가 업데이트되면 useEffect에서 자동으로 상태 업데이트
        // isEditing은 남은 포인트가 있으면 자동으로 true로 유지됨
    };

    const chartStats = useMemo(() => {
        const result: Record<string, number> = {};
        for (const key of Object.values(CoreStat)) {
            result[key] = (currentUser.baseStats[key] || 0) + (tempPoints[key] || 0);
        }
        return result;
    }, [currentUser.baseStats, tempPoints]);

    const radarDatasets = useMemo(() => [
        { stats: chartStats, color: '#60a5fa', fill: 'rgba(59, 130, 246, 0.4)' }
    ], [chartStats]);

    const statColors: Record<CoreStat, string> = {
        [CoreStat.Concentration]: 'from-blue-500 to-cyan-400',
        [CoreStat.ThinkingSpeed]: 'from-purple-500 to-pink-400',
        [CoreStat.Judgment]: 'from-amber-500 to-yellow-400',
        [CoreStat.Calculation]: 'from-emerald-500 to-green-400',
        [CoreStat.CombatPower]: 'from-red-500 to-orange-400',
        [CoreStat.Stability]: 'from-indigo-500 to-blue-400',
    };

    // 능력치를 3개씩 양쪽으로 나누기
    const leftStats = [CoreStat.Concentration, CoreStat.ThinkingSpeed, CoreStat.Judgment];
    const rightStats = [CoreStat.Calculation, CoreStat.CombatPower, CoreStat.Stability];

    const shellClass =
        'rounded-2xl border border-amber-900/25 bg-gradient-to-b from-[#12141c] via-[#0f1118] to-[#090a10] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_60px_-30px_rgba(0,0,0,0.9)]';
    const statCardClass =
        'rounded-xl border border-white/[0.1] bg-gradient-to-br from-slate-900/90 via-slate-950/90 to-black/85 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-all duration-200 hover:border-amber-400/35';

    return (
        <DraggableWindow title="능력치 포인트 분배" onClose={onClose} windowId="stat-allocation" initialWidth={1000} isTopmost={isTopmost}>
            <div className={`${shellClass} flex h-auto min-h-0 flex-col gap-4`}>
                {/* 상단: 보너스 포인트 표시 */}
                <div className={`rounded-xl border border-amber-300/25 bg-gradient-to-r from-amber-950/35 via-slate-900/75 to-indigo-950/35 ${isMobile ? 'p-2' : 'p-3.5'} text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm flex-shrink-0`}>
                    <p className={`${isMobile ? 'text-xs' : 'text-base'} mb-1 font-semibold tracking-wide text-amber-200/90`}>사용 가능한 보너스 포인트</p>
                    <p className={`${isMobile ? 'text-2xl' : 'text-4xl'} font-black bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-300 bg-clip-text text-transparent`}>
                        {availablePoints}
                    </p>
                </div>

                {/* 중앙: 육각형 그래프를 가운데, 양쪽에 능력치 3개씩 */}
                <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} ${isMobile ? 'gap-2' : 'gap-4'} ${isMobile ? 'items-stretch' : 'items-center'} justify-center flex-shrink-0`}>
                    {/* 왼쪽: 능력치 3개 */}
                    <div className={`${isMobile ? 'w-full' : 'w-1/3'} flex flex-col ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
                        {leftStats.map(stat => {
                            const currentSpent = tempPoints[stat] || 0;
                            const existingSpentPoints = currentUser.spentStatPoints || {};
                            const existingSpentOnThisStat = existingSpentPoints[stat] || 0;
                            const existingTotalSpent = Object.values(existingSpentPoints).reduce((sum, points) => sum + points, 0);
                            
                            // 현재 tempPoints에서 다른 능력치에 추가로 분배한 포인트 계산
                            const currentTotalSpent = Object.values(tempPoints).reduce((sum, points) => sum + points, 0);
                            const additionalSpentInOtherStats = currentTotalSpent - existingTotalSpent - (currentSpent - existingSpentOnThisStat);
                            
                            // 실제 사용 가능한 포인트 = 전체 사용 가능 포인트 - 기존 분배 포인트 - 다른 능력치에 추가로 분배한 포인트
                            const totalAvailablePoints = totalBonusPoints - existingTotalSpent;
                            const actuallyAvailablePoints = totalAvailablePoints - additionalSpentInOtherStats;
                            
                            // 기존 분배 포인트는 최소값, 최대값은 기존 분배 + 실제 사용 가능한 포인트
                            const minForThisSlider = existingSpentOnThisStat;
                            const maxForThisSlider = existingSpentOnThisStat + actuallyAvailablePoints;
                            const statName = CORE_STATS_DATA[stat].name;
                            const colorClass = statColors[stat];
                            
                            return (
                                <div key={stat} className={`${statCardClass} ${isMobile ? 'p-1.5' : 'p-2'}`}>
                                    <div className={`flex justify-between items-center ${isMobile ? 'mb-1' : 'mb-1.5'}`}>
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${colorClass} shadow-lg`}></div>
                                            <span className={`font-bold ${isMobile ? 'text-xs' : 'text-sm'} text-slate-100`}>{statName}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-slate-400`}>{currentUser.baseStats[stat] || 0}</span>
                                            <span className={`font-mono font-black ${isMobile ? 'text-sm' : 'text-base'} bg-gradient-to-r ${colorClass} bg-clip-text text-transparent`}>
                                                {chartStats[stat]}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-2'}`}>
                                        <input
                                            type="range"
                                            min={minForThisSlider}
                                            max={maxForThisSlider}
                                            value={currentSpent}
                                            onChange={(e) => handlePointChange(stat, e.target.value)}
                                            className={`flex-1 ${isMobile ? 'h-1' : 'h-1.5'} rounded-full appearance-none cursor-pointer`}
                                            style={{
                                                background: maxForThisSlider > minForThisSlider 
                                                    ? `linear-gradient(to right, rgb(34, 211, 238) 0%, rgb(34, 211, 238) ${((currentSpent - minForThisSlider) / (maxForThisSlider - minForThisSlider)) * 100}%, rgba(75, 85, 99, 0.5) ${((currentSpent - minForThisSlider) / (maxForThisSlider - minForThisSlider)) * 100}%, rgba(75, 85, 99, 0.5) 100%)`
                                                    : 'rgba(75, 85, 99, 0.5)'
                                            }}
                                            disabled={!isEditing}
                                        />
                                        <input
                                            type="number"
                                            min={minForThisSlider}
                                            max={maxForThisSlider}
                                            value={currentSpent}
                                            onChange={(e) => handlePointChange(stat, e.target.value)}
                                            className={`${isMobile ? 'w-14 text-xs p-1' : 'w-20 text-sm p-1.5'} rounded-md border border-amber-300/25 bg-black/45 text-center font-bold text-amber-100 transition-all focus:border-amber-300/60 focus:ring-1 focus:ring-amber-300/40`}
                                            disabled={!isEditing}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 가운데: 육각형 그래프 */}
                    <div className={`${isMobile ? 'w-full' : 'w-1/3'} flex flex-col items-center justify-center rounded-xl border border-amber-300/20 bg-gradient-to-br from-slate-900/85 via-[#0e111a] to-slate-950/85 ${isMobile ? 'p-2' : 'p-4'} shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_38px_-24px_rgba(251,191,36,0.35)] backdrop-blur-sm flex-shrink-0`}>
                        <div className={isMobile ? 'scale-75' : 'scale-90'}>
                            <RadarChart datasets={radarDatasets} maxStatValue={300} size={isMobile ? 180 : 220} />
                        </div>
                    </div>

                    {/* 오른쪽: 능력치 3개 */}
                    <div className={`${isMobile ? 'w-full' : 'w-1/3'} flex flex-col ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
                        {rightStats.map(stat => {
                            const currentSpent = tempPoints[stat] || 0;
                            const existingSpentPoints = currentUser.spentStatPoints || {};
                            const existingSpentOnThisStat = existingSpentPoints[stat] || 0;
                            const existingTotalSpent = Object.values(existingSpentPoints).reduce((sum, points) => sum + points, 0);
                            
                            // 현재 tempPoints에서 다른 능력치에 추가로 분배한 포인트 계산
                            const currentTotalSpent = Object.values(tempPoints).reduce((sum, points) => sum + points, 0);
                            const additionalSpentInOtherStats = currentTotalSpent - existingTotalSpent - (currentSpent - existingSpentOnThisStat);
                            
                            // 실제 사용 가능한 포인트 = 전체 사용 가능 포인트 - 기존 분배 포인트 - 다른 능력치에 추가로 분배한 포인트
                            const totalAvailablePoints = totalBonusPoints - existingTotalSpent;
                            const actuallyAvailablePoints = totalAvailablePoints - additionalSpentInOtherStats;
                            
                            // 기존 분배 포인트는 최소값, 최대값은 기존 분배 + 실제 사용 가능한 포인트
                            const minForThisSlider = existingSpentOnThisStat;
                            const maxForThisSlider = existingSpentOnThisStat + actuallyAvailablePoints;
                            const statName = CORE_STATS_DATA[stat].name;
                            const colorClass = statColors[stat];
                            
                            return (
                                <div key={stat} className={`${statCardClass} ${isMobile ? 'p-1.5' : 'p-2'}`}>
                                    <div className={`flex justify-between items-center ${isMobile ? 'mb-1' : 'mb-1.5'}`}>
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${colorClass} shadow-lg`}></div>
                                            <span className={`font-bold ${isMobile ? 'text-xs' : 'text-sm'} text-slate-100`}>{statName}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-slate-400`}>{currentUser.baseStats[stat] || 0}</span>
                                            <span className={`font-mono font-black ${isMobile ? 'text-sm' : 'text-base'} bg-gradient-to-r ${colorClass} bg-clip-text text-transparent`}>
                                                {chartStats[stat]}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-2'}`}>
                                        <input
                                            type="range"
                                            min={minForThisSlider}
                                            max={maxForThisSlider}
                                            value={currentSpent}
                                            onChange={(e) => handlePointChange(stat, e.target.value)}
                                            className={`flex-1 ${isMobile ? 'h-1' : 'h-1.5'} rounded-full appearance-none cursor-pointer`}
                                            style={{
                                                background: maxForThisSlider > minForThisSlider 
                                                    ? `linear-gradient(to right, rgb(34, 211, 238) 0%, rgb(34, 211, 238) ${((currentSpent - minForThisSlider) / (maxForThisSlider - minForThisSlider)) * 100}%, rgba(75, 85, 99, 0.5) ${((currentSpent - minForThisSlider) / (maxForThisSlider - minForThisSlider)) * 100}%, rgba(75, 85, 99, 0.5) 100%)`
                                                    : 'rgba(75, 85, 99, 0.5)'
                                            }}
                                            disabled={!isEditing}
                                        />
                                        <input
                                            type="number"
                                            min={minForThisSlider}
                                            max={maxForThisSlider}
                                            value={currentSpent}
                                            onChange={(e) => handlePointChange(stat, e.target.value)}
                                            className={`${isMobile ? 'w-14 text-xs p-1' : 'w-20 text-sm p-1.5'} rounded-md border border-amber-300/25 bg-black/45 text-center font-bold text-amber-100 transition-all focus:border-amber-300/60 focus:ring-1 focus:ring-amber-300/40`}
                                            disabled={!isEditing}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 하단: 버튼들 */}
                <div className={`flex ${isMobile ? 'flex-col' : 'justify-between items-center'} ${isMobile ? 'gap-2' : ''} ${isMobile ? 'pt-2' : 'pt-3'} border-t border-white/10 flex-shrink-0`}>
                    <div className={`flex flex-col ${isMobile ? 'items-stretch w-full' : 'items-start'} ${isMobile ? 'gap-1' : ''}`}>
                        <Button 
                            onClick={handleReset} 
                            colorScheme="red" 
                            disabled={!canReset}
                            className={`${isMobile ? '!text-sm !py-2.5 !px-3.5 w-full min-h-[44px]' : '!text-sm !py-2 !px-3.5'} rounded-lg border border-rose-300/35 bg-gradient-to-r from-rose-600/90 via-rose-500/90 to-orange-500/85 shadow-[0_14px_26px_-18px_rgba(244,63,94,0.85)] hover:from-rose-500 hover:via-rose-500 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            초기화 (<img src="/images/icon/Gold.png" alt="골드" className={`${isMobile ? 'w-3 h-3' : 'w-3 h-3'} inline-block`} />{resetCost.toLocaleString()})
                        </Button>
                        <p className={`${isMobile ? 'text-xs' : 'text-xs'} text-slate-400 ${isMobile ? 'mt-0 text-center' : 'mt-0.5'}`}>일일 변경제한: {maxDailyResets - statResetCountToday}/{maxDailyResets}</p>
                    </div>
                    <div className={`flex ${isMobile ? 'w-full' : ''} ${isMobile ? 'gap-2' : 'gap-2'} ${isMobile ? 'mt-1' : ''}`}>
                        <Button 
                            onClick={onClose} 
                            colorScheme="gray" 
                            className={`${isMobile ? '!text-sm !py-2.5 !px-3.5 flex-1 min-h-[44px]' : '!text-sm !py-2 !px-3.5'} rounded-lg border border-white/15 bg-gradient-to-r from-slate-700/85 to-slate-600/85 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.85)] hover:from-slate-600 hover:to-slate-500`}
                        >
                            취소
                        </Button>
                        {isEditing ? (
                            <Button 
                                onClick={handleConfirm} 
                                colorScheme="green" 
                                disabled={!hasChanges} 
                                className={`${isMobile ? '!text-sm !py-2.5 !px-3.5 flex-1 min-h-[44px]' : '!text-sm !py-2 !px-3.5'} rounded-lg border border-emerald-300/40 bg-gradient-to-r from-emerald-600/90 via-emerald-500/90 to-teal-500/85 shadow-[0_14px_26px_-18px_rgba(16,185,129,0.8)] hover:from-emerald-500 hover:via-emerald-400 hover:to-teal-400 disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                분배
                            </Button>
                        ) : (
                            <Button 
                                onClick={onClose} 
                                colorScheme="gray" 
                                className={`${isMobile ? '!text-sm !py-2.5 !px-3.5 flex-1 min-h-[44px]' : '!text-sm !py-2 !px-3.5'} rounded-lg border border-white/15 bg-gradient-to-r from-slate-700/85 to-slate-600/85 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.85)] hover:from-slate-600 hover:to-slate-500`}
                            >
                                닫기
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default StatAllocationModal;