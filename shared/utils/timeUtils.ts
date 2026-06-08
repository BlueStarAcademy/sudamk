const KST_OFFSET = 9 * 60 * 60 * 1000;

export type SeasonInfo = {
    year: number;
    season: 1 | 2 | 3 | 4;
    name: string; // e.g., '25-1시즌'
};

export const getKSTDate = (date: Date | number = Date.now()): Date => {
    const utc = typeof date === 'number' ? date : date.getTime();
    return new Date(utc + KST_OFFSET);
};

// KST 시간의 요일, 시, 분을 가져오는 헬퍼 함수들
export const getKSTDay = (date: Date | number = Date.now()): number => {
    const kstDate = getKSTDate(date);
    // getKSTDate는 UTC+9 시간을 UTC로 변환한 Date 객체를 반환하므로
    // UTC 메서드를 사용하여 KST의 날짜/시간 정보를 얻을 수 있습니다
    return kstDate.getUTCDay();
};

export const getKSTHours = (date: Date | number = Date.now()): number => {
    const kstDate = getKSTDate(date);
    return kstDate.getUTCHours();
};

export const getKSTMinutes = (date: Date | number = Date.now()): number => {
    const kstDate = getKSTDate(date);
    return kstDate.getUTCMinutes();
};

export const getKSTDate_UTC = (date: Date | number = Date.now()): number => {
    const kstDate = getKSTDate(date);
    return kstDate.getUTCDate();
};

export const getKSTMonth = (date: Date | number = Date.now()): number => {
    const kstDate = getKSTDate(date);
    return kstDate.getUTCMonth();
};

export const getKSTFullYear = (date: Date | number = Date.now()): number => {
    const kstDate = getKSTDate(date);
    return kstDate.getUTCFullYear();
};

export const isSameDayKST = (ts1: number | undefined, ts2: number): boolean => {
    if (!ts1 || ts1 === 0) return false;
    const d1 = getKSTDate(ts1);
    const d2 = getKSTDate(ts2);
    return d1.getUTCFullYear() === d2.getUTCFullYear() &&
           d1.getUTCMonth() === d2.getUTCMonth() &&
           d1.getUTCDate() === d2.getUTCDate();
};

export const isDifferentDayKST = (ts1: number | undefined, ts2: number): boolean => {
    if (!ts1 || ts1 === 0) return true;
    return !isSameDayKST(ts1, ts2);
};

export const isDifferentWeekKST = (ts1: number | undefined, ts2: number): boolean => {
    if (!ts1 || ts1 === 0) return true; // Treat no previous update as a new week

    const d1 = getKSTDate(ts1);
    const d2 = getKSTDate(ts2);
    
    // If years are different, it's definitely a different week
    if (d1.getUTCFullYear() !== d2.getUTCFullYear()) {
        return true;
    }

    // Calculate the date of the Monday for each date
    const day1 = d1.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const diff1 = d1.getUTCDate() - day1 + (day1 === 0 ? -6 : 1); // Adjust for Sunday
    const monday1 = new Date(d1);
    monday1.setUTCDate(diff1);
    monday1.setUTCHours(0, 0, 0, 0);

    const day2 = d2.getUTCDay();
    const diff2 = d2.getUTCDate() - day2 + (day2 === 0 ? -6 : 1);
    const monday2 = new Date(d2);
    monday2.setUTCDate(diff2);
    monday2.setUTCHours(0, 0, 0, 0);

    return monday1.getTime() !== monday2.getTime();
};

export const isDifferentMonthKST = (ts1: number | undefined, ts2: number): boolean => {
    if (!ts1 || ts1 === 0) return true;
    const d1 = getKSTDate(ts1);
    const d2 = getKSTDate(ts2);

    return d1.getUTCFullYear() !== d2.getUTCFullYear() || d1.getUTCMonth() !== d2.getUTCMonth();
};


