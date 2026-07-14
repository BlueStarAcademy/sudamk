import { describe, expect, it } from 'vitest';
import { CoreStat, GuildResearchId } from '../../../types/enums.js';
import {
    computeGuildBossUserMaxHp,
    computeGuildBossHpPercentDamage,
    computeGuildBossStabilityMitigation,
    computeGuildBossResearchDamagePercent,
    computeGuildBossResearchEvasionPercent,
    computeGuildBossResearchHitDamageReductionPercent,
    guildBossUserDamageStageMultiplier,
    GUILD_BOSS_BOSS_HP_PERCENT_CAP,
} from '../../../shared/constants/guildBossBalance.js';
import { GUILD_BOSSES } from '../../../shared/constants/guildConstants.js';
import { scaleGuildBossForStage } from '../../../utils/guildBossStageUtils.js';
import { runGuildBossBattle } from '../../../utils/guildBossSimulator.js';
import type { Guild, User } from '../../../types/index.js';

function makeStats(all: number): Record<CoreStat, number> {
    return {
        [CoreStat.Concentration]: all,
        [CoreStat.ThinkingSpeed]: all,
        [CoreStat.Judgment]: all,
        [CoreStat.Calculation]: all,
        [CoreStat.CombatPower]: all,
        [CoreStat.Stability]: all,
    };
}

function makeGuild(research: Partial<Record<GuildResearchId, { level: number }>> = {}): Guild {
    return {
        id: 'g1',
        name: 'Test Guild',
        level: 10,
        members: [],
        leaderId: 'u1',
        research: research as Guild['research'],
    } as Guild;
}

function makeUser(stats: number, nickname = 'Tester'): User {
    const baseStats = makeStats(stats);
    return {
        id: 'u1',
        nickname,
        username: nickname,
        baseStats,
        spentStatPoints: {} as Record<CoreStat, number>,
        inventory: [],
        equipment: {},
    } as User;
}

function median(nums: number[]): number {
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function percentile(nums: number[], p: number): number {
    const sorted = [...nums].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * p);
    return sorted[Math.min(sorted.length - 1, Math.max(0, idx))]!;
}

function runMonteCarlo(
    user: User,
    guild: Guild,
    bossId: string,
    stage: number,
    runs: number,
): { medianDamage: number; medianTurns: number; p10Damage: number } {
    const template = GUILD_BOSSES.find((b) => b.id === bossId) ?? GUILD_BOSSES[0]!;
    const boss = scaleGuildBossForStage({ ...template, hp: template.maxHp }, stage);
    const damages: number[] = [];
    const turns: number[] = [];
    for (let i = 0; i < runs; i++) {
        const result = runGuildBossBattle(user, guild, boss, stage);
        damages.push(result.damageDealt);
        turns.push(result.turnsSurvived);
    }
    return {
        medianDamage: median(damages),
        medianTurns: median(turns),
        p10Damage: percentile(damages, 0.1),
    };
}

