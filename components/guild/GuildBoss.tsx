import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import { Guild as GuildType, UserWithStatus, GuildBossInfo, QuestReward, GuildMember, GuildMemberRole, CoreStat, GuildResearchId, EquipmentSlot, InventoryItem, ItemGrade } from '../../types/index.js';
import BackButton from '../BackButton.js';
import Button from '../Button.js';
import { GUILD_BOSSES, GUILD_RESEARCH_PROJECTS, AVATAR_POOL, BORDER_POOL, emptySlotImages, slotNames, GUILD_BOSS_MAX_ATTEMPTS, ADMIN_USER_ID, ADMIN_NICKNAME } from '../../constants/index.js';
import { LOBBY_MOBILE_BTN_PRIMARY_CLASS, PRE_GAME_MODAL_PRIMARY_BTN_CLASS } from '../game/PreGameDescriptionLayout.js';
import { getTodayKSTDateString } from '../../utils/timeUtils.js';
import DraggableWindow from '../DraggableWindow.js';
import GuildResearchPanel from './GuildResearchPanel.js';
import GuildMissionsPanel from './GuildMissionsPanel.js';
import GuildShopModal from './GuildShopModal.js';
import { BOSS_SKILL_ICON_MAP } from '../../assets.js';
import { GUILD_UI_ICONS } from '../../shared/constants/guildUiIcons.js';
import {
    clearPendingGuildBossBattle,
    GUILD_BOSS_LOG_PLAYBACK_MS,
    loadPendingGuildBossBattle,
    savePendingGuildBossBattle,
    type GuildBossBattleModalResult,
    type GuildBossBattleSubmitContext,
} from '../../utils/guildBossBattlePersistence.js';
import { getCurrentGuildBossStage, scaleGuildBossForStage } from '../../utils/guildBossStageUtils.js';
import { computeGuildBossUserMaxHp } from '../../shared/constants/guildBossBalance.js';
import type { BattleLogEntry, GuildBossBattleResult } from '../../types/index.js';
import { calculateTotalStats } from '../../utils/statUtils.js';
import Avatar from '../Avatar.js';
import UserNicknameText from '../UserNicknameText.js';
import EquipmentEnhancementBadge from '../EquipmentEnhancementBadge.js';
import {
    GRADE_SLOT_BORDER_OVERLAY_POSITION_CLASS,
    GRADE_SLOT_SCRIM_CLASS,
    gradeSlotBorderOverlayClass,
    itemSlotIconStyleForGrade,
} from '../../shared/constants/itemSlotIconLayout.js';
import HomeNativeMergedEquipmentAbilityPanel from '../HomeNativeMergedEquipmentAbilityPanel.js';
import { BADUK_ABILITY_STAT_CAP, BADUK_ABILITY_TOTAL_CAP } from '../CoreStatsHexagonChart.js';
import GuildBossBattleResultModal from './GuildBossBattleResultModal.js';
import GuildBossBattleArena, {
    ResearchSkillTile,
    getBossResearchEffectDisplay,
} from './GuildBossBattleArena.js';
import PcLobbyThreeColumnShell from '../shell/PcLobbyThreeColumnShell.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { useTranslation } from 'react-i18next';
import { translateGuildBossName } from '../../shared/utils/translateGuildBossName.js';
import GuildBossPortrait from './GuildBossPortrait.js';
import { resolveGuildBossCombatFx, type GuildBossCombatFxState } from '../../utils/guildBossBattleFx.js';
import {
    GUILD_BOSS_ENGAGE_MS,
    GUILD_BOSS_ENGAGE_STONE_COUNT,
    GUILD_BOSS_FINALE_MS,
    GUILD_BOSS_OPENING_HP_BUFF_MS,
    GUILD_BOSS_SUPPORT_RESEARCH_IDS,
    type GuildBossPresentationPhase,
} from '../../utils/guildBossBattleBoards.js';
import {
    PC_HOME_LEFT_COLUMN_CLASS,
    PC_LOBBY_DESKTOP_SHELL_PADDING_CLASS,
} from '../../shared/constants/pcShellLayout.js';

const GUILD_BOSS_TOP_RANK_BADGE_CLASS: Record<1 | 2 | 3, string> = {
    1: 'bg-gradient-to-br from-amber-100 via-yellow-400 to-amber-700 text-amber-950 ring-2 ring-amber-200/90 shadow-[0_0_12px_rgba(251,191,36,0.42)]',
    2: 'bg-gradient-to-br from-slate-50 via-slate-300 to-slate-600 text-slate-900 ring-2 ring-slate-200/85 shadow-[0_2px_8px_rgba(148,163,184,0.35)]',
    3: 'bg-gradient-to-br from-orange-200 via-amber-700 to-orange-950 text-orange-50 ring-2 ring-orange-300/75 shadow-[0_2px_8px_rgba(194,65,12,0.28)]',
};

