import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Guild, GuildBossInfo, UserWithStatus, BattleLogEntry, CoreStat, GuildBossFxKind } from '../../types/index.js';
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
import GuildBossPortrait from './GuildBossPortrait.js';
import GuildBossSkillHitFx from './GuildBossSkillHitFx.js';
import Avatar from '../Avatar.js';
import UserNicknameText from '../UserNicknameText.js';
import { translateGuildBossName } from '../../shared/utils/translateGuildBossName.js';
import type { TFunction } from 'i18next';

const getBossResearchEffectDisplay = (
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

export type GuildBossCombatFxState = {
    fxKind: GuildBossFxKind;
    secondaryFxKind?: GuildBossFxKind;
    icon?: string;
    isCrit: boolean;
    attacker: 'user' | 'boss' | null;
    targetHit: 'user' | 'boss' | null;
    duelOutcome?: string;
    researchId?: string;
    fxKey: number;
    missProjectile?: boolean;
};

type FloatNum = { id: number; text: string; color: string; isHeal?: boolean; isCrit?: boolean };

type BossSkillTileProps = {
    skill: GuildBossInfo['skills'][number];
    compact?: boolean;
};

type ResearchSkillTileProps = {
    name: string;
    description: string;
    image: string;
    level: number;
    effect: { chance?: number; description: string } | null;
    proc?: boolean;
    compact?: boolean;
    inactiveLabel: string;
};

const ResearchSkillTile: React.FC<ResearchSkillTileProps> = ({
    name,
    description,
    image,
    level,
    effect,
    proc = false,
    compact = false,
    inactiveLabel,
}) => {
    const [tipOpen, setTipOpen] = useState(false);
    const active = level > 0;

    return (
        <button
            type="button"
            className={`group/research relative shrink-0 rounded-md border border-white/15 bg-black/40 outline-none ${
                !active ? 'opacity-45' : ''
            } ${proc ? 'guild-boss-research-icon-proc' : ''} ${compact ? 'p-0.5' : 'p-1'}`}
            onMouseEnter={() => setTipOpen(true)}
            onMouseLeave={() => setTipOpen(false)}
            onFocus={() => setTipOpen(true)}
            onBlur={() => setTipOpen(false)}
            aria-label={`${name}${active ? ` Lv.${level}` : ''}`}
        >
            <img src={image} alt="" className={compact ? 'h-7 w-7 object-contain' : 'h-9 w-9 object-contain'} />
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

const BossSkillTile: React.FC<BossSkillTileProps> = ({ skill, compact = false }) => {
    const [touchTipOpen, setTouchTipOpen] = useState(false);
    return (
        <button
            type="button"
            className={`relative shrink-0 rounded-lg border border-white/25 bg-black/40 ${compact ? 'p-0.5' : 'p-1'}`}
            onMouseEnter={() => setTouchTipOpen(true)}
            onMouseLeave={() => setTouchTipOpen(false)}
            onClick={() => setTouchTipOpen((v) => !v)}
            aria-label={skill.name}
        >
            <img src={skill.image} alt={skill.name} className={compact ? 'h-8 w-8 object-contain' : 'h-10 w-10 object-contain'} />
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
                    ? 'group/tip relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-amber-400/35 bg-black/60 text-lg shadow-md'
                    : 'group/tip relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-amber-400/35 bg-black/60 text-xl shadow-md'
            }
            aria-label={t('boss.recommendedStatsAria', { stats: stats.join(', ') })}
        >
            <span className="select-none leading-none" aria-hidden>
                💡
            </span>
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
    /** 이번 전투 누적 피해 (재생 중 실시간) */
    currentBattleDamage: number;
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

    const researchProjects = useMemo(() => {
        return Object.entries(GUILD_RESEARCH_PROJECTS)
            .filter(([, project]) => project.category === 'boss')
            .map(([id, project]) => {
                const currentLevel = guild.research?.[id as GuildResearchId]?.level || 0;
                return { ...project, id: id as GuildResearchId, currentLevel };
            });
    }, [guild]);

    const bossHpPercent = bossMaxHp > 0 ? (bossHp / bossMaxHp) * 100 : 0;
    const userHpPercent = userMaxHp > 0 ? (userHp / userMaxHp) * 100 : 0;

    const bossActorClass = [
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

    const fxOnBoss =
        combatFx &&
        (combatFx.targetHit === 'boss' ||
            combatFx.fxKind === 'research_heal_block' ||
            combatFx.fxKind === 'research_heal_reduce' ||
            (combatFx.fxKind === 'heal' && combatFx.attacker === 'boss'));
    const fxOnUser =
        combatFx &&
        (combatFx.targetHit === 'user' ||
            combatFx.fxKind === 'extra_turn' ||
            combatFx.fxKind === 'research_regen' ||
            combatFx.fxKind === 'research_hp_buff');

    const projectileDir =
        combatFx?.attacker === 'user' && combatFx.targetHit === 'boss'
            ? 'to-boss'
            : combatFx?.attacker === 'boss' && combatFx.targetHit === 'user'
              ? 'to-user'
              : 'none';

    return (
        <div className={`flex h-full min-h-0 w-full flex-col gap-2 ${compact ? 'p-1' : 'p-2'}`}>
            <div
                className={`relative flex min-h-0 flex-[1.15] flex-row items-stretch overflow-hidden rounded-xl border border-amber-500/35 bg-black/45 shadow-inner ${
                    compact ? 'gap-1 p-1.5' : 'gap-2 p-3'
                }`}
            >
                {/* VS badge + live cumulative damage — panel center */}
                <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5">
                    <div
                        className={`guild-boss-vs-badge ${compact ? 'guild-boss-vs-badge--compact' : ''}`}
                        aria-hidden
                    >
                        <span className="guild-boss-vs-badge__wing guild-boss-vs-badge__wing--l" />
                        <span className="guild-boss-vs-badge__core">
                            <span className="guild-boss-vs-badge__text">VS</span>
                        </span>
                        <span className="guild-boss-vs-badge__wing guild-boss-vs-badge__wing--r" />
                    </div>
                    <div
                        className={`guild-boss-vs-damage ${compact ? 'guild-boss-vs-damage--compact' : ''}`}
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        <span className="guild-boss-vs-damage__label">{t('boss.vsLiveDamage')}</span>
                        <span className="guild-boss-vs-damage__value tabular-nums">
                            {Math.max(0, Math.floor(currentBattleDamage)).toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* User side (left) */}
                <div className={`relative z-10 flex min-h-0 min-w-0 flex-1 flex-col items-center ${userActorClass}`}>
                    <div className={`relative flex w-full flex-1 flex-col items-center justify-center ${compact ? 'max-w-[12rem]' : 'max-w-[18rem]'}`}>
                        <Avatar
                            userId={user.id}
                            userName={user.nickname}
                            avatarUrl={avatarUrl}
                            borderUrl={borderUrl}
                            size={compact ? 96 : 140}
                        />
                        <div className="mt-2" style={{ textShadow: '1px 1px 3px black' }}>
                            <UserNicknameText
                                user={{
                                    nickname: user.nickname,
                                    isAdmin: user.isAdmin,
                                    staffNicknameDisplayEligibility: user.staffNicknameDisplayEligibility,
                                }}
                                as="h3"
                                className={`font-bold text-white ${compact ? 'text-sm' : 'text-lg'}`}
                            />
                        </div>
                        {(fxOnUser || showOpeningHpBuff) && (combatFx || showOpeningHpBuff) ? (
                            <GuildBossSkillHitFx
                                fxKind={showOpeningHpBuff && !combatFx ? 'research_hp_buff' : combatFx!.fxKind}
                                secondaryFxKind={combatFx?.secondaryFxKind}
                                icon={combatFx?.icon}
                                isCrit={combatFx?.isCrit}
                                fxKey={combatFx?.fxKey ?? 0}
                                projectileDir={projectileDir === 'to-user' ? 'to-user' : 'none'}
                                missProjectile={combatFx?.missProjectile}
                            />
                        ) : null}
                    </div>
                    <div className={`relative w-full ${compact ? 'mt-1 max-w-[12rem]' : 'mt-2 max-w-[18rem]'}`}>
                        <div
                            className={`relative w-full overflow-hidden rounded-full border-2 border-emerald-900/80 bg-tertiary ${
                                compact ? 'h-3' : 'h-4'
                            }`}
                        >
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600"
                                style={{ width: `${userHpPercent}%`, transition: 'width 0.5s linear' }}
                            />
                            <span
                                className={`absolute inset-0 flex items-center justify-center font-bold text-white ${compact ? 'text-[9px]' : 'text-xs'}`}
                                style={{ textShadow: '1px 1px 2px black' }}
                            >
                                HP: {Math.ceil(userHp).toLocaleString()} / {userMaxHp.toLocaleString()}
                            </span>
                        </div>
                        <div className="pointer-events-none absolute left-0 right-0 top-0 h-16 overflow-hidden">
                            {userDamageNumbers.map((dn) => (
                                <div
                                    key={dn.id}
                                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 font-bold animate-float-up-and-fade-1s ${dn.color} ${
                                        compact ? 'text-sm' : 'text-lg'
                                    }`}
                                    style={{ textShadow: '1px 1px 3px black' }}
                                >
                                    {dn.text}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="relative z-10 mt-1 flex max-w-full shrink-0 flex-row flex-nowrap items-center justify-center gap-1 overflow-visible rounded-xl border border-white/20 bg-black/45 p-1">
                        <div
                            className={`group/atk relative flex shrink-0 flex-col items-center rounded-md border border-amber-400/40 bg-black/50 ${
                                combatFx?.fxKind === 'slash' || combatFx?.researchId === 'boss_damage_increase'
                                    ? 'guild-boss-research-icon-proc'
                                    : ''
                            } ${compact ? 'px-1 py-0.5' : 'px-1.5 py-1'}`}
                        >
                            <img src={GUILD_ATTACK_ICON} alt={t('boss.normalAttack')} className={compact ? 'h-7 w-7' : 'h-9 w-9'} />
                            <span className={`font-mono font-bold text-amber-200 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
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
                        {researchProjects.map((project) => {
                            const effect = getBossResearchEffectDisplay(project.id, project.currentLevel, t);
                            const proc =
                                combatFx?.researchId === project.id ||
                                (showOpeningHpBuff && project.id === 'boss_hp_increase');
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
                                    inactiveLabel={t('boss.inactive')}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* Boss side (right) */}
                <div className={`relative z-10 flex min-h-0 min-w-0 flex-1 flex-col items-center ${bossActorClass}`}>
                    <div className={`relative w-full flex-1 ${compact ? 'max-w-[15rem]' : 'max-w-[min(100%,26rem)]'}`}>
                        <GuildBossPortrait
                            image={boss.image}
                            alt={bossDisplayName}
                            variant="hero"
                            className="h-full w-full"
                            imgClassName="h-full w-full max-h-full object-contain object-bottom"
                        />
                        <p
                            className={`pointer-events-none absolute inset-x-0 top-0 z-10 truncate text-center font-bold tabular-nums text-white ${
                                compact ? 'left-1 right-1 top-1 text-[11px] leading-tight' : 'left-2 right-2 top-2 text-sm sm:text-base'
                            }`}
                            style={{ textShadow: '1px 1px 3px black, 0 0 8px rgba(0,0,0,0.85)' }}
                        >
                            {bossDisplayName} · {t('boss.stage', { stage: difficultyStage })}
                        </p>
                        <div
                            className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 ${
                                compact ? 'left-1 right-1 bottom-1' : 'left-2 right-2 bottom-2'
                            }`}
                        >
                            <div
                                className={`relative w-full overflow-hidden rounded-full border-2 border-black/50 bg-tertiary ${
                                    compact ? 'h-4' : 'h-5'
                                }`}
                            >
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-red-500 to-red-700"
                                    style={{ width: `${bossHpPercent}%`, transition: 'width 0.5s linear' }}
                                />
                                <span
                                    className={`absolute inset-0 flex items-center justify-center font-bold text-white ${
                                        compact ? 'text-[10px]' : 'text-xs sm:text-sm'
                                    }`}
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
                                        className={`absolute bottom-0 left-1/2 -translate-x-1/2 font-bold ${dn.isCrit ? 'text-2xl' : 'text-lg'} ${dn.color} ${
                                            dn.isHeal ? 'animate-float-up-and-fade-1s' : 'animate-float-down-and-fade-1s'
                                        }`}
                                        style={{ textShadow: dn.isCrit ? '0 0 5px yellow, 0 0 8px orange' : '1px 1px 3px black' }}
                                    >
                                        {dn.text}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {(fxOnBoss || (combatFx && combatFx.fxKind === 'dodge' && combatFx.secondaryFxKind)) && combatFx ? (
                            <GuildBossSkillHitFx
                                fxKind={combatFx.fxKind === 'dodge' ? combatFx.fxKind : combatFx.fxKind}
                                secondaryFxKind={combatFx.fxKind === 'dodge' ? combatFx.secondaryFxKind : combatFx.researchId ? 'research_damage_buff' : combatFx.secondaryFxKind}
                                icon={combatFx.icon}
                                isCrit={combatFx.isCrit}
                                fxKey={combatFx.fxKey}
                                projectileDir={projectileDir === 'to-boss' ? 'to-boss' : 'none'}
                                missProjectile={combatFx.missProjectile}
                            />
                        ) : null}
                    </div>
                    <div className={`relative z-10 mt-1 flex shrink-0 items-center justify-center gap-1.5`}>
                        <div className="flex flex-row items-center gap-1 rounded-xl border border-white/20 bg-black/45 p-1">
                            {boss.skills.map((skill) => (
                                <BossSkillTile key={skill.id} skill={skill} compact={compact} />
                            ))}
                        </div>
                        <BossRecommendedStatsTip stats={boss.recommendedStats || []} compact={compact} t={t} />
                    </div>
                </div>

                {combatFx && projectileDir !== 'none' && combatFx.missProjectile ? (
                    <GuildBossSkillHitFx
                        fxKind={combatFx.fxKind}
                        icon={combatFx.icon}
                        fxKey={combatFx.fxKey + 1}
                        projectileDir={projectileDir}
                        missProjectile
                        className="!inset-0"
                    />
                ) : null}
            </div>

            {/* Split combat log: my attacks | boss attacks (turn-by-turn sides) */}
            <div
                className={`flex min-h-0 flex-1 flex-row overflow-hidden rounded-lg border border-color bg-panel/90 ${
                    compact ? 'gap-1 p-1' : 'gap-2 p-2'
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
                                className="flex items-start gap-1.5 animate-fade-in text-sky-100"
                            >
                                <span className="shrink-0 font-bold text-yellow-300">
                                    {t('boss.turnLabel', { turn: entry.turn })}
                                </span>
                                {entry.icon ? <img src={entry.icon} alt="" className="mt-0.5 h-5 w-5 shrink-0" /> : null}
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
                                className="flex items-start gap-1.5 animate-fade-in text-rose-100"
                            >
                                <span className="shrink-0 font-bold text-yellow-300">
                                    {t('boss.turnLabel', { turn: entry.turn })}
                                </span>
                                {entry.icon ? <img src={entry.icon} alt="" className="mt-0.5 h-5 w-5 shrink-0" /> : null}
                                <span className="min-w-0 leading-snug">{entry.message}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuildBossBattleArena;
