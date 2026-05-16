import type { ChampionshipVersusVenueKind, User } from '../types/entities.js';
import {
    CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX,
    CHAMPIONSHIP_VERSUS_DUEL_TICKET_REGEN_MS,
    CHAMPIONSHIP_VERSUS_VENUE_KINDS,
} from '../constants/championshipVersusVenue.js';

export type ChampionshipVersusDuelTicketsPick = Pick<
    User,
    'championshipVersusDuelTicketsByVenue' | 'championshipVersusDuelTickets' | 'championshipVersusDuelTicketNextAtByVenue' | 'championshipVersusDuelTicketNextAt'
>;

export type ChampionshipVersusDuelTicketComputed = {
    tickets: number;
    nextAt?: number;
};

export function clampChampionshipVersusDuelTicketCount(raw: unknown): number {
    const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX;
    return Math.max(0, Math.min(CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX, n));
}

export function hasPersistedVersusDuelTicketsByVenue(user: ChampionshipVersusDuelTicketsPick): boolean {
    const m = user.championshipVersusDuelTicketsByVenue;
    if (!m || typeof m !== 'object') return false;
    return CHAMPIONSHIP_VERSUS_VENUE_KINDS.every((k) => typeof (m as Record<string, unknown>)[k] === 'number');
}

function readPersistedTicketRaw(
    user: ChampionshipVersusDuelTicketsPick,
    venue: ChampionshipVersusVenueKind,
): number | undefined {
    const by = user.championshipVersusDuelTicketsByVenue;
    if (by && typeof by[venue] === 'number' && Number.isFinite(by[venue])) {
        return by[venue]!;
    }
    if (venue === 'pvp' && typeof user.championshipVersusDuelTickets === 'number' && Number.isFinite(user.championshipVersusDuelTickets)) {
        return user.championshipVersusDuelTickets;
    }
    return undefined;
}

function readPersistedNextAtRaw(
    user: ChampionshipVersusDuelTicketsPick,
    venue: ChampionshipVersusVenueKind,
): number | undefined {
    const by = user.championshipVersusDuelTicketNextAtByVenue;
    if (by && typeof by[venue] === 'number' && Number.isFinite(by[venue])) {
        return by[venue];
    }
    if (
        venue === 'pvp' &&
        typeof user.championshipVersusDuelTicketNextAt === 'number' &&
        Number.isFinite(user.championshipVersusDuelTicketNextAt)
    ) {
        return user.championshipVersusDuelTicketNextAt;
    }
    return undefined;
}

/**
 * 서버 `normalizeChampionshipVersusDuelTicketsForVenue`와 동일한 회복 규칙으로
 * 표시용 결투권·다음 충전 시각을 계산한다(유저 객체는 변경하지 않음).
 */
export function computeChampionshipVersusDuelTicketStateForVenue(
    user: ChampionshipVersusDuelTicketsPick,
    venue: ChampionshipVersusVenueKind,
    nowMs: number = Date.now(),
): ChampionshipVersusDuelTicketComputed {
    const MAX = CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX;
    const INTERVAL = CHAMPIONSHIP_VERSUS_DUEL_TICKET_REGEN_MS;

    let t = readPersistedTicketRaw(user, venue);
    if (typeof t !== 'number' || !Number.isFinite(t)) {
        if (hasPersistedVersusDuelTicketsByVenue(user) || venue === 'pvp') {
            t = MAX;
        } else {
            return { tickets: 0, nextAt: undefined };
        }
    }
    t = Math.max(0, Math.min(MAX, Math.floor(t)));

    let nextAt = readPersistedNextAtRaw(user, venue);

    if (t >= MAX) {
        return { tickets: MAX };
    }

    if (typeof nextAt !== 'number' || !Number.isFinite(nextAt)) {
        return { tickets: t, nextAt: nowMs + INTERVAL };
    }

    while (t < MAX && nowMs >= nextAt) {
        t += 1;
        nextAt += INTERVAL;
    }

    if (t >= MAX) {
        return { tickets: MAX };
    }
    return { tickets: t, nextAt };
}

export function getChampionshipVersusDuelTicketsForVenue(
    user: ChampionshipVersusDuelTicketsPick,
    venue: ChampionshipVersusVenueKind,
): number {
    const by = user.championshipVersusDuelTicketsByVenue;
    if (by && typeof by[venue] === 'number' && Number.isFinite(by[venue]!)) {
        return clampChampionshipVersusDuelTicketCount(by[venue]);
    }
    // `championshipVersusDuelTickets`는 서버에서 PVP(`pvp`)만 미러하는 구 필드다.
    // pet / petpair 에서 레거시로 폴백하면 다른 경기장(PVP 만땅 등) 수치가 섞여 «회복된 것처럼» 보인다.
    if (venue === 'pvp') {
        return clampChampionshipVersusDuelTicketCount(user.championshipVersusDuelTickets);
    }
    const raw = by?.[venue];
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return clampChampionshipVersusDuelTicketCount(raw);
    }
    return 0;
}

/** 경과 시간·회복 간격을 반영한 표시용 결투권 수(대기실·경기장 공통). */
export function getChampionshipVersusDuelTicketsForVenueUi(
    user: ChampionshipVersusDuelTicketsPick,
    venue: ChampionshipVersusVenueKind,
    nowMs: number = Date.now(),
): number {
    return computeChampionshipVersusDuelTicketStateForVenue(user, venue, nowMs).tickets;
}

/** `getChampionshipVersusDuelTicketsForVenueUi`와 짝을 맞춘 다음 충전 시각(만충이면 undefined). */
export function getChampionshipVersusDuelTicketNextAtForVenueUi(
    user: ChampionshipVersusDuelTicketsPick,
    venue: ChampionshipVersusVenueKind,
    nowMs: number = Date.now(),
): number | undefined {
    const { tickets, nextAt } = computeChampionshipVersusDuelTicketStateForVenue(user, venue, nowMs);
    if (tickets >= CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX) return undefined;
    return nextAt;
}

export function getChampionshipVersusDuelTicketNextAtForVenue(
    user: ChampionshipVersusDuelTicketsPick,
    venue: ChampionshipVersusVenueKind,
): number | undefined {
    const by = user.championshipVersusDuelTicketNextAtByVenue;
    if (by && typeof by[venue] === 'number' && Number.isFinite(by[venue]!)) {
        return by[venue];
    }
    if (venue === 'pvp') {
        return typeof user.championshipVersusDuelTicketNextAt === 'number' && Number.isFinite(user.championshipVersusDuelTicketNextAt)
            ? user.championshipVersusDuelTicketNextAt
            : undefined;
    }
    const v = by?.[venue];
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