const GuildBossTopRankBadge: React.FC<{ place: 1 | 2 | 3; compact?: boolean }> = ({ place, compact = false }) => {
    const { t } = useTranslation(['guild', 'common']);
    return (
    <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-black tabular-nums ${
            compact ? 'h-5 w-5 text-[10px]' : 'h-8 w-8 text-sm'
        } ${GUILD_BOSS_TOP_RANK_BADGE_CLASS[place]}`}
        aria-label={t('boss.placeAria', { place })}
    >
        {place}
    </span>
    );
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

export const EquipmentSlotDisplay: React.FC<{ slot: EquipmentSlot; item?: InventoryItem; onClick?: () => void; }> = ({ slot, item, onClick }) => {
    const clickableClass = item && onClick ? 'cursor-pointer hover:scale-105 transition-transform' : '';
    
    if (item) {
        const isTranscendent = item.grade === ItemGrade.Transcendent;
        return (
            <div
                className={`relative aspect-square w-full overflow-hidden rounded-md border border-color/50 bg-tertiary/50 ${clickableClass} ${isTranscendent ? 'transcendent-grade-slot' : ''}`}
                title={item.name}
                onClick={onClick}
            >
                <img src={gradeBackgrounds[item.grade]} alt={item.grade} className="absolute inset-0 h-full w-full rounded-sm object-cover" />
                <div className={GRADE_SLOT_SCRIM_CLASS} aria-hidden />
                {item.image && (
                    <img
                        src={item.image}
                        alt={item.name}
                        className="absolute z-[2] object-contain"
                        style={itemSlotIconStyleForGrade(item.grade)}
                    />
                )}
                <div
                    className={`${GRADE_SLOT_BORDER_OVERLAY_POSITION_CLASS} ${gradeSlotBorderOverlayClass(item.grade)}`}
                    aria-hidden
                />
                <EquipmentEnhancementBadge stars={item.stars} />
            </div>
        );
    } else {
         return (
             <img src={emptySlotImages[slot]} alt={`${slot} empty slot`} className="w-full aspect-square rounded-md bg-tertiary/50 border-2 border-dashed border-color/50" />
        );
    }
};

const GuildBossSupportSkillsPanel: React.FC<{
    guild: GuildType | null;
    combatFx: GuildBossCombatFxState | null;
    showOpeningHpBuff?: boolean;
    engageWave?: boolean;
    compact?: boolean;
    /** 모바일 하단 한 줄 바 */
    denseBar?: boolean;
}> = ({
    guild,
    combatFx,
    showOpeningHpBuff = false,
    engageWave = false,
    compact = false,
    denseBar = false,
}) => {
    const { t } = useTranslation('guild');

    const supportProjects = useMemo(() => {
        return GUILD_BOSS_SUPPORT_RESEARCH_IDS.map((id) => {
            const project = GUILD_RESEARCH_PROJECTS[id];
            const currentLevel = guild?.research?.[id]?.level || 0;
            return { ...project, id, currentLevel };
        });
    }, [guild]);

    const nameMap: Partial<Record<GuildResearchId, string>> = useMemo(
        () => ({
            boss_hp_increase: t('boss.researchHpIncrease'),
            boss_damage_increase: t('boss.researchDamageIncrease'),
            boss_attack_evasion: t('boss.researchAttackEvasion'),
            boss_hit_damage_reduction: t('boss.researchHitDamageReduction'),
        }),
        [t],
    );

    if (denseBar) {
        return (
            <div
                className={`flex items-center gap-1.5 rounded-lg border border-amber-400/25 bg-black/45 px-1.5 py-1 ${
                    engageWave ? 'guild-boss-skill-strip--engage' : ''
                }`}
            >
                <span className="shrink-0 text-[9px] font-bold tracking-wide text-amber-200/85">
                    {t('boss.supportSkills')}
                </span>
                <div className="flex min-w-0 flex-1 flex-row items-center justify-end gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {supportProjects.map((project) => {
                        const effect = getBossResearchEffectDisplay(project.id, project.currentLevel, t);
                        const proc =
                            combatFx?.researchId === project.id ||
                            (showOpeningHpBuff && project.id === GuildResearchId.boss_hp_increase);
                        return (
                            <ResearchSkillTile
                                key={project.id}
                                name={nameMap[project.id] || project.name}
                                description={project.description}
                                image={project.image}
                                level={project.currentLevel}
                                effect={effect}
                                proc={proc}
                                compact
                                dense
                                inactiveLabel={t('boss.inactive')}
                            />
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div
            className={`rounded-lg border border-amber-400/25 bg-black/40 [box-shadow:inset_0_1px_0_rgba(255,255,255,0.06)] ${
                compact ? 'p-1.5' : 'p-2'
            } ${engageWave ? 'guild-boss-skill-strip--engage' : ''}`}
        >
            <h3
                className={`mb-1 text-center font-bold tracking-wide text-amber-200/90 ${
                    compact ? 'text-[10px]' : 'text-xs'
                }`}
            >
                {t('boss.supportSkills')}
            </h3>
            <div className="flex flex-row flex-wrap items-center justify-center gap-1">
                {supportProjects.map((project) => {
                    const effect = getBossResearchEffectDisplay(project.id, project.currentLevel, t);
                    const proc =
                        combatFx?.researchId === project.id ||
                        (showOpeningHpBuff && project.id === GuildResearchId.boss_hp_increase);
                    return (
                        <ResearchSkillTile
                            key={project.id}
                            name={nameMap[project.id] || project.name}
                            description={project.description}
                            image={project.image}
                            level={project.currentLevel}
                            effect={effect}
                            proc={proc}
                            compact={compact}
                            inactiveLabel={t('boss.inactive')}
                        />
                    );
                })}
            </div>
        </div>
    );
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
    /** 모바일: 연구소 스킬을 별도 오버레이로 분리 */
    hideResearchSkills?: boolean;
    /** 좌측 프로필 레일: 체력 게이지 숨김 (전투 뷰어에서만 표시) */
    hideHp?: boolean;
}

const UserStatsPanel: React.FC<UserStatsPanelProps> = ({
    user,
    guild,
    hp,
    maxHp,
    damageNumbers,
    isSimulating,
    compact = false,
    hideResearchSkills = false,
    hideHp = false,
}) => {
    const { t } = useTranslation(['guild', 'common']);
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
    
    const presets = useMemo(() => {
        const userPresets = user.equipmentPresets || [];
        return Array(5).fill(null).map((_, i) => 
            userPresets[i] || { name: t('boss.presetName', { index: i + 1 }), equipment: {} }
        );
    }, [user.equipmentPresets, t]);

    const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const presetIndex = Number(event.target.value);
        setSelectedPreset(presetIndex);
        const selectedPresetData = presets[presetIndex];
        handlers.applyPreset(selectedPresetData || { name: t('boss.presetName', { index: presetIndex + 1 }), equipment: {} });
    };

    return (
        <div
            className={`bg-panel border border-color rounded-lg flex flex-col min-h-0 ${
                hideResearchSkills ? 'shrink-0' : 'flex-1'
            } ${compact ? 'p-2 gap-0.5' : 'p-3'}`}
        >
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

            {!hideHp ? (
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
            ) : null}
            
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

            {!hideResearchSkills ? (
                <div className={`flex min-h-0 flex-1 flex-col border-t border-color ${compact ? 'mt-1 pt-1' : 'mt-2 pt-2'}`}>
                    <h4 className={`flex-shrink-0 text-center font-semibold text-secondary ${compact ? 'mb-1 text-xs' : 'mb-1 text-sm'}`}>{t('boss.researchSkillEffects')}</h4>
                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                        <GuildBossSupportSkillsPanel guild={guild} combatFx={null} compact={compact} />
                    </div>
                </div>
            ) : null}
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

const BossRecommendedStatsTip: React.FC<{ stats: CoreStat[]; compact?: boolean }> = ({ stats, compact = false }) => {
    const { t } = useTranslation(['guild', 'common']);
    return (
    <button
        type="button"
        className={
            compact
                ? 'group/tip relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-amber-400/35 bg-black/60 text-lg shadow-md outline-none transition hover:border-amber-300/50 hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-amber-400/70 active:scale-95'
                : 'group/tip relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-amber-400/35 bg-black/60 text-2xl shadow-md outline-none transition hover:border-amber-300/50 hover:bg-black/70 focus-visible:ring-2 focus-visible:ring-amber-400/70 active:scale-95 sm:h-12 sm:w-12 sm:text-3xl'
        }
        aria-label={t('boss.recommendedStatsAria', { stats: stats.join(', ') })}
    >
        <img
            src={GUILD_UI_ICONS.tip}
            alt=""
            className={compact ? 'h-4 w-4 object-contain' : 'h-6 w-6 object-contain sm:h-7 sm:w-7'}
            aria-hidden
        />
        <div
            className="pointer-events-none absolute bottom-[calc(100%+0.6rem)] left-1/2 z-[60] w-max max-w-[min(18rem,calc(100vw-3rem))] -translate-x-1/2 rounded-2xl border border-amber-500/40 bg-gray-950/95 px-3 py-2.5 text-left opacity-0 shadow-xl backdrop-blur-sm transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100 group-active/tip:opacity-100"
            role="tooltip"
        >
            <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-amber-300/90">{t('boss.recommendedStats')}</p>
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
};

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
    const { t } = useTranslation(['guild', 'common']);
    const bossDisplayName = useMemo(
        () => translateGuildBossName(boss.id, boss.name, t),
        [boss.id, boss.name, t],
    );
    const hpPercent = maxHp > 0 ? (hp / maxHp) * 100 : 0;
    /** PC 좌레일: 레일 폭에 맞추고 높이는 이미지 비율(정사각 등)로 — 남는 세로를 랭킹에 양보 */
    const desktopWidthFit = fitContentWidth && !fillAvailableHeight && !compact;
    const desktopFitFill = fitContentWidth && fillAvailableHeight && !compact;

    return (
        <div
            className={`flex flex-col ${
                compact
                    ? 'h-full min-h-0 gap-1'
                    : desktopFitFill
                      ? 'h-full min-h-0 w-full gap-2'
                      : desktopWidthFit
                        ? 'h-full max-h-full w-full max-w-full shrink-0 gap-1.5'
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
                          : desktopWidthFit
                            ? 'min-h-0 w-full max-w-full flex-1 overflow-hidden'
                            : fitContentWidth
                              ? 'w-fit max-w-full shrink-0'
                              : 'flex min-h-0 flex-1 flex-col items-center justify-center'
                }`}
            >
                <GuildBossPortrait
                    image={boss.image}
                    alt={bossDisplayName}
                    variant="hero"
                    roundedClassName="rounded-lg"
                    className={
                        compact
                            ? 'relative z-0 mx-auto h-full min-h-0 w-full max-w-full'
                            : desktopFitFill
                              ? 'relative z-0 mx-auto h-full w-fit max-w-full'
                              : desktopWidthFit
                                ? 'relative z-0 w-full max-w-full'
                                : fitContentWidth
                                  ? 'relative z-0 w-fit max-w-full shrink-0'
                                  : 'relative z-0 mx-auto flex min-h-0 w-full max-w-full flex-1 flex-col'
                    }
                    imgClassName={
                        compact
                            ? 'h-full w-auto max-w-full min-h-0'
                            : desktopFitFill
                              ? 'block h-full w-auto max-w-full'
                              : desktopWidthFit
                                ? 'block h-auto w-full max-h-full'
                                : fitContentWidth
                                  ? 'block h-auto w-auto max-h-[min(58vh,520px)]'
                                  : 'mx-auto h-full w-full max-h-[min(88vh,820px)] min-h-[min(58vh,480px)]'
                    }
                />
                <div className="pointer-events-none absolute inset-0 z-[1] rounded-lg bg-gradient-to-b from-black/55 via-transparent to-transparent"></div>
                
                <div className={`absolute left-2 right-2 z-10 flex flex-col items-stretch gap-1 ${compact ? 'top-1' : 'top-2'}`}>
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
                        {bossDisplayName} · {t('boss.stage', { stage: difficultyStage })}
                    </p>
                </div>
            </div>

            {/* 스킬·추천팁: 보스 이미지 아래 (오버레이 아님) */}
            <div
                className={`relative z-10 flex shrink-0 items-center justify-center ${
                    compact ? 'gap-1.5 px-0.5' : 'gap-2.5 sm:gap-3'
                }`}
            >
                <div
                    className={`flex max-w-full shrink-0 flex-row flex-nowrap items-center justify-center overflow-visible rounded-xl border border-white/20 bg-black/45 shadow-lg ${
                        compact ? 'gap-0.5 p-1' : 'gap-1.5 p-1.5 sm:gap-2 sm:p-2'
                    }`}
                    aria-label={t('boss.bossSkillsAria')}
                >
                    {boss.skills.map((skill) => (
                        <BossSkillTile
                            key={skill.id}
                            skill={skill}
                            className={
                                compact
                                    ? 'h-9 w-9 shrink-0'
                                    : 'h-12 w-12 shrink-0 sm:h-14 sm:w-14'
                            }
                        />
                    ))}
                </div>
                <div className={`w-px shrink-0 bg-gray-500/50 ${compact ? 'h-8' : 'h-9 sm:h-11'}`}></div>
                <BossRecommendedStatsTip stats={boss.recommendedStats} compact={compact} />
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

const getDamageRankingNickColClass = (compact: boolean) =>
    compact
        ? 'min-w-0 whitespace-nowrap border-r border-color/40 pr-2 text-left font-semibold leading-tight'
        : 'min-w-0 truncate border-r border-color/40 pr-2 text-left font-semibold leading-tight';
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
    const { t } = useTranslation(['guild', 'common']);
    const { handlers, allUsers } = useAppContext();
    /** PC 확장: 전체 랭킹 스크롤 / 그 외: Top 3 */
    const showFullRanking = !compact && !desktopTightTop3;
    const rankingRows = showFullRanking ? fullDamageRanking : fullDamageRanking.slice(0, 3);
    const amIInTop3 = myRankData ? myRankData.rank <= 3 : false;
    const myRankUser = myRankData ? allUsers?.find((u) => u.id === myRankData.userId) : undefined;

    const rowClass = compact
        ? 'h-[1.7rem] px-1 text-[11px] leading-tight'
        : desktopTightTop3
          ? 'h-[2.4rem] px-1.5 text-[15px] leading-tight'
          : 'h-[2.35rem] px-1.5 text-[15px] leading-tight';
    const rankingGridClass = getDamageRankingGridClass(compact);
    const nickColClass = getDamageRankingNickColClass(compact);

    return (
        <div
            className={`bg-panel border border-color flex min-h-0 flex-col rounded-lg ${
                compact ? 'h-full p-1.5' : desktopTightTop3 ? 'shrink-0 p-2.5' : 'h-full p-2.5'
            }`}
        >
            <h4
                className={`flex-shrink-0 text-center font-bold text-yellow-300 ${
                    compact ? 'mb-0.5 text-xs' : desktopTightTop3 ? 'mb-1.5 text-base' : 'mb-1.5 text-base'
                }`}
            >
                {compact
                    ? t('boss.damageTop3')
                    : showFullRanking
                      ? t('boss.cumulativeRank')
                      : t('boss.damageRankingTop3')}
            </h4>

            <div
                className={
                    desktopTightTop3
                        ? 'flex shrink-0 flex-col justify-center gap-1'
                        : 'min-h-0 flex-grow overflow-y-auto pr-1'
                }
            >
                {rankingRows.length > 0 ? (
                    <ul className={desktopTightTop3 ? 'flex flex-col gap-1' : 'space-y-1'}>
                        {rankingRows.map((rank, index) => {
                            const ru = allUsers?.find((u) => u.id === rank.userId);
                            const place = index + 1;
                            const isMe = myRankData?.userId === rank.userId;
                            return (
                            <li
                                key={rank.userId}
                                onClick={() => handlers.openViewingUser(rank.userId)}
                                className={`${rankingGridClass} cursor-pointer rounded-md hover:bg-secondary ${rowClass} ${
                                    isMe ? 'bg-blue-900/40' : 'bg-tertiary/50'
                                }`}
                            >
                                <div className={DAMAGE_RANKING_RANK_COL_CLASS}>
                                    {place <= 3 ? (
                                        <GuildBossTopRankBadge place={place as 1 | 2 | 3} compact={compact} />
                                    ) : (
                                        <span
                                            className={`inline-flex shrink-0 items-center justify-center rounded-full bg-tertiary font-bold tabular-nums text-secondary ${
                                                compact ? 'h-5 w-5 text-[10px]' : 'h-8 w-8 text-sm'
                                            }`}
                                        >
                                            {place}
                                        </span>
                                    )}
                                </div>
                                <UserNicknameText
                                    user={{
                                        nickname: rank.nickname,
                                        isAdmin: ru?.isAdmin,
                                        staffNicknameDisplayEligibility: ru?.staffNicknameDisplayEligibility,
                                    }}
                                    className={nickColClass}
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
                        {t('boss.noRecords')}
                    </div>
                )}
            </div>
            {myRankData && !amIInTop3 && !showFullRanking && (
                <div className={`border-t border-color/50 flex-shrink-0 ${compact ? 'mt-0.5 pt-0.5' : 'mt-2 pt-2'}`}>
                    <div className={`${rankingGridClass} rounded-md bg-blue-900/40 ${compact ? 'p-1 text-[11px]' : 'p-1.5 text-xs'}`}>
                        <span
                            className={`${DAMAGE_RANKING_RANK_COL_CLASS} font-bold tabular-nums ${
                                compact ? 'h-5 w-5 text-[10px]' : 'h-8 w-8 text-sm'
                            }`}
                        >
                            {myRankData.rank}
                        </span>
                        <span className={`${nickColClass} inline-flex min-w-0 items-center gap-1`}>
                            <UserNicknameText
                                user={{
                                    nickname: myRankData.nickname,
                                    isAdmin: myRankUser?.isAdmin,
                                    staffNicknameDisplayEligibility: myRankUser?.staffNicknameDisplayEligibility,
                                }}
                                className={compact ? 'min-w-0 whitespace-nowrap' : 'min-w-0 truncate'}
                            />
                            <span className="shrink-0">{t('boss.me')}</span>
                        </span>
                        <span className={DAMAGE_RANKING_DMG_COL_CLASS}>
                            {myRankData.damage.toLocaleString()}
                        </span>
                    </div>
                </div>
            )}
            <div className={`flex-shrink-0 border-t border-color/50 ${compact ? 'mt-0.5 pt-0.5' : 'mt-2 pt-2'}`}>
                <p className={`${rankingGridClass} ${compact ? 'text-[11px]' : 'text-sm'}`}>
                    <span aria-hidden />
                    <span className={`${nickColClass} text-secondary`}>
                        {compact ? t('boss.battleDamage') : t('boss.battleDamageFull')}
                    </span>
                    <span className={`${DAMAGE_RANKING_DMG_COL_CLASS} font-bold text-yellow-300`}>
                        {myCurrentBattleDamage.toLocaleString()}
                    </span>
                </p>
            </div>
        </div>
    );
};

const GuildBoss: React.FC = () => {
    const { t } = useTranslation(['guild', 'common']);
    const { currentUserWithStatus, guilds, handlers } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();

    const [isSimulating, setIsSimulating] = useState(false);
    const [mobileTab, setMobileTab] = useState<'info' | 'battle'>('info');
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
    const [battleResult, setBattleResult] = useState<GuildBossBattleModalResult | null>(null);
    const [previousRank, setPreviousRank] = useState<number | null>(null);
    /** 전투 재생 중 Top3에 서버 선반영 누적 피해가 보이지 않도록 전투 시작 시점 스냅샷 */
    const [battleDisplayDamageLog, setBattleDisplayDamageLog] = useState<Record<string, number> | null>(null);
    const [combatFx, setCombatFx] = useState<GuildBossCombatFxState | null>(null);
    const [showOpeningHpBuff, setShowOpeningHpBuff] = useState(false);
    const [presentationPhase, setPresentationPhase] = useState<GuildBossPresentationPhase>('idle');
    const [engageComplete, setEngageComplete] = useState(false);
    const [combatBoardMoveCount, setCombatBoardMoveCount] = useState(0);
    const engageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // 입장 시(공격 전) 표시할 유저 최대 체력 — 시뮬레이터와 동일한 식
    const initialMaxUserHp = useMemo(() => {
        if (!currentUserWithStatus || !myGuild) return 0;
        const totalStats = calculateTotalStats(currentUserWithStatus, myGuild, 'guildBoss');
        return computeGuildBossUserMaxHp(totalStats, myGuild);
    }, [currentUserWithStatus, myGuild]);

    // 공격 전에도 유저 체력 표시: 입장 시 초기 HP 설정
    useEffect(() => {
        if (isSimulating || !currentUserWithStatus || !myGuild || initialMaxUserHp <= 0) return;
        if (maxUserHp === 0 && userHp === 0) {
            setMaxUserHp(initialMaxUserHp);
            setUserHp(initialMaxUserHp);
        }
    }, [initialMaxUserHp, isSimulating, currentUserWithStatus, myGuild, maxUserHp, userHp]);

    useEffect(() => {
        if (!myGuild || isSimulating) return;
        const hpResearch = myGuild.research?.[GuildResearchId.boss_hp_increase]?.level || 0;
        if (hpResearch <= 0) return;
        setShowOpeningHpBuff(true);
        const timer = setTimeout(() => setShowOpeningHpBuff(false), GUILD_BOSS_OPENING_HP_BUFF_MS);
        return () => clearTimeout(timer);
    }, [myGuild?.id, currentBoss.id, isSimulating]);

    useEffect(() => {
        if (userLogContainerRef.current) {
            userLogContainerRef.current.scrollTop = userLogContainerRef.current.scrollHeight;
        }
        if (bossLogContainerRef.current) {
            bossLogContainerRef.current.scrollTop = bossLogContainerRef.current.scrollHeight;
        }
    }, [battleLog]);
    
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
        setPresentationPhase('result');
        setBattleResult(modalResult);
        setShowResultModal(true);
        clearPendingGuildBossBattle();
        battleSubmitContextRef.current = null;
        battleStartedAtRef.current = null;
        confirmedBattleResultRef.current = null;
        setBattleDisplayDamageLog(null);
        setIsSimulating(false);
        setSimulationResult(null);
        setActiveDebuffs({});
        setCombatFx(null);
        setEngageComplete(false);
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
        setMobileTab('battle');
        setPresentationPhase('engage');
        setEngageComplete(false);
        setCombatBoardMoveCount(0);
        setIsSimulating(true);
        setBattleLog([]);
        setLogIndex(0);
        setDamageNumbers([]);
        setBossDamageNumbers([]);
        setCurrentBattleDamage(0);
        currentBattleDamageRef.current = 0;
        setActiveDebuffs({});
        setCombatFx(null);
        setShowOpeningHpBuff(false);
        if (engageTimerRef.current) clearTimeout(engageTimerRef.current);
        engageTimerRef.current = setTimeout(() => {
            engageTimerRef.current = null;
            setEngageComplete(true);
        }, GUILD_BOSS_ENGAGE_MS);
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
            bossName: translateGuildBossName(currentBoss.id, currentBoss.name, t),
            guildId,
        };

        const totalDamageLog = myGuild.guildBossState?.totalDamageLog || {};
        setBattleDisplayDamageLog({ ...totalDamageLog });
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
                throw new Error(t('boss.serverReplayFailed'));
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
                bossName: translateGuildBossName(currentBoss.id, currentBoss.name, t),
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
            setBattleDisplayDamageLog(null);
            setIsSimulating(false);
            setPresentationPhase('idle');
            setEngageComplete(false);
            setCombatBoardMoveCount(0);
            if (engageTimerRef.current) {
                clearTimeout(engageTimerRef.current);
                engageTimerRef.current = null;
            }
            simulationInFlight.current = false;
        }
    }, [currentUserWithStatus, myGuild, scaledBoss, currentBoss, persistPendingBattle, t]);

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
        setMobileTab('battle');
        setIsSimulating(true);
        setPresentationPhase('combat');
        setEngageComplete(true);
        setCombatBoardMoveCount(pending.logIndex);

        const rankUserId = pending.submitContext.rankUserId;
        const damageDealt =
            pending.confirmedBattleResult?.damageDealt ?? pending.simulationResult.damageDealt ?? 0;
        const currentLog = myGuild.guildBossState?.totalDamageLog || {};
        const frozenLog: Record<string, number> = { ...currentLog };
        if (rankUserId && damageDealt > 0) {
            frozenLog[rankUserId] = Math.max(0, (frozenLog[rankUserId] || 0) - damageDealt);
        }
        setBattleDisplayDamageLog(frozenLog);

        const playbackFinished = pending.logIndex >= pending.simulationResult.battleLog.length;
        if (playbackFinished && pending.confirmedBattleResult) {
            finishBattlePlaybackRef.current(pending.confirmedBattleResult);
        }
    }, [currentUserWithStatus?.id, myGuild?.id, currentBoss.id]);

    // Engage intro gate: wait for engage timer + server simulation before combat playback
    useEffect(() => {
        if (!isSimulating || presentationPhase !== 'engage') return;
        if (!engageComplete || !simulationResult) return;
        // Keep engage stones on the board; combat logs continue placing from here
        setCombatBoardMoveCount((prev) => Math.max(prev, GUILD_BOSS_ENGAGE_STONE_COUNT));
        setPresentationPhase('combat');
    }, [isSimulating, presentationPhase, engageComplete, simulationResult]);

    useEffect(() => {
        if (!isSimulating || !simulationResult) return;
        if (presentationPhase !== 'combat' && presentationPhase !== 'finale') return;

        if (logIndex >= simulationResult.battleLog.length) {
            if (presentationPhase === 'combat') {
                setPresentationPhase('finale');
                return;
            }
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
            }, GUILD_BOSS_FINALE_MS);
            return () => clearTimeout(timer);
        }

        if (presentationPhase !== 'combat') return;

        const HIT_DELAY_MS = 350;
        let hitTimer: ReturnType<typeof setTimeout> | undefined;
        const stepTimer = setTimeout(() => {
            const newEntry = simulationResult.battleLog[logIndex];
            let nextUserHp = userHpRef.current;
            let nextBossHp = simulatedBossHpRef.current;
            let nextBattleDamage = currentBattleDamageRef.current;
            const resolved = resolveGuildBossCombatFx(newEntry, currentBoss.id);
            setCombatFx({
                ...resolved,
                fxKey: Date.now() + Math.random(),
                missProjectile: resolved.fxKind === 'dodge',
            });
            // Each combat log places one more stone (continues after engage intro)
            setCombatBoardMoveCount((prev) => prev + 1);

            if (logIndex > 0 && simulationResult.battleLog[logIndex - 1].turn !== newEntry.turn) {
                setActiveDebuffs((prev) => {
                    const nextDebuffs: Record<string, { value: number; turns: number }> = {};
                    for (const key in prev) {
                        if (prev[key].turns > 1) {
                            nextDebuffs[key] = { ...prev[key], turns: prev[key].turns - 1 };
                        }
                    }
                    return nextDebuffs;
                });
            }

            hitTimer = setTimeout(() => {
                setBattleLog((prev) => [...prev, newEntry]);

                if (newEntry.damageTaken !== undefined) {
                    nextUserHp = Math.max(0, nextUserHp - (newEntry.damageTaken || 0));
                    setUserHp(nextUserHp);
                    if (newEntry.damageTaken > 0) {
                        setDamageNumbers((prev) => [
                            ...prev.slice(-5),
                            {
                                id: Date.now() + Math.random(),
                                text: `-${newEntry.damageTaken}`,
                                color: resolved.fxKind === 'dodge' ? 'text-amber-200' : 'text-red-400',
                            },
                        ]);
                    }
                }
                if (newEntry.healingDone !== undefined) {
                    nextUserHp = Math.min(maxUserHp, nextUserHp + (newEntry.healingDone || 0));
                    setUserHp(nextUserHp);
                    setDamageNumbers((prev) => [
                        ...prev.slice(-5),
                        { id: Date.now() + Math.random(), text: `+${newEntry.healingDone}`, color: 'text-green-400' },
                    ]);
                }

                if (newEntry.debuffsApplied && Array.isArray(newEntry.debuffsApplied)) {
                    setActiveDebuffs((prev) => {
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
                    if (damageMatch?.[1]) {
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
                        setBossDamageNumbers((prev) => [
                            ...prev.slice(-9),
                            {
                                id: Date.now() + Math.random(),
                                text: `-${value.toLocaleString()}`,
                                color: newEntry.isCrit ? 'text-yellow-300' : 'text-red-400',
                                isHeal: false,
                                isCrit: newEntry.isCrit,
                            },
                        ]);
                    } else {
                        nextBossHp = Math.min(simulationResult.bossMaxHp, nextBossHp + value);
                        setSimulatedBossHp(nextBossHp);
                        setBossDamageNumbers((prev) => [
                            ...prev.slice(-9),
                            {
                                id: Date.now() + Math.random(),
                                text: `+${value.toLocaleString()}`,
                                color: 'text-green-400',
                                isHeal: true,
                                isCrit: false,
                            },
                        ]);
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
            }, HIT_DELAY_MS);
        }, Math.max(0, GUILD_BOSS_LOG_PLAYBACK_MS - HIT_DELAY_MS));

        return () => {
            clearTimeout(stepTimer);
            if (hitTimer) clearTimeout(hitTimer);
        };
    }, [
        isSimulating,
        simulationResult,
        logIndex,
        maxUserHp,
        persistPendingBattle,
        currentBoss.id,
        presentationPhase,
    ]);

    const { fullDamageRanking, myRankData } = useMemo(() => {
        const liveDamageLog = myGuild?.guildBossState?.totalDamageLog;
        const damageLog =
            isSimulating && battleDisplayDamageLog
                ? battleDisplayDamageLog
                : (liveDamageLog || {});

        if (!myGuild || Object.keys(damageLog).length === 0) {
            return { fullDamageRanking: [], myRankData: null };
        }

        const fullRanking = Object.entries(damageLog)
            .map(([userId, damage]: [string, any]) => {
                let member = myGuild.members?.find((m: GuildMember) => m.userId === userId);
                if (!member && userId === ADMIN_USER_ID) {
                    member = myGuild.members?.find((m: GuildMember) => m.nickname === ADMIN_NICKNAME);
                }
                const nickname = member?.nickname || (userId === ADMIN_USER_ID ? ADMIN_NICKNAME : t('war.unknownUser'));
                return { userId, nickname, damage: typeof damage === 'number' ? damage : 0 };
            })
            .sort((a, b) => b.damage - a.damage);
            
        const myRankIndex = fullRanking.findIndex(r => r.userId === currentUserWithStatus?.id);
        const myData = myRankIndex !== -1 ? { ...fullRanking[myRankIndex], rank: myRankIndex + 1 } : null;

        return { fullDamageRanking: fullRanking, myRankData: myData };
    }, [
        myGuild,
        myGuild?.guildBossState?.totalDamageLog,
        myGuild?.members,
        currentUserWithStatus?.id,
        isSimulating,
        battleDisplayDamageLog,
    ]);
    
    if (!currentUserWithStatus || !myGuild) {
        return <div className="p-4">{t('loading.guildInfo')}</div>;
    }

    const todayKST = getTodayKSTDateString();
    const usedToday = currentUserWithStatus.guildBossLastAttemptDayKST === todayKST ? (currentUserWithStatus.guildBossAttemptsUsedToday ?? 0) : 0;
    const attemptsLeft = GUILD_BOSS_MAX_ATTEMPTS - usedToday;
    
    const challengeButton = (
        <div
            className={`flex-shrink-0 rounded-lg border border-amber-400/30 bg-gradient-to-t from-[#060508] via-[#0f0d14] to-[#16131f] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] ${
                !isSimulating && attemptsLeft > 0 ? 'guild-boss-challenge-idle' : ''
            }`}
        >
            <Button
                bare
                colorScheme="none"
                onClick={handleBattleStart}
                disabled={attemptsLeft <= 0 || isSimulating}
                className={`flex w-full items-center justify-center gap-1.5 ${
                    isNativeMobile
                        ? `${LOBBY_MOBILE_BTN_PRIMARY_CLASS} !min-h-[2.75rem] !text-[13px] !font-bold`
                        : PRE_GAME_MODAL_PRIMARY_BTN_CLASS
                }`}
            >
                {!isSimulating && (
                    <img src="/images/guild/ticket.webp" alt={t('boss.challengeTicketAlt')} className="h-4 w-4 shrink-0 opacity-95" />
                )}
                <span>
                    {isSimulating
                        ? t('boss.simulating')
                        : t('boss.challenge', { left: attemptsLeft, max: GUILD_BOSS_MAX_ATTEMPTS })}
                </span>
            </Button>
        </div>
    );

    const supportSkillsPanel = (
        <GuildBossSupportSkillsPanel
            guild={myGuild}
            combatFx={combatFx}
            showOpeningHpBuff={showOpeningHpBuff}
            engageWave={presentationPhase === 'engage'}
            compact={isNativeMobile}
        />
    );

    const battleArena = (
        <GuildBossBattleArena
            boss={currentBoss}
            bossHp={simulatedBossHp}
            bossMaxHp={scaledBoss.maxHp}
            difficultyStage={bossDifficultyStage}
            bossDamageNumbers={bossDamageNumbers}
            user={currentUserWithStatus}
            guild={myGuild}
            userHp={userHp}
            userMaxHp={maxUserHp}
            userDamageNumbers={damageNumbers}
            battleLog={battleLog}
            combatFx={combatFx}
            showOpeningHpBuff={showOpeningHpBuff}
            currentBattleDamage={currentBattleDamage}
            presentationPhase={presentationPhase}
            combatBoardMoveCount={combatBoardMoveCount}
            compact={isNativeMobile}
            userLogContainerRef={userLogContainerRef}
            bossLogContainerRef={bossLogContainerRef}
        />
    );

    const desktopLeftColumn = (
        <div className={`flex h-full min-h-0 ${PC_HOME_LEFT_COLUMN_CLASS} flex-col gap-2 overflow-hidden`}>
            <div className="flex shrink-0 items-center gap-2">
                <BackButton onClick={() => { window.location.hash = '#/guild'; }} />
                <h1 className="truncate text-xl font-bold text-white" style={{ textShadow: '2px 2px 5px black' }}>
                    {t('boss.title')}
                </h1>
            </div>
            <div className="shrink-0">
                <UserStatsPanel
                    user={currentUserWithStatus}
                    guild={myGuild}
                    hp={userHp}
                    maxHp={maxUserHp}
                    damageNumbers={damageNumbers}
                    isSimulating={isSimulating}
                    hideResearchSkills
                    hideHp
                />
            </div>
            <div className="shrink-0">{supportSkillsPanel}</div>
            <div className="min-h-0 flex-1 overflow-hidden">
                <DamageRankingPanel
                    fullDamageRanking={fullDamageRanking}
                    myRankData={myRankData}
                    myCurrentBattleDamage={currentBattleDamage}
                />
            </div>
            {challengeButton}
        </div>
    );

    return (
        <div
            style={backgroundStyle}
            className={`relative mx-auto flex h-full w-full flex-col ${
                isNativeMobile ? 'p-2 pb-1' : PC_LOBBY_DESKTOP_SHELL_PADDING_CLASS
            }`}
        >
            {isNativeMobile ? (
                <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden pb-[max(0.25rem,env(safe-area-inset-bottom,0px))]">
                    <header className="relative flex h-9 shrink-0 items-center justify-center">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2">
                            <BackButton onClick={() => { window.location.hash = '#/guild'; }} />
                        </div>
                        <h1 className="text-base font-bold text-white" style={{ textShadow: '2px 2px 5px black' }}>
                            {t('boss.title')}
                        </h1>
                    </header>
                    <div className="flex shrink-0 rounded-lg bg-gray-900/70 p-1">
                        {([
                            { id: 'info' as const, label: t('boss.tabInfo') },
                            { id: 'battle' as const, label: t('boss.tabBattle') },
                        ]).map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setMobileTab(tab.id)}
                                className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold transition-all ${
                                    mobileTab === tab.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700/50'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative min-h-0 flex-1 overflow-hidden">
                        <div
                            className={`flex h-full min-h-0 flex-col gap-1.5 overflow-hidden ${
                                mobileTab === 'info' ? '' : 'invisible pointer-events-none absolute inset-0'
                            }`}
                            aria-hidden={mobileTab !== 'info'}
                        >
                            <div className="shrink-0">
                                <UserStatsPanel
                                    user={currentUserWithStatus}
                                    guild={myGuild}
                                    hp={userHp}
                                    maxHp={maxUserHp}
                                    damageNumbers={damageNumbers}
                                    isSimulating={isSimulating}
                                    compact
                                    hideResearchSkills
                                    hideHp
                                />
                            </div>
                            <div className="shrink-0">
                                <GuildBossSupportSkillsPanel
                                    guild={myGuild}
                                    combatFx={combatFx}
                                    showOpeningHpBuff={showOpeningHpBuff}
                                    engageWave={presentationPhase === 'engage'}
                                    compact
                                />
                            </div>
                            <div className="min-h-0 flex-1 overflow-hidden">
                                <DamageRankingPanel
                                    fullDamageRanking={fullDamageRanking}
                                    myRankData={myRankData}
                                    myCurrentBattleDamage={currentBattleDamage}
                                />
                            </div>
                        </div>
                        <div
                            className={`h-full min-h-0 overflow-hidden ${
                                mobileTab === 'battle' ? '' : 'invisible pointer-events-none absolute inset-0'
                            }`}
                            aria-hidden={mobileTab !== 'battle'}
                        >
                            {battleArena}
                        </div>
                    </div>
                    <div className="shrink-0 border-t border-white/5 pt-1">{challengeButton}</div>
                </main>
            ) : (
                <PcLobbyThreeColumnShell
                    left={desktopLeftColumn}
                    center={battleArena}
                    centerTransparentShell
                    centerFullWidth
                />
            )}
            {showResultModal && battleResult && (
                <GuildBossBattleResultModal
                    result={battleResult}
                    onClose={() => {
                        setShowResultModal(false);
                        setBattleResult(null);
                        setPresentationPhase('idle');
                        setCombatBoardMoveCount(0);
                        void handlers.handleAction({ type: 'GET_GUILD_INFO' });
                    }}
                    isTopmost={true}
                />
            )}
        </div>
    );
};

export default GuildBoss;
