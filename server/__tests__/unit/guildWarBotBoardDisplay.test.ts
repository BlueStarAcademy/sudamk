import { describe, expect, it } from 'vitest';
import {
    aggregateGuildWarBoardTotals,
    getGuildWarBotBoardDisplayTally,
} from '../../../shared/utils/guildWarBoardOwner.js';
import { GUILD_WAR_BOT_GUILD_ID } from '../../../shared/constants/auth.js';

const baseInput = {
    warId: 'war-1',
    boardId: 'top-left',
    guild1Id: 'human-guild',
    guild2Id: GUILD_WAR_BOT_GUILD_ID,
    botGuildId: GUILD_WAR_BOT_GUILD_ID,
    isBotWar: true,
};

describe('getGuildWarBotBoardDisplayTally pre-start', () => {
    it('전쟁 개시 전(isWarOpenForPlay=false)에는 봇 연출 없이 0vs0', () => {
        const board = {
            guild1Attempts: 0,
            guild2Attempts: 12,
            guild1Stars: 0,
            guild2Stars: 0,
        };
        const tally = getGuildWarBotBoardDisplayTally(board, {
            ...baseInput,
            isWarOpenForPlay: false,
        });
        expect(tally.guild1Stars).toBe(0);
        expect(tally.guild2Stars).toBe(0);
        expect(tally.guild1HouseTally).toBe(0);
        expect(tally.guild2HouseTally).toBe(0);
        expect(tally.occupierCapturesDisplay).toBeUndefined();
        expect(tally.occupierScoreDiffDisplay).toBeUndefined();
    });

    it('전쟁 개시 후(isWarOpenForPlay=true)에는 봇 도전권 기반 연출 적용', () => {
        const board = {
            guild1Attempts: 0,
            guild2Attempts: 3,
            guild1Stars: 0,
            guild2Stars: 0,
        };
        const tally = getGuildWarBotBoardDisplayTally(board, {
            ...baseInput,
            isWarOpenForPlay: true,
        });
        expect(tally.guild2Stars).toBeGreaterThan(0);
        expect(tally.guild2HouseTally).toBeGreaterThan(0);
    });

    it('완료된 봇 길드전 합산에도 봇 별·집 연출 반영', () => {
        const startTime = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const endTime = Date.now() - 24 * 60 * 60 * 1000;
        const totals = aggregateGuildWarBoardTotals(
            {
                id: 'war-completed',
                status: 'completed',
                isBotGuild: true,
                guild1Id: 'human-guild',
                guild2Id: GUILD_WAR_BOT_GUILD_ID,
                startTime,
                endTime,
                boards: {
                    'top-left': {
                        guild1Attempts: 0,
                        guild2Attempts: 6,
                        guild1Stars: 0,
                        guild2Stars: 0,
                    },
                },
            },
            Date.now(),
        );
        expect(totals.guild2Stars).toBeGreaterThan(0);
        expect(totals.guild2Score).toBeGreaterThan(0);
    });
});
