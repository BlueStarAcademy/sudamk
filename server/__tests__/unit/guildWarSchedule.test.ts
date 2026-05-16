import { describe, expect, it } from 'vitest';
import {
    inferGuildWarRoundTypeFromMatchKst,
    resolveGuildWarStartEndTimes,
    isGuildWarPrimeMatchWindowKst,
    isGuildWarCatchUpMatchWindowKst,
    GUILD_WAR_TUE_WED_DURATION_MS,
    GUILD_WAR_THU_SUN_DURATION_MS,
} from '../../../shared/utils/guildWarSchedule.js';
import { getKSTDay, getKSTHours, getStartOfDayKST } from '../../../shared/utils/timeUtils.js';

/** KST 달력 시각 → UTC epoch (timeUtils와 동일 오프셋) */
function kstToUtcMs(y: number, mo: number, d: number, h: number, min = 0): number {
    return Date.UTC(y, mo - 1, d, h - 9, min);
}

describe('guildWarSchedule', () => {
    it('월 23시 매칭 → 화 0시 개시, 수 23시 종료', () => {
        const matchAt = kstToUtcMs(2026, 5, 11, 23, 30);
        expect(isGuildWarPrimeMatchWindowKst(matchAt)).toBe(true);
        expect(inferGuildWarRoundTypeFromMatchKst(matchAt)).toBe('tue_wed');
        const { startTime, endTime } = resolveGuildWarStartEndTimes('tue_wed', matchAt);
        expect(getKSTDay(startTime)).toBe(2);
        expect(getKSTHours(startTime)).toBe(0);
        expect(endTime - startTime).toBe(GUILD_WAR_TUE_WED_DURATION_MS);
        expect(getKSTDay(endTime)).toBe(3);
        expect(getKSTHours(endTime)).toBe(23);
    });

    it('수 23시 매칭 → 목 0시 개시, 일 23시 종료', () => {
        const matchAt = kstToUtcMs(2026, 5, 13, 23, 15);
        expect(isGuildWarPrimeMatchWindowKst(matchAt)).toBe(true);
        expect(inferGuildWarRoundTypeFromMatchKst(matchAt)).toBe('fri_sun');
        const { startTime, endTime } = resolveGuildWarStartEndTimes('fri_sun', matchAt);
        expect(getKSTDay(startTime)).toBe(4);
        expect(getKSTHours(startTime)).toBe(0);
        expect(endTime - startTime).toBe(GUILD_WAR_THU_SUN_DURATION_MS);
        expect(getKSTDay(endTime)).toBe(0);
        expect(getKSTHours(endTime)).toBe(23);
    });

    it('화 0시 캐치업 → 당일 화 0시 개시', () => {
        const matchAt = kstToUtcMs(2026, 5, 12, 0, 20);
        expect(isGuildWarCatchUpMatchWindowKst(matchAt)).toBe(true);
        const { startTime } = resolveGuildWarStartEndTimes('tue_wed', matchAt);
        expect(startTime).toBe(getStartOfDayKST(matchAt));
    });

    it('즉시 매칭(토요일)도 이번 목~일 라운드 종료 시각을 씀', () => {
        const matchAt = kstToUtcMs(2026, 5, 16, 15, 20);
        const warType = inferGuildWarRoundTypeFromMatchKst(matchAt);
        expect(warType).toBe('fri_sun');
        const { startTime, endTime } = resolveGuildWarStartEndTimes(warType, matchAt);
        expect(getKSTDay(startTime)).toBe(4);
        expect(getKSTHours(startTime)).toBe(0);
        const remainingOnSat = endTime - matchAt;
        expect(remainingOnSat).toBeGreaterThan(24 * 60 * 60 * 1000);
    });
});
