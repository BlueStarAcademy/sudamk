import React, { useState, useEffect, useMemo } from 'react';
import { Guild, GuildMember, GuildResearchId, GuildResearchCategory } from '../../types/index.js';
import { GuildMemberRole } from '../../types/enums.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import Button from '../Button.js';
import { GUILD_RESEARCH_PROJECTS, ADMIN_USER_ID } from '../../constants/index.js';
import DraggableWindow from '../DraggableWindow.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';

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
    if(!project) return 0;
    const hours = project.baseTimeHours + (project.timeIncrementHours * level);
    return hours * 60 * 60 * 1000;
};

const formatTimeLeft = (ms: number): string => {
    if (ms <= 0) return "완료";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getResearchSkillDisplay = (researchId: GuildResearchId, level: number): { chance?: number; description: string; } | null => {
    if (level === 0) return null;
    const project = GUILD_RESEARCH_PROJECTS[researchId];
    if (!project) return null;

    const totalEffect = project.baseEffect * level;

    switch (researchId) {
        case GuildResearchId.boss_hp_increase:
            return { description: `[${totalEffect}% 증가]` };
        case GuildResearchId.boss_skill_heal_block: {
            const chance = 10 + (15 * level);
            const reduction = 10 * level; // baseEffect is 10
            return { description: `[${chance}%]확률 / 회복량 [-${reduction}%]` };
        }
        case GuildResearchId.boss_skill_regen: { // '회복'
            const chance = 10 + (15 * level);
            const increase = 10 * level; // baseEffect is 10
            return { description: `[${chance}%]확률 / 회복량[+${increase}%]` };
        }
        case GuildResearchId.boss_skill_ignite: {
            const chance = 10 + (15 * level);
            const increasePercent = level * 10; // baseEffect is 10
            return { description: `[${chance}%]확률 / 피해량[+${increasePercent}%]` };
        }
        case GuildResearchId.ap_regen_boost: {
            const sec = project.baseEffect * level;
            return { description: `행동력 회복시간 -${sec}초` };
        }
        case GuildResearchId.stat_concentration:
            return { description: `집중력 +${totalEffect}%` };
        case GuildResearchId.stat_thinking_speed:
            return { description: `사고속도 +${totalEffect}%` };
        case GuildResearchId.stat_judgment:
            return { description: `판단력 +${totalEffect}%` };
        case GuildResearchId.stat_calculation:
            return { description: `계산력 +${totalEffect}%` };
        case GuildResearchId.stat_combat_power:
            return { description: `전투력 +${totalEffect}%` };
        case GuildResearchId.stat_stability:
            return { description: `안정감 +${totalEffect}%` };
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
}> = ({ researchId, project, guild, myMemberInfo, isResearchingThis, isAnyResearchActive, isNativeMobile }) => {
    const { handlers, currentUserWithStatus } = useAppContext();
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
    // 서버 GUILD_START_RESEARCH와 동일: 관리자는 members에 canonical id 또는 실제 id로 들어갈 수 있음
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
        if (window.confirm(`[${project.name}] ${nextLevel}레벨 연구를 시작하시겠습니까?\n\n필요 포인트: ${cost.toLocaleString()} RP\n예상 시간: ${formatTimeLeft(timeMs)}`)) {
            handlers.handleAction({ type: 'GUILD_START_RESEARCH', payload: { guildId: guild.id, researchId } });
        }
    };
    
    const currentEffectDisplay = getResearchSkillDisplay(researchId, currentLevel);
    const nextEffectDisplay = getResearchSkillDisplay(researchId, nextLevel);

    const defaultEffectText = `+${(project.baseEffect * currentLevel).toFixed(project.effectUnit === '%' ? 1 : 0).replace('.0', '')}${project.effectUnit}`;
    const defaultNextEffectText = `+${(project.baseEffect * nextLevel).toFixed(project.effectUnit === '%' ? 1 : 0).replace('.0', '')}${project.effectUnit}`;
    
    let currentEffectString = '효과 없음';
    if (currentLevel > 0) {
        currentEffectString = currentEffectDisplay ? `${currentEffectDisplay.chance ? `[${currentEffectDisplay.chance}% 확률] ` : ''}${currentEffectDisplay.description}` : defaultEffectText;
    }

    let nextEffectString = '';
    if (!isMaxLevel) {
        nextEffectString = nextEffectDisplay ? `${nextEffectDisplay.chance ? `[${nextEffectDisplay.chance}% 확률] ` : ''}${nextEffectDisplay.description}` : defaultNextEffectText;
    }


    const effectBoxes = (
        <div className={`rounded-lg border border-stone-700/50 bg-stone-800/40 ${isNativeMobile ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm'}`}>
            {isMaxLevel ? (
                <>
                    <span className="text-stone-400">효과:</span>
                    <span className="ml-1 font-bold text-emerald-400 break-words">{currentEffectString}</span>
                </>
            ) : (
                <>
                    <span className="text-stone-400">효과:</span>
                    <span className="ml-1 font-bold text-emerald-400 break-words">{currentEffectString}</span>
                    <span className="mx-1 text-stone-500">→</span>
                    <span className="font-bold text-cyan-400 break-words">{nextEffectString}</span>
                </>
            )}
        </div>
    );

    const sidePanel = (
        <div className="flex-shrink-0 flex flex-col items-center gap-2.5">
            {isResearchingThis ? (
                <div className={`w-full text-center bg-gradient-to-br from-emerald-900/90 via-teal-800/80 to-emerald-900/90 rounded-xl border-2 border-emerald-500/70 shadow-2xl relative overflow-hidden ${isNativeMobile ? 'max-w-full p-2.5' : 'max-w-[12rem] p-3'}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-teal-400/10 to-emerald-500/15 pointer-events-none"></div>
                    <div className="relative z-10">
                        <p className={`text-emerald-300 mb-1 font-semibold ${isNativeMobile ? 'text-[11px]' : 'text-xs'}`}>연구 진행 중</p>
                        <p className={`font-mono font-bold text-emerald-200 drop-shadow-lg ${isNativeMobile ? 'text-lg' : 'text-2xl'}`}>{formatTimeLeft(timeLeft)}</p>
                    </div>
                </div>
            ) : (
                <div className={`w-full bg-gradient-to-br from-stone-800/80 to-stone-900/80 rounded-xl border-2 border-stone-600/60 shadow-lg ${isNativeMobile ? 'max-w-full p-2.5 text-xs space-y-1.5' : 'max-w-[12rem] p-2.5 text-sm space-y-1.5'}`}>
                    {isMaxLevel ? (
                        <p className="text-center font-bold text-emerald-400 text-sm py-1">✨ 최고 레벨 ✨</p>
                    ) : (
                        <>
                            <div className="flex justify-between items-center gap-1">
                                <span className="text-stone-400">포인트:</span>
                                <span className={`font-bold tabular-nums ${canAfford ? 'text-amber-300' : 'text-red-400'}`}>{cost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center gap-1">
                                <span className="text-stone-400">시간:</span>
                                <span className="font-semibold text-stone-300">{formatTimeLeft(timeMs)}</span>
                            </div>
                            <div className="flex justify-between items-center gap-1">
                                <span className="text-stone-400">길드Lv:</span>
                                <span className={`font-bold ${meetsGuildLevel ? 'text-stone-300' : 'text-red-400'}`}>{project.requiredGuildLevel?.[currentLevel] ?? nextLevel}</span>
                            </div>
                        </>
                    )}
                </div>
            )}
            <button
                onClick={handleStartResearch}
                disabled={!canStartResearch}
                className={`w-full rounded-xl font-bold transition-all duration-200 relative overflow-hidden group ${
                    isNativeMobile ? 'max-w-full py-2.5 text-sm' : 'max-w-[12rem] py-2.5 text-[15px]'
                } ${
                    canStartResearch
                        ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 text-white shadow-lg shadow-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/50 active:scale-[0.98]'
                        : 'bg-stone-700/50 text-stone-400 cursor-not-allowed'
                }`}
            >
                {canStartResearch && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                )}
                <span className="relative z-10 flex items-center justify-center gap-1.5">
                    {isMaxLevel ? (
                        <>✨ 최고 레벨</>
                    ) : (
                        <>
                            <span>🔬</span>
                            <span>연구 시작</span>
                        </>
                    )}
                </span>
            </button>
        </div>
    );

    return (
        <div
            className={`rounded-2xl transition-all duration-300 border-2 relative overflow-hidden ${
                isResearchingThis
                    ? 'border-fuchsia-400/75 ring-2 ring-fuchsia-400/45 shadow-[0_0_36px_rgba(217,70,239,0.4)]'
                    : 'border-violet-400/35 hover:border-fuchsia-400/50 shadow-[0_18px_36px_-20px_rgba(0,0,0,0.7)]'
            } bg-[radial-gradient(120%_100%_at_10%_0%,rgba(217,70,239,0.2),transparent_45%),radial-gradient(90%_80%_at_90%_100%,rgba(45,212,191,0.16),transparent_50%),linear-gradient(145deg,rgba(12,10,25,0.96),rgba(26,22,46,0.94))]`}
        >
            <div className={`relative z-10 ${isNativeMobile ? 'p-2.5' : 'p-4'}`}>
                <div className={`grid gap-3 ${isNativeMobile ? 'grid-cols-1' : 'grid-cols-[88px_1fr_210px] items-center'}`}>
                    <div className="relative mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border border-fuchsia-300/35 bg-gradient-to-br from-fuchsia-600/20 via-violet-700/15 to-cyan-600/15 shadow-lg">
                        <img src={project.image} alt={project.name} className="h-[3.5rem] w-[3.5rem] object-contain drop-shadow-[0_0_8px_rgba(217,70,239,0.45)]" />
                    </div>
                    <div className="min-w-0">
                        <div className="mb-2 flex items-start justify-between gap-2.5">
                            <h4 className={`${isNativeMobile ? 'text-base' : 'text-xl'} font-extrabold leading-tight text-fuchsia-100 drop-shadow`}>
                                {project.name}
                            </h4>
                            <span className="rounded-lg border border-amber-300/45 bg-amber-500/10 px-2.5 py-1 text-sm font-bold text-amber-200">
                                Lv {currentLevel}/{project.maxLevel}
                            </span>
                        </div>
                        <p className={`${isNativeMobile ? 'text-sm' : 'text-[15px]'} mb-2 text-violet-100/85`}>{project.description}</p>
                        {effectBoxes}
                    </div>
                    {sidePanel}
                </div>
            </div>
        </div>
    );
};

const GuildResearchPanel: React.FC<GuildResearchPanelProps & { onClose: () => void }> = ({ guild, myMemberInfo, onClose }) => {
    const { isNativeMobile } = useNativeMobileShell();
    // FIX: Replaced string literal with GuildResearchCategory enum member for initial state.
    const [activeTab, setActiveTab] = useState<GuildResearchCategory>(GuildResearchCategory.development);
    const researchInProgressId = guild.researchTask?.researchId;

    const researchProjectsForTab = useMemo(() => {
        return (Object.entries(GUILD_RESEARCH_PROJECTS) as [GuildResearchId, typeof GUILD_RESEARCH_PROJECTS[GuildResearchId]][])
            .filter(([, project]) => project.category === activeTab)
            .map(([id, project]) => ({ id, project }));
    }, [activeTab]);
    
    const tabs: { id: GuildResearchCategory; label: string }[] = [
        // FIX: Replaced string literals with GuildResearchCategory enum members.
        { id: GuildResearchCategory.development, label: '길드 발전' },
        { id: GuildResearchCategory.boss, label: '보스전' },
        { id: GuildResearchCategory.stats, label: '능력치 증가' },
        { id: GuildResearchCategory.rewards, label: '보상 증가' },
    ];

    return (
        <DraggableWindow
            title="길드 연구소"
            onClose={onClose}
            windowId="guild-research"
            initialWidth={840}
            initialHeight={850}
            variant="store"
            mobileViewportFit={isNativeMobile}
            mobileViewportMaxHeightVh={94}
            bodyPaddingClassName={isNativeMobile ? 'p-2.5' : 'p-3.5'}
        >
            <div className="flex flex-col h-full relative overflow-hidden rounded-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(90%_65%_at_0%_0%,rgba(217,70,239,0.18),transparent_55%),radial-gradient(70%_60%_at_100%_100%,rgba(45,212,191,0.16),transparent_55%),linear-gradient(145deg,rgba(8,6,20,0.95),rgba(22,18,40,0.92))] pointer-events-none"></div>
                <div className={`relative z-10 flex flex-col h-full ${isNativeMobile ? 'px-1.5 pt-1.5 pb-1' : 'px-2 pt-2 pb-1.5'}`}>
                <div className={`grid grid-cols-[1fr_auto_1fr] items-center flex-shrink-0 gap-2.5 ${isNativeMobile ? 'mb-3.5' : 'mb-5'}`}>
                    <div className={isNativeMobile ? 'pr-2' : 'pr-4'} />
                    <div className={`flex items-center justify-center min-w-0 ${isNativeMobile ? 'gap-2' : 'gap-3'}`}>
                        <h3 className={`font-black bg-gradient-to-r from-fuchsia-200 via-pink-200 to-cyan-200 bg-clip-text text-transparent truncate ${isNativeMobile ? 'text-xl' : 'text-4xl'}`}>길드 연구소</h3>
                    </div>
                    <div className={`flex justify-end ${isNativeMobile ? 'pr-0.5' : 'pr-1'}`}>
                    <div className={`bg-gradient-to-br from-fuchsia-900/85 via-violet-800/80 to-cyan-900/80 rounded-xl border-2 border-fuchsia-400/60 shadow-2xl backdrop-blur-md relative overflow-hidden flex-shrink-0 ${isNativeMobile ? 'px-2.5 py-1.5' : 'px-3.5 py-2'}`}>
                        <div className="relative z-10 inline-flex items-center gap-1.5">
                            <img src="/images/guild/button/guildlab.webp" alt="" className={`${isNativeMobile ? 'h-4 w-4' : 'h-5 w-5'} object-contain`} />
                            <span className={`font-black text-cyan-200 drop-shadow-lg tabular-nums ${isNativeMobile ? 'text-sm' : 'text-lg'}`}>
                                {(guild.researchPoints ?? 0).toLocaleString()} RP
                            </span>
                        </div>
                    </div>
                    </div>
                </div>
                <div className={`flex gap-1.5 bg-gradient-to-r from-violet-950/80 via-fuchsia-950/65 to-cyan-950/75 rounded-xl flex-shrink-0 border border-fuchsia-400/35 shadow-lg ${isNativeMobile ? 'px-1 py-1 mb-2.5' : 'px-1.5 py-1.5 mb-4'} ${isNativeMobile ? 'mx-0.5' : 'mx-1'}`}>
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
                                className={`flex-1 font-bold rounded-lg transition-all ${isNativeMobile ? 'py-1.5 text-xs' : 'py-2 text-base'} ${
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
                    className={`overflow-y-auto flex-1 [scrollbar-width:thin] [scrollbar-color:rgba(167,139,250,0.42)_transparent] [&::-webkit-scrollbar]:w-[4px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-violet-400/45 hover:[&::-webkit-scrollbar-thumb]:bg-fuchsia-300/55 ${isNativeMobile ? 'space-y-2.5 pr-1 pl-0.5' : 'space-y-3.5 pr-2.5 pl-1'}`}
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
                        />
                    ))}
                </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default GuildResearchPanel;