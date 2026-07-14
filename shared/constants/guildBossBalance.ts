import type { Guild } from '../types/index.js';
import { CoreStat, GuildResearchId } from '../types/enums.js';
import { GUILD_RESEARCH_PROJECTS } from './guildConstants.js';

/** 유저 최대 HP — 기본 */
export const GUILD_BOSS_USER_HP_BASE = 35_000;

/** 유저 최대 HP — 집중력당 */
export const GUILD_BOSS_USER_HP_PER_CONCENTRATION = 15;

/** 유저 최대 HP — 안정감당 (×5 = stability stat × this factor) */
export const GUILD_BOSS_USER_HP_PER_STABILITY = 5;

/** 1턴 기본 피해 계수 (전투력 / 판단력 / 계산력) */
export const GUILD_BOSS_USER_DAMAGE_COEF = {
    combat: 4.8,
    judgment: 3.8,
    calculation: 2.6,
} as const;

/** 크리티컬 기본 확률(%) + 판단력×0.03 */
export const GUILD_BOSS_CRIT_BASE_CHANCE = 18;

/** 추가턴 확률 = 사고속도 × this */
export const GUILD_BOSS_EXTRA_TURN_COEF = 0.025;

/** 연구-점화 기본 피해 = boss.maxHp × this */
export const GUILD_BOSS_IGNITE_BASE_HP_RATIO = 0.002;

/** 단일 hp_percent 스킬 피해 상한 (maxUserHp 대비) */
export const GUILD_BOSS_BOSS_HP_PERCENT_CAP = 0.18;

/** 안정감 피해 경감: K / (K + stability) */
export const GUILD_BOSS_STABILITY_MITIGATION_K = 350;

/** 연구-회복: 안정감 × this */
export const GUILD_BOSS_REGEN_STABILITY_FACTOR = 0.65;

/** 난이도 단계당 유저 피해 +5% (1단계 = 1.0) */
export const GUILD_BOSS_USER_DAMAGE_STAGE_BONUS_PER_LEVEL = 0.05;

/** 길드연구소 보스 데미지 증가: 1레벨 0%, 이후 레벨업마다 +5% (최대 10강 → 45%) */
export const GUILD_BOSS_RESEARCH_DAMAGE_PER_LEVEL_PERCENT = 5;

/** 길드연구소 보스 공격 회피: 1레벨 0%, 이후 레벨업마다 +3% (최대 10강 → 27%) */
export const GUILD_BOSS_RESEARCH_EVASION_PER_LEVEL_PERCENT = 3;

/** 길드연구소 보스 피격데미지 감소: 1레벨 0%, 이후 레벨업마다 +5% (최대 10강 → 45%) */
export const GUILD_BOSS_RESEARCH_HIT_DAMAGE_REDUCTION_PER_LEVEL_PERCENT = 5;

export function guildBossUserDamageStageMultiplier(stage: number): number {
    const st = Math.min(10, Math.max(1, Math.floor(stage) || 1));
    return 1 + GUILD_BOSS_USER_DAMAGE_STAGE_BONUS_PER_LEVEL * (st - 1);
}

/** 1레벨 0% 출발 연구: (level - 1) * perLevel */
function computeGuildBossResearchPercentFromLevel1Zero(level: number, perLevelPercent: number): number {
    const lv = Math.max(0, Math.floor(level) || 0);
    if (lv <= 1) return 0;
    return perLevelPercent * (lv - 1);
}

/** 연구 레벨에 따른 길드 보스전 유저 피해 증가율(%) */
export function computeGuildBossResearchDamagePercent(level: number): number {
    return computeGuildBossResearchPercentFromLevel1Zero(level, GUILD_BOSS_RESEARCH_DAMAGE_PER_LEVEL_PERCENT);
}

/** 연구 레벨에 따른 보스 공격 회피 확률(%) */
export function computeGuildBossResearchEvasionPercent(level: number): number {
    return computeGuildBossResearchPercentFromLevel1Zero(level, GUILD_BOSS_RESEARCH_EVASION_PER_LEVEL_PERCENT);
}

/** 연구 레벨에 따른 보스 피격 피해 감소율(%) */
export function computeGuildBossResearchHitDamageReductionPercent(level: number): number {
    return computeGuildBossResearchPercentFromLevel1Zero(
        level,
        GUILD_BOSS_RESEARCH_HIT_DAMAGE_REDUCTION_PER_LEVEL_PERCENT,
    );
}

export function computeGuildBossStabilityMitigation(stability: number): number {
    const stab = Math.max(0, stability);
    return GUILD_BOSS_STABILITY_MITIGATION_K / (GUILD_BOSS_STABILITY_MITIGATION_K + stab);
}

/** hp_percent 스킬: percent는 0~100 정수 범위 */
export function computeGuildBossHpPercentDamage(
    maxUserHp: number,
    percentMin: number,
    percentMax: number,
    rollPercent: number,
): number {
    const pct = Math.max(percentMin, Math.min(percentMax, rollPercent));
    const cappedPct = Math.min(pct, GUILD_BOSS_BOSS_HP_PERCENT_CAP * 100);
    return Math.round(maxUserHp * (cappedPct / 100));
}

export function computeGuildBossUserMaxHp(
    totalStats: Record<CoreStat, number>,
    guild: Guild | null,
): number {
    let userHp =
        GUILD_BOSS_USER_HP_BASE +
        totalStats[CoreStat.Concentration] * GUILD_BOSS_USER_HP_PER_CONCENTRATION +
        totalStats[CoreStat.Stability] * GUILD_BOSS_USER_HP_PER_STABILITY;

    const hpIncreaseLevel = guild?.research?.[GuildResearchId.boss_hp_increase]?.level || 0;
    if (hpIncreaseLevel > 0) {
        const project = GUILD_RESEARCH_PROJECTS[GuildResearchId.boss_hp_increase];
        userHp *= 1 + (project.baseEffect * hpIncreaseLevel) / 100;
    }
    return Math.round(Math.max(1, userHp));
}

/** 기본 공격 피해(분산·크리·디버프·단계·장비% 미적용) */
export function computeGuildBossUserBaseTurnDamage(totalStats: Record<CoreStat, number>): number {
    return (
        totalStats[CoreStat.CombatPower] * GUILD_BOSS_USER_DAMAGE_COEF.combat +
        totalStats[CoreStat.Judgment] * GUILD_BOSS_USER_DAMAGE_COEF.judgment +
        totalStats[CoreStat.Calculation] * GUILD_BOSS_USER_DAMAGE_COEF.calculation
    );
}
