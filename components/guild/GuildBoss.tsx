import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import { Guild as GuildType, UserWithStatus, GuildBossInfo, QuestReward, GuildMember, GuildMemberRole, CoreStat, GuildResearchId, EquipmentSlot, InventoryItem, ItemGrade } from '../../types/index.js';
import BackButton from '../BackButton.js';
import Button from '../Button.js';
import GuildHomePanel from './GuildHomePanel.js';
import GuildMembersPanel from './GuildMembersPanel.js';
import GuildManagementPanel from './GuildManagementPanel.js';
import { GUILD_XP_PER_LEVEL, GUILD_BOSSES, GUILD_RESEARCH_PROJECTS, AVATAR_POOL, BORDER_POOL, emptySlotImages, slotNames, GUILD_BOSS_MAX_ATTEMPTS, ADMIN_USER_ID, ADMIN_NICKNAME } from '../../constants/index.js';
import { getTodayKSTDateString } from '../../utils/timeUtils.js';
import DraggableWindow from '../DraggableWindow.js';
import GuildResearchPanel from './GuildResearchPanel.js';
import GuildMissionsPanel from './GuildMissionsPanel.js';
import GuildShopModal from './GuildShopModal.js';
import { BOSS_SKILL_ICON_MAP } from '../../assets.js';
import {
    clearPendingGuildBossBattle,
    GUILD_BOSS_LOG_PLAYBACK_MS,
    loadPendingGuildBossBattle,
    savePendingGuildBossBattle,
    type GuildBossBattleModalResult,
    type GuildBossBattleSubmitContext,
} from '../../utils/guildBossBattlePersistence.js';
import { getCurrentGuildBossStage, scaleGuildBossForStage } from '../../utils/guildBossStageUtils.js';
import type { BattleLogEntry, GuildBossBattleResult } from '../../types/index.js';
import { calculateTotalStats } from '../../utils/statUtils.js';
import Avatar from '../Avatar.js';
import UserNicknameText from '../UserNicknameText.js';
import { GUILD_ATTACK_ICON, GUILD_RESEARCH_HEAL_BLOCK_IMG, GUILD_RESEARCH_IGNITE_IMG, GUILD_RESEARCH_REGEN_IMG } from '../../assets.js';
import HomeNativeMergedEquipmentAbilityPanel from '../HomeNativeMergedEquipmentAbilityPanel.js';
import { BADUK_ABILITY_STAT_CAP, BADUK_ABILITY_TOTAL_CAP } from '../CoreStatsHexagonChart.js';
import GuildBossBattleResultModal from './GuildBossBattleResultModal.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { LOBBY_MOBILE_BTN_PRIMARY_CLASS, PRE_GAME_MODAL_PRIMARY_BTN_CLASS } from '../game/PreGameDescriptionLayout.js';

/** 모바일 보스전: 보스·유저(및 하단 로그) 가로 비율 4.5 : 5.5 */
const GUILD_BOSS_MOBILE_BOSS_COLUMN_CLASS = 'min-w-0 basis-0 flex-[4.5]';
const GUILD_BOSS_MOBILE_USER_COLUMN_CLASS = 'min-w-0 basis-0 flex-[5.5]';
/** PC 보스전: 좌 보스(이미지 폭) → 우 유저(콘텐츠 폭) → 중 로그(남는 공간 flex-1) */
const GUILD_BOSS_DESKTOP_LEFT_RAIL_CLASS =
    'flex h-full min-h-0 w-[min(32vw,28rem)] min-w-[16rem] shrink-0 flex-col items-stretch gap-2 overflow-hidden';
const GUILD_BOSS_DESKTOP_LOG_RAIL_CLASS = 'flex min-h-0 min-w-0 flex-1 flex-col gap-3';
const GUILD_BOSS_DESKTOP_USER_RAIL_CLASS = 'flex min-h-0 w-[32rem] min-w-[32rem] shrink-0 flex-col gap-4';

const GUILD_BOSS_TOP_RANK_BADGE_CLASS: Record<1 | 2 | 3, string> = {
    1: 'bg-gradient-to-br from-amber-100 via-yellow-400 to-amber-700 text-amber-950 ring-2 ring-amber-200/90 shadow-[0_0_12px_rgba(251,191,36,0.42)]',
    2: 'bg-gradient-to-br from-slate-50 via-slate-300 to-slate-600 text-slate-900 ring-2 ring-slate-200/85 shadow-[0_2px_8px_rgba(148,163,184,0.35)]',
    3: 'bg-gradient-to-br from-orange-200 via-amber-700 to-orange-950 text-orange-50 ring-2 ring-orange-300/75 shadow-[0_2px_8px_rgba(194,65,12,0.28)]',
};

