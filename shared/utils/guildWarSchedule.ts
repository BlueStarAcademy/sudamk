import {
    getKSTDay,
    getKSTHours,
    getKSTMinutes,
    getStartOfDayKST,
    getKSTFullYear,
    getKSTMonth,
    getKSTDate_UTC,
} from './timeUtils.js';

/** 신규 전쟁 라운드. 레거시 tue_wed/fri_sun 은 저장된 endTime·duration 폴백용 */
export type GuildWarRoundType = 'weekly' | 'tue_wed' | 'fri_sun';

export type GuildWarCalendarPhase = 'war' | 'settlement' | 'rest' | 'matching';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** 화 0:00 KST ~ 다음 월 0:00 KST (6일) */
export const GUILD_WAR_WEEKLY_DURATION_MS = 6 * DAY_MS;

/** 레거시: 화 0:00 ~ 수 23:00 */
export const GUILD_WAR_TUE_WED_DURATION_MS = 47 * HOUR_MS;

/** 레거시: 금 0:00 ~ 일 23:00 */
export const GUILD_WAR_FRI_SUN_DURATION_MS = 71 * HOUR_MS;

/** @deprecated {@link GUILD_WAR_FRI_SUN_DURATION_MS} */
export const GUILD_WAR_THU_SUN_DURATION_MS = GUILD_WAR_FRI_SUN_DURATION_MS;

/** 월 0:00 종료 후 정산 창(보상 개방까지) */
export const GUILD_WAR_SETTLEMENT_MS = HOUR_MS;

export const GUILD_WAR_DURATION_MS_BY_TYPE: Record<GuildWarRoundType, number> = {
    weekly: GUILD_WAR_WEEKLY_DURATION_MS,
    tue_wed: GUILD_WAR_TUE_WED_DURATION_MS,
    fri_sun: GUILD_WAR_FRI_SUN_DURATION_MS,
};

export function normalizeGuildWarRoundType(warType: unknown): GuildWarRoundType {
    if (warType === 'tue_wed' || warType === 'fri_sun' || warType === 'weekly') return warType;
    return 'weekly';
}

export function durationMsForGuildWarType(warType: unknown): number {
    return GUILD_WAR_DURATION_MS_BY_TYPE[normalizeGuildWarRoundType(warType)];
}

/**
 * KST 달력 위상
 * - war: 화 0:00 ~ 월 0:00
 * - settlement: 월 0:00 ~ 1:00
 * - rest: 월 1:00 ~ 23:00
 * - matching: 월 23:00 ~ 화 0:00
 */
export function getGuildWarCalendarPhaseKst(now: number = Date.now()): GuildWarCalendarPhase {
    const d = getKSTDay(now);
    const h = getKSTHours(now);
    if (d === 1) {
        if (h < 1) return 'settlement';
        if (h < 23) return 'rest';
        return 'matching';
    }
    return 'war';
}

export function isGuildWarSettlementTimeKst(now: number = Date.now()): boolean {
    return getGuildWarCalendarPhaseKst(now) === 'settlement';
}

export function isGuildWarRestTimeKst(now: number = Date.now()): boolean {
    return getGuildWarCalendarPhaseKst(now) === 'rest';
}

/** 정규 매칭 연출 창: 월 23:00~23:59 KST */
export function isGuildWarPrimeMatchWindowKst(now: number = Date.now()): boolean {
    return getKSTDay(now) === 1 && getKSTHours(now) === 23 && getKSTMinutes(now) < 60;
}

/** 매칭 누락 캐치업: 화요일 종일 (월 23시 정규 매칭 누락 보충) */
export function isGuildWarCatchUpMatchWindowKst(now: number = Date.now()): boolean {
    return getKSTDay(now) === 2;
}

/** 정규(월 23시) + 화 캐치업 — 자동 큐 등록·매칭 스케줄 창 */
export function isGuildWarScheduledAutoMatchWindowKst(now: number = Date.now()): boolean {
    return isGuildWarPrimeMatchWindowKst(now) || isGuildWarCatchUpMatchWindowKst(now);
}

/** 화 0:00 ~ 월 0:00 KST 진행 중인 weekly 라운드 안인지 */
function isWithinOngoingWeeklyRoundKst(now: number): boolean {
    const d = getKSTDay(now);
    return d === 2 || d === 3 || d === 4 || d === 5 || d === 6 || d === 0;
}

/** 월요일(정산·휴식·매칭) — 다음 길드전 준비 시간(입장 불가) */
export function isGuildWarPrepTimeKst(now: number = Date.now()): boolean {
    return getKSTDay(now) === 1;
}

/** 준비 시간이 끝나 참여(입장) 가능해지는 다음 시각 — 화 0:00 KST */
export function getNextGuildWarEntryOpenDateKst(now: number = Date.now()): number {
    const kstDay = getKSTDay(now);
    const todayStart = getStartOfDayKST(now);
    if (kstDay === 1) {
        return todayStart + DAY_MS;
    }
    if (kstDay === 2) {
        return todayStart;
    }
    let daysUntilTue = (2 - kstDay + 7) % 7;
    if (daysUntilTue === 0) daysUntilTue = 7;
    return todayStart + daysUntilTue * DAY_MS;
}

