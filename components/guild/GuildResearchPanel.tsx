import React, { useState, useEffect, useMemo } from 'react';
import type { TFunction } from 'i18next';
import { Guild, GuildMember, GuildResearchId, GuildResearchCategory } from '../../types/index.js';
import { GuildMemberRole } from '../../types/enums.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import Button from '../Button.js';
import { GUILD_RESEARCH_PROJECTS, ADMIN_USER_ID } from '../../constants/index.js';
import {
    computeGuildBossResearchDamagePercent,
    computeGuildBossResearchEvasionPercent,
    computeGuildBossResearchHitDamageReductionPercent,
} from '../../shared/constants/guildBossBalance.js';
import DraggableWindow from '../DraggableWindow.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { useTranslation } from 'react-i18next';
import GuildResearchStartConfirmModal, {
    type GuildResearchStartConfirmPayload,
} from './GuildResearchStartConfirmModal.js';

interface GuildResearchPanelProps {
    guild: Guild;
    myMemberInfo: GuildMember | undefined;
    onClose: () => void;
}

const getResearchCost = (researchId: GuildResearchId, level: number): number => {
    const project = GUILD_RESEARCH_PROJECTS[researchId];
    if (!project) return Infinity;
    return Math.floor(project.baseCost * Math.pow(project.costMultiplier, level));
};

const getResearchTimeMs = (researchId: GuildResearchId, level: number): number => {
    const project = GUILD_RESEARCH_PROJECTS[researchId];
    if (!project) return 0;
    const hours = project.baseTimeHours + (project.timeIncrementHours * level);
    return hours * 60 * 60 * 1000;
};

