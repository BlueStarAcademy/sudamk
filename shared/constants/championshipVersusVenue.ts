import type { ChampionshipVersusVenueKind } from '../types/entities.js';

export const CHAMPIONSHIP_VERSUS_VENUE_KINDS: readonly ChampionshipVersusVenueKind[] = ['pvp', 'pet', 'petpair'];

/** 상대 목록 무료 새로고침 (KST 일당) */
export const CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY = 5;
/** 무료 횟수 소진 후 목록 새로고침당 다이아 */
export const CHAMPIONSHIP_VERSUS_OPP_REFRESH_DIAMONDS = 10;

/** 결투권 최대 보유 */
export const CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX = 5;
/** 결투권 1개 회복 간격 (ms) */
export const CHAMPIONSHIP_VERSUS_DUEL_TICKET_REGEN_MS = 2 * 60 * 60 * 1000;