/** 매칭 시각으로 라운드 타입 추론 — 신규는 항상 weekly */
export function inferGuildWarRoundTypeFromMatchKst(_matchAtMs: number): GuildWarRoundType {
    return 'weekly';
}

/**
 * 전쟁 개시(화 0:00) KST 날짜 문자열 YYYY-MM-DD — warWeekId 용
 */
export function formatGuildWarWeekIdFromStartMs(startMs: number): string {
    const y = getKSTFullYear(startMs);
    const m = String(getKSTMonth(startMs) + 1).padStart(2, '0');
    const d = String(getKSTDate_UTC(startMs)).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * 매칭 완료 시각 기준으로 전쟁 개시·종료 시각(KST 달력 고정)을 계산한다.
 * weekly: 다음(또는 당일) 화 0:00 시작 → 다음 월 0:00 종료 (144h)
 * 레거시 타입도 동일 weekly 일정으로 해석한다.
 */
export function resolveGuildWarStartEndTimes(
    warType: GuildWarRoundType,
    matchCompletedAtMs: number,
): { startTime: number; endTime: number } {
    const normalized = normalizeGuildWarRoundType(warType);
    const kstDay = getKSTDay(matchCompletedAtMs);
    const todayStart = getStartOfDayKST(matchCompletedAtMs);

    // 레거시 fri_sun/tue_wed 진행 중 전쟁 재매칭이라면 저장된 duration은 guildWarEndMs가 담당.
    // 신규 계산은 항상 weekly 달력.
    void normalized;

    let startTime: number;
    if (isWithinOngoingWeeklyRoundKst(matchCompletedAtMs)) {
        // 화=0, 수=-1, …, 일=-5 일 전 화요일 0시
        const daysSinceTue = kstDay === 0 ? 5 : kstDay - 2;
        startTime = todayStart - daysSinceTue * DAY_MS;
    } else {
        // 월요일: 다음 화 0시
        const daysUntilTue = (2 - kstDay + 7) % 7;
        startTime = todayStart + daysUntilTue * DAY_MS;
    }
    const endTime = startTime + GUILD_WAR_WEEKLY_DURATION_MS;
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

export function guildWarEndMs(
    w: { endTime?: unknown; startTime?: unknown; warType?: GuildWarRoundType } | null | undefined,
): number {
    const et = w?.endTime;
    if (et != null && et !== '') {
        if (typeof et === 'number' && Number.isFinite(et)) return et;
        if (typeof et === 'string') {
            const parsed = Date.parse(et);
            if (Number.isFinite(parsed)) return parsed;
            const n = Number(et);
            if (Number.isFinite(n) && n > 0) return n;
        }
    }
    const startMs = guildWarStartMs(w);
    if (startMs <= 0) return 0;
    return startMs + durationMsForGuildWarType(w?.warType);
}

export type GuildWarDisplayCountdownTarget = {
    kind: 'until_open' | 'until_end';
    targetMs: number;
};

/**
 * UI 카운트다운: 진행 중이면 종료까지, 그 외에는 다음 화 0시 개시까지.
 */
export function getGuildWarDisplayCountdownTarget(
    now: number = Date.now(),
    activeWar?: { startTime?: unknown; endTime?: unknown; status?: string; warType?: GuildWarRoundType } | null,
): GuildWarDisplayCountdownTarget | null {
    if (activeWar && guildWarIsOpenForPlay(activeWar, now)) {
        const endMs = guildWarEndMs(activeWar);
        if (endMs > now) {
            return { kind: 'until_end', targetMs: endMs };
        }
    }

    const nextOpen = getNextGuildWarEntryOpenDateKst(now);

    if (activeWar?.status === 'active') {
        const startMs = guildWarStartMs(activeWar);
        if (startMs > now) {
            return { kind: 'until_open', targetMs: Math.min(startMs, nextOpen) };
        }
    }

    if (isGuildWarPrepTimeKst(now) || !activeWar) {
        return { kind: 'until_open', targetMs: nextOpen };
    }

    return { kind: 'until_open', targetMs: nextOpen };
}

/** 전쟁 개시 시각 이후이고 아직 종료 전인지 (플레이·입장 가능) */
export function guildWarIsOpenForPlay(
    w: { startTime?: unknown; endTime?: unknown; status?: string } | null | undefined,
    now: number,
): boolean {
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
    const warType = (w as { warType?: GuildWarRoundType } | null | undefined)?.warType;
    return startMs > 0 && now < startMs + durationMsForGuildWarType(warType);
}

/** 보상 수령 개방 시각: 예정 종료 + 정산 1시간 */
export function guildWarRewardAvailableAtMs(
    w: { endTime?: unknown; startTime?: unknown; warType?: GuildWarRoundType; rewardAvailableAt?: unknown } | null | undefined,
): number {
    const explicit = w?.rewardAvailableAt;
    if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit > 0) return explicit;
    if (typeof explicit === 'string' && explicit.length > 0) {
        const p = Date.parse(explicit);
        if (Number.isFinite(p)) return p;
        const n = Number(explicit);
        if (Number.isFinite(n) && n > 0) return n;
    }
    const endMs = guildWarEndMs(w);
    if (endMs <= 0) return 0;
    return endMs + GUILD_WAR_SETTLEMENT_MS;
}
