import React, { useState, useMemo, useEffect } from 'react';
import { UserWithStatus, CoreStat, ServerAction } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import RadarChart from './RadarChart.js';
import { CORE_STATS_DATA } from '../constants';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

interface StatAllocationModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    isTopmost?: boolean;
}

const StatAllocationModal: React.FC<StatAllocationModalProps> = ({ currentUser, onClose, onAction, isTopmost }) => {
    const { isNativeMobile, isNarrowViewport } = useNativeMobileShell();
    const isMobile = isNativeMobile || isNarrowViewport;
    
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
    const [selectedStat, setSelectedStat] = useState<CoreStat | null>(null);

    const resetCost = 1000; // 골드로 변경 (서버와 일치)
    const maxDailyResets = 2;
    const currentDay = new Date().toDateString();
    const lastResetDate = currentUser.lastStatResetDate;
    const statResetCountToday = currentUser.statResetCountToday || 0;
    const usedResetsToday = lastResetDate === currentDay ? statResetCountToday : 0;
    const remainingResetsToday = Math.max(0, maxDailyResets - usedResetsToday);

    const canReset = useMemo(() => {
        // 골드 확인
        if ((currentUser.gold || 0) < resetCost) return false;
        if (usedResetsToday >= maxDailyResets) return false;
        return true;
    }, [currentUser.gold, usedResetsToday, maxDailyResets, resetCost]);

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

    const getStatBounds = (stat: CoreStat, points: Record<CoreStat, number>) => {
        const currentSpent = points[stat] || 0;
        const existingSpentPoints = currentUser.spentStatPoints || {};
        const existingSpentOnThisStat = existingSpentPoints[stat] || 0;
        const existingTotalSpent = Object.values(existingSpentPoints).reduce((sum, p) => sum + p, 0);
        const currentTotalSpent = Object.values(points).reduce((sum, p) => sum + p, 0);
        const additionalSpentInOtherStats = currentTotalSpent - existingTotalSpent - (currentSpent - existingSpentOnThisStat);
        const totalAvailablePoints = totalBonusPoints - existingTotalSpent;
        const actuallyAvailablePoints = totalAvailablePoints - additionalSpentInOtherStats;
        const min = existingSpentOnThisStat;
        const max = existingSpentOnThisStat + Math.max(0, actuallyAvailablePoints);
        return { min, max, current: currentSpent };
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
        if (window.confirm(`골드 ${resetCost.toLocaleString()}개를 사용하여 모든 보너스 포인트를 초기화하시겠습니까? (오늘 ${remainingResetsToday}회 남음)`)) {
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

    const statGridOrder: CoreStat[] = [
        CoreStat.Concentration,
        CoreStat.ThinkingSpeed,
        CoreStat.Judgment,
        CoreStat.Calculation,
        CoreStat.CombatPower,
        CoreStat.Stability,
    ];

    const shellClass =
        'rounded-2xl border border-amber-900/25 bg-gradient-to-b from-[#12141c] via-[#0f1118] to-[#090a10] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_24px_60px_-30px_rgba(0,0,0,0.9)]';
    const statCardClass =
        'rounded-xl border border-white/[0.1] bg-gradient-to-br from-slate-900/90 via-slate-950/90 to-black/85 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-all duration-200 hover:border-amber-400/35';

    return (
        <DraggableWindow
            title="능력치 포인트 분배"
            onClose={onClose}
            windowId="stat-allocation"
            initialWidth={isMobile ? 420 : 1000}
            isTopmost={isTopmost}
            shrinkHeightToContent={!isMobile}
        >
            <div
                className={`${shellClass} flex min-h-0 flex-col ${isMobile ? 'h-[min(74vh,560px)] gap-2 p-2 sm:p-2.5' : 'gap-2.5 p-3'}`}
            >
                {isMobile ? (
                    <div className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-300/25 bg-gradient-to-r from-amber-950/35 via-slate-900/75 to-indigo-950/35 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                        <div className="flex h-[140px] w-[60%] shrink-0 items-center justify-center rounded-lg border border-amber-300/20 bg-gradient-to-br from-slate-900/85 via-[#0e111a] to-slate-950/85 p-0.5">
                            <RadarChart datasets={radarDatasets} maxStatValue={300} size={172} />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-center">
                            <p className="whitespace-nowrap text-[10px] font-semibold tracking-wide text-amber-200/90">보너스</p>
                            <p className="text-base font-black bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-300 bg-clip-text text-transparent">
                                {availablePoints}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex shrink-0 flex-row items-stretch gap-3 rounded-xl border border-amber-300/25 bg-gradient-to-r from-amber-950/35 via-slate-900/75 to-indigo-950/35 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                        <div className="flex h-[176px] w-[200px] shrink-0 items-center justify-center rounded-lg border border-amber-300/20 bg-gradient-to-br from-slate-900/85 via-[#0e111a] to-slate-950/85 p-0.5">
                            <RadarChart datasets={radarDatasets} maxStatValue={300} size={168} />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-center">
                            <p className="text-xs font-semibold tracking-wide text-amber-200/90 sm:text-sm">사용 가능한 보너스 포인트</p>
                            <p className="text-3xl font-black leading-tight bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-300 bg-clip-text text-transparent sm:text-4xl">
                                {availablePoints}
                            </p>
                        </div>
                    </div>
                )}

                <div className={isMobile ? 'min-h-0 flex-1 overflow-y-auto pb-1' : ''}>
                    <div className={`grid ${isMobile ? 'grid-cols-2 gap-2' : 'grid-cols-3 gap-2'}`}>
                        {statGridOrder.map((stat) => {
                            const colorClass = statColors[stat];
                            return (
                                <button
                                    key={stat}
                                    type="button"
                                    onClick={() => setSelectedStat(stat)}
                                    className={`${statCardClass} ${isMobile ? 'p-1.5 min-h-[62px]' : 'p-2 min-h-0'} text-left`}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={`font-bold ${isMobile ? 'text-[11px] sm:text-[12px]' : 'text-[13px]'} text-slate-100 whitespace-nowrap`}>{CORE_STATS_DATA[stat].name}</span>
                                        <span className={`font-mono font-black ${isMobile ? 'text-[12px] sm:text-[13px]' : 'text-sm'} bg-gradient-to-r ${colorClass} bg-clip-text text-transparent whitespace-nowrap`}>
                                            {chartStats[stat]}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 하단: 버튼들 */}
                <div className={`bg-[#0b0d13] rounded-xl p-1.5 ${isMobile ? '' : 'border-t border-white/10 pt-2'} flex-shrink-0`}>
                    <div className="flex w-full items-start justify-center">
                        <div className="flex min-w-0 w-full max-w-md flex-col items-center sm:max-w-lg">
                            <Button
                                onClick={handleReset}
                                colorScheme="red"
                                disabled={!canReset}
                                className={`${isMobile ? '!text-[10px] sm:!text-[11px] !leading-none !py-1.5 !px-1.5 w-full min-h-[36px] !whitespace-nowrap' : '!text-xs sm:!text-sm !py-1.5 !px-3 w-full'} rounded-lg border border-rose-300/35 bg-gradient-to-r from-rose-600/90 via-rose-500/90 to-orange-500/85 shadow-[0_14px_26px_-18px_rgba(244,63,94,0.85)] hover:from-rose-500 hover:via-rose-500 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                초기화 (<img src="/images/icon/Gold.png" alt="골드" className="w-3 h-3 inline-block" />{resetCost.toLocaleString()})
                            </Button>
                            <p className={`${isMobile ? 'text-[10px]' : 'text-[11px]'} mt-0.5 whitespace-nowrap text-center text-slate-400`}>일일({remainingResetsToday}/{maxDailyResets})</p>
                        </div>
                    </div>
                </div>
            </div>
            {isMobile && selectedStat && (
                <div
                    className="fixed inset-0 z-[120] flex items-end bg-black/60"
                    role="presentation"
                    onClick={() => setSelectedStat(null)}
                >
                    <div
                        className="w-full rounded-t-2xl border-x border-t border-amber-400/45 bg-zinc-950 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`${CORE_STATS_DATA[selectedStat].name} 분배`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                            <h3 className="text-sm font-black text-amber-100">{CORE_STATS_DATA[selectedStat].name} 분배</h3>
                            <span className="text-xs font-bold text-emerald-300">남은 보너스 {availablePoints}</span>
                        </div>
                        {(() => {
                            const b = getStatBounds(selectedStat, tempPoints);
                            const nextMinus = Math.max(b.min, b.current - 1);
                            const nextPlus = Math.min(b.max, b.current + 1);
                            return (
                                <div className="mt-3 space-y-3">
                                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                                        <span className="text-xs text-zinc-400">현재 분배</span>
                                        <span className="font-mono text-lg font-black text-amber-100">{b.current}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            onClick={() => handlePointChange(selectedStat, String(nextMinus))}
                                            disabled={b.current <= b.min || !isEditing}
                                            colorScheme="none"
                                            className="!min-h-[2.75rem] !w-16 rounded-lg border border-white/20 bg-zinc-800/80 !text-xl !font-black text-white disabled:opacity-40"
                                        >
                                            -
                                        </Button>
                                        <input
                                            type="range"
                                            min={b.min}
                                            max={b.max}
                                            value={b.current}
                                            onChange={(e) => handlePointChange(selectedStat, e.target.value)}
                                            className="h-2 flex-1 cursor-pointer appearance-none rounded-full"
                                            disabled={!isEditing}
                                        />
                                        <Button
                                            onClick={() => handlePointChange(selectedStat, String(nextPlus))}
                                            disabled={b.current >= b.max || !isEditing}
                                            colorScheme="none"
                                            className="!min-h-[2.75rem] !w-16 rounded-lg border border-cyan-300/35 bg-cyan-900/60 !text-xl !font-black text-cyan-50 disabled:opacity-40"
                                        >
                                            +
                                        </Button>
                                    </div>
                                    <p className="text-center text-xs text-zinc-500">
                                        최소 {b.min} / 최대 {b.max}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button
                                            onClick={() => setSelectedStat(null)}
                                            colorScheme="none"
                                            className="!mt-1 !min-h-[2.75rem] flex-1 rounded-lg border border-white/20 bg-zinc-800/70 !text-sm !font-bold text-zinc-100"
                                        >
                                            닫기
                                        </Button>
                                        <Button
                                            onClick={() => {
                                                handleConfirm();
                                                setSelectedStat(null);
                                            }}
                                            colorScheme="none"
                                            disabled={!hasChanges}
                                            className="!mt-1 !min-h-[2.75rem] flex-1 rounded-lg border border-emerald-300/40 bg-gradient-to-r from-emerald-600/90 via-emerald-500/90 to-teal-500/85 !text-sm !font-bold text-white disabled:opacity-50"
                                        >
                                            분배 저장
                                        </Button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
        </DraggableWindow>
    );
};

export default StatAllocationModal;