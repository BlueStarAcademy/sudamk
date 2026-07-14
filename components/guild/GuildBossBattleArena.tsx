import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Guild, GuildBossInfo, UserWithStatus, BattleLogEntry, CoreStat } from '../../types/index.js';
import { GuildResearchId } from '../../types/enums.js';
import { GUILD_RESEARCH_PROJECTS, AVATAR_POOL, BORDER_POOL } from '../../constants/index.js';
import { GUILD_ATTACK_ICON } from '../../assets.js';
import { calculateTotalStats } from '../../utils/statUtils.js';
import {
    computeGuildBossUserBaseTurnDamage,
    computeGuildBossResearchDamagePercent,
    computeGuildBossResearchEvasionPercent,
    computeGuildBossResearchHitDamageReductionPercent,
} from '../../shared/constants/guildBossBalance.js';
import { GUILD_BOSS_ATTACK_RESEARCH_IDS, type GuildBossPresentationPhase } from '../../utils/guildBossBattleBoards.js';
import type { GuildBossCombatFxState } from '../../utils/guildBossBattleFx.js';
import GuildBossPortrait from './GuildBossPortrait.js';
import GuildBossBattleBoard from './GuildBossBattleBoard.js';
import Avatar from '../Avatar.js';
import UserNicknameText from '../UserNicknameText.js';
import { translateGuildBossName } from '../../shared/utils/translateGuildBossName.js';
import type { TFunction } from 'i18next';
import { GUILD_UI_ICONS } from '../../shared/constants/guildUiIcons.js';

export type { GuildBossCombatFxState };

export const getBossResearchEffectDisplay = (
    researchId: GuildResearchId,
    level: number,
    t: TFunction,
): { chance?: number; description: string } | null => {
    if (level <= 0) return null;
    const project = GUILD_RESEARCH_PROJECTS[researchId];
    if (!project) return null;
    const totalEffect = project.baseEffect * level;
    switch (researchId) {
        case GuildResearchId.boss_hp_increase:
            return { description: t('research.bossHpIncrease', { value: totalEffect }) };
        case GuildResearchId.boss_damage_increase:
            return { description: t('research.bossDamageIncrease', { value: computeGuildBossResearchDamagePercent(level) }) };
        case GuildResearchId.boss_attack_evasion:
            return {
                chance: computeGuildBossResearchEvasionPercent(level),
                description: t('boss.researchAttackEvasionDesc'),
            };
        case GuildResearchId.boss_hit_damage_reduction:
            return {
                description: t('boss.researchHitDamageReductionDesc', {
                    value: computeGuildBossResearchHitDamageReductionPercent(level),
                }),
            };
        case GuildResearchId.boss_skill_heal_block:
            return {
                chance: 10 + 15 * level,
                description: t('boss.researchHealBlockDesc', { reduction: 10 * level }),
            };
        case GuildResearchId.boss_skill_regen:
            return {
                chance: 10 + 15 * level,
                description: t('boss.researchRegenDesc', { increase: 10 * level }),
            };
        case GuildResearchId.boss_skill_ignite:
            return {
                chance: 10 + 15 * level,
                description: t('boss.researchIgniteDesc', { damage: level * 10 }),
            };
        default:
            return { description: project.description };
    }
};

type FloatNum = { id: number; text: string; color: string; isHeal?: boolean; isCrit?: boolean };

type BossSkillTileProps = {
    skill: GuildBossInfo['skills'][number];
    compact?: boolean;
    proc?: boolean;
};

export type ResearchSkillTileProps = {
    name: string;
    description: string;
    image: string;
    level: number;
    effect: { chance?: number; description: string } | null;
    proc?: boolean;
    compact?: boolean;
    /** 모바일 dense bar용 더 작은 아이콘 */
    dense?: boolean;
    inactiveLabel: string;
};

