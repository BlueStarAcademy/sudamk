import { describe, it, expect } from 'vitest';
import { checkGuildLevelUp } from '../../guildService.js';
import { GUILD_XP_PER_LEVEL } from '../../../shared/constants/guildConstants.js';
import type { Guild } from '../../../types/index.js';

const makeGuild = (level: number, xp: number): Guild =>
    ({
        id: 'guild-test',
        name: 'Test',
        level,
        xp,
        members: [],
    }) as Guild;

describe('checkGuildLevelUp', () => {
    it('levels up exactly at threshold and leaves 0 XP', () => {
        const need = GUILD_XP_PER_LEVEL(1);
        const guild = makeGuild(1, need);
        expect(checkGuildLevelUp(guild)).toBe(true);
        expect(guild.level).toBe(2);
        expect(guild.xp).toBe(0);
        expect((guild as { experience?: number }).experience).toBe(0);
    });

    it('applies multi-level surplus without going negative', () => {
        const need1 = GUILD_XP_PER_LEVEL(1);
        const need2 = GUILD_XP_PER_LEVEL(2);
        const surplus = 1234;
        const guild = makeGuild(1, need1 + need2 + surplus);
        expect(checkGuildLevelUp(guild)).toBe(true);
        expect(guild.level).toBe(3);
        expect(guild.xp).toBe(surplus);
    });

    it('does not level when XP is below threshold', () => {
        const need = GUILD_XP_PER_LEVEL(3);
        const guild = makeGuild(3, need - 1);
        expect(checkGuildLevelUp(guild)).toBe(false);
        expect(guild.level).toBe(3);
        expect(guild.xp).toBe(need - 1);
    });

    it('reads experience alias when xp is missing', () => {
        const need = GUILD_XP_PER_LEVEL(1);
        const guild = makeGuild(1, 0);
        delete (guild as { xp?: number }).xp;
        (guild as { experience?: number }).experience = need;
        expect(checkGuildLevelUp(guild)).toBe(true);
        expect(guild.level).toBe(2);
        expect(guild.xp).toBe(0);
    });
});