describe('guildBossBalance constants', () => {
    it('computeGuildBossUserMaxHp uses new base formula', () => {
        const stats = makeStats(600);
        const hp = computeGuildBossUserMaxHp(stats, makeGuild({ [GuildResearchId.boss_hp_increase]: { level: 5 } }));
        // (35000 + 600*15 + 600*5) * 1.25 = 58750
        expect(hp).toBe(58_750);
    });

    it('hp_percent cap limits single hit to 18% maxUserHp', () => {
        const dmg = computeGuildBossHpPercentDamage(50_000, 25, 40, 40);
        expect(dmg).toBe(Math.round(50_000 * GUILD_BOSS_BOSS_HP_PERCENT_CAP));
    });

    it('stability mitigation improves with higher stability', () => {
        expect(computeGuildBossStabilityMitigation(500)).toBeGreaterThan(0.4);
        expect(computeGuildBossStabilityMitigation(500)).toBeLessThan(0.45);
    });

    it('stage damage multiplier scales +5% per level', () => {
        expect(guildBossUserDamageStageMultiplier(1)).toBe(1);
        expect(guildBossUserDamageStageMultiplier(3)).toBeCloseTo(1.1);
    });

    it('research damage percent: L1=0% then +5% per level up to L10=45%', () => {
        expect(computeGuildBossResearchDamagePercent(0)).toBe(0);
        expect(computeGuildBossResearchDamagePercent(1)).toBe(0);
        expect(computeGuildBossResearchDamagePercent(2)).toBe(5);
        expect(computeGuildBossResearchDamagePercent(10)).toBe(45);
    });

    it('research evasion percent: L1=0% then +3% per level up to L10=27%', () => {
        expect(computeGuildBossResearchEvasionPercent(0)).toBe(0);
        expect(computeGuildBossResearchEvasionPercent(1)).toBe(0);
        expect(computeGuildBossResearchEvasionPercent(2)).toBe(3);
        expect(computeGuildBossResearchEvasionPercent(10)).toBe(27);
    });

    it('research hit damage reduction: L1=0% then +5% per level up to L10=45%', () => {
        expect(computeGuildBossResearchHitDamageReductionPercent(0)).toBe(0);
        expect(computeGuildBossResearchHitDamageReductionPercent(1)).toBe(0);
        expect(computeGuildBossResearchHitDamageReductionPercent(2)).toBe(5);
        expect(computeGuildBossResearchHitDamageReductionPercent(10)).toBe(45);
    });
});

describe('guildBossBalance Monte Carlo', () => {
    it('early build: improved vs low stat floor, survives longer than before', () => {
        const user = makeUser(300);
        const guild = makeGuild();
        const { medianDamage, medianTurns, p10Damage } = runMonteCarlo(user, guild, 'boss_1', 1, 200);
        expect(medianDamage).toBeGreaterThanOrEqual(45_000);
        expect(medianDamage).toBeLessThanOrEqual(120_000);
        expect(medianTurns).toBeGreaterThanOrEqual(8);
        expect(medianTurns).toBeLessThanOrEqual(22);
        expect(p10Damage).toBeGreaterThanOrEqual(30_000);
    });

    it('growth build: median damage well above early, 18~30 turns', () => {
        const earlyUser = makeUser(300);
        const growthUser = makeUser(600);
        const guild = makeGuild({
            [GuildResearchId.boss_hp_increase]: { level: 5 },
            [GuildResearchId.boss_skill_ignite]: { level: 3 },
            [GuildResearchId.boss_skill_regen]: { level: 3 },
        });
        const early = runMonteCarlo(earlyUser, makeGuild(), 'boss_1', 1, 150);
        const growth = runMonteCarlo(growthUser, guild, 'boss_1', 1, 200);
        expect(growth.medianDamage).toBeGreaterThan(early.medianDamage * 1.8);
        expect(growth.medianDamage).toBeGreaterThanOrEqual(120_000);
        expect(growth.medianTurns).toBeGreaterThanOrEqual(18);
        expect(growth.medianTurns).toBeLessThanOrEqual(30);
    });

    it('late build: highest damage tier at stage 1', () => {
        const user = makeUser(1000);
        const guild = makeGuild({
            [GuildResearchId.boss_hp_increase]: { level: 10 },
            [GuildResearchId.boss_skill_ignite]: { level: 7 },
            [GuildResearchId.boss_skill_regen]: { level: 7 },
        });
        const growthUser = makeUser(600);
        const growthGuild = makeGuild({
            [GuildResearchId.boss_hp_increase]: { level: 5 },
            [GuildResearchId.boss_skill_ignite]: { level: 3 },
            [GuildResearchId.boss_skill_regen]: { level: 3 },
        });
        const late = runMonteCarlo(user, guild, 'boss_1', 1, 150);
        const growth = runMonteCarlo(growthUser, growthGuild, 'boss_1', 1, 150);
        expect(late.medianDamage).toBeGreaterThan(growth.medianDamage);
        expect(late.medianTurns).toBeGreaterThanOrEqual(18);
    });
});
