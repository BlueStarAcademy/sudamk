import type { ChampionshipVersusVenueKind, ChampionshipVersusVenueRatingEntry, User } from '../types/entities.js';
import { RANKED_ELO_BASE_SCORE } from '../constants/rules.js';
import { getCurrentSeason } from './timeUtils.js';

export const CHAMPIONSHIP_VERSUS_ELO_DEFAULT = RANKED_ELO_BASE_SCORE;
/** 표준 ELO K — 전략바둑 랭킹전과 동일 */
export const CHAMPIONSHIP_VERSUS_ELO_K = 32;

const LEGACY_MONTH_KEY = /^\d{4}-\d{2}$/;

export function isChampionshipVersusVenueKind(v: unknown): v is ChampionshipVersusVenueKind {
    return v === 'pvp' || v === 'pet' || v === 'petpair';
}

export function expectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}

/** 승자 A, 패자 B — (A의 새 점수, B의 새 점수) */
export function computeEloPairAfterMatch(
    ratingWinner: number,
    ratingLoser: number,
    k: number = CHAMPIONSHIP_VERSUS_ELO_K,
): { winnerNext: number; loserNext: number } {
    const ew = expectedScore(ratingWinner, ratingLoser);
    const el = expectedScore(ratingLoser, ratingWinner);
    const winnerNext = Math.max(100, Math.round(ratingWinner + k * (1 - ew)));
    const loserNext = Math.max(100, Math.round(ratingLoser + k * (0 - el)));
    return { winnerNext, loserNext };
}

function readLegacyEntry(raw: ChampionshipVersusVenueRatingEntry & { ratingMonthKST?: string }): {
    rating: number;
    seasonKey: string | null;
    seasonWins: number;
    seasonLosses: number;
} {
    const any = raw as ChampionshipVersusVenueRatingEntry & { ratingMonthKST?: string };
    const rating =
        typeof any.rating === 'number' && Number.isFinite(any.rating) && any.rating >= 100 ? any.rating : CHAMPIONSHIP_VERSUS_ELO_DEFAULT;
    const seasonKey =
        typeof any.ratingSeasonKey === 'string' && any.ratingSeasonKey.length > 0
            ? any.ratingSeasonKey
            : typeof any.ratingMonthKST === 'string' && LEGACY_MONTH_KEY.test(any.ratingMonthKST)
              ? null
              : typeof any.ratingMonthKST === 'string'
                ? any.ratingMonthKST
                : null;
    return {
        rating,
        seasonKey,
        seasonWins: Math.max(0, Math.floor(Number(any.seasonWins) || 0)),
        seasonLosses: Math.max(0, Math.floor(Number(any.seasonLosses) || 0)),
    };
}

/** DB에 저장할 정규 형태로 쓰기 전 in-memory User 객체 정리(구 ratingMonthKST 제거) */
export function normalizeChampionshipVersusVenueRatingEntryInPlace(
    venue: ChampionshipVersusVenueKind,
    user: User,
    now: number = Date.now(),
): ChampionshipVersusVenueRatingEntry {
    const season = getCurrentSeason(now).name;
    if (!user.championshipVersusVenueRatings) {
        user.championshipVersusVenueRatings = {};
    }
    const slot = user.championshipVersusVenueRatings[venue] as (ChampionshipVersusVenueRatingEntry & { ratingMonthKST?: string }) | undefined;
    if (!slot) {
        const fresh: ChampionshipVersusVenueRatingEntry = {
            rating: CHAMPIONSHIP_VERSUS_ELO_DEFAULT,
            ratingSeasonKey: season,
            seasonWins: 0,
            seasonLosses: 0,
        };
        user.championshipVersusVenueRatings[venue] = fresh;
        return fresh;
    }
    const legacy = readLegacyEntry(slot);
    const anySlot = slot as ChampionshipVersusVenueRatingEntry & { ratingMonthKST?: string };
    delete anySlot.ratingMonthKST;

    if (!legacy.seasonKey || legacy.seasonKey !== season) {
        const next: ChampionshipVersusVenueRatingEntry = {
            rating: legacy.rating,
            ratingSeasonKey: season,
            seasonWins: 0,
            seasonLosses: 0,
        };
        user.championshipVersusVenueRatings[venue] = next;
        return next;
    }
    const next: ChampionshipVersusVenueRatingEntry = {
        rating: legacy.rating,
        ratingSeasonKey: season,
        seasonWins: legacy.seasonWins,
        seasonLosses: legacy.seasonLosses,
    };
    user.championshipVersusVenueRatings[venue] = next;
    return next;
}

export function getChampionshipVersusDisplayRating(
    user: User,
    venue: ChampionshipVersusVenueKind,
    now: number = Date.now(),
): number {
    const cur = user.championshipVersusVenueRatings?.[venue];
    if (!cur) return CHAMPIONSHIP_VERSUS_ELO_DEFAULT;
    const normalized = normalizeChampionshipVersusVenueRatingEntryInPlace(venue, user, now);
    if (typeof normalized.rating !== 'number' || !Number.isFinite(normalized.rating) || normalized.rating < 100) {
        return CHAMPIONSHIP_VERSUS_ELO_DEFAULT;
    }
    return normalized.rating;
}

export function ensureChampionshipVersusRatingEntry(
    user: User,
    venue: ChampionshipVersusVenueKind,
    now: number = Date.now(),
): ChampionshipVersusVenueRatingEntry {
    return normalizeChampionshipVersusVenueRatingEntryInPlace(venue, user, now);
}

export function champCoinsForVersusWin(ratingBefore: number): number {
    return Math.max(0, Math.floor(ratingBefore * 0.15));
}

export function champCoinsForVersusLoss(ratingBefore: number): number {
    return Math.max(0, Math.floor(ratingBefore * 0.03));
}