/** KST 기준 달력 날짜 키 `YYYY-MM-DD` */
export function formatKstYmd(date: Date | number = Date.now()): string {
    const d = getKSTDate(date);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** 현재 KST 분기 시즌이 끝나는 달력일의 월·일만 `MM:DD` (예: 06:30) */
export function getCurrentSeasonEndMonthDayKST(date: Date | number = Date.now()): string {
    const s = getCurrentSeason(date);
    const monthIndex = s.season * 3;
    const end = new Date(Date.UTC(s.year, monthIndex, 0));
    const mm = String(end.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(end.getUTCDate()).padStart(2, '0');
    return `${mm}:${dd}`;
}

export const getCurrentSeason = (date: Date | number = Date.now()): SeasonInfo => {
    const d = getKSTDate(date);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth(); // 0-11
    let season: 1 | 2 | 3 | 4;

    if (month < 3) season = 1;      // Jan, Feb, Mar (Month 0, 1, 2)
    else if (month < 6) season = 2; // Apr, May, Jun (Month 3, 4, 5)
    else if (month < 9) season = 3; // Jul, Aug, Sep (Month 6, 7, 8)
    else season = 4;                // Oct, Nov, Dec (Month 9, 10, 11)
    
    const shortYear = year.toString().slice(-2);
    return { year, season, name: `${shortYear}-${season}시즌` };
};

/** 다음 분기 시즌이 시작되는 KST 순간(다음 분기 1일 00:00 KST)의 UTC ms */
export function getNextSeasonStartTimestampKST(date: Date | number = Date.now()): number {
    const cur = getCurrentSeason(date);
    let y = cur.year;
    let month1 = 4;
    if (cur.season === 1) {
        month1 = 4;
    } else if (cur.season === 2) {
        month1 = 7;
    } else if (cur.season === 3) {
        month1 = 10;
    } else {
        month1 = 1;
        y += 1;
    }
    return new Date(`${y}-${String(month1).padStart(2, '0')}-01T00:00:00+09:00`).getTime();
}

/** 현재 시즌 종료(다음 시즌 시작 시점)까지 남은 일·시간 — 정수 일 + 0~23시간 */
export function getVersusSeasonRemainingDaysHours(date: Date | number = Date.now()): { days: number; hours: number } {
    const t = typeof date === 'number' ? date : date.getTime();
    const end = getNextSeasonStartTimestampKST(t);
    const ms = Math.max(0, end - t);
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    return { days, hours };
}

export const getPreviousSeason = (date: Date | number = Date.now()): SeasonInfo => {
    const d = getKSTDate(date);
    const currentYear = d.getUTCFullYear();
    const currentMonth = d.getUTCMonth();
    
    let prevYear = currentYear;
    let prevSeason: 1 | 2 | 3 | 4;

    if (currentMonth < 3) { // Q1 -> prev year Q4
        prevSeason = 4;
        prevYear -= 1;
    } else if (currentMonth < 6) { // Q2 -> Q1
        prevSeason = 1;
    } else if (currentMonth < 9) { // Q3 -> Q2
        prevSeason = 2;
    } else { // Q4 -> Q3
        prevSeason = 3;
    }

    const shortYear = prevYear.toString().slice(-2);
    return { year: prevYear, season: prevSeason, name: `${shortYear}-${prevSeason}시즌` };
};

/** 대기실 지난 랭킹: 집계·표시 시작 시즌 (2026년 1분기 = 26-1시즌) */
export const FIRST_TRACKED_RANKING_SEASON_YEAR = 2026;
export const FIRST_TRACKED_RANKING_SEASON_QUARTER = 1 as const;

export const getFirstTrackedRankingSeason = (): SeasonInfo => {
    const year = FIRST_TRACKED_RANKING_SEASON_YEAR;
    const season = FIRST_TRACKED_RANKING_SEASON_QUARTER;
    const shortYear = year.toString().slice(-2);
    return { year, season, name: `${shortYear}-${season}시즌` };
};

const compareSeasonChronological = (a: SeasonInfo, b: SeasonInfo): number => {
    if (a.year !== b.year) return a.year - b.year;
    return a.season - b.season;
};

/** 직전 시즌 다음(분기 롤오버) */
export const getNextSeasonInfo = (info: SeasonInfo): SeasonInfo => {
    if (info.season === 4) {
        const y = info.year + 1;
        return { year: y, season: 1, name: `${y.toString().slice(-2)}-1시즌` };
    }
    const s = (info.season + 1) as 1 | 2 | 3 | 4;
    return { year: info.year, season: s, name: `${info.year.toString().slice(-2)}-${s}시즌` };
};

/**
 * 종료된 시즌만. 26-1시즌부터 마지막 종료 시즌(getPreviousSeason)까지, 최신순.
 * 아직 추적 구간에 종료된 시즌이 없으면 빈 배열.
 */
export const getCompletedTrackedRankingSeasonsNewestFirst = (date: Date | number = Date.now()): SeasonInfo[] => {
    const first = getFirstTrackedRankingSeason();
    const lastCompleted = getPreviousSeason(date);
    if (compareSeasonChronological(lastCompleted, first) < 0) {
        return [];
    }
    const ascending: SeasonInfo[] = [];
    let cur: SeasonInfo = { ...first };
    for (;;) {
        ascending.push(cur);
        if (cur.year === lastCompleted.year && cur.season === lastCompleted.season) break;
        cur = getNextSeasonInfo(cur);
    }
    return ascending.reverse();
};

export const getStartOfDayKST = (timestamp: number = Date.now()): number => {
    const kstDate = getKSTDate(timestamp);
    kstDate.setUTCHours(0, 0, 0, 0);
    // Convert back to UTC timestamp
    return kstDate.getTime() - KST_OFFSET;
};

/** 다음 KST 자정(당일이 아닌 다음날 0:00 KST)까지의 기준 시각(UTC ms) */
export const getNextKstMidnightUtcMs = (timestamp: number = Date.now()): number => {
    return getStartOfDayKST(timestamp) + 24 * 60 * 60 * 1000;
};

/**
 * `dailyShopPurchases` 등에 저장된 `date` 값 정규화.
 * JSON 직렬화·DB에서 숫자 밀리초, ISO 문자열, `Date` 등으로 올 수 있어 KST 일일 판정이 어긋나지 않게 처리합니다.
 */
export function shopPurchaseRecordDateMs(raw: unknown): number {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (raw instanceof Date) {
        const t = raw.getTime();
        return Number.isFinite(t) ? t : 0;
    }
    if (typeof raw === 'string') {
        const n = Number(raw);
        if (Number.isFinite(n)) return n;
        const parsed = Date.parse(raw);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

/** KST 기준 오늘 날짜 문자열 'YYYY-MM-DD' (길드 보스 일일 참여 등에 사용) */
export const getTodayKSTDateString = (date: Date | number = Date.now()): string => {
    const d = getKSTDate(date);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/** KST 기준 연-월 키 `YYYY-MM` — 챔피언십 PVP/펫 랭킹 월간 시즌 구분용 */
export const getKstYearMonthKey = (date: Date | number = Date.now()): string => {
    const d = getKSTDate(date);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
};

export const formatDateTimeKST = (timestamp: number): string => {
    // timestamp는 UTC 기준 밀리초. 이 순간을 한국 시간(Asia/Seoul)으로 표시 (getKSTDate 사용 시 이중 변환되므로 사용하지 않음)
    return new Date(timestamp).toLocaleString('ko-KR', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Asia/Seoul'
    });
};

export const formatLastLogin = (timestamp: number | undefined): string => {
    if (!timestamp) return '방문 기록 없음';
    const now = Date.now();
    const diff = now - timestamp;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return '오늘';
    if (days === 1) return '어제';
    if (days < 7) return `${days}일 전`;
    if (days < 30) return `${Math.floor(days / 7)}주 전`;
    if (days < 365) return `${Math.floor(days / 30)}개월 전`;
    return `${Math.floor(days / 365)}년 전`;
};

/** 길드원 목록용: 1시간 이내 / N시간전 / N일전 / N주전 / N달전 / 장기미접속 */
export const formatLastSeenGuild = (timestamp: number | undefined): string => {
    if (timestamp == null || timestamp <= 0) return '장기미접속';
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 0) return '1시간 이내'; // 시계 오차 대비
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    if (minutes < 60) return '1시간 이내';
    if (hours < 24) return `${hours}시간전`;
    if (days < 7) return `${days}일전`;
    if (weeks < 4) return `${weeks}주전`;
    if (months < 12) return `${months}달전`;
    return '장기미접속';
};

/** 길드전 매칭 연출: 월·목 23:00 KST. 전쟁 개시·참여: 화·금 0:00 KST. 준비(입장 불가): 월·목 0:00~23:59 KST. */

const GUILD_WAR_MATCH_HOUR_MS = 23 * 60 * 60 * 1000;

/** 다음 길드전 매칭 시각 (월요일 23:00 또는 목요일 23:00 KST, 가까운 쪽) */
export const getNextGuildWarMatchDate = (now: number = Date.now()): number => {
    const kstDay = getKSTDay(now);
    const kstHours = getKSTHours(now);
    const kstMinutes = getKSTMinutes(now);
    const todayStart = getStartOfDayKST(now);
    const oneDay = 24 * 60 * 60 * 1000;

    const inMonMatchWindow = kstDay === 1 && kstHours === 23 && kstMinutes < 60;
    const inThuMatchWindow = kstDay === 4 && kstHours === 23 && kstMinutes < 60;
    if (inMonMatchWindow) return todayStart + 3 * oneDay + GUILD_WAR_MATCH_HOUR_MS;
    if (inThuMatchWindow) {
        let daysUntilMon = (1 - kstDay + 7) % 7;
        if (daysUntilMon === 0) daysUntilMon = 7;
        return todayStart + daysUntilMon * oneDay + GUILD_WAR_MATCH_HOUR_MS;
    }

    if (kstDay === 1 && kstHours < 23) return todayStart + GUILD_WAR_MATCH_HOUR_MS;
    if (kstDay === 4 && kstHours < 23) return todayStart + GUILD_WAR_MATCH_HOUR_MS;

    let daysUntilMon = (1 - kstDay + 7) % 7;
    if (daysUntilMon === 0) daysUntilMon = 7;
    let daysUntilThu = (4 - kstDay + 7) % 7;
    if (daysUntilThu === 0) daysUntilThu = 7;
    const nextMon = todayStart + daysUntilMon * oneDay + GUILD_WAR_MATCH_HOUR_MS;
    const nextThu = todayStart + daysUntilThu * oneDay + GUILD_WAR_MATCH_HOUR_MS;
    return Math.min(nextMon, nextThu);
};

/** 다음 길드전 전쟁 개시·참여 가능 시각 (화요일 0:00 또는 금요일 0:00 KST) */
export const getNextGuildWarStartDate = (now: number = Date.now()): number => {
    const matchAt = getNextGuildWarMatchDate(now);
    const matchDay = getKSTDay(matchAt);
    const matchDayStart = getStartOfDayKST(matchAt);
    const oneDay = 24 * 60 * 60 * 1000;
    if (matchDay === 1) return matchDayStart + oneDay;
    if (matchDay === 4) return matchDayStart + oneDay;
    return matchDayStart;
};

/** 다음 길드전 신청 마감 시각 (전쟁 개시 1시간 전 = 월·목 23:00 KST) */
export const getNextGuildWarApplicationDeadline = (now: number = Date.now()): number => {
    return getNextGuildWarStartDate(now) - 60 * 60 * 1000;
};

/** 전쟁 개시·매칭 시각 기준 라운드 타입 (화 0시 → tue_wed, 금 0시 → fri_sun) */
export const getGuildWarTypeFromMatchTime = (matchTimeMs: number): 'tue_wed' | 'fri_sun' => {
    const d = getKSTDay(matchTimeMs);
    const h = getKSTHours(matchTimeMs);
    if (d === 1 && h === 23) return 'tue_wed';
    if (d === 2 && h === 0) return 'tue_wed';
    if (d === 4 && h === 23) return 'fri_sun';
    if (d === 5 && h === 0) return 'fri_sun';
    if (d === 2 || d === 3) return 'tue_wed';
    if (d === 5 || d === 6 || d === 0) return 'fri_sun';
    if (d === 1) return 'tue_wed';
    return 'fri_sun';
};

export const getTimeUntilNextMondayKST = (): number => {
    const now = Date.now();
    const kstNow = getKSTDate(now);
    const dayOfWeek = kstNow.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7;
    const nextMonday = new Date(kstNow);
    nextMonday.setUTCDate(kstNow.getUTCDate() + daysUntilMonday);
    nextMonday.setUTCHours(0, 0, 0, 0);
    return nextMonday.getTime() - KST_OFFSET - now;
};