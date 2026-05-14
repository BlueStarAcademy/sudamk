import type { ChampionshipVersusVenueKind } from '../types/entities.js';

export const CHAMPIONSHIP_VERSUS_VENUE_KINDS: readonly ChampionshipVersusVenueKind[] = ['pvp', 'pet', 'petpair'];

/** PVP / 펫 / 페어 챔피언십 입장(결투) 티켓 — `public/images/championship/ticket*.webp` */
export const CHAMPIONSHIP_VERSUS_ENTRY_TICKET_IMAGE: Record<ChampionshipVersusVenueKind, string> = {
    pvp: '/images/championship/ticket1.webp',
    pet: '/images/championship/ticket2.webp',
    petpair: '/images/championship/ticket3.webp',
};

/** 매칭 상대 명단 크기(서버 `championshipVersusVenueService`와 동일). */
export const CHAMPIONSHIP_VERSUS_OPPONENT_LIST_SIZE = 5;

/** 상대 목록 무료 새로고침 (KST 일당) */
export const CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY = 5;
/** 무료 횟수 소진 후 목록 새로고침당 다이아 */
export const CHAMPIONSHIP_VERSUS_OPP_REFRESH_DIAMONDS = 10;

/** 결투권 최대 보유 */
export const CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX = 5;
/** 결투권 1개 회복 간격 (ms) */
export const CHAMPIONSHIP_VERSUS_DUEL_TICKET_REGEN_MS = 2 * 60 * 60 * 1000;

/** 챔피언십 결투장 `경기 시작` 시 이 값 이하(1~100)이면 실수·신의 한수에 영향을 주므로 경고 모달을 띄운다. */
export const CHAMPIONSHIP_VERSUS_LOW_CONDITION_START_WARN_AT = 50;