export const ResearchSkillTile: React.FC<ResearchSkillTileProps> = ({
    name,
    description,
    image,
    level,
    effect,
    proc = false,
    compact = false,
    dense = false,
    inactiveLabel,
}) => {
    const [tipOpen, setTipOpen] = useState(false);
    const active = level > 0;
    const iconClass = dense ? 'h-6 w-6 object-contain' : compact ? 'h-7 w-7 object-contain' : 'h-9 w-9 object-contain';

    return (
        <button
            type="button"
            className={`group/research relative shrink-0 rounded-md border border-white/15 bg-black/40 outline-none ${
                !active ? 'opacity-45' : ''
            } ${proc ? 'guild-boss-research-icon-proc' : ''} ${dense ? 'p-0.5' : compact ? 'p-0.5' : 'p-1'}`}
            onMouseEnter={() => setTipOpen(true)}
            onMouseLeave={() => setTipOpen(false)}
            onFocus={() => setTipOpen(true)}
            onBlur={() => setTipOpen(false)}
            aria-label={`${name}${active ? ` Lv.${level}` : ''}`}
        >
            <img src={image} alt="" className={iconClass} />
            {tipOpen ? (
                <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-[70] w-52 -translate-x-1/2 rounded-xl border border-amber-400/35 bg-gray-950/95 p-2.5 text-left shadow-xl backdrop-blur-sm"
                >
                    <p className="text-xs font-bold text-amber-200">
                        {name}
                        {active ? (
                            <span className="ml-1 font-mono text-[10px] text-amber-100/80">Lv.{level}</span>
                        ) : null}
                    </p>
                    <p className="mt-1 text-[10px] leading-snug text-zinc-300">{description}</p>
                    <p className={`mt-1.5 text-[11px] font-semibold leading-snug ${active ? 'text-yellow-300' : 'text-zinc-500'}`}>
                        {effect
                            ? `${effect.chance !== undefined ? `[${effect.chance}%] ` : ''}${effect.description}`
                            : inactiveLabel}
                    </p>
                </div>
            ) : null}
        </button>
    );
};

const BossSkillTile: React.FC<BossSkillTileProps> = ({ skill, compact = false, proc = false }) => {
    const [touchTipOpen, setTouchTipOpen] = useState(false);
    return (
        <button
            type="button"
            className={`relative shrink-0 rounded-lg border border-white/25 bg-black/40 ${compact ? 'p-0.5' : 'p-1'} ${
                proc ? 'guild-boss-research-icon-proc' : ''
            }`}
            onMouseEnter={() => setTouchTipOpen(true)}
            onMouseLeave={() => setTouchTipOpen(false)}
            onClick={() => setTouchTipOpen((v) => !v)}
            aria-label={skill.name}
        >
            <img src={skill.image} alt={skill.name} className={compact ? 'h-6 w-6 object-contain' : 'h-10 w-10 object-contain'} />
            {touchTipOpen ? (
                <div className="absolute bottom-full left-1/2 z-50 mb-1 w-44 -translate-x-1/2 rounded-md border border-white/20 bg-black/90 p-2 text-left text-[10px] text-white shadow-lg">
                    <p className="font-bold text-amber-200">{skill.name}</p>
                    <p className="mt-0.5 leading-snug text-zinc-200">{skill.description}</p>
                </div>
            ) : null}
        </button>
    );
};

const BossRecommendedStatsTip: React.FC<{ stats: CoreStat[]; compact?: boolean; t: TFunction }> = ({ stats, compact, t }) => {
    return (
        <button
            type="button"
            className={
                compact
                    ? 'group/tip relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border border-amber-400/35 bg-black/60 text-sm shadow-md'
                    : 'group/tip relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-amber-400/35 bg-black/60 text-xl shadow-md'
            }
            aria-label={t('boss.recommendedStatsAria', { stats: stats.join(', ') })}
        >
            <img
                src={GUILD_UI_ICONS.tip}
                alt=""
                className={compact ? 'h-3.5 w-3.5 object-contain' : 'h-5 w-5 object-contain'}
                aria-hidden
            />
            <div className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-[60] w-max max-w-[14rem] -translate-x-1/2 rounded-xl border border-amber-500/40 bg-gray-950/95 px-2.5 py-2 text-left opacity-0 shadow-xl transition-opacity group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100">
                <p className="mb-1 text-center text-[10px] font-bold text-amber-300/90">{t('boss.recommendedStats')}</p>
                <div className="flex flex-wrap justify-center gap-1 text-[10px] font-semibold text-white">
                    {stats.map((stat) => (
                        <span key={stat}>{stat}</span>
                    ))}
                </div>
            </div>
        </button>
    );
};