const GuildBossTopRankBadge: React.FC<{ place: 1 | 2 | 3; compact?: boolean }> = ({ place, compact = false }) => (
    <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-black tabular-nums ${
            compact ? 'h-6 w-6 text-[11px]' : 'h-8 w-8 text-sm'
        } ${GUILD_BOSS_TOP_RANK_BADGE_CLASS[place]}`}
        aria-label={`${place}위`}
    >
        {place}
    </span>
);

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


const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: '/images/equipments/normalbgi.webp',
    uncommon: '/images/equipments/uncommonbgi.webp',
    rare: '/images/equipments/rarebgi.webp',
    epic: '/images/equipments/epicbgi.webp',
    legendary: '/images/equipments/legendarybgi.webp',
    mythic: '/images/equipments/mythicbgi.webp',
    transcendent: '/images/equipments/transcendentbgi.webp',
};

const renderStarDisplay = (stars: number) => {
    if (stars === 0) return null;

    let starImage = '';
    let numberColor = '';
    let starImageClass = '';

    if (stars >= 10) {
        starImage = '/images/equipments/Star4.webp';
        numberColor = "prism-text-effect";
        starImageClass = "prism-image-effect";
    } else if (stars >= 7) {
        starImage = '/images/equipments/Star3.webp';
        numberColor = "text-purple-400";
    } else if (stars >= 4) {
        starImage = '/images/equipments/Star2.webp';
        numberColor = "text-amber-400";
    } else if (stars >= 1) {
        starImage = '/images/equipments/Star1.webp';
        numberColor = "text-white";
    }

    return (
        <div
            className="absolute right-1.5 top-0.5 z-10 flex items-center gap-0.5 rounded-bl-md bg-black/45 px-1 py-0.5 backdrop-blur-[2px]"
            style={{ textShadow: '1px 1px 2px black' }}
        >
            <img src={starImage} alt="star" className={`w-3 h-3 ${starImageClass}`} />
            <span className={`font-bold text-xs leading-none ${numberColor}`}>{stars}</span>
        </div>
    );
};

export const EquipmentSlotDisplay: React.FC<{ slot: EquipmentSlot; item?: InventoryItem; onClick?: () => void; }> = ({ slot, item, onClick }) => {
    const clickableClass = item && onClick ? 'cursor-pointer hover:scale-105 transition-transform' : '';
    
    if (item) {
        const isTranscendent = item.grade === ItemGrade.Transcendent;
        return (
            <div
                className={`relative w-full aspect-square rounded-md border border-color/50 bg-tertiary/50 ${clickableClass} ${isTranscendent ? 'transcendent-grade-slot' : ''}`}
                title={item.name}
                onClick={onClick}
            >
                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 w-full h-full object-cover rounded-sm" />
                {renderStarDisplay(item.stars)}
                {item.image && <img src={item.image} alt={item.name} className="absolute object-contain p-1" style={{ width: '80%', height: '80%', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }} />}
            </div>
        );
    } else {
         return (
             <img src={emptySlotImages[slot]} alt={`${slot} empty slot`} className="w-full aspect-square rounded-md bg-tertiary/50 border-2 border-dashed border-color/50" />
        );
    }
};

interface UserStatsPanelProps {
    user: UserWithStatus;
    guild: GuildType | null;
    hp: number;
    maxHp: number;
    damageNumbers: { id: number; text: string; color: string }[];
    isSimulating: boolean;
    /** 네이티브 모바일 보스전 한 화면 레이아웃용 압축 UI */
    compact?: boolean;
}

const UserStatsPanel: React.FC<UserStatsPanelProps> = ({ user, guild, hp, maxHp, damageNumbers, isSimulating, compact = false }) => {
    const { handlers } = useAppContext();
    const myGuild = guild;
    const [selectedPreset, setSelectedPreset] = useState(0);
    
    const totalStats = useMemo(() => calculateTotalStats(user, myGuild, 'guildBoss'), [user, myGuild]);
    const baseWithSpent = useMemo(() => {
        const stats: Record<CoreStat, number> = {} as any;
        for (const key of Object.values(CoreStat)) {
            stats[key] = (user.baseStats[key] || 0) + (user.spentStatPoints?.[key] || 0);
        }
        return stats;
    }, [user.baseStats, user.spentStatPoints]);

    const coreStatComputeBundle = useMemo(() => {
        const finalByStat = { ...totalStats };
        const baseByStat = baseWithSpent;
        const badukAbilityTotal = Math.min(
            BADUK_ABILITY_TOTAL_CAP,
            Object.values(finalByStat).reduce((sum, v) => {
                const safeValue = Number.isFinite(v) ? Math.max(0, v) : 0;
                return sum + Math.min(BADUK_ABILITY_STAT_CAP, safeValue);
            }, 0),
        );
        return { finalByStat, baseByStat, badukAbilityTotal };
    }, [totalStats, baseWithSpent]);

    const levelPoints = (user.userLevel - 1) * 2;
    const bonusPoints = user.bonusStatPoints || 0;
    const totalPoints = levelPoints + bonusPoints;
    const spentPoints = useMemo(
        () => Object.values(user.spentStatPoints || {}).reduce((sum, points) => sum + points, 0),
        [user.spentStatPoints],
    );
    const availablePoints = totalPoints - spentPoints;

    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === user.avatarId)?.url, [user.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === user.borderId)?.url, [user.borderId]);

    const equippedItems = useMemo(() => {
        return (user.inventory || []).filter(item => item.isEquipped);
    }, [user.inventory]);

    const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0;
    
    const allBossResearch = useMemo(() => {
        if (!guild) return [];
        return Object.entries(GUILD_RESEARCH_PROJECTS)
            .filter(([, project]) => project.category === 'boss')
            .map(([id, project]) => {
                const currentLevel = guild.research?.[id as GuildResearchId]?.level || 0;
                return { ...project, id: id as GuildResearchId, currentLevel };
            });
    }, [guild]);

    const presets = useMemo(() => {
        const userPresets = user.equipmentPresets || [];
        return Array(5).fill(null).map((_, i) => 
            userPresets[i] || { name: `프리셋 ${i + 1}`, equipment: {} }
        );
    }, [user.equipmentPresets]);

    const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const presetIndex = Number(event.target.value);
        setSelectedPreset(presetIndex);
        const selectedPresetData = presets[presetIndex];
        handlers.applyPreset(selectedPresetData || { name: `프리셋 ${presetIndex + 1}`, equipment: {} });
    };

    return (
        <div className={`bg-panel border border-color rounded-lg flex flex-col flex-1 min-h-0 ${compact ? 'p-2 gap-0.5' : 'p-3'}`}>
            <style>{`
                @keyframes float-up-and-fade {
                    from { transform: translateY(0) scale(1); opacity: 1; }
                    to { transform: translateY(-50px) scale(1.5); opacity: 0; }
                }
                .damage-number-animation {
                    animation: float-up-and-fade 1.5s ease-out forwards;
                }
            `}</style>
            
            <div className={`flex items-center flex-shrink-0 ${compact ? 'gap-2 mb-1' : 'gap-3 mb-2'}`}>
                <Avatar userId={user.id} userName={user.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={compact ? 36 : 48} />
                <UserNicknameText
                    user={{
                        nickname: user.nickname,
                        isAdmin: user.isAdmin,
                        staffNicknameDisplayEligibility: user.staffNicknameDisplayEligibility,
                    }}
                    as="h3"
                    className={`font-bold truncate ${compact ? 'text-sm' : 'text-lg'}`}
                />
            </div>
            
            <div className={`relative flex-shrink-0 ${compact ? 'mb-1.5' : 'mb-3'}`}>
                <div className={`w-full bg-tertiary rounded-full border-2 border-color relative ${compact ? 'h-3' : 'h-4'}`}>
                    <div className="bg-gradient-to-r from-green-400 to-green-600 h-full rounded-full" style={{ width: `${hpPercent}%`, transition: 'width 0.5s linear' }}></div>
                     <span className={`absolute inset-0 font-bold text-white flex items-center justify-center ${compact ? 'text-[10px]' : 'text-xs'}`} style={{textShadow: '1px 1px 2px black'}}>
                        HP: {Math.ceil(hp).toLocaleString()} / {maxHp.toLocaleString()}
                    </span>
                </div>
                <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full overflow-hidden pointer-events-none ${compact ? 'h-16' : 'h-24'}`}>
                    {damageNumbers.map(dn => (
                        <div key={dn.id} className={`absolute bottom-0 left-1/2 -translate-x-1/2 font-bold damage-number-animation ${dn.color} ${compact ? 'text-sm' : 'text-lg'}`} style={{ textShadow: '1px 1px 3px black' }}>
                            {dn.text}
                        </div>
                    ))}
                </div>
            </div>
            
            <div className={`min-w-0 flex-shrink-0 ${compact ? 'mb-1' : 'mb-2'}`}>
                <HomeNativeMergedEquipmentAbilityPanel
                    equippedItems={equippedItems}
                    presets={presets}
                    selectedPreset={selectedPreset}
                    onPresetChange={handlePresetChange}
                    onOpenEquipmentEffects={handlers.openEquipmentEffectsModal}
                    onOpenStatAllocation={handlers.openStatAllocationModal}
                    onViewEquippedItem={(item) => handlers.openViewingItem(item, true)}
                    finalByStat={coreStatComputeBundle.finalByStat}
                    baseByStat={coreStatComputeBundle.baseByStat}
                    badukAbilityTotal={coreStatComputeBundle.badukAbilityTotal}
                    availablePoints={availablePoints}
                    framed={false}
                    compactLayout={compact}
                    guildBossPanel
                    presetSelectDisabled={isSimulating}
                />
            </div>

            <div className={`border-t border-color flex-1 min-h-0 flex flex-col ${compact ? 'mt-1 pt-1' : 'mt-2 pt-2'}`}>
                <h4 className={`font-semibold text-center text-secondary flex-shrink-0 ${compact ? 'text-xs mb-1' : 'text-sm mb-1'}`}>연구소 스킬 효과</h4>
                 <div className={`flex-1 min-h-0 overflow-y-auto pr-1 ${compact ? 'space-y-1.5 text-xs' : 'space-y-1 text-xs'}`}>
                    {allBossResearch.map(project => {
                        const currentLevel = guild?.research?.[project.id]?.level || 0;
                        const displayInfo = getResearchSkillDisplay(project.id, currentLevel);
                        const simpleNameMap: Partial<Record<GuildResearchId, string>> = {
                            'boss_hp_increase': 'HP증가',
                            'boss_skill_heal_block': '회복불가',
                            'boss_skill_regen': '회복',
                            'boss_skill_ignite': '점화',
                        };
                        const displayName = simpleNameMap[project.id] || project.name;
                        
                        return (
                            <div key={project.id} className={`flex items-center bg-tertiary/50 rounded-md ${!displayInfo ? 'opacity-60' : ''} ${compact ? 'gap-1.5 p-1.5' : 'gap-2 p-1'}`} title={project.description}>
                                <div className={`flex items-center flex-shrink-0 ${compact ? 'gap-1.5 min-w-0 w-[6.25rem]' : 'gap-2 w-28'}`}>
                                    <img src={project.image} alt={displayName} className={compact ? 'h-10 w-10 shrink-0' : 'w-12 h-12'}/>
                                    <span className={`font-semibold text-primary leading-tight ${compact ? 'text-xs' : 'text-sm'}`}>{displayName}</span>
                                </div>
                                <div className="min-w-0 flex-1 text-right">
                                    {displayInfo ? (
                                        <p className={`font-mono font-bold text-yellow-400 leading-snug ${compact ? 'text-sm' : 'text-sm sm:text-base'}`}>
                                            {displayInfo.chance !== undefined ? `[${displayInfo.chance}%] ` : ''}{displayInfo.description}
                                        </p>
                                    ) : (
                                        <p className={`text-tertiary ${compact ? 'text-xs' : 'text-[10px]'}`}>비활성</p>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

interface BossPanelProps {
    boss: GuildBossInfo;
    hp: number;
    maxHp: number;
    /** 길드 보스 난이도 단계(1~10), 체력 게이지 아래에 이름과 함께 표시 */
    difficultyStage: number;
    damageNumbers: { id: number; text: string; color: string; isHeal: boolean; isCrit?: boolean }[];
    compact?: boolean;
    /** PC 좌측: 이미지 실제 가로폭에 열 맞춤 */
    fitContentWidth?: boolean;
    /** PC 좌측: 랭킹 위 남는 세로 공간을 채우도록 이미지 확대 */
    fillAvailableHeight?: boolean;
}

const BossSkillTile: React.FC<{ skill: GuildBossInfo['skills'][number]; className?: string }> = ({ skill, className = '' }) => {
    const [touchTipOpen, setTouchTipOpen] = useState(false);
    const [coarsePointer, setCoarsePointer] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(hover: none)');
        const apply = () => setCoarsePointer(mq.matches);
        apply();
        mq.addEventListener('change', apply);
        return () => mq.removeEventListener('change', apply);
    }, []);

    useEffect(() => {
        if (!coarsePointer || !touchTipOpen) return;
        const close = (ev: Event) => {
            const t = ev.target as Node;
            if (btnRef.current?.contains(t)) return;
            setTouchTipOpen(false);
        };
        const id = window.setTimeout(() => {
            document.addEventListener('touchstart', close, true);
            document.addEventListener('click', close, true);
        }, 0);
        return () => {
            window.clearTimeout(id);
            document.removeEventListener('touchstart', close, true);
            document.removeEventListener('click', close, true);
        };
    }, [coarsePointer, touchTipOpen]);

    const tipOpen = coarsePointer ? touchTipOpen : false;

    return (
        <button
            ref={btnRef}
            type="button"
            className={`group/skill relative shrink-0 rounded-xl border-none bg-transparent p-0 outline-none transition hover:opacity-95 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${className}`}
            aria-label={skill.name}
            aria-expanded={coarsePointer ? touchTipOpen : undefined}
            onClick={(e) => {
                if (!coarsePointer) return;
                e.stopPropagation();
                setTouchTipOpen((v) => !v);
            }}
        >
            <div className="flex aspect-square h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-black/40">
                <img src={skill.image || ''} alt="" className="h-full w-full object-contain p-0.5 sm:p-1" />
            </div>
            <div
                className={`pointer-events-none absolute bottom-full left-1/2 z-[70] mb-2 w-56 max-w-[min(18rem,85vw)] -translate-x-1/2 rounded-2xl border border-amber-500/40 bg-gray-950/95 px-3 py-2.5 text-left shadow-xl backdrop-blur-sm transition-opacity duration-150 ${
                    tipOpen ? 'opacity-100' : 'opacity-0'
                } ${coarsePointer ? '' : 'group-hover/skill:opacity-100 group-focus-visible/skill:opacity-100'}`}
                role="tooltip"
            >
                <div
                    className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-amber-500/40 bg-gray-950/95"
                    aria-hidden
                />
                <p className="relative font-bold text-amber-200">{skill.name}</p>
                <p className="relative mt-1 text-xs leading-snug text-white" style={{ textShadow: '1px 1px 2px black' }}>
                    {skill.description}
                </p>
            </div>
        </button>
    );
};

const BossRecommendedStatsTip: React.FC<{ stats: CoreStat[]; compact?: boolean }> = ({ stats, compact = false }) => (
    <button
        type="button"
        className={
            compact
                ? 'group/tip relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-amber-400/35 bg-black/60 text-lg shadow-md outline-none transition hover:border-amber-300/50 hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-amber-400/70 active:scale-95'
                : 'group/tip relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-amber-400/35 bg-black/60 text-2xl shadow-md outline-none transition hover:border-amber-300/50 hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-amber-400/70 active:scale-95 sm:h-12 sm:w-12 sm:text-3xl'
        }
        aria-label={`보스 공략 추천 능력치: ${stats.join(', ')}`}
    >
        <span className="select-none leading-none" aria-hidden>
            💡
        </span>
        <div
            className="pointer-events-none absolute bottom-[calc(100%+0.6rem)] left-1/2 z-[60] w-max max-w-[min(18rem,calc(100vw-3rem))] -translate-x-1/2 rounded-2xl border border-amber-500/40 bg-gray-950/95 px-3 py-2.5 text-left opacity-0 shadow-xl backdrop-blur-sm transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100 group-active/tip:opacity-100"
            role="tooltip"
        >
            <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-amber-300/90">추천 능력치</p>
            <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-xs font-semibold text-white" style={{ textShadow: '1px 1px 2px black' }}>
                {stats.map((stat) => (
                    <span key={stat} className="whitespace-nowrap">
                        {stat}
                    </span>
                ))}
            </div>
            <div
                className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b border-r border-amber-500/40 bg-gray-950/95"
                aria-hidden
            />
        </div>
    </button>
);

const BossPanel: React.FC<BossPanelProps> = ({
    boss,
    hp,
    maxHp,
    difficultyStage,
    damageNumbers,
    compact = false,
    fitContentWidth = false,
    fillAvailableHeight = false,
}) => {
    const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0;
    const desktopFitFill = fitContentWidth && fillAvailableHeight && !compact;

    return (
        <div
            className={`flex flex-col ${
                compact
                    ? 'h-full min-h-0 gap-1'
                    : desktopFitFill
                      ? 'h-full min-h-0 w-full gap-2'
                      : fitContentWidth
                        ? 'w-fit max-w-full shrink-0 gap-2'
                        : 'h-full gap-2'
            }`}
        >
            <div
                className={`relative group ${
                    compact
                        ? 'flex min-h-0 flex-1 flex-col items-center justify-center'
                        : desktopFitFill
                          ? 'mx-auto h-full w-fit max-w-full'
                          : fitContentWidth
                            ? 'w-fit max-w-full shrink-0'
                            : 'flex min-h-0 flex-1 flex-col items-center justify-center'
                }`}
            >
                <img
                    src={boss.image}
                    alt={boss.name}
                    className={`rounded-lg object-contain ${
                        compact
                            ? 'mx-auto h-full w-auto max-w-full min-h-0'
                            : desktopFitFill
                              ? 'block h-full w-auto max-w-full'
                              : fitContentWidth
                                ? 'block h-auto w-auto max-h-[min(58vh,520px)]'
                                : 'mx-auto h-full w-full max-h-[min(88vh,820px)] min-h-[min(58vh,480px)]'
                    }`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/50 rounded-lg pointer-events-none"></div>
                
                <div className={`absolute left-2 right-2 flex flex-col items-stretch gap-1 ${compact ? 'top-1' : 'top-2'}`}>
                     <div className={`w-full bg-tertiary rounded-full border-2 border-black/50 relative ${compact ? 'h-4' : 'h-5'}`}>
                        <div className="bg-gradient-to-r from-red-500 to-red-700 h-full rounded-full" style={{ width: `${hpPercent}%`, transition: 'width 0.5s linear' }}></div>
                         <span className={`absolute inset-0 font-bold text-white flex items-center justify-center ${compact ? 'text-[10px]' : 'text-sm'}`} style={{textShadow: '1px 1px 2px black'}}>
                            {Math.ceil(hp).toLocaleString()} / {maxHp.toLocaleString()} ({hpPercent.toFixed(1)}%)
                        </span>
                        <div className={`absolute top-full left-0 right-0 pointer-events-none ${compact ? 'h-16' : 'h-24'}`}>
                            {damageNumbers.map(dn => (
                                <div 
                                    key={dn.id} 
                                    className={`absolute top-0 left-1/2 -translate-x-1/2 font-bold ${dn.isCrit ? 'text-3xl' : 'text-xl'} ${dn.color} ${dn.isHeal ? 'animate-float-up-and-fade-1s' : 'animate-float-down-and-fade-1s'}`}
                                    style={{ textShadow: dn.isCrit ? '0 0 5px yellow, 0 0 8px orange' : '1px 1px 3px black' }}
                                >
                                    {dn.text}
                                </div>
                            ))}
                        </div>
                    </div>
                    <p
                        className={`pointer-events-none text-center font-bold tabular-nums text-white/95 ${compact ? 'text-[10px] leading-tight' : 'text-xs sm:text-sm'}`}
                        style={{ textShadow: '1px 1px 2px black' }}
                    >
                        {boss.name} · {difficultyStage}단계
                    </p>
                </div>
                
                <div className={`absolute bottom-0 left-0 right-0 flex items-center justify-center ${compact ? 'gap-1.5 p-1' : 'gap-3 p-2 sm:gap-4'}`}>
                    <div
                        className={`flex max-w-full shrink-0 flex-row flex-nowrap items-center justify-center overflow-visible rounded-xl border border-white/20 bg-black/45 shadow-lg ${compact ? 'gap-0.5 p-1' : 'gap-1.5 p-1.5 sm:gap-2 sm:p-2'}`}
                        aria-label="보스 스킬"
                    >
                        {boss.skills.map((skill) => (
                            <BossSkillTile
                                key={skill.id}
                                skill={skill}
                                className={
                                    compact
                                        ? 'h-9 w-9 shrink-0'
                                        : 'h-14 w-14 shrink-0 sm:h-16 sm:w-16 md:h-[4.5rem] md:w-[4.5rem]'
                                }
                            />
                        ))}
                    </div>
                    <div className={`w-px shrink-0 bg-gray-500/50 ${compact ? 'h-8' : 'h-10 sm:h-12'}`}></div>
                    <BossRecommendedStatsTip stats={boss.recommendedStats} compact={compact} />
                </div>
            </div>
        </div>
    );
};


interface DamageRankingPanelProps {
    fullDamageRanking: { userId: string; nickname: string; damage: number }[];
    myRankData: { userId: string; nickname: string; damage: number; rank: number } | null;
    myCurrentBattleDamage: number;
    compact?: boolean;
    /** PC 좌측: Top3 행만 딱 맞는 높이 */
    desktopTightTop3?: boolean;
}


const getDamageRankingGridClass = (compact: boolean) =>
    compact
        ? 'grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-1.5'
        : 'grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-2';

const DAMAGE_RANKING_NICK_COL_CLASS =
    'min-w-0 truncate border-r border-color/40 pr-2 text-left font-semibold leading-tight';
const DAMAGE_RANKING_DMG_COL_CLASS =
    'shrink-0 pl-1.5 text-right font-mono tabular-nums text-highlight leading-tight';
const DAMAGE_RANKING_RANK_COL_CLASS = 'flex items-center justify-center';

const DamageRankingPanel: React.FC<DamageRankingPanelProps> = ({
    fullDamageRanking,
    myRankData,
    myCurrentBattleDamage,
    compact = false,
    desktopTightTop3 = false,
}) => {
    const { handlers, allUsers } = useAppContext();
    const top3 = fullDamageRanking.slice(0, 3);
    const amIInTop3 = myRankData ? myRankData.rank <= 3 : false;
    const myRankUser = myRankData ? allUsers?.find((u) => u.id === myRankData.userId) : undefined;

    const top3RowClass = compact
        ? 'h-[2.15rem] px-1 text-sm'
        : desktopTightTop3
          ? 'h-[2.4rem] px-1.5 text-[15px] leading-tight'
          : 'p-1.5 text-base';
    const rankingGridClass = getDamageRankingGridClass(compact);

    return (
        <div
            className={`bg-panel border border-color flex min-h-0 flex-col rounded-lg ${
                compact ? 'h-full p-2' : desktopTightTop3 ? 'shrink-0 p-2.5' : 'h-full p-3'
            }`}
        >
            <h4
                className={`flex-shrink-0 text-center font-bold text-yellow-300 ${
                    compact ? 'mb-1 text-base' : desktopTightTop3 ? 'mb-1.5 text-base' : 'mb-2 text-lg'
                }`}
            >
                {compact ? '누적 피해 Top 3' : '누적 피해 랭킹 Top 3'}
            </h4>

            <div
                className={
                    desktopTightTop3
                        ? 'flex shrink-0 flex-col justify-center gap-1'
                        : 'min-h-0 flex-grow overflow-y-auto pr-1'
                }
            >
                {top3.length > 0 ? (
                    <ul className={desktopTightTop3 ? 'flex flex-col gap-1' : 'space-y-1'}>
                        {top3.map((rank, index) => {
                            const ru = allUsers?.find((u) => u.id === rank.userId);
                            const place = (index + 1) as 1 | 2 | 3;
                            return (
                            <li
                                key={rank.userId}
                                onClick={() => handlers.openViewingUser(rank.userId)}
                                className={`${rankingGridClass} cursor-pointer rounded-md bg-tertiary/50 hover:bg-secondary ${top3RowClass}`}
                            >
                                <div className={DAMAGE_RANKING_RANK_COL_CLASS}>
                                    <GuildBossTopRankBadge place={place} compact={compact} />
                                </div>
                                <UserNicknameText
                                    user={{
                                        nickname: rank.nickname,
                                        isAdmin: ru?.isAdmin,
                                        staffNicknameDisplayEligibility: ru?.staffNicknameDisplayEligibility,
                                    }}
                                    className={DAMAGE_RANKING_NICK_COL_CLASS}
                                />
                                <span className={DAMAGE_RANKING_DMG_COL_CLASS}>
                                    {rank.damage.toLocaleString()}
                                </span>
                            </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div
                        className={`flex items-center justify-center text-tertiary ${
                            desktopTightTop3 ? 'h-[7.6rem] text-sm' : compact ? 'h-full text-sm' : 'h-full text-base'
                        }`}
                    >
                        기록 없음
                    </div>
                )}
            </div>
            {myRankData && !amIInTop3 && (
                <div className={`border-t border-color/50 flex-shrink-0 ${compact ? 'mt-1 pt-1' : 'mt-2 pt-2'}`}>
                    <div className={`${rankingGridClass} rounded-md bg-blue-900/40 ${compact ? 'p-1.5 text-xs' : 'p-1.5 text-xs'}`}>
                        <span
                            className={`${DAMAGE_RANKING_RANK_COL_CLASS} font-bold tabular-nums ${
                                compact ? 'h-6 w-6 text-[11px]' : 'h-8 w-8 text-sm'
                            }`}
                        >
                            {myRankData.rank}
                        </span>
                        <span className={`${DAMAGE_RANKING_NICK_COL_CLASS} inline-flex min-w-0 items-center gap-1`}>
                            <UserNicknameText
                                user={{
                                    nickname: myRankData.nickname,
                                    isAdmin: myRankUser?.isAdmin,
                                    staffNicknameDisplayEligibility: myRankUser?.staffNicknameDisplayEligibility,
                                }}
                                className="min-w-0 truncate"
                            />
                            <span className="shrink-0">(나)</span>
                        </span>
                        <span className={DAMAGE_RANKING_DMG_COL_CLASS}>
                            {myRankData.damage.toLocaleString()}
                        </span>
                    </div>
                </div>
            )}
            <div className={`flex-shrink-0 border-t border-color/50 ${compact ? 'mt-1 pt-1' : 'mt-2 pt-2'}`}>
                <p className={`${rankingGridClass} ${compact ? 'text-xs' : 'text-sm'}`}>
                    <span aria-hidden />
                    <span className={`${DAMAGE_RANKING_NICK_COL_CLASS} text-secondary`}>
                        {compact ? '이번 전투:' : '이번 전투 피해량:'}
                    </span>
                    <span className={`${DAMAGE_RANKING_DMG_COL_CLASS} font-bold text-yellow-300`}>
                        {myCurrentBattleDamage.toLocaleString()}
                    </span>
                </p>
            </div>
        </div>
    );
};

interface GuildBossDesktopLeftRailProps {
    boss: GuildBossInfo;
    hp: number;
    maxHp: number;
    difficultyStage: number;
    bossDamageNumbers: BossPanelProps['damageNumbers'];
    fullDamageRanking: DamageRankingPanelProps['fullDamageRanking'];
    myRankData: DamageRankingPanelProps['myRankData'];
    myCurrentBattleDamage: number;
}

const GuildBossDesktopLeftRail: React.FC<GuildBossDesktopLeftRailProps> = ({
    boss,
    hp,
    maxHp,
    difficultyStage,
    bossDamageNumbers,
    fullDamageRanking,
    myRankData,
    myCurrentBattleDamage,
}) => (
    <div className={GUILD_BOSS_DESKTOP_LEFT_RAIL_CLASS}>
        <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
            <BossPanel
                boss={boss}
                hp={hp}
                maxHp={maxHp}
                difficultyStage={difficultyStage}
                damageNumbers={bossDamageNumbers}
                fitContentWidth
                fillAvailableHeight
            />
        </div>
        <div className="min-w-0 w-full shrink-0">
            <DamageRankingPanel
                fullDamageRanking={fullDamageRanking}
                myRankData={myRankData}
                myCurrentBattleDamage={myCurrentBattleDamage}
                desktopTightTop3
            />
        </div>
    </div>
);

const GuildBoss: React.FC = () => {
    const { currentUserWithStatus, guilds, handlers } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();

    const [isSimulating, setIsSimulating] = useState(false);
    const simulationInFlight = useRef(false);
    const handleActionRef = useRef(handlers.handleAction);
    handleActionRef.current = handlers.handleAction;
    const currentUserRef = useRef(currentUserWithStatus);
    currentUserRef.current = currentUserWithStatus;
    const myGuildRef = useRef<GuildType | null>(null);
    const currentBattleDamageRef = useRef(0);
    const userHpRef = useRef(0);
    const simulatedBossHpRef = useRef(0);
    const battleRecoveryAttemptedRef = useRef(false);
    const battleStartedAtRef = useRef<number | null>(null);
    const confirmedBattleResultRef = useRef<GuildBossBattleModalResult | null>(null);
    const finishBattlePlaybackRef = useRef<(modalResult: GuildBossBattleModalResult) => void>(() => {});
    const battleSubmitContextRef = useRef<GuildBossBattleSubmitContext | null>(null);
    const [simulationResult, setSimulationResult] = useState<GuildBossBattleResult | null>(null);
    const [logIndex, setLogIndex] = useState(0);
    const [battleLog, setBattleLog] = useState<BattleLogEntry[]>([]);
    const [userHp, setUserHp] = useState(0);
    const [maxUserHp, setMaxUserHp] = useState(0);
    const [damageNumbers, setDamageNumbers] = useState<{ id: number; text: string; color: string }[]>([]);
    const [bossDamageNumbers, setBossDamageNumbers] = useState<{ id: number; text: string; color: string; isHeal: boolean; isCrit?: boolean }[]>([]);
    const [currentBattleDamage, setCurrentBattleDamage] = useState(0);
    const [activeDebuffs, setActiveDebuffs] = useState<Record<string, { value: number; turns: number }>>({});
    const [showResultModal, setShowResultModal] = useState(false);
    const [battleResult, setBattleResult] = useState<GuildBossBattleResult & { bossName: string; previousRank?: number; currentRank?: number } | null>(null);
    const [previousRank, setPreviousRank] = useState<number | null>(null);

    
    const userLogContainerRef = useRef<HTMLDivElement>(null);
    const bossLogContainerRef = useRef<HTMLDivElement>(null);

    const myGuild = useMemo(() => {
        if (!currentUserWithStatus?.guildId || !guilds) return null;
        return (guilds as Record<string, GuildType>)[currentUserWithStatus.guildId];
    }, [currentUserWithStatus?.guildId, guilds]);
    myGuildRef.current = myGuild;

    const currentBoss = useMemo(() => {
        if (!myGuild?.guildBossState) return GUILD_BOSSES[0];
        return GUILD_BOSSES.find(b => b.id === myGuild.guildBossState!.currentBossId) || GUILD_BOSSES[0];
    }, [myGuild]);

    const bossDifficultyStage = useMemo(
        () => getCurrentGuildBossStage(myGuild?.guildBossState, currentBoss.id),
        [myGuild?.guildBossState, currentBoss.id]
    );
    const scaledBoss = useMemo(
        () => scaleGuildBossForStage(currentBoss, bossDifficultyStage),
        [currentBoss, bossDifficultyStage]
    );
    
    const bossIndex = useMemo(() => (currentBoss?.id || 'boss_1').split('_')[1], [currentBoss]);
    const backgroundStyle = useMemo(() => ({
        backgroundImage: `url(/images/guild/boss/boss${bossIndex}bg.webp)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: 'rgb(var(--bg-tertiary))', // Fallback color
    }), [bossIndex]);
    
    const { guildBossState } = myGuild || {};
    const currentHp = guildBossState?.currentBossHp ?? scaledBoss.maxHp;
    const [simulatedBossHp, setSimulatedBossHp] = useState(currentHp);
    userHpRef.current = userHp;
    simulatedBossHpRef.current = simulatedBossHp;

    const userLogs = useMemo(() => battleLog.filter(e => e.isUserAction), [battleLog]);
    const bossLogs = useMemo(() => battleLog.filter(e => !e.isUserAction), [battleLog]);

    // 입장 시(공격 전) 표시할 유저 최대 체력 — 시뮬레이터와 동일한 식
    const initialMaxUserHp = useMemo(() => {
        if (!currentUserWithStatus || !myGuild) return 0;
        const totalStats = calculateTotalStats(currentUserWithStatus, myGuild, 'guildBoss');
        let hp = 20000 + (totalStats[CoreStat.Concentration] * 10);
        const hpIncreaseLevel = myGuild.research?.boss_hp_increase?.level || 0;
        if (hpIncreaseLevel > 0) {
            const project = GUILD_RESEARCH_PROJECTS[GuildResearchId.boss_hp_increase];
            if (project) hp *= (1 + (project.baseEffect * hpIncreaseLevel) / 100);
        }
        return Math.round(hp);
    }, [currentUserWithStatus, myGuild]);

    // 공격 전에도 유저 체력 표시: 입장 시 초기 HP 설정
    useEffect(() => {
        if (isSimulating || !currentUserWithStatus || !myGuild || initialMaxUserHp <= 0) return;
        if (maxUserHp === 0 && userHp === 0) {
            setMaxUserHp(initialMaxUserHp);
            setUserHp(initialMaxUserHp);
        }
    }, [initialMaxUserHp, isSimulating, currentUserWithStatus, myGuild, maxUserHp, userHp]);

    // 데스크톱 스크롤 자동 이동
    useEffect(() => { 
        if (userLogContainerRef.current) {
            userLogContainerRef.current.scrollTop = userLogContainerRef.current.scrollHeight;
        }
    }, [userLogs]);
    useEffect(() => { 
        if (bossLogContainerRef.current) {
            bossLogContainerRef.current.scrollTop = bossLogContainerRef.current.scrollHeight;
        }
    }, [bossLogs]);
    
    useEffect(() => { if (!isSimulating) setSimulatedBossHp(currentHp); }, [currentHp, isSimulating]);

    // 보스 데미지 숫자가 1초 후 자동으로 제거되도록
    useEffect(() => {
        if (bossDamageNumbers.length === 0) return;
        
        const timers = bossDamageNumbers.map(dn => {
            return setTimeout(() => {
                setBossDamageNumbers(prev => prev.filter(item => item.id !== dn.id));
            }, 1000);
        });

        return () => {
            timers.forEach(timer => clearTimeout(timer));
        };
    }, [bossDamageNumbers]);

    const persistPendingBattle = useCallback((
        result: GuildBossBattleResult,
        snapshot: {
            logIndex: number;
            battleLog: BattleLogEntry[];
            userHp: number;
            currentBattleDamage: number;
            simulatedBossHp: number;
            confirmedBattleResult?: GuildBossBattleModalResult;
        },
    ) => {
        const submitContext = battleSubmitContextRef.current;
        const userSnapshot = currentUserRef.current;
        if (!submitContext || !userSnapshot?.id) return;
        savePendingGuildBossBattle({
            userId: userSnapshot.id,
            guildId: submitContext.guildId,
            submitContext,
            simulationResult: result,
            logIndex: snapshot.logIndex,
            battleLog: snapshot.battleLog,
            userHp: snapshot.userHp,
            currentBattleDamage: snapshot.currentBattleDamage,
            simulatedBossHp: snapshot.simulatedBossHp,
            startedAt: battleStartedAtRef.current ?? Date.now(),
            confirmedBattleResult: snapshot.confirmedBattleResult ?? confirmedBattleResultRef.current ?? undefined,
        });
    }, []);

    const finishBattlePlayback = useCallback((modalResult: GuildBossBattleModalResult) => {
        setBattleResult(modalResult);
        setShowResultModal(true);
        clearPendingGuildBossBattle();
        battleSubmitContextRef.current = null;
        battleStartedAtRef.current = null;
        confirmedBattleResultRef.current = null;
        setIsSimulating(false);
        setSimulationResult(null);
        setActiveDebuffs({});
        simulationInFlight.current = false;
    }, []);
    finishBattlePlaybackRef.current = finishBattlePlayback;

    const handleBattleStart = useCallback(async () => {
        if (!currentUserWithStatus || !myGuild || simulationInFlight.current) return;
        
        const todayKST = getTodayKSTDateString();
        const usedToday = currentUserWithStatus.guildBossLastAttemptDayKST === todayKST ? (currentUserWithStatus.guildBossAttemptsUsedToday ?? 0) : 0;
        const attemptsLeft = GUILD_BOSS_MAX_ATTEMPTS - usedToday;
        if (attemptsLeft <= 0) return;

        simulationInFlight.current = true;
        battleStartedAtRef.current = Date.now();
        setIsSimulating(true);
        setBattleLog([]);
        setLogIndex(0);
        setDamageNumbers([]);
        setBossDamageNumbers([]);
        setCurrentBattleDamage(0);
        currentBattleDamageRef.current = 0;
        setActiveDebuffs({});
        const preGuildHp = myGuild.guildBossState?.currentBossHp;
        const battleStartHp =
            preGuildHp != null && preGuildHp > 0 ? preGuildHp : scaledBoss.maxHp;
        setSimulatedBossHp(battleStartHp);
        simulatedBossHpRef.current = battleStartHp;

        const rankUserId = currentUserWithStatus.isAdmin ? ADMIN_USER_ID : currentUserWithStatus.id;
        const guildId = myGuild.id;
        battleSubmitContextRef.current = {
            rankUserId,
            preBattleGuildHp: preGuildHp,
            bossId: currentBoss.id,
            bossName: currentBoss.name,
            guildId,
        };

        const totalDamageLog = myGuild.guildBossState?.totalDamageLog || {};
        const rankingBefore = Object.entries(totalDamageLog)
            .map(([userId, damage]: [string, any]) => ({ userId, damage: typeof damage === 'number' ? damage : 0 }))
            .sort((a, b) => b.damage - a.damage);
        const prevRank = rankUserId ? rankingBefore.findIndex((r) => r.userId === rankUserId) + 1 : 0;
        setPreviousRank(prevRank > 0 ? prevRank : null);

        try {
            const actionResult = await handleActionRef.current({
                type: 'START_GUILD_BOSS_BATTLE',
                payload: { bossId: currentBoss.id, bossName: currentBoss.name },
            });

            const errorMessage = (actionResult as { error?: string } | void)?.error;
            if (errorMessage) {
                throw new Error(errorMessage);
            }

            const serverResult =
                (actionResult as any)?.guildBossBattleResult
                ?? (actionResult as any)?.clientResponse?.guildBossBattleResult;
            if (!serverResult?.battleLog?.length) {
                throw new Error('서버 전투 기보를 받지 못했습니다.');
            }

            const guildsPayload = (actionResult as any)?.clientResponse?.guilds ?? (actionResult as any)?.guilds;
            const updatedGuild =
                (guildsPayload && guildId ? guildsPayload[guildId] : null) || myGuild;
            const rankingAfter = Object.entries(updatedGuild?.guildBossState?.totalDamageLog || {})
                .map(([userId, damage]: [string, any]) => ({ userId, damage: typeof damage === 'number' ? damage : 0 }))
                .sort((a, b) => b.damage - a.damage);
            const newRank = rankUserId ? rankingAfter.findIndex((r) => r.userId === rankUserId) + 1 : 0;

            const modalResult: GuildBossBattleModalResult = {
                ...serverResult,
                bossName: currentBoss.name,
                previousRank: prevRank > 0 ? prevRank : null,
                currentRank: newRank > 0 ? newRank : null,
            };
            confirmedBattleResultRef.current = modalResult;

            const replayBossStartHp =
                typeof serverResult.bossHpBefore === 'number' ? serverResult.bossHpBefore : battleStartHp;
            setUserHp(serverResult.maxUserHp);
            userHpRef.current = serverResult.maxUserHp;
            setMaxUserHp(serverResult.maxUserHp);
            setSimulatedBossHp(replayBossStartHp);
            simulatedBossHpRef.current = replayBossStartHp;
            setSimulationResult(serverResult);
            persistPendingBattle(serverResult, {
                logIndex: 0,
                battleLog: [],
                userHp: serverResult.maxUserHp,
                currentBattleDamage: 0,
                simulatedBossHp: replayBossStartHp,
                confirmedBattleResult: modalResult,
            });
        } catch (err) {
            console.error('[GuildBoss] Failed to start battle:', err);
            battleSubmitContextRef.current = null;
            battleStartedAtRef.current = null;
            confirmedBattleResultRef.current = null;
            setIsSimulating(false);
            simulationInFlight.current = false;
        }
    }, [currentUserWithStatus, myGuild, scaledBoss, currentBoss, persistPendingBattle]);

    useEffect(() => {
        if (battleRecoveryAttemptedRef.current || !currentUserWithStatus?.id || !myGuild?.id) return;
        battleRecoveryAttemptedRef.current = true;

        const pending = loadPendingGuildBossBattle(currentUserWithStatus.id, myGuild.id, currentBoss.id);
        if (!pending) return;
        if (!pending.confirmedBattleResult) {
            clearPendingGuildBossBattle();
            return;
        }

        simulationInFlight.current = true;
        battleStartedAtRef.current = pending.startedAt;
        battleSubmitContextRef.current = pending.submitContext;
        confirmedBattleResultRef.current = pending.confirmedBattleResult ?? null;
        currentBattleDamageRef.current = pending.currentBattleDamage;
        userHpRef.current = pending.userHp;
        simulatedBossHpRef.current = pending.simulatedBossHp;
        setSimulationResult(pending.simulationResult);
        setLogIndex(pending.logIndex);
        setBattleLog(pending.battleLog);
        setUserHp(pending.userHp);
        setMaxUserHp(pending.simulationResult.maxUserHp);
        setCurrentBattleDamage(pending.currentBattleDamage);
        setSimulatedBossHp(pending.simulatedBossHp);
        setIsSimulating(true);

        const playbackFinished = pending.logIndex >= pending.simulationResult.battleLog.length;
        if (playbackFinished && pending.confirmedBattleResult) {
            finishBattlePlaybackRef.current(pending.confirmedBattleResult);
        }
    }, [currentUserWithStatus?.id, myGuild?.id, currentBoss.id]);

    useEffect(() => {
        if (!isSimulating || !simulationResult) return;

        if (logIndex >= simulationResult.battleLog.length) {
            const timer = setTimeout(() => {
                const modalResult = confirmedBattleResultRef.current;
                if (modalResult) {
                    finishBattlePlaybackRef.current(modalResult);
                } else {
                    finishBattlePlaybackRef.current({
                        ...simulationResult,
                        bossName: battleSubmitContextRef.current?.bossName ?? '',
                    });
                }
            }, GUILD_BOSS_LOG_PLAYBACK_MS);
            return () => clearTimeout(timer);
        }

        const processNextLogEntry = () => {
            const newEntry = simulationResult.battleLog[logIndex];
            let nextUserHp = userHpRef.current;
            let nextBossHp = simulatedBossHpRef.current;
            let nextBattleDamage = currentBattleDamageRef.current;
            
            // At the start of a new turn, update debuffs
            if (logIndex > 0 && simulationResult.battleLog[logIndex-1].turn !== newEntry.turn) {
                 setActiveDebuffs(prev => {
                    const nextDebuffs: Record<string, { value: number; turns: number }> = {};
                    for (const key in prev) {
                        if (prev[key].turns > 1) {
                            nextDebuffs[key] = { ...prev[key], turns: prev[key].turns - 1 };
                        }
                    }
                    return nextDebuffs;
                });
            }
            
            setBattleLog(prev => [...prev, newEntry]);

            if (newEntry.damageTaken !== undefined) {
                nextUserHp = Math.max(0, nextUserHp - (newEntry.damageTaken || 0));
                setUserHp(nextUserHp);
                setDamageNumbers(prev => [...prev.slice(-5), { id: Date.now() + Math.random(), text: `-${newEntry.damageTaken}`, color: 'text-red-400' }]);
            }
            if (newEntry.healingDone !== undefined) {
                nextUserHp = Math.min(maxUserHp, nextUserHp + (newEntry.healingDone || 0));
                setUserHp(nextUserHp);
                setDamageNumbers(prev => [...prev.slice(-5), { id: Date.now() + Math.random(), text: `+${newEntry.healingDone}`, color: 'text-green-400' }]);
            }
            
            if (newEntry.debuffsApplied && Array.isArray(newEntry.debuffsApplied)) {
                setActiveDebuffs(prev => {
                    const newDebuffs = { ...prev };
                    for (const debuff of newEntry.debuffsApplied as any[]) {
                        if (debuff && debuff.type && debuff.value && debuff.turns) {
                            newDebuffs[debuff.type] = { value: debuff.value, turns: debuff.turns };
                        }
                    }
                    return newDebuffs;
                });
            }

            if (newEntry.isUserAction) {
                const damageMatch = newEntry.message.match(/보스 HP -([\d,]+)/);
                if (damageMatch && damageMatch[1]) {
                    const damageDealtInTurn = parseInt(damageMatch[1].replace(/,/g, ''), 10);
                    if (!isNaN(damageDealtInTurn)) {
                        nextBattleDamage += damageDealtInTurn;
                        currentBattleDamageRef.current = nextBattleDamage;
                        setCurrentBattleDamage(nextBattleDamage);
                    }
                }
            }

            const bossHpChangeMatch = newEntry.message.match(/보스 HP ([+-])([\d,]+)/);
            if (bossHpChangeMatch) {
                const sign = bossHpChangeMatch[1];
                const value = parseInt(bossHpChangeMatch[2].replace(/,/g, ''), 10);
                
                if (sign === '-') {
                    nextBossHp = Math.max(0, nextBossHp - value);
                    setSimulatedBossHp(nextBossHp);
                    setBossDamageNumbers(prev => [...prev.slice(-9), { 
                        id: Date.now() + Math.random(), 
                        text: `-${value.toLocaleString()}`, 
                        color: newEntry.isCrit ? 'text-yellow-300' : 'text-red-400',
                        isHeal: false,
                        isCrit: newEntry.isCrit
                    }]);
                } else {
                    nextBossHp = Math.min(simulationResult.bossMaxHp, nextBossHp + value);
                    setSimulatedBossHp(nextBossHp);
                    setBossDamageNumbers(prev => [...prev.slice(-9), { 
                        id: Date.now() + Math.random(), 
                        text: `+${value.toLocaleString()}`, 
                        color: 'text-green-400',
                        isHeal: true,
                        isCrit: false
                    }]);
                }
            }

            userHpRef.current = nextUserHp;
            simulatedBossHpRef.current = nextBossHp;
            const nextLogIndex = logIndex + 1;
            setLogIndex(nextLogIndex);
            persistPendingBattle(simulationResult, {
                logIndex: nextLogIndex,
                battleLog: simulationResult.battleLog.slice(0, nextLogIndex),
                userHp: nextUserHp,
                currentBattleDamage: nextBattleDamage,
                simulatedBossHp: nextBossHp,
            });
        };

        const timer = setTimeout(processNextLogEntry, GUILD_BOSS_LOG_PLAYBACK_MS);
        return () => clearTimeout(timer);

    }, [isSimulating, simulationResult, logIndex, maxUserHp, persistPendingBattle]);

    const { fullDamageRanking, myRankData } = useMemo(() => {
        if (!myGuild?.guildBossState?.totalDamageLog) {
            return { fullDamageRanking: [], myRankData: null };
        }
        
        const damageLog = myGuild.guildBossState.totalDamageLog || {} as Record<string, number>;
        
        console.log('GuildBoss: currentUserWithStatus.id', currentUserWithStatus?.id);
        console.log('GuildBoss: myGuild.members', myGuild.members);
        console.log('GuildBoss: totalDamageLog', myGuild.guildBossState.totalDamageLog);

        const fullRanking = Object.entries(damageLog)
            .map(([userId, damage]: [string, any]) => {
                let member = myGuild.members?.find((m: GuildMember) => m.userId === userId);
                if (!member && userId === ADMIN_USER_ID) {
                    member = myGuild.members?.find((m: GuildMember) => m.nickname === ADMIN_NICKNAME);
                }
                const nickname = member?.nickname || (userId === ADMIN_USER_ID ? ADMIN_NICKNAME : '알 수 없음');
                return { userId, nickname, damage: typeof damage === 'number' ? damage : 0 };
            })
            .sort((a, b) => b.damage - a.damage);
            
        const myRankIndex = fullRanking.findIndex(r => r.userId === currentUserWithStatus?.id);
        const myData = myRankIndex !== -1 ? { ...fullRanking[myRankIndex], rank: myRankIndex + 1 } : null;

        return { fullDamageRanking: fullRanking, myRankData: myData };
    }, [myGuild?.guildBossState?.totalDamageLog, myGuild?.members, currentUserWithStatus?.id]);
    
    if (!currentUserWithStatus || !myGuild) {
        return <div className="p-4">길드 정보를 불러오는 중...</div>;
    }

    const { gold, diamonds } = currentUserWithStatus;
    const guildCoins = currentUserWithStatus.guildCoins ?? 0;
    const todayKST = getTodayKSTDateString();
    const usedToday = currentUserWithStatus.guildBossLastAttemptDayKST === todayKST ? (currentUserWithStatus.guildBossAttemptsUsedToday ?? 0) : 0;
    const attemptsLeft = GUILD_BOSS_MAX_ATTEMPTS - usedToday;
    
    return (
        <div
            style={backgroundStyle}
            className={`relative mx-auto flex h-full w-full max-w-[98%] flex-col ${isNativeMobile ? 'p-2 pb-1' : 'p-6'}`}
        >
            <header className={`relative flex justify-center items-center flex-shrink-0 ${isNativeMobile ? 'mb-1 py-1' : 'mb-4 py-2'}`}>
                <div className="absolute left-0 top-1/2 -translate-y-1/2">
                    <BackButton onClick={() => window.location.hash = '#/guild'} />
                </div>
                <h1 className={`font-bold text-white ${isNativeMobile ? 'text-xl' : 'text-3xl'}`} style={{ textShadow: '2px 2px 5px black' }}>길드 보스전</h1>
            </header>

            {/* 네이티브 모바일: 좌 보스·랭킹 | 우 유저정보 | 하단 공격 로그 + 도전 */}
            {isNativeMobile ? (
                <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex min-h-0 flex-1 flex-row gap-1.5 overflow-hidden">
                        <div className={`flex min-h-0 ${GUILD_BOSS_MOBILE_BOSS_COLUMN_CLASS} flex-col gap-1.5 overflow-hidden`}>
                            <div className="min-h-0 flex-[1.55] overflow-hidden">
                                <BossPanel
                                    boss={currentBoss}
                                    hp={simulatedBossHp}
                                    maxHp={scaledBoss.maxHp}
                                    difficultyStage={bossDifficultyStage}
                                    damageNumbers={bossDamageNumbers}
                                    compact
                                />
                            </div>
                            <div className="min-h-0 max-h-[34%] flex-shrink-0 basis-[28%] overflow-hidden">
                                <DamageRankingPanel
                                    fullDamageRanking={fullDamageRanking}
                                    myRankData={myRankData}
                                    myCurrentBattleDamage={currentBattleDamage}
                                    compact
                                />
                            </div>
                        </div>
                        <div className={`flex min-h-0 ${GUILD_BOSS_MOBILE_USER_COLUMN_CLASS} flex-col overflow-y-auto overflow-x-hidden`}>
                            <UserStatsPanel
                                user={currentUserWithStatus}
                                guild={myGuild}
                                hp={userHp}
                                maxHp={maxUserHp}
                                damageNumbers={damageNumbers}
                                isSimulating={isSimulating}
                                compact
                            />
                        </div>
                    </div>

                    <section
                        className="flex min-h-0 shrink-0 basis-[min(30vh,200px)] flex-row gap-1.5"
                        aria-label="공격 정보"
                    >
                        <div className={`bg-panel border border-color flex min-h-0 ${GUILD_BOSS_MOBILE_BOSS_COLUMN_CLASS} flex-col rounded-lg p-1.5`}>
                            <h3 className="mb-0.5 flex-shrink-0 text-center text-[11px] font-bold text-red-300">보스의 공격</h3>
                            <div
                                ref={bossLogContainerRef}
                                className="min-h-0 flex-1 overflow-y-auto rounded-md bg-tertiary/50 p-1 text-[10px] leading-snug space-y-1"
                            >
                                {bossLogs.map((entry, index) => (
                                    <div key={index} className="flex items-start gap-1 animate-fade-in">
                                        <span className="font-bold text-yellow-300 flex-shrink-0">[{entry.turn}]</span>
                                        {entry.icon && <img src={entry.icon} alt="" className="h-4 w-4 flex-shrink-0" />}
                                        <span className="min-w-0 break-words">{entry.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className={`bg-panel border border-color flex min-h-0 ${GUILD_BOSS_MOBILE_USER_COLUMN_CLASS} flex-col rounded-lg p-1.5`}>
                            <h3 className="mb-0.5 flex-shrink-0 text-center text-[11px] font-bold text-blue-300">나의 공격</h3>
                            <div
                                ref={userLogContainerRef}
                                className="min-h-0 flex-1 overflow-y-auto rounded-md bg-tertiary/50 p-1 text-[10px] leading-snug space-y-1"
                            >
                                {userLogs.map((entry, index) => (
                                    <div key={index} className="flex items-start gap-1 animate-fade-in">
                                        <span className="font-bold text-yellow-300 flex-shrink-0">[{entry.turn}]</span>
                                        {entry.icon && <img src={entry.icon} alt="" className="h-4 w-4 flex-shrink-0" />}
                                        <span className="min-w-0 break-words">{entry.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    <div className="flex-shrink-0 rounded-lg border border-amber-400/30 bg-gradient-to-t from-[#060508] via-[#0f0d14] to-[#16131f] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                        <Button
                            bare
                            colorScheme="none"
                            onClick={handleBattleStart}
                            disabled={attemptsLeft <= 0 || isSimulating}
                            className={`flex w-full items-center justify-center gap-1.5 ${LOBBY_MOBILE_BTN_PRIMARY_CLASS} !min-h-[2.75rem] !text-[13px] !font-bold`}
                        >
                            {!isSimulating && <img src="/images/guild/ticket.webp" alt="도전권" className="h-4 w-4 shrink-0 opacity-95" />}
                            <span>{isSimulating ? '전투 중...' : `도전하기 (${attemptsLeft}/${GUILD_BOSS_MAX_ATTEMPTS})`}</span>
                        </Button>
                    </div>
                </main>
            ) : (
            <main className="flex min-h-0 min-w-0 flex-1 flex-row gap-3">
                <GuildBossDesktopLeftRail
                    boss={currentBoss}
                    hp={simulatedBossHp}
                    maxHp={scaledBoss.maxHp}
                    difficultyStage={bossDifficultyStage}
                    bossDamageNumbers={bossDamageNumbers}
                    fullDamageRanking={fullDamageRanking}
                    myRankData={myRankData}
                    myCurrentBattleDamage={currentBattleDamage}
                />

                <div className={GUILD_BOSS_DESKTOP_LOG_RAIL_CLASS}>
                    <div className="bg-panel border border-color flex h-1/2 min-h-0 flex-col rounded-lg p-3">
                        <h3 className="mb-1.5 flex-shrink-0 text-center text-base font-bold text-red-300">보스의 공격</h3>
                        <div ref={bossLogContainerRef} className="min-h-0 flex-grow overflow-y-auto rounded-md bg-tertiary/50 p-1.5 pr-1.5 text-xs leading-snug space-y-1.5">
                            {bossLogs.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2 animate-fade-in">
                                    <span className="font-bold text-yellow-300 mr-2 flex-shrink-0">[{entry.turn}턴]</span>
                                    {entry.icon && <img src={entry.icon} alt="action" className="w-6 h-6 flex-shrink-0" />}
                                    <span>{entry.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-panel border border-color flex h-1/2 min-h-0 flex-col rounded-lg p-3">
                        <h3 className="mb-1.5 flex-shrink-0 text-center text-base font-bold text-blue-300">나의 공격</h3>
                        <div ref={userLogContainerRef} className="min-h-0 flex-grow overflow-y-auto rounded-md bg-tertiary/50 p-1.5 pr-1.5 text-xs leading-snug space-y-1.5">
                            {userLogs.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2 animate-fade-in justify-start">
                                    <span className="font-bold text-yellow-300 mr-2 flex-shrink-0">[{entry.turn}턴]</span>
                                    {entry.icon && <img src={entry.icon} alt="action" className="w-6 h-6 flex-shrink-0" />}
                                    <span>{entry.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div className={GUILD_BOSS_DESKTOP_USER_RAIL_CLASS}>
                    <UserStatsPanel 
                        user={currentUserWithStatus} 
                        guild={myGuild} 
                        hp={userHp} 
                        maxHp={maxUserHp} 
                        damageNumbers={damageNumbers}
                        isSimulating={isSimulating}
                    />
                     <div className="flex-shrink-0 space-y-2 rounded-lg border border-amber-400/30 bg-gradient-to-t from-[#060508] via-[#0f0d14] to-[#16131f] p-3 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
                         <Button
                            bare
                            colorScheme="none"
                            onClick={handleBattleStart}
                            disabled={attemptsLeft <= 0 || isSimulating}
                            className={`mt-1 flex w-full items-center justify-center gap-2 ${PRE_GAME_MODAL_PRIMARY_BTN_CLASS}`}
                         >
                             {!isSimulating && (
                                 <img src="/images/guild/ticket.webp" alt="도전권" className="h-5 w-5 shrink-0 opacity-95" />
                             )}
                             <span>{isSimulating ? '전투 중...' : `도전하기 (${attemptsLeft}/${GUILD_BOSS_MAX_ATTEMPTS})`}</span>
                         </Button>
                     </div>
                </div>
            </main>
            )}
            {showResultModal && battleResult && (
                <GuildBossBattleResultModal 
                    result={battleResult} 
                    onClose={() => {
                        setShowResultModal(false);
                        setBattleResult(null);
                        void handlers.handleAction({ type: 'GET_GUILD_INFO' });
                    }} 
                    isTopmost={true}
                />
            )}
        </div>
    );
};

export default GuildBoss;
