import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { UserWithStatus, CoreStat, ServerAction } from '../types.js';
import DraggableWindow from './DraggableWindow.js';
import Button from './Button.js';
import ConfirmModal from './ConfirmModal.js';
import { CORE_STATS_DATA } from '../constants';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { useModalStackLayer } from '../hooks/useModalStackLayer.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';
import { calculateTotalStats } from '../services/statService.js';
import { BADUK_ABILITY_STAT_CAP, CORE_STAT_RADAR_ORDER } from './CoreStatsHexagonChart.js';
import type { StatTotalsContext } from '../shared/utils/totalStatsContext.js';

interface StatAllocationModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    isTopmost?: boolean;
    embedded?: boolean;
}

/** `DraggableWindow`의 `windowId`와 동일 — `createPortal(document.body)` UI가 바깥 클릭으로 본 창을 닫지 않게 함 */
const STAT_ALLOCATION_WINDOW_ID = 'stat-allocation';

function sumBadukAbilityTotal(stats: Record<CoreStat, number>): number {
    return CORE_STAT_RADAR_ORDER.reduce((sum, stat) => {
        const v = stats[stat] ?? 0;
        const safe = Number.isFinite(v) ? Math.max(0, v) : 0;
        return sum + Math.min(BADUK_ABILITY_STAT_CAP, Math.floor(safe));
    }, 0);
}

const ABILITY_CONTEXTS: { context: StatTotalsContext; titleKey: string; tabLabelKey: string }[] = [
    { context: 'default', titleKey: 'coreAbility.goAbility', tabLabelKey: 'statAllocation.abilityTabDefault' },
    { context: 'championshipVenue', titleKey: 'statAllocation.championshipGoAbility', tabLabelKey: 'statAllocation.abilityTabChampionship' },
    { context: 'guildBoss', titleKey: 'statAllocation.guildBossGoAbility', tabLabelKey: 'statAllocation.abilityTabGuildBoss' },
];