export type GuildBossBattleArenaProps = {
    boss: GuildBossInfo;
    bossHp: number;
    bossMaxHp: number;
    difficultyStage: number;
    bossDamageNumbers: FloatNum[];
    user: UserWithStatus;
    guild: Guild;
    userHp: number;
    userMaxHp: number;
    userDamageNumbers: FloatNum[];
    battleLog: BattleLogEntry[];
    combatFx: GuildBossCombatFxState | null;
    showOpeningHpBuff: boolean;
    currentBattleDamage: number;
    presentationPhase: GuildBossPresentationPhase;
    combatBoardMoveCount: number;
    compact?: boolean;
    userLogContainerRef: React.RefObject<HTMLDivElement | null> | React.MutableRefObject<HTMLDivElement | null>;
    bossLogContainerRef: React.RefObject<HTMLDivElement | null> | React.MutableRefObject<HTMLDivElement | null>;
};

const GuildBossBattleArena: React.FC<GuildBossBattleArenaProps> = ({
    boss,
    bossHp,
    bossMaxHp,
    difficultyStage,
    bossDamageNumbers,
    user,
    guild,
    userHp,
    userMaxHp,
    userDamageNumbers,
    battleLog,
    combatFx,
    showOpeningHpBuff,
    currentBattleDamage,
    presentationPhase,
    combatBoardMoveCount,
    compact = false,
    userLogContainerRef,
    bossLogContainerRef,
}) => {
    const { t } = useTranslation(['guild', 'common']);
    const bossDisplayName = translateGuildBossName(boss.id, boss.name, t);
    const totalStats = useMemo(() => calculateTotalStats(user, guild, 'guildBoss'), [user, guild]);
    const baseAtk = useMemo(
        () => Math.floor(computeGuildBossUserBaseTurnDamage(totalStats)),
        [totalStats],
    );
    const userLogs = useMemo(() => battleLog.filter((e) => e.isUserAction), [battleLog]);
    const bossLogs = useMemo(() => battleLog.filter((e) => !e.isUserAction), [battleLog]);
    const avatarUrl = useMemo(() => AVATAR_POOL.find((a) => a.id === user.avatarId)?.url, [user.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find((b) => b.id === user.borderId)?.url, [user.borderId]);

    const attackResearchProjects = useMemo(() => {
        return GUILD_BOSS_ATTACK_RESEARCH_IDS.map((id) => {
            const project = GUILD_RESEARCH_PROJECTS[id];
            const currentLevel = guild.research?.[id]?.level || 0;
            return { ...project, id, currentLevel };
        });
    }, [guild]);

    const bossHpPercent = bossMaxHp > 0 ? (bossHp / bossMaxHp) * 100 : 0;
    const userHpPercent = userMaxHp > 0 ? (userHp / userMaxHp) * 100 : 0;
    const engageWave = presentationPhase === 'engage';

    const bossActorClass = [
        presentationPhase === 'idle' ? 'guild-boss-actor-enter' : '',
        combatFx?.attacker === 'boss' ? 'guild-boss-actor-lunge-left' : '',
        combatFx?.fxKind === 'dodge' ? 'guild-boss-actor-dodge' : '',
        combatFx?.targetHit === 'boss' && combatFx.fxKind !== 'heal' && combatFx.fxKind !== 'research_regen'
            ? combatFx.isCrit
                ? 'guild-boss-actor-shake'
                : 'guild-boss-actor-shake-soft'
            : '',
    ]
        .filter(Boolean)
        .join(' ');

    const userActorClass = [
        presentationPhase === 'idle' ? 'guild-boss-actor-enter' : '',
        combatFx?.attacker === 'user' && combatFx.fxKind !== 'extra_turn' ? 'guild-boss-actor-lunge-right' : '',
        combatFx?.fxKind === 'dodge' ? 'guild-boss-actor-dodge' : '',
        combatFx?.targetHit === 'user' &&
        combatFx.fxKind !== 'dodge' &&
        combatFx.fxKind !== 'heal' &&
        combatFx.fxKind !== 'research_regen'
            ? combatFx.secondaryFxKind === 'guard_partial'
                ? 'guild-boss-actor-shake-soft'
                : 'guild-boss-actor-shake'
            : '',
    ]
        .filter(Boolean)
        .join(' ');

    const attackSkillStrip = (
        <div
            className={`relative z-10 flex max-w-full shrink-0 flex-row flex-nowrap items-center justify-center gap-1 overflow-x-auto rounded-xl border border-white/20 bg-black/45 p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                engageWave ? 'guild-boss-skill-strip--engage' : ''
            }`}
        >
            <div
                className={`group/atk relative flex shrink-0 flex-col items-center rounded-md border border-amber-400/40 bg-black/50 ${
                    combatFx?.fxKind === 'slash' || combatFx?.researchId === 'boss_damage_increase'
                        ? 'guild-boss-research-icon-proc'
                        : ''
                } ${compact ? 'px-1 py-0.5' : 'px-1.5 py-1'}`}
            >
                <img src={GUILD_ATTACK_ICON} alt={t('boss.normalAttack')} className={compact ? 'h-6 w-6' : 'h-9 w-9'} />
                <span className={`font-mono font-bold text-amber-200 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
                    {t('boss.normalAttackAtk', { value: baseAtk.toLocaleString() })}
                </span>
                <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-[calc(100%+0.45rem)] left-1/2 z-[70] w-44 -translate-x-1/2 rounded-xl border border-amber-400/35 bg-gray-950/95 p-2.5 text-left opacity-0 shadow-xl transition-opacity group-hover/atk:opacity-100 group-focus-within/atk:opacity-100"
                >
                    <p className="text-xs font-bold text-amber-200">{t('boss.normalAttack')}</p>
                    <p className="mt-1 text-[10px] leading-snug text-zinc-300">{t('boss.normalAttackTip')}</p>
                </div>
            </div>
            {attackResearchProjects.map((project) => {
                const effect = getBossResearchEffectDisplay(project.id, project.currentLevel, t);
                const proc = combatFx?.researchId === project.id;
                return (
                    <ResearchSkillTile
                        key={project.id}
                        name={project.name}
                        description={project.description}
                        image={project.image}
                        level={project.currentLevel}
                        effect={effect}
                        proc={proc}
                        compact={compact}
                        dense={compact}
                        inactiveLabel={t('boss.inactive')}
                    />
                );
            })}
        </div>
    );

    const bossSkillStrip = (
        <div
            className={`relative z-10 flex shrink-0 items-center justify-center gap-1 ${
                engageWave ? 'guild-boss-skill-strip--engage' : ''
            }`}
        >
            <div className="flex flex-row items-center gap-1 rounded-xl border border-white/20 bg-black/45 p-1">
                {boss.skills.map((skill) => (
                    <BossSkillTile key={skill.id} skill={skill} compact={compact} />
                ))}
            </div>
            <BossRecommendedStatsTip stats={boss.recommendedStats || []} compact={compact} t={t} />
        </div>
    );

    const combatLogs = (
        <div
            className={`flex min-h-0 flex-row overflow-hidden rounded-lg border border-color bg-panel/90 ${
                compact ? 'min-h-[5.25rem] flex-[0.72] gap-1 p-1' : 'flex-1 gap-2 p-2'
            }`}
        >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-sky-500/25 bg-tertiary/40">
                <h3
                    className={`flex-shrink-0 border-b border-sky-400/20 text-center font-bold text-sky-300 ${
                        compact ? 'px-1 py-0.5 text-[10px]' : 'px-2 py-1 text-sm'
                    }`}
                >
                    {t('boss.myAttack')}
                </h3>
                <div
                    ref={userLogContainerRef as React.Ref<HTMLDivElement>}
                    className={`min-h-0 flex-1 space-y-1 overflow-y-auto ${compact ? 'p-1 text-[10px]' : 'p-1.5 text-xs'}`}
                >
                    {userLogs.map((entry, index) => (
                        <div
                            key={`u-${entry.turn}-${index}-${entry.message.slice(0, 20)}`}
                            className="guild-boss-log-row flex items-start gap-1.5 text-sky-100"
                        >
                            <span className="shrink-0 font-bold text-yellow-300">
                                {t('boss.turnLabel', { turn: entry.turn })}
                            </span>
                            {entry.icon ? <img src={entry.icon} alt="" className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                            <span className="min-w-0 leading-snug">{entry.message}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-rose-500/25 bg-tertiary/40">
                <h3
                    className={`flex-shrink-0 border-b border-rose-400/20 text-center font-bold text-rose-300 ${
                        compact ? 'px-1 py-0.5 text-[10px]' : 'px-2 py-1 text-sm'
                    }`}
                >
                    {t('boss.bossAttack')}
                </h3>
                <div
                    ref={bossLogContainerRef as React.Ref<HTMLDivElement>}
                    className={`min-h-0 flex-1 space-y-1 overflow-y-auto ${compact ? 'p-1 text-[10px]' : 'p-1.5 text-xs'}`}
                >
                    {bossLogs.map((entry, index) => (
                        <div
                            key={`b-${entry.turn}-${index}-${entry.message.slice(0, 20)}`}
                            className="guild-boss-log-row flex items-start gap-1.5 text-rose-100"
                        >
                            <span className="shrink-0 font-bold text-yellow-300">
                                {t('boss.turnLabel', { turn: entry.turn })}
                            </span>
                            {entry.icon ? <img src={entry.icon} alt="" className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                            <span className="min-w-0 leading-snug">{entry.message}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    if (compact) {
        return (
            <div className="flex h-full min-h-0 w-full flex-col gap-1 p-0.5">
                <div className="relative flex min-h-0 flex-[1.65] flex-col overflow-hidden rounded-xl border border-amber-500/35 bg-black/45 p-1 shadow-inner">
                    <div className="flex min-h-0 flex-1 flex-row items-stretch gap-0.5">
                        <div className={`relative z-10 flex min-h-0 min-w-0 flex-[1.05] flex-col items-center ${userActorClass}`}>
                            <div className="relative flex w-full min-h-0 flex-1 flex-col items-center justify-center">
                                <Avatar
                                    userId={user.id}
                                    userName={user.nickname}
                                    avatarUrl={avatarUrl}
                                    borderUrl={borderUrl}
                                    size={56}
                                />
                                <UserNicknameText
                                    user={{
                                        nickname: user.nickname,
                                        isAdmin: user.isAdmin,
                                        staffNicknameDisplayEligibility: user.staffNicknameDisplayEligibility,
                                    }}
                                    as="h3"
                                    className="mt-0.5 max-w-full truncate text-[11px] font-bold text-white"
                                    style={{ textShadow: '1px 1px 3px black' }}
                                />
                            </div>
                            <div className="relative mt-0.5 w-full max-w-[7.5rem]">
                                <div className="relative h-2.5 w-full overflow-hidden rounded-full border border-emerald-900/80 bg-tertiary">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600"
                                        style={{ width: `${userHpPercent}%`, transition: 'width 0.5s linear' }}
                                    />
                                    <span
                                        className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white"
                                        style={{ textShadow: '1px 1px 2px black' }}
                                    >
                                        {Math.ceil(userHp).toLocaleString()}
                                    </span>
                                </div>
                                <div className="pointer-events-none absolute inset-x-0 bottom-full h-10 overflow-hidden">
                                    {userDamageNumbers.map((dn) => (
                                        <div
                                            key={dn.id}
                                            className={`absolute bottom-0 left-1/2 -translate-x-1/2 text-xs font-bold animate-float-up-and-fade-1s ${dn.color}`}
                                            style={{ textShadow: '1px 1px 3px black' }}
                                        >
                                            {dn.text}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="relative z-20 flex w-[6.75rem] shrink-0 flex-col items-center justify-center self-center">
                            <GuildBossBattleBoard
                                bossId={boss.id}
                                phase={presentationPhase}
                                combatMoveCount={combatBoardMoveCount}
                                combatFx={combatFx}
                                showOpeningHpBuff={showOpeningHpBuff}
                                currentBattleDamage={currentBattleDamage}
                                compact
                                showEngageLabel={presentationPhase === 'engage'}
                            />
                        </div>

                        <div className={`relative z-10 flex min-h-0 min-w-0 flex-[1.2] flex-col items-center ${bossActorClass}`}>
                            <div className="relative min-h-0 w-full flex-1 max-w-[9.5rem]">
                                <GuildBossPortrait
                                    image={boss.image}
                                    alt={bossDisplayName}
                                    variant="hero"
                                    className="h-full w-full"
                                    imgClassName="h-full w-full max-h-full object-contain object-bottom"
                                />
                                <p
                                    className="pointer-events-none absolute inset-x-0.5 top-0.5 z-10 truncate text-center text-[10px] font-bold leading-tight text-white"
                                    style={{ textShadow: '1px 1px 3px black, 0 0 8px rgba(0,0,0,0.85)' }}
                                >
                                    {bossDisplayName} · {t('boss.stage', { stage: difficultyStage })}
                                </p>
                                <div className="pointer-events-none absolute inset-x-0.5 bottom-0.5 z-10">
                                    <div className="relative h-2.5 w-full overflow-hidden rounded-full border border-black/50 bg-tertiary">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-700"
                                            style={{ width: `${bossHpPercent}%`, transition: 'width 0.5s linear' }}
                                        />
                                        <span
                                            className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white"
                                            style={{ textShadow: '1px 1px 2px black' }}
                                        >
                                            {Math.ceil(bossHp).toLocaleString()} ({bossHpPercent.toFixed(0)}%)
                                        </span>
                                    </div>
                                    <div className="pointer-events-none absolute inset-x-0 bottom-full mb-0.5 h-10">
                                        {bossDamageNumbers.map((dn) => (
                                            <div
                                                key={dn.id}
                                                className={`absolute bottom-0 left-1/2 -translate-x-1/2 font-bold ${
                                                    dn.isCrit ? 'text-base' : 'text-sm'
                                                } ${dn.color} ${
                                                    dn.isHeal
                                                        ? 'animate-float-up-and-fade-1s'
                                                        : 'animate-float-down-and-fade-1s'
                                                }`}
                                                style={{
                                                    textShadow: dn.isCrit
                                                        ? '0 0 5px yellow, 0 0 8px orange'
                                                        : '1px 1px 3px black',
                                                }}
                                            >
                                                {dn.text}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-1 flex shrink-0 flex-row items-stretch gap-1">
                        <div className="min-w-0 flex-1">{attackSkillStrip}</div>
                        <div className="min-w-0 flex-1">{bossSkillStrip}</div>
                    </div>
                </div>

                {combatLogs}
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 w-full flex-col gap-2 p-2">
            <div className="relative flex min-h-0 flex-[1.15] flex-row items-stretch gap-2 overflow-hidden rounded-xl border border-amber-500/35 bg-black/45 p-3 shadow-inner">
                <div className={`relative z-10 flex min-h-0 min-w-0 flex-1 flex-col items-center ${userActorClass}`}>
                    <div className="relative flex w-full max-w-[16rem] flex-1 flex-col items-center justify-center">
                        <Avatar
                            userId={user.id}
                            userName={user.nickname}
                            avatarUrl={avatarUrl}
                            borderUrl={borderUrl}
                            size={128}
                        />
                        <div className="mt-2" style={{ textShadow: '1px 1px 3px black' }}>
                            <UserNicknameText
                                user={{
                                    nickname: user.nickname,
                                    isAdmin: user.isAdmin,
                                    staffNicknameDisplayEligibility: user.staffNicknameDisplayEligibility,
                                }}
                                as="h3"
                                className="text-lg font-bold text-white"
                            />
                        </div>
                    </div>
                    <div className="relative mt-2 w-full max-w-[16rem]">
                        <div className="relative h-4 w-full overflow-hidden rounded-full border-2 border-emerald-900/80 bg-tertiary">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600"
                                style={{ width: `${userHpPercent}%`, transition: 'width 0.5s linear' }}
                            />
                            <span
                                className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white"
                                style={{ textShadow: '1px 1px 2px black' }}
                            >
                                HP: {Math.ceil(userHp).toLocaleString()} / {userMaxHp.toLocaleString()}
                            </span>
                        </div>
                        <div className="pointer-events-none absolute left-0 right-0 top-0 h-16 overflow-hidden">
                            {userDamageNumbers.map((dn) => (
                                <div
                                    key={dn.id}
                                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 text-lg font-bold animate-float-up-and-fade-1s ${dn.color}`}
                                    style={{ textShadow: '1px 1px 3px black' }}
                                >
                                    {dn.text}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="mt-1 w-full max-w-full">{attackSkillStrip}</div>
                </div>

                <div className="relative z-20 flex w-[13.5rem] shrink-0 flex-col items-center justify-center sm:w-[15.5rem]">
                    <GuildBossBattleBoard
                        bossId={boss.id}
                        phase={presentationPhase}
                        combatMoveCount={combatBoardMoveCount}
                        combatFx={combatFx}
                        showOpeningHpBuff={showOpeningHpBuff}
                        currentBattleDamage={currentBattleDamage}
                        showEngageLabel={presentationPhase === 'engage'}
                    />
                </div>

                <div className={`relative z-10 flex min-h-0 min-w-0 flex-1 flex-col items-center ${bossActorClass}`}>
                    <div className="relative w-full max-w-[min(100%,22rem)] flex-1">
                        <GuildBossPortrait
                            image={boss.image}
                            alt={bossDisplayName}
                            variant="hero"
                            className="h-full w-full"
                            imgClassName="h-full w-full max-h-full object-contain object-bottom"
                        />
                        <p
                            className="pointer-events-none absolute inset-x-2 top-2 z-10 truncate text-center text-sm font-bold tabular-nums text-white sm:text-base"
                            style={{ textShadow: '1px 1px 3px black, 0 0 8px rgba(0,0,0,0.85)' }}
                        >
                            {bossDisplayName} · {t('boss.stage', { stage: difficultyStage })}
                        </p>
                        <div className="pointer-events-none absolute inset-x-2 bottom-2 z-10">
                            <div className="relative h-5 w-full overflow-hidden rounded-full border-2 border-black/50 bg-tertiary">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-700"
                                    style={{ width: `${bossHpPercent}%`, transition: 'width 0.5s linear' }}
                                />
                                <span
                                    className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white sm:text-sm"
                                    style={{ textShadow: '1px 1px 2px black' }}
                                >
                                    {Math.ceil(bossHp).toLocaleString()} / {bossMaxHp.toLocaleString()} (
                                    {bossHpPercent.toFixed(1)}%)
                                </span>
                            </div>
                            <div className="pointer-events-none absolute inset-x-0 bottom-full mb-0.5 h-14">
                                {bossDamageNumbers.map((dn) => (
                                    <div
                                        key={dn.id}
                                        className={`absolute bottom-0 left-1/2 -translate-x-1/2 font-bold ${
                                            dn.isCrit ? 'text-2xl' : 'text-lg'
                                        } ${dn.color} ${
                                            dn.isHeal
                                                ? 'animate-float-up-and-fade-1s'
                                                : 'animate-float-down-and-fade-1s'
                                        }`}
                                        style={{
                                            textShadow: dn.isCrit
                                                ? '0 0 5px yellow, 0 0 8px orange'
                                                : '1px 1px 3px black',
                                        }}
                                    >
                                        {dn.text}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="mt-1">{bossSkillStrip}</div>
                </div>
            </div>

            {combatLogs}
        </div>
    );
};

export default GuildBossBattleArena;
