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
import HelpModal from '../HelpModal.js';
import { runGuildBossBattle } from '../../utils/guildBossSimulator.js';
import { getCurrentGuildBossStage, scaleGuildBossForStage } from '../../utils/guildBossStageUtils.js';
import type { BattleLogEntry, GuildBossBattleResult } from '../../types/index.js';
import { calculateTotalStats, calculateUserEffects } from '../../utils/statUtils.js';
import Avatar from '../Avatar.js';
import UserNicknameText from '../UserNicknameText.js';
import { GUILD_ATTACK_ICON, GUILD_RESEARCH_HEAL_BLOCK_IMG, GUILD_RESEARCH_IGNITE_IMG, GUILD_RESEARCH_REGEN_IMG } from '../../assets.js';
import RadarChart from '../RadarChart.js';
import GuildBossBattleResultModal from './GuildBossBattleResultModal.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { LOBBY_MOBILE_BTN_PRIMARY_CLASS, PRE_GAME_MODAL_PRIMARY_BTN_CLASS } from '../game/PreGameDescriptionLayout.js';

const CORE_STAT_CAP = 1500;

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
        default:
            return null;
    }
};


const gradeBackgrounds: Record<ItemGrade, string> = {
    normal: '/images/equipments/normalbgi.png',
    uncommon: '/images/equipments/uncommonbgi.png',
    rare: '/images/equipments/rarebgi.png',
    epic: '/images/equipments/epicbgi.png',
    legendary: '/images/equipments/legendarybgi.png',
    mythic: '/images/equipments/mythicbgi.png',
    transcendent: '/images/equipments/transcendentbgi.png',
};

