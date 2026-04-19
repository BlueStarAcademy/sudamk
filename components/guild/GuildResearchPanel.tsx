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
            return { chance, description: `회복 불가 또는 회복량 ${reduction}% 감소` };
        }
        case GuildResearchId.boss_skill_regen: { // '회복'
            const chance = 10 + (15 * level);
            const increase = 10 * level; // baseEffect is 10
            return { chance, description: `회복, 회복량 +${increase}%` };
        }
        case GuildResearchId.boss_skill_ignite: {
            const chance = 10 + (15 * level);
            const increasePercent = level * 10; // baseEffect is 10
            return { chance, description: `고정피해, 피해량 +${increasePercent}%` };
        }
        case GuildResearchId.ap_regen_boost: {
            const sec = project.baseEffect * level;
            return { description: `1AP 회복 간격 ${sec}초 감소` };
        }
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
        <div className={`grid gap-1.5 ${isNativeMobile ? 'grid-cols-1 text-[11px]' : 'grid-cols-2 text-xs'}`}>
            <div className={`bg-stone-800/40 rounded-lg border border-stone-700/50 ${isNativeMobile ? 'px-2 py-1' : 'px-2 py-1.5'}`}>
                <span className="text-stone-400">현재:</span>
                <span className="font-bold text-emerald-400 ml-1 break-words">{currentEffectString}</span>
            </div>
            {!isMaxLevel && (
                <div className={`bg-stone-800/40 rounded-lg border border-stone-700/50 ${isNativeMobile ? 'px-2 py-1' : 'px-2 py-1.5'}`}>
                    <span className="text-stone-400">다음:</span>
                    <span className="font-bold text-cyan-400 ml-1 break-words">{nextEffectString}</span>
                </div>
            )}
        </div>
    );

    const sidePanel = (
        <div className="flex-shrink-0 flex flex-col gap-2">
            {isResearchingThis ? (
                <div className={`text-center bg-gradient-to-br from-emerald-900/90 via-teal-800/80 to-emerald-900/90 rounded-xl border-2 border-emerald-500/70 shadow-2xl relative overflow-hidden ${isNativeMobile ? 'p-2' : 'p-3'}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-teal-400/10 to-emerald-500/15 pointer-events-none"></div>
                    <div className="relative z-10">
                        <p className={`text-emerald-300 mb-0.5 font-semibold ${isNativeMobile ? 'text-[9px]' : 'text-[10px]'}`}>연구 진행 중</p>
                        <p className={`font-mono font-bold text-emerald-200 drop-shadow-lg ${isNativeMobile ? 'text-base' : 'text-xl'}`}>{formatTimeLeft(timeLeft)}</p>
                    </div>
                </div>
            ) : (
                <div className={`bg-gradient-to-br from-stone-800/80 to-stone-900/80 rounded-xl border-2 border-stone-600/60 shadow-lg ${isNativeMobile ? 'p-2 text-[10px] space-y-1' : 'p-2.5 text-xs space-y-1.5'}`}>
                    {isMaxLevel ? (
                        <p className="text-center font-bold text-emerald-400 text-xs py-1">✨ 최고 레벨 ✨</p>
                    ) : (
                        <>
                            <div className="flex justify-between items-center gap-1">
                                <span className="text-stone-400">포인트:</span>
                                <span className={`font-bold tabular-nums ${canAfford ? 'text-amber-300' : 'text-red-400'}`}>{cost.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center gap-1">
                                <span className="text-stone-400">시간:</span>
                                <span className="font-semibold text-stone-300 text-[10px]">{formatTimeLeft(timeMs)}</span>
                            </div>
                            <div className="flex justify-between items-center gap-1">
                                <span className="text-stone-400">길드Lv:</span>
                                <span className={`font-bold text-[10px] ${meetsGuildLevel ? 'text-stone-300' : 'text-red-400'}`}>{project.requiredGuildLevel?.[currentLevel] ?? nextLevel}</span>
                            </div>
                        </>
                    )}
                </div>
            )}
            <button
                onClick={handleStartResearch}
                disabled={!canStartResearch}
                className={`w-full rounded-xl font-bold transition-all duration-200 relative overflow-hidden group ${
                    isNativeMobile ? 'py-2 text-xs' : 'py-2.5 text-sm'
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
         <div className={`bg-gradient-to-br from-stone-900/95 via-neutral-800/90 to-stone-900/95 rounded-xl transition-all duration-300 border-2 relative overflow-hidden ${
            isResearchingThis 
                ? 'border-emerald-500/80 ring-2 ring-emerald-500/50 shadow-[0_0_25px_rgba(16,185,129,0.6)]' 
                : 'border-stone-600/60 hover:border-stone-500/80 hover:shadow-xl'
        }`}>
            <div className="absolute inset-0 bg-gradient-to-br from-stone-500/10 via-gray-500/5 to-stone-500/10 pointer-events-none"></div>
            <div className={`relative z-10 ${isNativeMobile ? 'p-2.5' : 'p-4'}`}>
                {isNativeMobile ? (
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-start gap-2.5">
                            <div className="flex-shrink-0 w-[3.25rem] h-[3.25rem] bg-gradient-to-br from-stone-800/90 to-stone-900/90 rounded-lg flex items-center justify-center border-2 border-stone-600/60 shadow-xl relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-emerald-500/15 pointer-events-none"></div>
                                <img src={project.image} alt={project.name} className="w-[2.6rem] h-[2.6rem] object-contain drop-shadow-2xl relative z-10" />
                            </div>
                            <div className="flex-grow min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <h4 className="font-bold text-[13px] text-white leading-tight drop-shadow-lg line-clamp-2">{project.name}</h4>
                                    <div className="flex-shrink-0 flex items-center gap-1 bg-stone-800/60 px-2 py-0.5 rounded-md border border-stone-700/50">
                                        <span className="text-[10px] text-stone-400">Lv</span>
                                        <span className="font-bold text-amber-300 text-xs">{currentLevel}/{project.maxLevel}</span>
                                    </div>
                                </div>
                                <p className="text-[11px] text-stone-300/80 line-clamp-2 leading-snug mb-2">{project.description}</p>
                                {effectBoxes}
                            </div>
                        </div>
                        {sidePanel}
                    </div>
                ) : (
                    <div className="grid grid-cols-[80px_1fr_280px] gap-4 items-center">
                        <div className="flex-shrink-0 w-20 h-20 bg-gradient-to-br from-stone-800/90 to-stone-900/90 rounded-xl flex items-center justify-center border-2 border-stone-600/60 shadow-xl relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-teal-500/10 to-emerald-500/15 pointer-events-none"></div>
                            <img src={project.image} alt={project.name} className="w-16 h-16 object-contain drop-shadow-2xl relative z-10" />
                        </div>
                        <div className="flex-grow min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex-grow min-w-0">
                                    <h4 className="font-bold text-base text-white truncate mb-1 drop-shadow-lg">{project.name}</h4>
                                    <p className="text-xs text-stone-300/80 line-clamp-1 leading-relaxed">{project.description}</p>
                                </div>
                                <div className="flex-shrink-0 flex items-center gap-2 bg-stone-800/60 px-3 py-1 rounded-lg border border-stone-700/50">
                                    <span className="text-xs text-stone-400">레벨</span>
                                    <span className="font-bold text-amber-300 text-sm">{currentLevel}/{project.maxLevel}</span>
                                </div>
                            </div>
                            {effectBoxes}
                        </div>
                        {sidePanel}
                    </div>
                )}
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
            initialWidth={1100}
            initialHeight={850}
            variant="store"
            mobileViewportFit={isNativeMobile}
            mobileViewportMaxHeightVh={94}
            bodyPaddingClassName={isNativeMobile ? 'p-2' : undefined}
        >
            <div className="flex flex-col h-full relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-stone-950/50 via-neutral-900/30 to-stone-950/50 pointer-events-none"></div>
                <div className="relative z-10 flex flex-col h-full">
                <div className={`flex justify-between items-center flex-shrink-0 gap-2 ${isNativeMobile ? 'mb-2' : 'mb-4'}`}>
                    <div className={`flex items-center min-w-0 ${isNativeMobile ? 'gap-2' : 'gap-3'}`}>
                        <h3 className={`font-bold bg-gradient-to-r from-emerald-300 to-teal-300 bg-clip-text text-transparent truncate ${isNativeMobile ? 'text-base' : 'text-2xl'}`}>길드 연구소</h3>
                    </div>
                    <div className={`bg-gradient-to-br from-amber-900/90 via-yellow-800/80 to-amber-900/90 rounded-xl text-center border-2 border-amber-500/60 shadow-2xl backdrop-blur-md relative overflow-hidden flex-shrink-0 ${isNativeMobile ? 'px-2.5 py-2' : 'p-4'}`}>
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-yellow-400/10 to-amber-500/15 pointer-events-none"></div>
                        <div className="relative z-10">
                            <p className={`text-amber-200/80 font-semibold ${isNativeMobile ? 'text-[9px] mb-0' : 'text-xs mb-1'}`}>연구 포인트</p>
                            <p className={`font-bold text-yellow-300 drop-shadow-lg tabular-nums ${isNativeMobile ? 'text-sm' : 'text-2xl'}`}>
                                {(guild.researchPoints ?? 0).toLocaleString()} {!isNativeMobile && <span className="text-lg">RP</span>}
                                {isNativeMobile && <span className="text-xs font-semibold text-amber-200/90"> RP</span>}
                            </p>
                        </div>
                    </div>
                </div>
                <div className={`flex bg-gradient-to-r from-stone-800/90 via-neutral-800/80 to-stone-800/90 rounded-xl flex-shrink-0 border border-stone-600/50 shadow-lg ${isNativeMobile ? 'p-1 mb-2' : 'p-1.5 mb-4'}`}>
                    {tabs.map(tab => {
                        const tabColors = {
                            [GuildResearchCategory.development]: { active: 'from-emerald-600 to-teal-600', inactive: 'text-emerald-300/70 hover:text-emerald-300' },
                            [GuildResearchCategory.boss]: { active: 'from-red-600 to-orange-600', inactive: 'text-red-300/70 hover:text-red-300' },
                            [GuildResearchCategory.stats]: { active: 'from-blue-600 to-cyan-600', inactive: 'text-blue-300/70 hover:text-blue-300' },
                            [GuildResearchCategory.rewards]: { active: 'from-purple-600 to-pink-600', inactive: 'text-purple-300/70 hover:text-purple-300' },
                        };
                        const colors = tabColors[tab.id] || { active: 'from-accent to-accent/80', inactive: 'text-tertiary' };
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 font-bold rounded-lg transition-all ${isNativeMobile ? 'py-2 text-[11px]' : 'py-2.5 text-sm'} ${
                                    activeTab === tab.id 
                                        ? `bg-gradient-to-r ${colors.active} text-white shadow-lg shadow-${colors.active.split(' ')[1]}/30` 
                                        : `${colors.inactive} hover:bg-stone-700/50`
                                }`}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
                <div className={`overflow-y-auto flex-1 ${isNativeMobile ? 'space-y-2 pr-1' : 'space-y-3 pr-2'}`}>
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