const formatTimeLeft = (ms: number, t: TFunction): string => {
    if (ms <= 0) return t('research.completed');
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getResearchSkillDisplay = (
    researchId: GuildResearchId,
    level: number,
    t: TFunction,
): { chance?: number; description: string } | null => {
    if (level === 0) return null;
    const project = GUILD_RESEARCH_PROJECTS[researchId];
    if (!project) return null;

    const totalEffect = project.baseEffect * level;

    switch (researchId) {
        case GuildResearchId.boss_hp_increase:
            return { description: t('research.bossHpIncrease', { value: totalEffect }) };
        case GuildResearchId.boss_damage_increase: {
            const damagePercent = computeGuildBossResearchDamagePercent(level);
            return { description: t('research.bossDamageIncrease', { value: damagePercent }) };
        }
        case GuildResearchId.boss_attack_evasion: {
            const evasionPercent = computeGuildBossResearchEvasionPercent(level);
            return { description: t('research.bossAttackEvasion', { value: evasionPercent }) };
        }
        case GuildResearchId.boss_hit_damage_reduction: {
            const reductionPercent = computeGuildBossResearchHitDamageReductionPercent(level);
            return { description: t('research.bossHitDamageReduction', { value: reductionPercent }) };
        }
        case GuildResearchId.boss_skill_heal_block: {
            const chance = 10 + (15 * level);
            const reduction = 10 * level;
            return { chance, description: t('research.bossHealBlock', { chance, reduction }) };
        }
        case GuildResearchId.boss_skill_regen: {
            const chance = 10 + (15 * level);
            const increase = 10 * level;
            return { chance, description: t('research.bossRegen', { chance, increase }) };
        }
        case GuildResearchId.boss_skill_ignite: {
            const chance = 10 + (15 * level);
            const increasePercent = level * 10;
            return { chance, description: t('research.bossIgnite', { chance, damage: increasePercent }) };
        }
        case GuildResearchId.ap_regen_boost: {
            const sec = project.baseEffect * level;
            return { description: t('research.apRegenEffect', { sec }) };
        }
        case GuildResearchId.stat_concentration:
            return { description: t('research.statConcentration', { value: totalEffect }) };
        case GuildResearchId.stat_thinking_speed:
            return { description: t('research.statThinkingSpeed', { value: totalEffect }) };
        case GuildResearchId.stat_judgment:
            return { description: t('research.statJudgment', { value: totalEffect }) };
        case GuildResearchId.stat_calculation:
            return { description: t('research.statCalculation', { value: totalEffect }) };
        case GuildResearchId.stat_combat_power:
            return { description: t('research.statCombatPower', { value: totalEffect }) };
        case GuildResearchId.stat_stability:
            return { description: t('research.statStability', { value: totalEffect }) };
        default:
            return null;
    }
};

const ResearchItemPanel: React.FC<{
    researchId: GuildResearchId;
    project: typeof GUILD_RESEARCH_PROJECTS[GuildResearchId];
    guild: Guild;
    myMemberInfo: GuildMember | undefined;
    isResearchingThis: boolean;
    isAnyResearchActive: boolean;
    isNativeMobile: boolean;
    onRequestStart: (payload: GuildResearchStartConfirmPayload) => void;
}> = ({
    researchId,
    project,
    guild,
    myMemberInfo,
    isResearchingThis,
    isAnyResearchActive,
    isNativeMobile,
    onRequestStart,
}) => {
    const { t } = useTranslation(['guild', 'common']);
    const { currentUserWithStatus } = useAppContext();
    const [timeLeft, setTimeLeft] = useState(0);

    const currentLevel = guild.research?.[researchId]?.level ?? 0;
    const isMaxLevel = currentLevel >= project.maxLevel;

    const nextLevel = currentLevel + 1;
    const cost = getResearchCost(researchId, currentLevel);
    const timeMs = getResearchTimeMs(researchId, currentLevel);

    const canAfford = (guild.researchPoints ?? 0) >= cost;
    const cu = currentUserWithStatus;
    const effectiveUserId = cu?.isAdmin ? ADMIN_USER_ID : (cu?.id ?? '');
    const actualUserId = cu?.id ?? '';
    const memberByEffective = effectiveUserId ? guild.members?.find((m) => m.userId === effectiveUserId) : undefined;
    const memberByActualId =
        cu?.isAdmin && actualUserId ? guild.members?.find((m) => m.userId === actualUserId) : undefined;
    const resolvedMyMember = memberByEffective ?? memberByActualId ?? myMemberInfo;
    const isLeaderById =
        (!!effectiveUserId && guild.leaderId === effectiveUserId) ||
        (!!actualUserId && guild.leaderId === actualUserId);
    const canManage =
        isLeaderById ||
        resolvedMyMember?.role === GuildMemberRole.Master ||
        resolvedMyMember?.role === GuildMemberRole.Vice;
    const meetsGuildLevel = guild.level >= (project.requiredGuildLevel?.[currentLevel] ?? nextLevel);

    const canStartResearch = canManage && !isAnyResearchActive && !isMaxLevel && canAfford && meetsGuildLevel;

    useEffect(() => {
        if (isResearchingThis && guild.researchTask) {
            const completionTime = guild.researchTask.completedAt || guild.researchTask.completionTime;
            if (completionTime) {
                const update = () => {
                    const remaining = Math.max(0, completionTime - Date.now());
                    setTimeLeft(remaining);
                };
                update();
                const interval = setInterval(update, 1000);
                return () => clearInterval(interval);
            }
        }
    }, [isResearchingThis, guild.researchTask]);

    const handleStartResearch = () => {
        if (!canStartResearch) return;
        onRequestStart({
            researchId,
            name: project.name,
            image: project.image,
            level: nextLevel,
            cost,
            timeLabel: formatTimeLeft(timeMs, t),
        });
    };

    const currentEffectDisplay = getResearchSkillDisplay(researchId, currentLevel, t);
    const nextEffectDisplay = getResearchSkillDisplay(researchId, nextLevel, t);

    const defaultEffectText = `+${(project.baseEffect * currentLevel).toFixed(project.effectUnit === '%' ? 1 : 0).replace('.0', '')}${project.effectUnit}`;
    const defaultNextEffectText = `+${(project.baseEffect * nextLevel).toFixed(project.effectUnit === '%' ? 1 : 0).replace('.0', '')}${project.effectUnit}`;

    let currentEffectString = t('research.noEffect');
    if (currentLevel > 0) {
        currentEffectString = currentEffectDisplay
            ? `${currentEffectDisplay.chance ? t('research.chancePrefix', { chance: currentEffectDisplay.chance }) : ''}${currentEffectDisplay.description}`
            : defaultEffectText;
    }

    let nextEffectString = '';
    if (!isMaxLevel) {
        nextEffectString = nextEffectDisplay
            ? `${nextEffectDisplay.chance ? t('research.chancePrefix', { chance: nextEffectDisplay.chance }) : ''}${nextEffectDisplay.description}`
            : defaultNextEffectText;
    }

    const effectBoxes = (
        <div className="rounded-md border border-stone-700/50 bg-stone-800/40 px-2 py-1 text-xs leading-snug">
            {isMaxLevel ? (
                <>
                    <span className="text-stone-400">{t('research.effectLabel')}</span>
                    <span className="ml-1 font-bold text-emerald-400 break-words">{currentEffectString}</span>
                </>
            ) : (
                <>
                    <span className="text-stone-400">{t('research.effectLabel')}</span>
                    <span className="ml-1 font-bold text-emerald-400 break-words">{currentEffectString}</span>
                    <span className="mx-1 text-stone-500">→</span>
                    <span className="font-bold text-cyan-400 break-words">{nextEffectString}</span>
                </>
            )}
        </div>
    );

    const sidePanel = (
        <div className="flex flex-shrink-0 flex-col items-center gap-1.5">
            {isResearchingThis ? (
                <div className="relative w-full max-w-full overflow-hidden rounded-lg border border-emerald-500/60 bg-gradient-to-br from-emerald-900/90 via-teal-800/80 to-emerald-900/90 p-2 text-center shadow-lg sm:max-w-[8.5rem]">
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-teal-400/10 to-emerald-500/15" />
                    <div className="relative z-10">
                        <p className="mb-0.5 text-[10px] font-semibold text-emerald-300">{t('research.researching')}</p>
                        <p className="font-mono text-sm font-bold text-emerald-200">{formatTimeLeft(timeLeft, t)}</p>
                    </div>
                </div>
            ) : (
                <div className="w-full max-w-full space-y-1 rounded-lg border border-stone-600/60 bg-gradient-to-br from-stone-800/80 to-stone-900/80 p-2 text-xs shadow-md sm:max-w-[8.5rem]">
                    {isMaxLevel ? (
                        <p className="py-0.5 text-center text-xs font-bold text-emerald-400">{t('research.maxLevel')}</p>
                    ) : (
                        <>
                            <div className="flex justify-between items-center gap-1">
                                <span className="text-stone-400">{t('research.points')}</span>
                                <span className={`font-bold tabular-nums ${canAfford ? 'text-amber-300' : 'text-red-400'}`}>{cost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center gap-1">
                                <span className="text-stone-400">{t('research.time')}</span>
                                <span className="font-semibold text-stone-300">{formatTimeLeft(timeMs, t)}</span>
                            </div>
                            <div className="flex justify-between items-center gap-1">
                                <span className="text-stone-400">{t('research.guildLevel')}</span>
                                <span className={`font-bold ${meetsGuildLevel ? 'text-stone-300' : 'text-red-400'}`}>{project.requiredGuildLevel?.[currentLevel] ?? nextLevel}</span>
                            </div>
                        </>
                    )}
                </div>
            )}
            <button
                onClick={handleStartResearch}
                disabled={!canStartResearch}
                className={`group relative w-full max-w-full overflow-hidden rounded-lg py-1.5 text-xs font-bold transition-all duration-200 sm:max-w-[8.5rem] ${
                    canStartResearch
                        ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white shadow-lg shadow-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/50 active:scale-[0.98]'
                        : 'bg-stone-700/50 text-stone-400 cursor-not-allowed'
                }`}
            >
                {canStartResearch && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                )}
                <span className="relative z-10">
                    {isMaxLevel ? t('research.maxLevel') : t('research.startResearch')}
                </span>
            </button>
        </div>
    );

    return (
        <div
            className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${
                isResearchingThis
                    ? 'border-fuchsia-400/70 ring-1 ring-fuchsia-400/40 shadow-[0_0_20px_rgba(217,70,239,0.28)]'
                    : 'border-violet-400/30 hover:border-fuchsia-400/45 shadow-md'
            } bg-[radial-gradient(120%_100%_at_10%_0%,rgba(217,70,239,0.14),transparent_45%),linear-gradient(145deg,rgba(12,10,25,0.96),rgba(26,22,46,0.94))]`}
        >
            <div className="relative z-10 p-2 sm:p-2.5">
                <div className={`grid items-center gap-2 ${isNativeMobile ? 'grid-cols-1' : 'grid-cols-[3rem_1fr_8.5rem]'}`}>
                    <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-600/15 via-violet-700/10 to-cyan-600/10">
                        <img src={project.image} alt={project.name} className="h-9 w-9 object-contain" />
                    </div>
                    <div className="min-w-0">
                        <div className="mb-1 flex items-start justify-between gap-1.5">
                            <h4 className="text-sm font-bold leading-tight text-fuchsia-100">
                                {project.name}
                            </h4>
                            <span className="shrink-0 rounded border border-amber-300/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                                Lv {currentLevel}/{project.maxLevel}
                            </span>
                        </div>
                        <p className="mb-1.5 text-xs leading-snug text-violet-100/80">{project.description}</p>
                        {effectBoxes}
                    </div>
                    {sidePanel}
                </div>
            </div>
        </div>
    );
};

const GuildResearchPanel: React.FC<GuildResearchPanelProps & { onClose: () => void }> = ({ guild, myMemberInfo, onClose }) => {
    const { t } = useTranslation(['guild', 'common']);
    const { handlers } = useAppContext();
    const { handleAction } = handlers;
    const { isNativeMobile } = useNativeMobileShell();
    const isHandheld = useIsHandheldDevice();
    const [activeTab, setActiveTab] = useState<GuildResearchCategory>(GuildResearchCategory.development);
    const [pendingStart, setPendingStart] = useState<GuildResearchStartConfirmPayload | null>(null);
    const researchInProgressId = guild.researchTask?.researchId;
    const researchEndAt =
        guild.researchTask?.completedAt ?? guild.researchTask?.completionTime ?? null;

    // When the research timer elapses, keep nudging the server until researchTask is cleared
    // (level up applied). A single GET_GUILD_INFO can lose to debounce/races.
    useEffect(() => {
        if (!researchInProgressId || researchEndAt == null) return;
        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const syncCompletion = () => {
            if (cancelled) return;
            void handleAction({ type: 'GET_GUILD_INFO' });
        };

        const remainingMs = Math.max(0, researchEndAt - Date.now());
        const startTimer = setTimeout(() => {
            syncCompletion();
            intervalId = setInterval(syncCompletion, 2500);
        }, remainingMs);

        return () => {
            cancelled = true;
            clearTimeout(startTimer);
            if (intervalId) clearInterval(intervalId);
        };
    }, [researchInProgressId, researchEndAt, handleAction]);

    const researchProjectsForTab = useMemo(() => {
        return (Object.entries(GUILD_RESEARCH_PROJECTS) as [GuildResearchId, typeof GUILD_RESEARCH_PROJECTS[GuildResearchId]][])
            .filter(([, project]) => project.category === activeTab)
            .map(([id, project]) => ({ id, project }));
    }, [activeTab]);

    const tabs: { id: GuildResearchCategory; label: string }[] = [
        { id: GuildResearchCategory.development, label: t('research.categoryDevelopment') },
        { id: GuildResearchCategory.boss, label: t('research.categoryBoss') },
        { id: GuildResearchCategory.stats, label: t('research.categoryStats') },
        { id: GuildResearchCategory.rewards, label: t('research.categoryRewards') },
    ];

    return (
        <DraggableWindow
            title={t('research.title')}
            onClose={onClose}
            windowId="guild-research"
            initialWidth={600}
            initialHeight={700}
            variant="store"
            mobileViewportFit={isNativeMobile}
            mobileViewportMaxHeightVh={94}
            mobileLockViewportHeight={isHandheld}
            bodyNoScroll={isHandheld}
            hideFooter={isHandheld}
            bodyPaddingClassName={isNativeMobile ? 'p-2' : 'p-2.5'}
        >
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl">
                <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(90%_65%_at_0%_0%,rgba(217,70,239,0.18),transparent_55%),radial-gradient(70%_60%_at_100%_100%,rgba(45,212,191,0.16),transparent_55%),linear-gradient(145deg,rgba(8,6,20,0.95),rgba(22,18,40,0.92))]" aria-hidden />
                <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col px-1 pt-1 pb-0.5">
                <div className="mb-2 flex flex-shrink-0 items-center justify-end">
                    <div className="inline-flex items-center gap-1 rounded-lg border border-fuchsia-400/45 bg-gradient-to-br from-fuchsia-900/80 via-violet-800/75 to-cyan-900/75 px-2 py-1 shadow-md">
                        <img src="/images/guild/button/guildlab.webp" alt="" className="h-3.5 w-3.5 object-contain" />
                        <span className="text-xs font-bold tabular-nums text-cyan-200">
                            {(guild.researchPoints ?? 0).toLocaleString()} RP
                        </span>
                    </div>
                </div>
                <div className="mb-2 flex flex-shrink-0 gap-1 rounded-lg border border-fuchsia-400/30 bg-gradient-to-r from-violet-950/80 via-fuchsia-950/65 to-cyan-950/75 p-0.5 shadow-sm">
                    {tabs.map(tab => {
                        const tabColors = {
                            [GuildResearchCategory.development]: { active: 'from-fuchsia-600 to-violet-600', inactive: 'text-fuchsia-200/70 hover:text-fuchsia-100' },
                            [GuildResearchCategory.boss]: { active: 'from-rose-600 to-orange-500', inactive: 'text-rose-200/70 hover:text-rose-100' },
                            [GuildResearchCategory.stats]: { active: 'from-blue-600 to-cyan-500', inactive: 'text-cyan-200/70 hover:text-cyan-100' },
                            [GuildResearchCategory.rewards]: { active: 'from-purple-600 to-pink-500', inactive: 'text-purple-200/70 hover:text-purple-100' },
                        };
                        const colors = tabColors[tab.id] || { active: 'from-accent to-accent/80', inactive: 'text-tertiary' };
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 rounded-md py-1.5 text-xs font-bold transition-all ${
                                    activeTab === tab.id
                                        ? `bg-gradient-to-r ${colors.active} text-white shadow-lg`
                                        : `${colors.inactive} hover:bg-stone-700/50`
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
                <div
                    className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] space-y-2 pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(167,139,250,0.42)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-violet-400/45"
                >
                    {researchProjectsForTab.map(({ id, project }) => (
                        <ResearchItemPanel
                            key={id}
                            researchId={id}
                            project={project}
                            guild={guild}
                            myMemberInfo={myMemberInfo}
                            isResearchingThis={researchInProgressId === id}
                            isAnyResearchActive={!!researchInProgressId}
                            isNativeMobile={isNativeMobile}
                            onRequestStart={setPendingStart}
                        />
                    ))}
                </div>
                </div>
            </div>
            {pendingStart && (
                <GuildResearchStartConfirmModal
                    payload={pendingStart}
                    onClose={() => setPendingStart(null)}
                    onConfirm={() => {
                        const researchId = pendingStart.researchId;
                        handleAction({
                            type: 'GUILD_START_RESEARCH',
                            payload: { guildId: guild.id, researchId },
                        });
                    }}
                />
            )}
        </DraggableWindow>
    );
};

export default GuildResearchPanel;
