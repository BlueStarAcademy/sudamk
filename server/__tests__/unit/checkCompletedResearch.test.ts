import { describe, it, expect } from 'vitest';
import {
    checkCompletedResearch,
    getResearchTaskEndAt,
    mergeResearchLevels,
    applyCompletedResearchAll,
} from '../../guildService.js';
import { GuildResearchId } from '../../../types/index.js';
import type { Guild } from '../../../types/index.js';

const makeGuild = (overrides: Partial<Guild> = {}): Guild =>
    ({
        id: 'guild-test',
        name: 'Test',
        level: 1,
        xp: 0,
        members: [],
        research: {},
        researchTask: null,
        ...overrides,
    }) as Guild;

describe('getResearchTaskEndAt', () => {
    it('prefers completedAt over completionTime', () => {
        expect(
            getResearchTaskEndAt({
                researchId: GuildResearchId.ap_regen_boost,
                startedAt: 1,
                completedAt: 200,
                completionTime: 100,
            })
        ).toBe(200);
    });

    it('falls back to completionTime when completedAt is missing', () => {
        expect(
            getResearchTaskEndAt({
                researchId: GuildResearchId.ap_regen_boost,
                startedAt: 1,
                completedAt: 0 as unknown as number,
                completionTime: 150,
            })
        ).toBe(150);
    });
});

describe('checkCompletedResearch', () => {
    it('does nothing while the timer is still running', () => {
        const now = 1_000_000;
        const guild = makeGuild({
            researchTask: {
                researchId: GuildResearchId.stat_concentration,
                startedAt: now - 1000,
                completedAt: now + 60_000,
                completionTime: now + 60_000,
            },
        });
        expect(checkCompletedResearch(guild, now)).toBeNull();
        expect(guild.researchTask).not.toBeNull();
        expect(guild.research?.[GuildResearchId.stat_concentration]?.level ?? 0).toBe(0);
    });

    it('levels up and clears the task when completedAt has passed', () => {
        const now = 1_000_000;
        const guild = makeGuild({
            research: {
                [GuildResearchId.stat_concentration]: { level: 2 },
            } as Guild['research'],
            researchTask: {
                researchId: GuildResearchId.stat_concentration,
                startedAt: now - 10_000,
                completedAt: now - 1,
                completionTime: now - 1,
            },
        });
        expect(checkCompletedResearch(guild, now)).toBe(GuildResearchId.stat_concentration);
        expect(guild.researchTask).toBeNull();
        expect(guild.research?.[GuildResearchId.stat_concentration]?.level).toBe(3);
    });

    it('completes using only completionTime (legacy shape)', () => {
        const now = 1_000_000;
        const guild = makeGuild({
            researchTask: {
                researchId: GuildResearchId.boss_hp_increase,
                startedAt: now - 10_000,
                completedAt: undefined as unknown as number,
                completionTime: now - 5,
            },
        });
        expect(checkCompletedResearch(guild, now)).toBe(GuildResearchId.boss_hp_increase);
        expect(guild.researchTask).toBeNull();
        expect(guild.research?.[GuildResearchId.boss_hp_increase]?.level).toBe(1);
    });

    it('initializes research entry from level 0 when missing', () => {
        const now = 1_000_000;
        const guild = makeGuild({
            research: undefined,
            researchTask: {
                researchId: GuildResearchId.member_limit_increase,
                startedAt: now - 10_000,
                completedAt: now,
                completionTime: now,
            },
        });
        expect(checkCompletedResearch(guild, now)).toBe(GuildResearchId.member_limit_increase);
        expect(guild.research?.[GuildResearchId.member_limit_increase]?.level).toBe(1);
        expect(guild.researchTask).toBeNull();
    });
});

describe('mergeResearchLevels', () => {
    it('keeps the higher level per research id', () => {
        const merged = mergeResearchLevels(
            { [GuildResearchId.stat_concentration]: { level: 3 } } as Guild['research'],
            { [GuildResearchId.stat_concentration]: { level: 2 }, [GuildResearchId.ap_regen_boost]: { level: 1 } } as Guild['research']
        );
        expect(merged?.[GuildResearchId.stat_concentration]?.level).toBe(3);
        expect(merged?.[GuildResearchId.ap_regen_boost]?.level).toBe(1);
    });
});

describe('applyCompletedResearchAll', () => {
    it('completes due research for every guild in the map', () => {
        const now = 1_000_000;
        const guilds: Record<string, Guild> = {
            a: makeGuild({
                id: 'a',
                researchTask: {
                    researchId: GuildResearchId.stat_judgment,
                    startedAt: now - 1000,
                    completedAt: now - 1,
                    completionTime: now - 1,
                },
            }),
            b: makeGuild({
                id: 'b',
                researchTask: {
                    researchId: GuildResearchId.stat_stability,
                    startedAt: now - 1000,
                    completedAt: now + 9999,
                    completionTime: now + 9999,
                },
            }),
        };
        expect(applyCompletedResearchAll(guilds, now)).toBe(true);
        expect(guilds.a.researchTask).toBeNull();
        expect(guilds.a.research?.[GuildResearchId.stat_judgment]?.level).toBe(1);
        expect(guilds.b.researchTask).not.toBeNull();
    });
});
