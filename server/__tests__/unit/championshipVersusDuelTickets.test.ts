import { describe, expect, it } from 'vitest';
import {
    CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX,
    CHAMPIONSHIP_VERSUS_DUEL_TICKET_REGEN_MS,
} from '../../../shared/constants/championshipVersusVenue.js';
import {
    computeChampionshipVersusDuelTicketStateForVenue,
    getChampionshipVersusDuelTicketsForVenue,
    getChampionshipVersusDuelTicketsForVenueUi,
} from '../../../shared/utils/championshipVersusDuelTickets.js';

describe('championshipVersusDuelTickets', () => {
    it('does not show full tickets when only one regen interval elapsed', () => {
        const now = 1_000_000;
        const user = {
            championshipVersusDuelTicketsByVenue: { pvp: 1 },
            championshipVersusDuelTicketNextAtByVenue: { pvp: now - 1 },
        };
        const ui = getChampionshipVersusDuelTicketsForVenueUi(user, 'pvp', now);
        expect(ui).toBe(2);
        expect(ui).not.toBe(CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX);
    });

    it('shows full tickets after enough regen intervals', () => {
        const now = 10_000_000;
        const user = {
            championshipVersusDuelTicketsByVenue: { pvp: 0 },
            championshipVersusDuelTicketNextAtByVenue: { pvp: now - CHAMPIONSHIP_VERSUS_DUEL_TICKET_REGEN_MS * 5 },
        };
        expect(getChampionshipVersusDuelTicketsForVenueUi(user, 'pvp', now)).toBe(CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX);
    });

    it('does not mirror PVP legacy count onto pet venue', () => {
        const user = {
            championshipVersusDuelTickets: CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX,
            championshipVersusDuelTicketNextAt: Date.now(),
        };
        expect(getChampionshipVersusDuelTicketsForVenue(user, 'pet')).toBe(0);
        expect(computeChampionshipVersusDuelTicketStateForVenue(user, 'pet').tickets).toBe(0);
    });

    it('uses per-venue persisted counts when present', () => {
        const user = {
            championshipVersusDuelTicketsByVenue: { pvp: 1, pet: 2, petpair: 0 },
            championshipVersusDuelTicketNextAtByVenue: { pvp: Date.now() + 60_000 },
        };
        expect(getChampionshipVersusDuelTicketsForVenue(user, 'pet')).toBe(2);
    });
});
