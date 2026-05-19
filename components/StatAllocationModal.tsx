import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserWithStatus, CoreStat, ServerAction } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import RadarChart from './RadarChart.js';
import { CORE_STATS_DATA } from '../constants';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { useModalStackLayer } from '../hooks/useModalStackLayer.js';

interface StatAllocationModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    isTopmost?: boolean;
}

/** `DraggableWindow`의 `windowId`와 동일 — `createPortal(document.body)` UI가 바깥 클릭으로 본 창을 닫지 않게 함 */
const STAT_ALLOCATION_WINDOW_ID = 'stat-allocation';

const StatAllocationModal: React.FC<StatAllocationModalProps> = ({ currentUser, onClose, onAction, isTopmost }) => {
    const { isNativeMobile, isNarrowViewport } = useNativeMobileShell();
    const isMobile = isNativeMobile || isNarrowViewport;
    
    // 모달이 열릴 때: 남은 보너스 포인트가 있으면 항상 편집 모드 활성화
    // 기존에 분배한 포인트는 초기화를 해야만 조절 가능하고, 현재 남아있는 보너스 포인트는 바로 조절 가능
    const [isEditing, setIsEditing] = useState(() => {
        // 남은 보너스 포인트가 있으면 항상 편집 모드
        const levelPoints = (currentUser.userLevel - 1) * 2;
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
    const statEditorLayer = useModalStackLayer({ enabled: Boolean(selectedStat), zIndexFloor: 10_000 });

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
        return (currentUser.userLevel - 1) * 2;
    }, [currentUser.userLevel]);
    
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
        const levelPoints = (currentUser.userLevel - 1) * 2;
        const bonusPoints = currentUser.bonusStatPoints || 0;
        const totalBonusPoints = levelPoints + bonusPoints;
        const existingSpentPoints = currentUser.spentStatPoints || {};
        const existingTotalSpent = Object.values(existingSpentPoints).reduce((sum, points) => sum + points, 0);
        const availablePoints = totalBonusPoints - existingTotalSpent;
        
        // 남은 보너스 포인트가 있으면 편집 모드 활성화
        setIsEditing(availablePoints > 0);
    }, [currentUser.spentStatPoints, currentUser.bonusStatPoints, currentUser.userLevel]);

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
        'rounded-xl border border-amber-900/30 bg-gradient-to-b from-[#10121a] via-[#0c0e14] to-[#08090e] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_40px_-24px_rgba(0,0,0,0.75)] sm:p-3';
    const statCardClass =
        'rounded-lg border border-white/[0.08] bg-gradient-to-br from-slate-900/88 via-slate-950/92 to-black/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-all duration-150 hover:border-amber-400/30 hover:bg-slate-900/95 active:border-amber-300/45 active:scale-[0.98]';

    const radarChartSize = isMobile ? 208 : 244;

    const statEditorInner =
        selectedStat &&
        (() => {
            const b = getStatBounds(selectedStat, tempPoints);
            const nextMinus = Math.max(b.min, b.current - 1);
            const nextPlus = Math.min(b.max, b.current + 1);
            const stepBtn =
                'flex min-h-[2.75rem] min-w-[2.75rem] shrink-0 touch-manipulation select-none items-center justify-center rounded-xl border text-center text-xl font-bold leading-none shadow-md transition active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-35 sm:min-h-[3rem] sm:min-w-[3rem] sm:text-2xl';
            return (
                <>
                    <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2">
                        <div className="min-w-0">
                            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-amber-200/60">능력치</p>
                            <h3 className="truncate text-sm font-bold tracking-tight text-amber-50 sm:text-base">
                                {CORE_STATS_DATA[selectedStat].name}
                            </h3>
                        </div>
                        <div className="shrink-0 rounded-md border border-emerald-500/25 bg-emerald-950/40 px-2 py-1 text-right">
                            <p className="text-[9px] font-medium text-emerald-200/80">남은</p>
                            <p className="font-mono text-sm font-bold tabular-nums text-emerald-200">{availablePoints}</p>
                        </div>
                    </div>
                    <div className="mt-2.5 space-y-2.5">
                        <div className="flex items-center justify-between rounded-lg border border-white/[0.09] bg-black/30 px-2.5 py-1.5">
                            <span className="text-[11px] text-zinc-400">이 능력치에 분배</span>
                            <span className="font-mono text-base font-bold tabular-nums text-amber-100 sm:text-lg">{b.current}</span>
                        </div>
                        <div className="touch-manipulation flex items-center gap-2 sm:gap-2.5">
                            <Button
                                bare
                                cooldownMs={0}
                                type="button"
                                onClick={() => handlePointChange(selectedStat, String(nextMinus))}
                                disabled={b.current <= b.min || !isEditing}
                                title="1 감소"
                                className={`${stepBtn} border-zinc-500/40 bg-gradient-to-b from-zinc-700 to-zinc-900 text-zinc-100 hover:from-zinc-600 hover:to-zinc-800`}
                            >
                                −
                            </Button>
                            <input
                                type="range"
                                min={b.min}
                                max={b.max}
                                value={b.current}
                                onChange={(e) => handlePointChange(selectedStat, e.target.value)}
                                className="h-3 w-0 min-w-0 flex-1 cursor-pointer accent-cyan-400"
                                disabled={!isEditing}
                            />
                            <Button
                                bare
                                cooldownMs={0}
                                type="button"
                                onClick={() => handlePointChange(selectedStat, String(nextPlus))}
                                disabled={b.current >= b.max || !isEditing}
                                title="1 증가"
                                className={`${stepBtn} border-cyan-400/45 bg-gradient-to-b from-cyan-600/90 via-sky-600/85 to-indigo-700/90 text-white ring-1 ring-cyan-300/20 hover:brightness-110`}
                            >
                                +
                            </Button>
                        </div>
                        <p className="text-center text-[10px] text-zinc-500">
                            범위 {b.min} ~ {b.max}
                        </p>
                        <div className="flex gap-2 pt-0.5">
                            <Button
                                bare
                                cooldownMs={0}
                                type="button"
                                onClick={() => setSelectedStat(null)}
                                className="min-h-[2.5rem] flex-1 rounded-lg border border-white/15 bg-zinc-800/80 text-xs font-semibold text-zinc-100 shadow-sm transition hover:bg-zinc-700/90 sm:text-sm"
                            >
                                닫기
                            </Button>
                            <Button
                                bare
                                cooldownMs={0}
                                type="button"
                                onClick={() => {
                                    handleConfirm();
                                    setSelectedStat(null);
                                }}
                                disabled={!hasChanges}
                                className="min-h-[2.5rem] flex-1 rounded-lg border border-emerald-400/35 bg-gradient-to-r from-emerald-700/95 via-emerald-600/95 to-teal-600/90 text-xs font-semibold text-white shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm"
                            >
                                분배 저장
                            </Button>
                        </div>
                    </div>
                </>
            );
        })();

    const radarBlock = (
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-visible rounded-lg border border-amber-300/18 bg-gradient-to-br from-slate-900/80 via-[#0e111a] to-slate-950/80 p-1 sm:p-1.5">
            <div className="mx-auto aspect-square w-full max-w-[min(100%,260px)] min-w-0 overflow-visible">
                <RadarChart datasets={radarDatasets} maxStatValue={300} size={radarChartSize} />
            </div>
        </div>
    );

    const bonusPanel = (
        <div className="flex w-[min(5.75rem,28%)] shrink-0 flex-col justify-center rounded-lg border border-white/[0.09] bg-gradient-to-b from-zinc-900/75 to-black/50 px-1.5 py-1.5 text-center shadow-inner sm:px-2 sm:py-2">
            <p className="text-[9px] font-medium uppercase tracking-wider text-amber-200/75 sm:text-[10px]">보너스</p>
            <p className="mt-0.5 bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-300 bg-clip-text font-mono text-xl font-bold tabular-nums leading-none text-transparent sm:text-2xl">
                {availablePoints}
            </p>
        </div>
    );

    const statButtons = statGridOrder.map((stat) => {
        const colorClass = statColors[stat];
        return (
            <button
                key={stat}
                type="button"
                onClick={() => setSelectedStat(stat)}
                className={`${statCardClass} flex min-h-[2.35rem] touch-manipulation flex-col items-center justify-center gap-0 px-0.5 py-1 text-center sm:min-h-[2.5rem]`}
            >
                <span className="w-full min-w-0 truncate px-0.5 text-center text-[9px] font-semibold leading-tight text-slate-300 sm:text-[10px]">
                    {CORE_STATS_DATA[stat].name}
                </span>
                <span
                    className={`font-mono text-sm font-bold leading-none tabular-nums sm:text-base bg-gradient-to-r ${colorClass} bg-clip-text text-transparent`}
                >
                    {chartStats[stat]}
                </span>
            </button>
        );
    });

    const resetFooter = (
        <div className="shrink-0 rounded-lg border-t border-white/[0.07] bg-[#0a0c12]/90 p-1.5 pt-2">
            <div className="flex w-full items-start justify-center">
                <div className="flex min-w-0 flex-col items-center">
                    <Button
                        onClick={handleReset}
                        colorScheme="red"
                        disabled={!canReset}
                        cooldownMs={0}
                        className="max-w-[min(100%,15rem)] min-h-[34px] !rounded-lg !border !border-rose-400/30 !bg-gradient-to-r !from-rose-700/90 !via-rose-600/90 !to-orange-600/85 !px-3 !py-1.5 !text-[10px] !font-semibold !leading-tight !shadow-md hover:!brightness-105 sm:!min-h-[36px] sm:!text-[11px]"
                    >
                        초기화 (<img src="/images/icon/Gold.webp" alt="골드" className="inline-block h-3 w-3 align-middle" />
                        {resetCost.toLocaleString()})
                    </Button>
                    <p className="mt-1 whitespace-nowrap text-center text-[9px] text-slate-500 sm:text-[10px]">
                        일일 {remainingResetsToday}/{maxDailyResets}
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <DraggableWindow
            title="능력치 포인트 분배"
            onClose={onClose}
            windowId={STAT_ALLOCATION_WINDOW_ID}
            initialWidth={isMobile ? 360 : 460}
            isTopmost={isTopmost}
            shrinkHeightToContent={!isMobile}
        >
            <div
                className={`${shellClass} flex min-h-0 w-full max-w-full flex-col ${
                    isMobile ? 'h-[min(72vh,520px)] gap-1.5' : 'gap-2'
                }`}
            >
                <div className="flex min-h-0 w-full shrink-0 flex-row items-stretch gap-1.5 overflow-visible rounded-xl border border-amber-300/20 bg-gradient-to-b from-amber-950/28 via-slate-900/72 to-indigo-950/28 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-sm sm:gap-2 sm:p-2">
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col">{radarBlock}</div>
                    {bonusPanel}
                </div>
                <div className="grid min-h-0 w-full flex-1 grid-cols-3 grid-rows-2 gap-1 sm:gap-1.5">{statButtons}</div>
                {resetFooter}
            </div>
            {typeof document !== 'undefined' &&
                selectedStat &&
                createPortal(
                    <div
                        className="fixed inset-0 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:p-5"
                        style={{ zIndex: statEditorLayer.zIndex }}
                        role="presentation"
                        data-draggable-satellite={STAT_ALLOCATION_WINDOW_ID}
                        onClick={() => setSelectedStat(null)}
                    >
                        <div
                            className="max-h-[min(88dvh,28rem)] w-full max-w-[min(calc(100vw-1.5rem),20rem)] overflow-y-auto rounded-xl border border-amber-400/35 bg-zinc-950/98 p-3 shadow-[0_20px_50px_-18px_rgba(0,0,0,0.88)] ring-1 ring-white/5 sm:max-w-[22rem] sm:p-3.5"
                            role="dialog"
                            aria-modal="true"
                            aria-label={`${CORE_STATS_DATA[selectedStat].name} 분배`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {statEditorInner}
                        </div>
                    </div>,
                    document.body
                )}
        </DraggableWindow>
    );
};

export default StatAllocationModal;