const StatAllocationModal: React.FC<StatAllocationModalProps> = ({ currentUser, onClose, onAction, isTopmost, embedded = false }) => {
    const { t } = useTranslation('profile');
    const { t: tCommon } = useTranslation('common');
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
    const [activeAbilityTab, setActiveAbilityTab] = useState(0);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
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
            alert(t('statAllocation.resetFailAlert'));
            return;
        }
        setShowResetConfirm(true);
    };

    const executeReset = () => {
        onAction({ type: 'RESET_STAT_POINTS' });
        setTempPoints({
            [CoreStat.Concentration]: 0,
            [CoreStat.ThinkingSpeed]: 0,
            [CoreStat.Judgment]: 0,
            [CoreStat.Calculation]: 0,
            [CoreStat.CombatPower]: 0,
            [CoreStat.Stability]: 0,
        });
        setIsEditing(true);
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

    const hypotheticalUser = useMemo(
        () => ({
            ...currentUser,
            spentStatPoints: tempPoints,
        }),
        [currentUser, tempPoints],
    );

    const baseByStat = useMemo(() => {
        const out = {} as Record<CoreStat, number>;
        for (const stat of Object.values(CoreStat)) {
            out[stat] = (currentUser.baseStats?.[stat] || 0) + (tempPoints[stat] || 0);
        }
        return out;
    }, [currentUser.baseStats, tempPoints]);

    const abilitySections = useMemo(
        () =>
            ABILITY_CONTEXTS.map(({ context, titleKey }) => {
                const finalByStat = calculateTotalStats(hypotheticalUser, context);
                const total = sumBadukAbilityTotal(finalByStat);
                const baseTotal = sumBadukAbilityTotal(baseByStat);
                const equipmentBonus = Math.max(0, total - baseTotal);
                return {
                    titleKey,
                    total,
                    equipmentBonus,
                    rows: CORE_STAT_RADAR_ORDER.map((stat) => {
                        const rawFinal = finalByStat[stat] ?? 0;
                        const displayValue = Math.min(BADUK_ABILITY_STAT_CAP, Math.max(0, Math.floor(rawFinal)));
                        const baseValue = baseByStat[stat] ?? 0;
                        const bonus = Math.round(rawFinal - baseValue);
                        return {
                            stat,
                            label: CORE_STATS_DATA[stat].name,
                            value: displayValue,
                            bonus,
                            hasBonus: bonus > 0,
                            baseValue,
                        };
                    }),
                };
            }),
        [hypotheticalUser, baseByStat],
    );

    const chartStats = useMemo(() => {
        const result: Record<string, number> = {};
        for (const key of Object.values(CoreStat)) {
            result[key] = (currentUser.baseStats[key] || 0) + (tempPoints[key] || 0);
        }
        return result;
    }, [currentUser.baseStats, tempPoints]);

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
                            <p
                                className={`font-medium uppercase tracking-[0.12em] text-amber-200/60 ${isMobile ? 'text-xs' : 'text-[10px]'}`}
                            >
                                {t('statAllocation.statLabel')}
                            </p>
                            <h3
                                className={`truncate font-bold tracking-tight text-amber-50 ${isMobile ? 'text-base' : 'text-sm sm:text-base'}`}
                            >
                                {CORE_STATS_DATA[selectedStat].name}
                            </h3>
                        </div>
                        <div className="shrink-0 rounded-md border border-emerald-500/25 bg-emerald-950/40 px-2 py-1 text-right">
                            <p className={`font-medium text-emerald-200/80 ${isMobile ? 'text-[11px]' : 'text-[9px]'}`}>
                                {t('statAllocation.remainingShort')}
                            </p>
                            <p className={`font-mono font-bold tabular-nums text-emerald-200 ${isMobile ? 'text-base' : 'text-sm'}`}>
                                {availablePoints}
                            </p>
                        </div>
                    </div>
                    <div className="mt-2.5 space-y-2.5">
                        <div className="flex items-center justify-between rounded-lg border border-white/[0.09] bg-black/30 px-2.5 py-1.5">
                            <span className={`text-zinc-400 ${isMobile ? 'text-sm' : 'text-[11px]'}`}>
                                {t('statAllocation.allocateToStat')}
                            </span>
                            <span
                                className={`font-mono font-bold tabular-nums text-amber-100 ${isMobile ? 'text-lg' : 'text-base sm:text-lg'}`}
                            >
                                {b.current}
                            </span>
                        </div>
                        <div className="touch-manipulation flex items-center gap-2 sm:gap-2.5">
                            <Button
                                bare
                                cooldownMs={0}
                                type="button"
                                onClick={() => handlePointChange(selectedStat, String(nextMinus))}
                                disabled={b.current <= b.min || !isEditing}
                                title={t('statAllocation.decreaseOne')}
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
                                title={t('statAllocation.increaseOne')}
                                className={`${stepBtn} border-cyan-400/45 bg-gradient-to-b from-cyan-600/90 via-sky-600/85 to-indigo-700/90 text-white ring-1 ring-cyan-300/20 hover:brightness-110`}
                            >
                                +
                            </Button>
                        </div>
                        <p className={`text-center text-zinc-500 ${isMobile ? 'text-xs' : 'text-[10px]'}`}>
                            범위 {b.min} ~ {b.max}
                        </p>
                        <div className="flex gap-2 pt-0.5">
                            <Button
                                bare
                                cooldownMs={0}
                                type="button"
                                onClick={() => setSelectedStat(null)}
                                className={`min-h-[2.75rem] flex-1 rounded-lg border border-white/15 bg-zinc-800/80 font-semibold text-zinc-100 shadow-sm transition hover:bg-zinc-700/90 ${
                                    isMobile ? 'text-sm' : 'text-xs sm:text-sm'
                                }`}
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
                                className={`min-h-[2.75rem] flex-1 rounded-lg border border-emerald-400/35 bg-gradient-to-r from-emerald-700/95 via-emerald-600/95 to-teal-600/90 font-semibold text-white shadow-md transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45 ${
                                    isMobile ? 'text-sm' : 'text-xs sm:text-sm'
                                }`}
                            >
                                분배 저장
                            </Button>
                        </div>
                    </div>
                </>
            );
        })();

    type AbilitySection = (typeof abilitySections)[number];

    const renderAbilitySectionPanel = (section: AbilitySection) => (
        <div
            className={`flex min-w-0 flex-col rounded-lg border border-amber-500/20 bg-black/25 px-2 py-2 sm:px-2.5 sm:py-2.5 ${
                isMobile ? 'shrink-0' : 'min-h-0 overflow-hidden'
            }`}
        >
            <div className="mb-1.5 flex shrink-0 flex-col items-center gap-1 border-b border-white/[0.06] pb-1.5 text-center">
                <span
                    className={`w-full break-keep px-0.5 font-bold leading-snug text-amber-100/95 ${isMobile ? 'text-sm' : 'text-xs sm:text-sm'}`}
                >
                    {t(section.titleKey)}
                </span>
                <span className="flex max-w-full flex-wrap items-center justify-center gap-x-1 gap-y-0.5 px-0.5">
                    <span
                        className={`font-mono font-black tabular-nums text-amber-200 ${isMobile ? 'text-base' : 'text-sm sm:text-base'}`}
                    >
                        {section.total.toLocaleString()}
                    </span>
                    {section.equipmentBonus > 0 ? (
                        <span
                            className={`font-mono font-semibold tabular-nums text-emerald-400/95 ${isMobile ? 'text-sm' : 'text-xs sm:text-sm'}`}
                        >
                            (+{section.equipmentBonus})
                        </span>
                    ) : null}
                </span>
            </div>
            {isMobile ? (
                <div className="grid shrink-0 grid-cols-2 gap-2">
                    {section.rows.map((row) => (
                        <div
                            key={`${section.titleKey}-${row.stat}`}
                            className="flex min-w-0 flex-col items-center justify-center rounded-md border border-white/[0.06] bg-black/30 px-1 py-1.5 text-center"
                            title={
                                row.hasBonus
                                    ? t('coreAbility.statBreakdown', {
                                          base: row.baseValue,
                                          shown: row.value,
                                          bonus: row.bonus,
                                      })
                                    : undefined
                            }
                        >
                            <span className="w-full break-keep text-xs font-semibold leading-tight text-slate-300 sm:text-sm">
                                {row.label}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-center justify-center gap-x-0.5 gap-y-0">
                                <span className="font-mono text-sm font-bold tabular-nums text-amber-100">{row.value}</span>
                                {row.hasBonus ? (
                                    <span className="font-mono text-xs font-semibold tabular-nums text-emerald-400/95">
                                        (+{row.bonus})
                                    </span>
                                ) : null}
                            </span>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex min-h-0 flex-1 flex-col justify-between gap-1 sm:gap-1.5">
                    {section.rows.map((row) => (
                        <div
                            key={`${section.titleKey}-${row.stat}`}
                            className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-1.5 overflow-hidden rounded-md border border-white/[0.06] bg-black/30 px-1.5 py-1 sm:gap-x-2 sm:px-2 sm:py-1.5"
                            title={
                                row.hasBonus
                                    ? t('coreAbility.statBreakdown', {
                                          base: row.baseValue,
                                          shown: row.value,
                                          bonus: row.bonus,
                                      })
                                    : undefined
                            }
                        >
                            <span className="min-w-0 truncate text-right text-[11px] font-semibold text-slate-300 sm:text-xs">
                                {row.label}
                            </span>
                            <span className="flex min-w-0 flex-wrap items-center justify-start gap-x-0.5 gap-y-0 overflow-hidden">
                                <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-amber-100 sm:text-sm">
                                    {row.value}
                                </span>
                                {row.hasBonus ? (
                                    <span className="shrink-0 font-mono text-[10px] font-semibold tabular-nums text-emerald-400/95 sm:text-xs">
                                        (+{row.bonus})
                                    </span>
                                ) : null}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    const abilityDisplay = isMobile ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
            <div className="grid shrink-0 grid-cols-3 gap-1 rounded-lg border border-white/[0.08] bg-black/40 p-0.5">
                {ABILITY_CONTEXTS.map(({ tabLabelKey }, index) => {
                    const isActive = activeAbilityTab === index;
                    return (
                        <button
                            key={tabLabelKey}
                            type="button"
                            onClick={() => setActiveAbilityTab(index)}
                            className={`min-h-[2.35rem] touch-manipulation rounded-md px-0.5 py-1 text-center text-xs font-semibold leading-tight transition ${
                                isActive
                                    ? 'border border-amber-400/40 bg-gradient-to-b from-amber-600/35 to-amber-900/45 text-amber-50 shadow-sm'
                                    : 'border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                            }`}
                        >
                            {t(tabLabelKey)}
                        </button>
                    );
                })}
            </div>
            {renderAbilitySectionPanel(abilitySections[activeAbilityTab]!)}
        </div>
    ) : (
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5 overflow-hidden sm:gap-2">
            {abilitySections.map((section) => (
                <React.Fragment key={section.titleKey}>{renderAbilitySectionPanel(section)}</React.Fragment>
            ))}
        </div>
    );

    const statButtons = statGridOrder.map((stat) => {
        const colorClass = statColors[stat];
        return (
            <button
                key={stat}
                type="button"
                onClick={() => setSelectedStat(stat)}
                className={`${statCardClass} flex w-full touch-manipulation flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-center ${
                    isMobile ? 'min-h-[3.1rem]' : 'min-h-[2.65rem] sm:min-h-[2.85rem]'
                }`}
            >
                <span
                    className={`w-full px-0.5 text-center font-semibold leading-tight text-slate-300 ${
                        isMobile ? 'whitespace-normal break-keep text-xs' : 'min-w-0 truncate text-[10px] sm:text-xs'
                    }`}
                >
                    {CORE_STATS_DATA[stat].name}
                </span>
                <span
                    className={`font-mono font-bold leading-none tabular-nums bg-gradient-to-r ${colorClass} bg-clip-text text-transparent ${
                        isMobile ? 'text-base' : 'text-sm sm:text-base'
                    }`}
                >
                    {chartStats[stat]}
                </span>
            </button>
        );
    });

    const bonusPanel = (
        <div
            className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-white/[0.09] bg-gradient-to-b from-zinc-900/75 to-black/50 px-1 py-1.5 shadow-inner ${
                isMobile ? 'w-[4rem]' : 'w-[4.75rem] sm:w-[5.25rem]'
            }`}
        >
            <p
                className={`text-center font-medium uppercase tracking-wide text-amber-200/75 ${isMobile ? 'text-xs' : 'text-[10px] sm:text-xs'}`}
            >
                {t('statAllocation.bonus')}
            </p>
            <p
                className={`bg-gradient-to-r from-emerald-300 via-cyan-300 to-sky-300 bg-clip-text text-center font-mono font-bold tabular-nums leading-none text-transparent ${
                    isMobile ? 'text-xl' : 'text-xl sm:text-2xl'
                }`}
            >
                {availablePoints}
            </p>
        </div>
    );

    const statGrid = (
        <div className={`grid min-w-0 flex-1 grid-cols-3 grid-rows-2 ${isMobile ? 'gap-1' : 'gap-1.5 sm:gap-2'}`}>{statButtons}</div>
    );

    const resetButtonDesktop = (
        <Button
            onClick={handleReset}
            colorScheme="red"
            disabled={!canReset}
            cooldownMs={0}
            className="flex w-[4.75rem] shrink-0 flex-col items-center justify-center gap-0.5 self-stretch !whitespace-normal !rounded-lg !border !border-rose-400/30 !bg-gradient-to-r !from-rose-700/90 !via-rose-600/90 !to-orange-600/85 !px-1.5 !py-2 !text-xs !font-semibold !leading-tight !shadow-md hover:!brightness-105 sm:w-[5.25rem] sm:!text-sm"
        >
            <span className="block w-full text-center leading-tight">{t('statAllocation.resetBtn')}</span>
            <span className="flex items-center justify-center gap-0.5 leading-none">
                <img
                    src="/images/icon/Gold.webp"
                    alt={tCommon('gold')}
                    className="h-3.5 w-3.5 shrink-0 object-contain sm:h-4 sm:w-4"
                />
                <span className="font-mono tabular-nums">{resetCost.toLocaleString()}</span>
            </span>
            <span className="text-center text-[10px] font-medium leading-none text-rose-100/80 sm:text-xs">
                {t('statAllocation.dailyResetLimit', { remaining: remainingResetsToday, max: maxDailyResets })}
            </span>
        </Button>
    );

    const resetButtonMobile = (
        <Button
            onClick={handleReset}
            colorScheme="red"
            disabled={!canReset}
            cooldownMs={0}
            className="flex w-full min-h-[3.25rem] flex-row flex-wrap items-center justify-center gap-x-2.5 gap-y-1 !whitespace-normal !rounded-lg !border !border-rose-400/30 !bg-gradient-to-r !from-rose-700/90 !via-rose-600/90 !to-orange-600/85 !px-3 !py-2.5 !text-base !font-semibold !leading-tight !shadow-md hover:!brightness-105"
        >
            <span className="leading-tight">{t('statAllocation.resetBtn')}</span>
            <span className="flex items-center gap-1 leading-none">
                <img
                    src="/images/icon/Gold.webp"
                    alt={tCommon('gold')}
                    className="h-4 w-4 shrink-0 object-contain"
                />
                <span className="font-mono text-base tabular-nums">{resetCost.toLocaleString()}</span>
            </span>
            <span className="text-sm font-medium leading-none text-rose-100/80">
                {t('statAllocation.dailyResetLimit', { remaining: remainingResetsToday, max: maxDailyResets })}
            </span>
        </Button>
    );

    const allocationFooter = isMobile ? (
        <div className="flex shrink-0 flex-col gap-2 rounded-lg border-t border-white/[0.07] bg-[#0a0c12]/90 p-2.5 pt-3">
            <div className="flex items-stretch gap-2">
                {bonusPanel}
                {statGrid}
            </div>
            {resetButtonMobile}
        </div>
    ) : (
        <div className="flex shrink-0 items-stretch gap-2 rounded-lg border-t border-white/[0.07] bg-[#0a0c12]/90 p-2.5 pt-3 sm:gap-2.5">
            {bonusPanel}
            {statGrid}
            {resetButtonDesktop}
        </div>
    );

    const allocationBody = (
            <div className={`${shellClass} flex h-full min-h-0 w-full max-w-full flex-col gap-2 overflow-hidden sm:gap-3`}>
                {abilityDisplay}
                {allocationFooter}
            </div>
    );

    const statEditorPortal =
        typeof document !== 'undefined' && selectedStat
            ? createPortal(
                  <div
                      className="fixed inset-0 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:p-5"
                      style={{ zIndex: statEditorLayer.zIndex }}
                      role="presentation"
                      data-draggable-satellite={STAT_ALLOCATION_WINDOW_ID}
                      onClick={() => setSelectedStat(null)}
                  >
                      <div
                          className="max-h-[min(88dvh,28rem)] w-full max-w-[min(calc(100vw-1.5rem),20rem)] overflow-y-auto rounded-xl border border-amber-400/50 bg-zinc-950 p-3 shadow-[0_20px_50px_-18px_rgba(0,0,0,0.88)] ring-1 ring-white/10 sm:max-w-[22rem] sm:p-3.5"
                          role="dialog"
                          aria-modal="true"
                          aria-label={t('statAllocation.allocateAria', { stat: CORE_STATS_DATA[selectedStat].name })}
                          onClick={(e) => e.stopPropagation()}
                      >
                          {statEditorInner}
                      </div>
                  </div>,
                  document.body,
              )
            : null;

    const resetConfirmModal = showResetConfirm ? (
        <ConfirmModal
            title={t('statAllocation.resetConfirmTitle')}
            message={t('statAllocation.resetConfirmBody', { remaining: remainingResetsToday })}
            confirmText={t('statAllocation.resetBtn')}
            cancelText={tCommon('actions.cancel')}
            onConfirm={executeReset}
            onCancel={() => setShowResetConfirm(false)}
            confirmColorScheme="red"
            variant="premium-ledger"
            goldCost={resetCost}
            windowId="stat-allocation-reset-confirm"
            isTopmost
        />
    ) : null;

    if (embedded) {
        return (
            <>
                <div className={PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS}>{allocationBody}</div>
                {statEditorPortal}
                {resetConfirmModal}
            </>
        );
    }

    return (
        <DraggableWindow
            title={t('statAllocation.allocateTitle')}
            onClose={onClose}
            windowId={STAT_ALLOCATION_WINDOW_ID}
            initialWidth={isMobile ? 420 : 840}
            initialHeight={680}
            isTopmost={isTopmost}
            shrinkHeightToContent={false}
            mobileLockViewportHeight={isMobile}
        >
            {allocationBody}
            {statEditorPortal}
            {resetConfirmModal}
        </DraggableWindow>
    );
};

export default StatAllocationModal;
