import { describe, expect, it } from 'vitest';
import {
    inferGuildWarRoundTypeFromMatchKst,
    resolveGuildWarStartEndTimes,
    isGuildWarPrimeMatchWindowKst,
    isGuildWarCatchUpMatchWindowKst,
    isGuildWarPrepTimeKst,
    getNextGuildWarEntryOpenDateKst,
    GUILD_WAR_TUE_WED_DURATION_MS,
    GUILD_WAR_FRI_SUN_DURATION_MS,
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

    it('목 23시 매칭 → 금 0시 개시, 일 23시 종료', () => {
        const matchAt = kstToUtcMs(2026, 5, 14, 23, 15);
        expect(isGuildWarPrimeMatchWindowKst(matchAt)).toBe(true);
        expect(inferGuildWarRoundTypeFromMatchKst(matchAt)).toBe('fri_sun');
        const { startTime, endTime } = resolveGuildWarStartEndTimes('fri_sun', matchAt);
        expect(getKSTDay(startTime)).toBe(5);
        expect(getKSTHours(startTime)).toBe(0);
        expect(endTime - startTime).toBe(GUILD_WAR_FRI_SUN_DURATION_MS);
        expect(getKSTDay(endTime)).toBe(0);
        expect(getKSTHours(endTime)).toBe(23);
    });

    it('화 0시 캐치업 → 당일 화 0시 개시', () => {
        const matchAt = kstToUtcMs(2026, 5, 12, 0, 20);
        expect(isGuildWarCatchUpMatchWindowKst(matchAt)).toBe(true);
        const { startTime } = resolveGuildWarStartEndTimes('tue_wed', matchAt);
        expect(startTime).toBe(getStartOfDayKST(matchAt));
    });

    it('금 0시 캐치업 → 당일 금 0시 개시', () => {
        const matchAt = kstToUtcMs(2026, 5, 15, 0, 20);
        expect(isGuildWarCatchUpMatchWindowKst(matchAt)).toBe(true);
        const { startTime } = resolveGuildWarStartEndTimes('fri_sun', matchAt);
        expect(startTime).toBe(getStartOfDayKST(matchAt));
    });

    it('월·목 0시~23시59분은 준비 시간(입장 불가)', () => {
        expect(isGuildWarPrepTimeKst(kstToUtcMs(2026, 5, 11, 0, 0))).toBe(true);
        expect(isGuildWarPrepTimeKst(kstToUtcMs(2026, 5, 11, 23, 59))).toBe(true);
        expect(isGuildWarPrepTimeKst(kstToUtcMs(2026, 5, 14, 12, 0))).toBe(true);
        expect(isGuildWarPrepTimeKst(kstToUtcMs(2026, 5, 12, 0, 0))).toBe(false);
        expect(isGuildWarPrepTimeKst(kstToUtcMs(2026, 5, 15, 0, 0))).toBe(false);
    });

    it('준비 시간 중 다음 입장 가능 시각은 화·금 0시', () => {
        const monPrep = kstToUtcMs(2026, 5, 11, 10, 0);
        expect(getNextGuildWarEntryOpenDateKst(monPrep)).toBe(getStartOfDayKST(kstToUtcMs(2026, 5, 12, 0, 0)));
        const thuPrep = kstToUtcMs(2026, 5, 14, 10, 0);
        expect(getNextGuildWarEntryOpenDateKst(thuPrep)).toBe(getStartOfDayKST(kstToUtcMs(2026, 5, 15, 0, 0)));
    });

    it('즉시 매칭(토요일)도 이번 금~일 라운드 종료 시각을 씀', () => {
        const matchAt = kstToUtcMs(2026, 5, 16, 15, 20);
        const warType = inferGuildWarRoundTypeFromMatchKst(matchAt);
        expect(warType).toBe('fri_sun');
        const { startTime, endTime } = resolveGuildWarStartEndTimes(warType, matchAt);
        expect(getKSTDay(startTime)).toBe(5);
        expect(getKSTHours(startTime)).toBe(0);
        const remainingOnSat = endTime - matchAt;
        expect(remainingOnSat).toBeGreaterThan(24 * 60 * 60 * 1000);
    });
});
