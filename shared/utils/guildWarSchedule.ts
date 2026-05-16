import {
    getKSTDay,
    getKSTHours,
    getKSTMinutes,
    getStartOfDayKST,
} from './timeUtils.js';

export type GuildWarRoundType = 'tue_wed' | 'fri_sun';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** 화 0:00 KST ~ 수 23:00 KST */
export const GUILD_WAR_TUE_WED_DURATION_MS = 47 * HOUR_MS;

/** 목 0:00 KST ~ 일 23:00 KST */
export const GUILD_WAR_THU_SUN_DURATION_MS = 95 * HOUR_MS;

export const GUILD_WAR_DURATION_MS_BY_TYPE: Record<GuildWarRoundType, number> = {
    tue_wed: GUILD_WAR_TUE_WED_DURATION_MS,
    fri_sun: GUILD_WAR_THU_SUN_DURATION_MS,
};

/** 정규 매칭 연출 창: 월·수 23:00~23:59 KST */
export function isGuildWarPrimeMatchWindowKst(now: number = Date.now()): boolean {
    const d = getKSTDay(now);
    const h = getKSTHours(now);
    const m = getKSTMinutes(now);
    return (d === 1 || d === 3) && h === 23 && m < 60;
}

/** 매칭 누락 캐치업: 화·목 0:00~0:59 KST */
export function isGuildWarCatchUpMatchWindowKst(now: number = Date.now()): boolean {
    const d = getKSTDay(now);
    const h = getKSTHours(now);
    const m = getKSTMinutes(now);
    return (d === 2 || d === 4) && h === 0 && m < 60;
}

/** 매칭 시각(또는 즉시 매칭 시각)으로 이번 라운드 타입 추론 */
export function inferGuildWarRoundTypeFromMatchKst(matchAtMs: number): GuildWarRoundType {
    const d = getKSTDay(matchAtMs);
    const h = getKSTHours(matchAtMs);
    if (d === 1 && h === 23) return 'tue_wed';
    if (d === 2 && h === 0) return 'tue_wed';
    if (d === 3 && h === 23) return 'fri_sun';
    if (d === 4 && h === 0) return 'fri_sun';
    // 화~수: tue_wed 라운드 진행 구간 / 목~일: fri_sun 라운드 진행 구간
    if (d === 2 || (d === 3 && h < 23)) return 'tue_wed';
    return 'fri_sun';
}

/**
 * 매칭 완료 시각 기준으로 전쟁 개시·종료 시각(KST 달력 고정)을 계산한다.
 * - tue_wed: 다음(또는 당일) 화 0:00 시작 → 수 23:00 종료
 * - fri_sun: 다음(또는 당일) 목 0:00 시작 → 일 23:00 종료
 */
export function resolveGuildWarStartEndTimes(
    warType: GuildWarRoundType,
    matchCompletedAtMs: number,
): { startTime: number; endTime: number } {
    const kstDay = getKSTDay(matchCompletedAtMs);
    const todayStart = getStartOfDayKST(matchCompletedAtMs);

    if (warType === 'tue_wed') {
        const daysUntilTue = (2 - kstDay + 7) % 7;
        const startTime = todayStart + daysUntilTue * DAY_MS;
        const endTime = startTime + GUILD_WAR_TUE_WED_DURATION_MS;
        return { startTime, endTime };
    }

    const daysUntilThu = (4 - kstDay + 7) % 7;
    const startTime = todayStart + daysUntilThu * DAY_MS;
    const endTime = startTime + GUILD_WAR_THU_SUN_DURATION_MS;
    return { startTime, endTime };
}

export function guildWarStartMs(w: { startTime?: unknown } | null | undefined): number {
    const st = w?.startTime;
    if (typeof st === 'number' && Number.isFinite(st)) return st;
    if (typeof st === 'string' && st.length > 0) {
        const p = Date.parse(st);
        if (Number.isFinite(p)) return p;
        const n = Number(st);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return 0;
}

/** 전쟁 개시 시각 이후이고 아직 종료 전인지 (플레이·입장 가능) */
export function guildWarIsOpenForPlay(w: { startTime?: unknown; endTime?: unknown; status?: string } | null | undefined, now: number): boolean {
    if (w?.status !== 'active') return false;
    const startMs = guildWarStartMs(w);
    if (startMs > 0 && now < startMs) return false;
    const et = w?.endTime;
    if (et != null && et !== '') {
        if (typeof et === 'number' && Number.isFinite(et)) return now < et;
        if (typeof et === 'string') {
            const parsed = Date.parse(et);
            if (Number.isFinite(parsed)) return now < parsed;
            const n = Number(et);
            if (Number.isFinite(n) && n > 0) return now < n;
        }
    }
    return startMs > 0 && now < startMs + GUILD_WAR_TUE_WED_DURATION_MS;
}
