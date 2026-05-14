import type { ChampionshipVersusVenueKind, User } from '../types/entities.js';
import {
    CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX,
    CHAMPIONSHIP_VERSUS_VENUE_KINDS,
} from '../constants/championshipVersusVenue.js';

export type ChampionshipVersusDuelTicketsPick = Pick<
    User,
    'championshipVersusDuelTicketsByVenue' | 'championshipVersusDuelTickets' | 'championshipVersusDuelTicketNextAtByVenue' | 'championshipVersusDuelTicketNextAt'
>;

export function clampChampionshipVersusDuelTicketCount(raw: unknown): number {
    const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX;
    return Math.max(0, Math.min(CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX, n));
}

export function hasPersistedVersusDuelTicketsByVenue(user: ChampionshipVersusDuelTicketsPick): boolean {
    const m = user.championshipVersusDuelTicketsByVenue;
    if (!m || typeof m !== 'object') return false;
    return CHAMPIONSHIP_VERSUS_VENUE_KINDS.every((k) => typeof (m as Record<string, unknown>)[k] === 'number');
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
    return clampChampionshipVersusDuelTicketCount(by?.[venue]);
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
