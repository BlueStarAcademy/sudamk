import { describe, expect, it } from 'vitest';
import {
    inferGuildWarRoundTypeFromMatchKst,
    resolveGuildWarStartEndTimes,
    isGuildWarPrimeMatchWindowKst,
    isGuildWarCatchUpMatchWindowKst,
    isGuildWarPrepTimeKst,
    isGuildWarSettlementTimeKst,
    isGuildWarRestTimeKst,
    getGuildWarCalendarPhaseKst,
    getNextGuildWarEntryOpenDateKst,
    getGuildWarDisplayCountdownTarget,
    guildWarRewardAvailableAtMs,
    GUILD_WAR_WEEKLY_DURATION_MS,
} from '../../../shared/utils/guildWarSchedule.js';
import { getKSTDay, getKSTHours, getStartOfDayKST, getNextGuildWarMatchDate, getNextGuildWarStartDate } from '../../../shared/utils/timeUtils.js';
import { getGuildWarParticipationRewardMult } from '../../../shared/utils/guildWarParticipationRewards.js';

/** KST 달력 시각 → UTC epoch (timeUtils와 동일 오프셋) */
function kstToUtcMs(y: number, mo: number, d: number, h: number, min = 0): number {
    return Date.UTC(y, mo - 1, d, h - 9, min);
}

describe('guildWarSchedule weekly', () => {
    it('월 23시 매칭 → 화 0시 개시, 다음 월 0시 종료', () => {
        const matchAt = kstToUtcMs(2026, 5, 11, 23, 30); // Mon
        expect(isGuildWarPrimeMatchWindowKst(matchAt)).toBe(true);
        expect(inferGuildWarRoundTypeFromMatchKst(matchAt)).toBe('weekly');
        const { startTime, endTime } = resolveGuildWarStartEndTimes('weekly', matchAt);
        expect(getKSTDay(startTime)).toBe(2);
        expect(getKSTHours(startTime)).toBe(0);
        expect(endTime - startTime).toBe(GUILD_WAR_WEEKLY_DURATION_MS);
        expect(getKSTDay(endTime)).toBe(1);
        expect(getKSTHours(endTime)).toBe(0);
        expect(guildWarRewardAvailableAtMs({ endTime, warType: 'weekly' })).toBe(endTime + 60 * 60 * 1000);
    });

    it('화 캐치업 → 당일 화 0시 개시', () => {
        const matchAt = kstToUtcMs(2026, 5, 12, 0, 20);
        expect(isGuildWarCatchUpMatchWindowKst(matchAt)).toBe(true);
        const { startTime } = resolveGuildWarStartEndTimes('weekly', matchAt);
        expect(startTime).toBe(getStartOfDayKST(matchAt));
    });

    it('수요일 오후 매칭도 이번 주 화 0시 개시', () => {
        const matchAt = kstToUtcMs(2026, 5, 13, 15, 0);
        const { startTime, endTime } = resolveGuildWarStartEndTimes('weekly', matchAt);
        expect(startTime).toBe(getStartOfDayKST(kstToUtcMs(2026, 5, 12, 0, 0)));
        expect(endTime - startTime).toBe(GUILD_WAR_WEEKLY_DURATION_MS);
        expect(matchAt).toBeGreaterThan(startTime);
        expect(matchAt).toBeLessThan(endTime);
    });

    it('캐치업은 화요일만, 수·금·토는 아님', () => {
        expect(isGuildWarCatchUpMatchWindowKst(kstToUtcMs(2026, 5, 12, 10, 0))).toBe(true);
        expect(isGuildWarCatchUpMatchWindowKst(kstToUtcMs(2026, 5, 13, 10, 0))).toBe(false);
        expect(isGuildWarCatchUpMatchWindowKst(kstToUtcMs(2026, 5, 15, 10, 0))).toBe(false);
        expect(isGuildWarCatchUpMatchWindowKst(kstToUtcMs(2026, 5, 16, 10, 0))).toBe(false);
    });

    it('월요일 위상: 정산 → 휴식 → 매칭', () => {
        expect(getGuildWarCalendarPhaseKst(kstToUtcMs(2026, 5, 11, 0, 30))).toBe('settlement');
        expect(isGuildWarSettlementTimeKst(kstToUtcMs(2026, 5, 11, 0, 30))).toBe(true);
        expect(getGuildWarCalendarPhaseKst(kstToUtcMs(2026, 5, 11, 12, 0))).toBe('rest');
        expect(isGuildWarRestTimeKst(kstToUtcMs(2026, 5, 11, 12, 0))).toBe(true);
        expect(getGuildWarCalendarPhaseKst(kstToUtcMs(2026, 5, 11, 23, 15))).toBe('matching');
        expect(isGuildWarPrepTimeKst(kstToUtcMs(2026, 5, 11, 12, 0))).toBe(true);
        expect(isGuildWarPrepTimeKst(kstToUtcMs(2026, 5, 12, 0, 0))).toBe(false);
        expect(isGuildWarPrepTimeKst(kstToUtcMs(2026, 5, 14, 12, 0))).toBe(false);
    });

    it('준비 시간 중 다음 입장 가능 시각은 화 0시', () => {
        const monPrep = kstToUtcMs(2026, 5, 11, 10, 0);
        expect(getNextGuildWarEntryOpenDateKst(monPrep)).toBe(getStartOfDayKST(kstToUtcMs(2026, 5, 12, 0, 0)));
    });

    it('목요일에도 카운트다운은 다음 화 0시', () => {
        const thuAfternoon = kstToUtcMs(2026, 6, 18, 14, 0);
        const nextTue = getStartOfDayKST(kstToUtcMs(2026, 6, 23, 0, 0));
        const target = getGuildWarDisplayCountdownTarget(thuAfternoon, null);
        expect(target).toEqual({ kind: 'until_open', targetMs: nextTue });
    });

    it('timeUtils: 다음 매칭은 월 23시, 다음 개시는 화 0시', () => {
        const wed = kstToUtcMs(2026, 5, 13, 12, 0);
        const nextMatch = getNextGuildWarMatchDate(wed);
        expect(getKSTDay(nextMatch)).toBe(1);
        expect(getKSTHours(nextMatch)).toBe(23);
        const nextStart = getNextGuildWarStartDate(wed);
        expect(getKSTDay(nextStart)).toBe(2);
        expect(getKSTHours(nextStart)).toBe(0);
    });
});

describe('guildWarParticipationRewards', () => {
    it('6+/4–5/1–3/0 참여도 배수', () => {
        expect(getGuildWarParticipationRewardMult(0)).toBe(0);
        expect(getGuildWarParticipationRewardMult(1)).toBe(0.5);
        expect(getGuildWarParticipationRewardMult(3)).toBe(0.5);
        expect(getGuildWarParticipationRewardMult(4)).toBe(0.75);
        expect(getGuildWarParticipationRewardMult(5)).toBe(0.75);
        expect(getGuildWarParticipationRewardMult(6)).toBe(1);
        expect(getGuildWarParticipationRewardMult(12)).toBe(1);
    });
});