const renderStarDisplay = (stars: number) => {
    if (stars === 0) return null;

    let starImage = '';
    let numberColor = '';
    let starImageClass = '';

    if (stars >= 10) {
        starImage = '/images/equipments/Star4.png';
        numberColor = "prism-text-effect";
        starImageClass = "prism-image-effect";
    } else if (stars >= 7) {
        starImage = '/images/equipments/Star3.png';
        numberColor = "text-purple-400";
    } else if (stars >= 4) {
        starImage = '/images/equipments/Star2.png';
        numberColor = "text-amber-400";
    } else if (stars >= 1) {
        starImage = '/images/equipments/Star1.png';
        numberColor = "text-white";
    }

    return (
        <div className="absolute top-0.5 left-1.5 flex items-center gap-0.5 bg-black/40 rounded-br-md px-1 py-0.5 z-10" style={{ textShadow: '1px 1px 2px black' }}>
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
    onOpenEffects: () => void;
    onOpenPresets: () => void;
    isSimulating: boolean;
    activeDebuffs: Record<string, { value: number; turns: number }>;
    /** 네이티브 모바일 보스전 한 화면 레이아웃용 압축 UI */
    compact?: boolean;
}

const UserStatsPanel: React.FC<UserStatsPanelProps> = ({ user, guild, hp, maxHp, damageNumbers, onOpenEffects, onOpenPresets, isSimulating, activeDebuffs, compact = false }) => {
    const { handlers } = useAppContext();
    const myGuild = guild;
    
    const totalStats = useMemo(() => calculateTotalStats(user, myGuild), [user, myGuild]);
    const baseWithSpent = useMemo(() => {
        const stats: Record<CoreStat, number> = {} as any;
        for (const key of Object.values(CoreStat)) {
            stats[key] = (user.baseStats[key] || 0) + (user.spentStatPoints?.[key] || 0);
        }
        return stats;
    }, [user.baseStats, user.spentStatPoints]);

    const equipmentOnlyEffects = useMemo(() => calculateUserEffects(user, null), [user]);

    const equipmentBonuses = useMemo(() => {
        const bonuses: Partial<Record<CoreStat, number>> = {};
        for (const key of Object.values(CoreStat)) {
            const baseValue = baseWithSpent[key];
            const flatBonus = equipmentOnlyEffects.coreStatBonuses[key].flat;
            const percentBonus = equipmentOnlyEffects.coreStatBonuses[key].percent;
            const baseAndSpent = Math.max(0, Number(baseValue) || 0);
            const baseWithFlat = Math.max(0, baseAndSpent + (Number(flatBonus) || 0));
            const percentGain = Math.floor(baseWithFlat * ((Number(percentBonus) || 0) / 100));
            const finalValue = baseWithFlat + percentGain;
            bonuses[key] = finalValue - baseValue;
        }
        return bonuses;
    }, [baseWithSpent, equipmentOnlyEffects]);

    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === user.avatarId)?.url, [user.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === user.borderId)?.url, [user.borderId]);

    const radarDataset = useMemo(() => [{
        stats: totalStats,
        color: '#60a5fa',
        fill: 'rgba(59, 130, 246, 0.4)',
    }], [totalStats]);
    
    const equippedItems = useMemo(() => {
        return (user.inventory || []).filter(item => item.isEquipped);
    }, [user.inventory]);

    const getItemForSlot = (slot: EquipmentSlot) => {
        return equippedItems.find(e => e && e.slot === slot);
    };
    
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

    const handleLoadPreset = (index: number) => {
        if (window.confirm(`'${presets[index].name}' 프리셋을 불러오시겠습니까? 현재 장착된 모든 장비가 해제됩니다.`)) {
            handlers.handleAction({ type: 'LOAD_EQUIPMENT_PRESET', payload: { presetIndex: index } });
        }
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
            
            <div className={`flex flex-row items-center ${compact ? 'gap-1.5 mb-1' : 'gap-2 mb-2'}`}>
                <div className="w-1/2 flex justify-center">
                    <RadarChart datasets={radarDataset} maxStatValue={CORE_STAT_CAP} size={compact ? 88 : 150} />
                </div>
                <div className={`w-1/2 grid grid-cols-1 gap-1 ${compact ? 'text-[10px]' : 'text-xs'}`}>
                    {Object.values(CoreStat).map(stat => {
                        const bonus = equipmentBonuses[stat] || 0;
                        const isDebuffed = stat === CoreStat.CombatPower && activeDebuffs['user_combat_power_reduction_percent']?.turns > 0;
                        const statValue = Number(totalStats[stat]) || 0;
                        const isCapped = statValue >= CORE_STAT_CAP;
                        return (
                            <div key={stat} className={`flex justify-between items-center bg-tertiary/40 rounded-md ${compact ? 'p-0.5' : 'p-1'}`}>
                                <span className={`font-semibold text-secondary ${isDebuffed ? 'text-red-400' : ''}`}>{stat}</span>
                                <div className="flex items-baseline">
                                    <span className={`font-mono font-bold ${isDebuffed || isCapped ? 'text-red-400' : 'text-primary'}`}>
                                        {isCapped ? CORE_STAT_CAP : statValue}
                                    </span>
                                    {bonus > 0 && <span className="font-mono text-xs text-green-400 ml-0.5">(+{bonus})</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            
            <div className={`grid grid-cols-6 px-1 ${compact ? 'gap-0.5' : 'gap-1'}`}>
                {(['fan', 'top', 'bottom', 'board', 'bowl', 'stones'] as EquipmentSlot[]).map(slot => (
                    <div key={slot} className="w-full">
                        <EquipmentSlotDisplay
                            slot={slot}
                            item={getItemForSlot(slot)}
                            onClick={() => {
                                const item = getItemForSlot(slot);
                                if (item) handlers.openViewingItem(item, true);
                            }}
                        />
                    </div>
                ))}
            </div>
            
            <div className={`flex items-center justify-end gap-2 ${compact ? 'mt-1' : 'mt-2'}`}>
                {/* FIX: Corrected typo from openEquipmentEffectsModal to openGuildEffectsModal, then corrected back to openEquipmentEffectsModal as it's for user equipment. */}
                <Button
                    bare
                    colorScheme="none"
                    onClick={handlers.openEquipmentEffectsModal}
                    className={`flex-1 touch-manipulation ${PRE_GAME_MODAL_PRIMARY_BTN_CLASS} ${
                        compact
                            ? '!min-h-[2rem] !rounded-lg !px-2 !py-1 !text-[10px] !font-bold !tracking-tight'
                            : '!min-h-[2.35rem] !rounded-[0.55rem] !px-3 !py-1.5 !text-xs !font-bold'
                    }`}
                >
                    장비 효과
                </Button>
                <select
                    onChange={(e) => {
                        const index = parseInt(e.target.value, 10);
                        if (!isNaN(index)) {
                            handleLoadPreset(index);
                        }
                        e.target.value = "";
                    }}
                    disabled={isSimulating}
                    className={`rounded-lg border border-violet-400/30 bg-gradient-to-b from-zinc-700/90 to-zinc-950 font-bold text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_0_0_rgba(15,23,42,0.65)] ring-1 ring-white/[0.06] transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 disabled:cursor-not-allowed disabled:opacity-45 ${compact ? 'p-1 text-[10px] w-24' : 'p-1.5 text-xs w-32'}`}
                    defaultValue=""
                >
                    <option value="" disabled>프리셋 불러오기</option>
                    {presets.map((preset, index) => (
                        <option key={index} value={index}>
                            {preset.name}
                        </option>
                    ))}
                </select>
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
                                        <p className={`font-mono font-bold text-yellow-400 ${compact ? 'text-xs leading-snug' : ''}`}>
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
    damageNumbers: { id: number; text: string; color: string; isHeal: boolean; isCrit?: boolean }[];
    compact?: boolean;
}

const BossSkillTile: React.FC<{ skill: GuildBossInfo['skills'][number]; className?: string }> = ({ skill, className = '' }) => (
    <button
        type="button"
        className={`group/skill relative shrink-0 border-none bg-transparent p-0 outline-none transition hover:opacity-95 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-xl ${className}`}
        aria-label={`${skill.name}. ${skill.description}`}
    >
        <div className="flex aspect-square h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-black/40">
            <img src={skill.image || ''} alt="" className="h-full w-full object-contain p-0.5 sm:p-1" />
        </div>
        <div
            className="pointer-events-none absolute bottom-full left-1/2 z-[70] mb-2 w-56 max-w-[min(18rem,85vw)] -translate-x-1/2 rounded-2xl border border-amber-500/40 bg-gray-950/95 px-3 py-2.5 text-left opacity-0 shadow-xl backdrop-blur-sm transition-opacity duration-150 group-hover/skill:opacity-100 group-focus-visible/skill:opacity-100 group-active/skill:opacity-100"
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

const BossPanel: React.FC<BossPanelProps> = ({ boss, hp, maxHp, damageNumbers, compact = false }) => {
    const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0;

    return (
        <div className={`flex h-full flex-col ${compact ? 'min-h-0 gap-1' : 'gap-2'}`}>
            <div
                className={`relative min-h-0 group ${compact ? 'flex min-h-0 flex-1 flex-col' : 'flex-shrink-0'}`}
            >
                <img
                    src={boss.image}
                    alt={boss.name}
                    className={`mx-auto w-full rounded-lg object-contain ${compact ? 'min-h-0 flex-1' : 'max-h-[min(72vh,640px)]'}`}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/50 rounded-lg pointer-events-none"></div>
                
                <div className={`absolute left-2 right-2 ${compact ? 'top-1' : 'top-2'}`}>
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
}


const DamageRankingPanel: React.FC<DamageRankingPanelProps> = ({ fullDamageRanking, myRankData, myCurrentBattleDamage, compact = false }) => {
    const { handlers, allUsers } = useAppContext();
    const top3 = fullDamageRanking.slice(0, 3);
    const amIInTop3 = myRankData ? myRankData.rank <= 3 : false;
    const myRankUser = myRankData ? allUsers?.find((u) => u.id === myRankData.userId) : undefined;

    return (
        <div className={`bg-panel border border-color rounded-lg flex flex-col min-h-0 h-full ${compact ? 'p-2' : 'p-3'}`}>
            <h4 className={`font-bold text-yellow-300 text-center flex-shrink-0 ${compact ? 'text-sm mb-1' : 'text-base mb-2'}`}>
                {compact ? '누적 피해 Top 3' : '누적 피해 랭킹 Top 3'}
            </h4>
            
            <div className="flex-grow min-h-0 overflow-y-auto pr-1">
                {top3.length > 0 ? (
                    <ul className={compact ? 'space-y-1' : 'space-y-1'}>
                        {top3.map((rank, index) => {
                            const ru = allUsers?.find((u) => u.id === rank.userId);
                            return (
                            <li key={rank.userId} onClick={() => handlers.openViewingUser(rank.userId)} className="flex cursor-pointer items-center justify-between rounded-md bg-tertiary/50 p-1.5 text-xs hover:bg-secondary">
                                <div className="flex items-center gap-1.5">
                                    <span className={`font-bold text-center ${compact ? 'w-6' : 'w-5'}`}>{index + 1}.</span>
                                    <UserNicknameText
                                        user={{
                                            nickname: rank.nickname,
                                            isAdmin: ru?.isAdmin,
                                            staffNicknameDisplayEligibility: ru?.staffNicknameDisplayEligibility,
                                        }}
                                        className="font-semibold truncate"
                                    />
                                </div>
                                <span className="font-mono text-highlight">{rank.damage.toLocaleString()}</span>
                            </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className={`h-full flex items-center justify-center text-tertiary ${compact ? 'text-xs' : 'text-sm'}`}>기록 없음</div>
                )}
            </div>
            {myRankData && !amIInTop3 && (
                <div className={`border-t border-color/50 flex-shrink-0 ${compact ? 'mt-1 pt-1' : 'mt-2 pt-2'}`}>
                    <div className={`flex items-center justify-between bg-blue-900/40 rounded-md ${compact ? 'p-1.5 text-xs' : 'p-1.5 text-xs'}`}>
                         <div className="flex items-center gap-1.5">
                            <span className="font-bold w-5 text-center">{myRankData.rank}</span>
                            <span className="inline-flex min-w-0 items-center gap-1 font-semibold">
                                <UserNicknameText
                                    user={{
                                        nickname: myRankData.nickname,
                                        isAdmin: myRankUser?.isAdmin,
                                        staffNicknameDisplayEligibility: myRankUser?.staffNicknameDisplayEligibility,
                                    }}
                                    className="truncate"
                                />
                                <span className="shrink-0"> (나)</span>
                            </span>
                        </div>
                        <span className="font-mono text-highlight">{myRankData.damage.toLocaleString()}</span>
                    </div>
                </div>
            )}
            <div className={`border-t border-color/50 flex-shrink-0 text-center ${compact ? 'mt-1 pt-1' : 'mt-2 pt-2'}`}>
                <p className={compact ? 'text-xs' : 'text-sm'}>
                    {compact ? '이번 전투: ' : '이번 전투 피해량: '}
                    <span className="font-bold text-yellow-300">{myCurrentBattleDamage.toLocaleString()}</span>
                </p>
            </div>
        </div>
    );
};

const GuildBoss: React.FC = () => {
    const { currentUserWithStatus, guilds, handlers } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();

    const [isSimulating, setIsSimulating] = useState(false);
    const simulationInFlight = useRef(false);
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
    const [showBossHelpModal, setShowBossHelpModal] = useState(false);

    
    const userLogContainerRef = useRef<HTMLDivElement>(null);
    const bossLogContainerRef = useRef<HTMLDivElement>(null);

    const myGuild = useMemo(() => {
        if (!currentUserWithStatus?.guildId || !guilds) return null;
        return (guilds as Record<string, GuildType>)[currentUserWithStatus.guildId];
    }, [currentUserWithStatus?.guildId, guilds]);

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
        backgroundImage: `url(/images/guild/boss/boss${bossIndex}bg.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: 'rgb(var(--bg-tertiary))', // Fallback color
    }), [bossIndex]);
    
    const { guildBossState } = myGuild || {};
    const currentHp = guildBossState?.currentBossHp ?? scaledBoss.maxHp;
    const [simulatedBossHp, setSimulatedBossHp] = useState(currentHp);

    const userLogs = useMemo(() => battleLog.filter(e => e.isUserAction), [battleLog]);
    const bossLogs = useMemo(() => battleLog.filter(e => !e.isUserAction), [battleLog]);

    // 입장 시(공격 전) 표시할 유저 최대 체력 — 시뮬레이터와 동일한 식
    const initialMaxUserHp = useMemo(() => {
        if (!currentUserWithStatus || !myGuild) return 0;
        const totalStats = calculateTotalStats(currentUserWithStatus, myGuild);
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

    const handleBattleStart = useCallback(() => {
        if (!currentUserWithStatus || !myGuild || simulationInFlight.current) return;
        
        const todayKST = getTodayKSTDateString();
        const usedToday = currentUserWithStatus.guildBossLastAttemptDayKST === todayKST ? (currentUserWithStatus.guildBossAttemptsUsedToday ?? 0) : 0;
        const attemptsLeft = GUILD_BOSS_MAX_ATTEMPTS - usedToday;
        if (attemptsLeft <= 0) return;

        simulationInFlight.current = true;
        setIsSimulating(true);
        setBattleLog([]);
        setLogIndex(0);
        setDamageNumbers([]);
        setBossDamageNumbers([]);
        setCurrentBattleDamage(0);
        setActiveDebuffs({});
        const preGuildHp = myGuild.guildBossState?.currentBossHp;
        const battleStartHp =
            preGuildHp != null && preGuildHp > 0 ? preGuildHp : scaledBoss.maxHp;
        setSimulatedBossHp(battleStartHp);

        const result = runGuildBossBattle(
            currentUserWithStatus,
            myGuild,
            { ...scaledBoss, hp: battleStartHp },
            bossDifficultyStage
        );
        
        setUserHp(result.maxUserHp);
        setMaxUserHp(result.maxUserHp);
        setSimulationResult(result);
    }, [currentUserWithStatus, myGuild, scaledBoss, bossDifficultyStage]);

    useEffect(() => {
        if (!isSimulating || !simulationResult) return;

        if (logIndex >= simulationResult.battleLog.length) {
            const timer = setTimeout(async () => {
                // 서버 totalDamageLog 키는 관리자일 때 effectiveUserId(ADMIN_USER_ID)와 통일됨 — 클라 id와 불일치 시 순위 0으로 나오던 문제 방지
                const rankUserId = currentUserWithStatus?.isAdmin ? ADMIN_USER_ID : (currentUserWithStatus?.id ?? '');
                // 현재 순위 계산 (보스전 전)
                const currentRanking = Object.entries(myGuild?.guildBossState?.totalDamageLog || {})
                    .map(([userId, damage]: [string, any]) => ({ userId, damage: typeof damage === 'number' ? damage : 0 }))
                    .sort((a, b) => b.damage - a.damage);
                const prevRank = rankUserId ? currentRanking.findIndex((r) => r.userId === rankUserId) + 1 : 0;
                setPreviousRank(prevRank > 0 ? prevRank : null);

                const preBattleGuildHp = myGuild?.guildBossState?.currentBossHp;
                const preBattleNum =
                    typeof preBattleGuildHp === 'number' ? preBattleGuildHp : simulationResult.bossMaxHp;
                const clientBossHpAfter =
                    preBattleNum <= 0 ? 0 : Math.max(0, preBattleNum - currentBattleDamage);
                const finalResult = {
                    ...simulationResult,
                    damageDealt: currentBattleDamage,
                    bossName: currentBoss.name,
                    bossHpAfter: clientBossHpAfter,
                    bossMaxHp: simulationResult.bossMaxHp,
                    bossHpBefore: preBattleNum <= 0 ? simulationResult.bossMaxHp : preBattleNum,
                };
                const actionResult = await handlers.handleAction({ type: 'START_GUILD_BOSS_BATTLE', payload: { bossId: currentBoss.id, result: finalResult, bossName: currentBoss.name } });
                
                // 서버에서 반환된 업데이트된 결과 사용 (장비 정보 포함)
                // API가 { success, ...clientResponse } 형태로 응답하므로 guildBossBattleResult는 최상위에 있음
                const serverResult = (actionResult as any)?.guildBossBattleResult ?? (actionResult as any)?.clientResponse?.guildBossBattleResult;
                const resultToUse = serverResult || finalResult;
                
                // 디버깅: 장비 정보 확인
                if (resultToUse?.rewards?.equipment) {
                    console.log('[GuildBoss] Equipment info in result:', {
                        hasName: !!resultToUse.rewards.equipment.name,
                        name: resultToUse.rewards.equipment.name,
                        hasImage: !!resultToUse.rewards.equipment.image,
                        hasSlot: !!resultToUse.rewards.equipment.slot,
                        grade: resultToUse.rewards.equipment.grade,
                        equipmentKeys: Object.keys(resultToUse.rewards.equipment)
                    });
                } else {
                    console.warn('[GuildBoss] No equipment in result:', {
                        hasRewards: !!resultToUse?.rewards,
                        hasEquipment: !!resultToUse?.rewards?.equipment,
                        rewardsKeys: resultToUse?.rewards ? Object.keys(resultToUse.rewards) : []
                    });
                }
                
                // 보스전 후 순위 계산 (응답의 guilds가 있으면 최신 로그 사용)
                const guildsPayload = (actionResult as any)?.clientResponse?.guilds ?? (actionResult as any)?.guilds;
                const updatedGuild =
                    (guildsPayload && myGuild?.id ? guildsPayload[myGuild.id] : null) || myGuild;
                const updatedRanking = Object.entries(updatedGuild?.guildBossState?.totalDamageLog || {})
                    .map(([userId, damage]: [string, any]) => ({ userId, damage: typeof damage === 'number' ? damage : 0 }))
                    .sort((a, b) => b.damage - a.damage);
                const newRank = rankUserId ? updatedRanking.findIndex((r) => r.userId === rankUserId) + 1 : 0;

                setBattleResult({
                    ...resultToUse,
                    bossName: currentBoss.name,
                    previousRank: prevRank > 0 ? prevRank : null,
                    currentRank: newRank > 0 ? newRank : null,
                });
                setShowResultModal(true);
                setIsSimulating(false);
                setSimulationResult(null);
                setActiveDebuffs({});
                simulationInFlight.current = false;
            }, 1000);
            return () => clearTimeout(timer);
        }

        const processNextLogEntry = () => {
            const newEntry = simulationResult.battleLog[logIndex];
            
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
                setUserHp((hp: number) => Math.max(0, hp - (newEntry.damageTaken || 0)));
                setDamageNumbers(prev => [...prev.slice(-5), { id: Date.now() + Math.random(), text: `-${newEntry.damageTaken}`, color: 'text-red-400' }]);
            }
            if (newEntry.healingDone !== undefined) {
                setUserHp((hp: number) => Math.min(maxUserHp, hp + (newEntry.healingDone || 0)));
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
                        setCurrentBattleDamage(prev => prev + damageDealtInTurn);
                    }
                }
            }

            const bossHpChangeMatch = newEntry.message.match(/보스 HP ([+-])([\d,]+)/);
            if (bossHpChangeMatch) {
                const sign = bossHpChangeMatch[1];
                const value = parseInt(bossHpChangeMatch[2].replace(/,/g, ''), 10);
                
                if (sign === '-') {
                    setSimulatedBossHp((prevHp: number) => Math.max(0, prevHp - value));
                    setBossDamageNumbers(prev => [...prev.slice(-9), { 
                        id: Date.now() + Math.random(), 
                        text: `-${value.toLocaleString()}`, 
                        color: newEntry.isCrit ? 'text-yellow-300' : 'text-red-400',
                        isHeal: false,
                        isCrit: newEntry.isCrit
                    }]);
                } else { // sign is '+'
                    setSimulatedBossHp((prevHp: number) => Math.min(simulationResult.bossMaxHp, prevHp + value));
                    setBossDamageNumbers(prev => [...prev.slice(-9), { 
                        id: Date.now() + Math.random(), 
                        text: `+${value.toLocaleString()}`, 
                        color: 'text-green-400',
                        isHeal: true,
                        isCrit: false
                    }]);
                }
            }

            setLogIndex(prev => prev + 1);
        };

        const timer = setTimeout(processNextLogEntry, 1000);
        return () => clearTimeout(timer);

    }, [isSimulating, simulationResult, logIndex, handlers, maxUserHp, currentBoss.name, currentBattleDamage, myGuild?.guildBossState?.currentBossHp, currentUserWithStatus?.id, currentUserWithStatus?.isAdmin, myGuild?.id]);

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
                <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10">
                    <button
                        type="button"
                        onClick={() => setShowBossHelpModal(true)}
                        className="flex h-10 w-10 touch-manipulation items-center justify-center rounded-xl border border-amber-400/40 bg-gradient-to-b from-amber-500/22 to-amber-950/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_14px_-6px_rgba(245,158,11,0.28)] ring-1 ring-amber-500/25 transition-all hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/55"
                        title="길드 보스전 도움말"
                        aria-label="도움말"
                    >
                        <img src="/images/button/help.webp" alt="도움말" className="w-full h-full" />
                    </button>
                </div>
            </header>

            {/* 네이티브 모바일: 좌 보스·랭킹 | 우 유저정보 | 하단 공격 로그 + 도전 */}
            {isNativeMobile ? (
                <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex min-h-0 flex-1 flex-row gap-1.5 overflow-hidden">
                        <div className="flex min-h-0 w-[50%] max-w-[50%] flex-col gap-1.5 overflow-hidden">
                            <div className="min-h-0 flex-[1.55] overflow-hidden">
                                <BossPanel
                                    boss={currentBoss}
                                    hp={simulatedBossHp}
                                    maxHp={scaledBoss.maxHp}
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
                        <div className="flex min-h-0 min-w-0 w-[50%] max-w-[50%] flex-1 flex-col overflow-y-auto overflow-x-hidden">
                            <UserStatsPanel
                                user={currentUserWithStatus}
                                guild={myGuild}
                                hp={userHp}
                                maxHp={maxUserHp}
                                damageNumbers={damageNumbers}
                                onOpenEffects={handlers.openEquipmentEffectsModal}
                                onOpenPresets={handlers.openPresetModal}
                                isSimulating={isSimulating}
                                activeDebuffs={activeDebuffs}
                                compact
                            />
                        </div>
                    </div>

                    <section
                        className="flex min-h-0 shrink-0 basis-[min(30vh,200px)] flex-row gap-1.5"
                        aria-label="공격 정보"
                    >
                        <div className="bg-panel border border-color flex min-h-0 min-w-0 flex-1 flex-col rounded-lg p-1.5">
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
                        <div className="bg-panel border border-color flex min-h-0 min-w-0 flex-1 flex-col rounded-lg p-1.5">
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
                            {!isSimulating && <img src="/images/guild/ticket.png" alt="도전권" className="h-4 w-4 shrink-0 opacity-95" />}
                            <span>{isSimulating ? '전투 중...' : `도전하기 (${attemptsLeft}/${GUILD_BOSS_MAX_ATTEMPTS})`}</span>
                        </Button>
                    </div>
                </main>
            ) : (
            <main className="flex min-h-0 min-w-0 flex-1 flex-row gap-4">
                <div className="flex w-[20%] min-w-0 shrink-0 flex-col gap-4">
                    <BossPanel boss={currentBoss} hp={simulatedBossHp} maxHp={scaledBoss.maxHp} damageNumbers={bossDamageNumbers} />
                    <DamageRankingPanel fullDamageRanking={fullDamageRanking} myRankData={myRankData} myCurrentBattleDamage={currentBattleDamage} />
                </div>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
                    <div className="bg-panel border border-color flex h-1/2 min-h-0 flex-col rounded-lg p-4">
                        <h3 className="mb-2 flex-shrink-0 text-center text-lg font-bold text-red-300">보스의 공격</h3>
                        <div ref={bossLogContainerRef} className="flex-grow overflow-y-auto rounded-md bg-tertiary/50 p-2 pr-2 text-sm space-y-2">
                            {bossLogs.map((entry, index) => (
                                <div key={index} className="flex items-center gap-2 animate-fade-in">
                                    <span className="font-bold text-yellow-300 mr-2 flex-shrink-0">[{entry.turn}턴]</span>
                                    {entry.icon && <img src={entry.icon} alt="action" className="w-6 h-6 flex-shrink-0" />}
                                    <span>{entry.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-panel border border-color flex h-1/2 min-h-0 flex-col rounded-lg p-4">
                        <h3 className="mb-2 flex-shrink-0 text-center text-lg font-bold text-blue-300">나의 공격</h3>
                        <div ref={userLogContainerRef} className="flex-grow overflow-y-auto rounded-md bg-tertiary/50 p-2 pr-2 text-sm space-y-2">
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
                
                <div className="flex w-[26%] min-w-0 shrink-0 flex-col gap-4">
                    <UserStatsPanel 
                        user={currentUserWithStatus} 
                        guild={myGuild} 
                        hp={userHp} 
                        maxHp={maxUserHp} 
                        damageNumbers={damageNumbers}
                        onOpenEffects={handlers.openEquipmentEffectsModal}
                        onOpenPresets={handlers.openPresetModal}
                        isSimulating={isSimulating}
                        activeDebuffs={activeDebuffs}
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
                                 <img src="/images/guild/ticket.png" alt="도전권" className="h-5 w-5 shrink-0 opacity-95" />
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
            {showBossHelpModal && (
                <HelpModal mode="guildBoss" onClose={() => setShowBossHelpModal(false)} />
            )}
        </div>
    );
};

export default GuildBoss;
