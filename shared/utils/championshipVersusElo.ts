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

const VERSUS_SHARED_VENUES: readonly ChampionshipVersusVenueKind[] = ['pvp', 'pet', 'petpair'];

/** 챔피언십 공개 랭킹에 올리기 위한 현재 시즌 대전장 대국 수 하한 */
export const CHAMPIONSHIP_RANKING_MIN_SEASON_GAMES = 5;

/**
 * 현재 시즌 대전장 ELO·전적(한 장소 기준). 여러 장소 중 시즌 대국 수가 최대인 슬롯을 고른 뒤,
 * 그중 ELO가 가장 높은 행을 사용한다(랭킹 패널 등 단일 행 표시용 — 점수는 장간 공유, 전적은 장별로 따로 쌓일 수 있음).
 */
export function pickChampionshipVersusSeasonRankingStats(
    user: User,
): { rating: number; seasonWins: number; seasonLosses: number } | null {
    const R = user.championshipVersusVenueRatings;
    if (!R || typeof R !== 'object') return null;

    type Cand = { rating: number; seasonWins: number; seasonLosses: number; games: number };
    const cands: Cand[] = [];
    for (const k of VERSUS_SHARED_VENUES) {
        const e = R[k];
        if (!e) continue;
        const sw = Math.max(0, Math.floor(Number(e.seasonWins) || 0));
        const sl = Math.max(0, Math.floor(Number(e.seasonLosses) || 0));
        const games = sw + sl;
        if (games < CHAMPIONSHIP_RANKING_MIN_SEASON_GAMES) continue;
        const rating =
            typeof e.rating === 'number' && Number.isFinite(e.rating) && e.rating >= 100
                ? e.rating
                : CHAMPIONSHIP_VERSUS_ELO_DEFAULT;
        cands.push({ rating, seasonWins: sw, seasonLosses: sl, games });
    }
    if (cands.length === 0) return null;

    const maxGames = Math.max(...cands.map((c) => c.games));
    const withMax = cands.filter((c) => c.games === maxGames);
    withMax.sort((a, b) => b.rating - a.rating);
    const b = withMax[0]!;
    return { rating: b.rating, seasonWins: b.seasonWins, seasonLosses: b.seasonLosses };
}

/**
 * PVP·펫·페어 챔피언십: **ELO(점수)만** 장간 공유로 맞추고, 시즌 승패는 경기장별로 유지한다.
 */
export function reconcileChampionshipVersusSharedRatings(user: User, now: number = Date.now()): void {
    if (!user.championshipVersusVenueRatings) user.championshipVersusVenueRatings = {};
    const R = user.championshipVersusVenueRatings;

    for (const k of VERSUS_SHARED_VENUES) {
        normalizeChampionshipVersusVenueRatingEntryInPlace(k, user, now);
    }

    let bestKey: ChampionshipVersusVenueKind = 'pvp';
    let bestGames = -1;
    for (const k of VERSUS_SHARED_VENUES) {
        const e = R[k];
        if (!e) continue;
        const g = (e.seasonWins ?? 0) + (e.seasonLosses ?? 0);
        if (g > bestGames) {
            bestGames = g;
            bestKey = k;
        }
    }
    const bestEntry = R[bestKey];
    const pvp = R.pvp;
    if (!pvp || !bestEntry) return;

    const pvpGames = (pvp.seasonWins ?? 0) + (pvp.seasonLosses ?? 0);
    if (bestGames > pvpGames) {
        pvp.rating = bestEntry.rating;
        pvp.ratingSeasonKey = bestEntry.ratingSeasonKey;
    }

    syncVersusSharedRatingFromPvp(user);
}

/** PVP의 ELO·시즌키만 펫·페어 슬롯에 복사한다(승패는 각 슬롯 값 유지). */
export function syncVersusSharedRatingFromPvp(user: User): void {
    const R = user.championshipVersusVenueRatings;
    if (!R?.pvp) return;
    const c = R.pvp;
    for (const k of VERSUS_SHARED_VENUES) {
        if (k === 'pvp') continue;
        const slot = R[k];
        if (!slot) continue;
        R[k] = {
            rating: c.rating,
            ratingSeasonKey: c.ratingSeasonKey,
            seasonWins: slot.seasonWins ?? 0,
            seasonLosses: slot.seasonLosses ?? 0,
        };
    }
}

/** @deprecated {@link syncVersusSharedRatingFromPvp} 사용 */
export function syncVersusRatingsCloneFromPvp(user: User): void {
    syncVersusSharedRatingFromPvp(user);
}

/** 승리: 랭킹점수 × 10~15% (내림) */
export function rollVersusGoldWinFromRating(ratingBefore: number): number {
    const r = Math.max(0, Number(ratingBefore) || 0);
    const pct = 0.1 + Math.random() * 0.05;
    return Math.max(0, Math.floor(r * pct));
}

/** 패배: 동일 산식 승리분의 50% 수준(독립 랜덤 후 절반) */
export function rollVersusGoldLossFromRating(ratingBefore: number): number {
    return Math.max(0, Math.floor(rollVersusGoldWinFromRating(ratingBefore) * 0.5));
}

/** 승리: 랭킹점수 × 5~10% (내림) — 장별로 유저/펫에 분배 */
export function rollVersusUserXpWinPoolFromRating(ratingBefore: number): number {
    const r = Math.max(0, Number(ratingBefore) || 0);
    const pct = 0.05 + Math.random() * 0.05;
    return Math.max(0, Math.floor(r * pct));
}

export function rollVersusUserXpLossPoolFromRating(ratingBefore: number): number {
    return Math.max(0, Math.floor(rollVersusUserXpWinPoolFromRating(ratingBefore) * 0.5));
}

export function splitVersusExperiencePoolForVenue(
    venue: ChampionshipVersusVenueKind,
    pool: number,
): { userPart: number; petPart: number } {
    const p = Math.max(0, Math.floor(pool));
    if (venue === 'pvp') return { userPart: p, petPart: 0 };
    if (venue === 'pet') return { userPart: 0, petPart: p };
    const half = Math.floor(p / 2);
    return { userPart: half, petPart: p - half };
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
    ensureChampionshipVersusRatingEntry(user, venue, now);
    const cur = user.championshipVersusVenueRatings?.[venue];
    if (!cur) return CHAMPIONSHIP_VERSUS_ELO_DEFAULT;
    if (typeof cur.rating !== 'number' || !Number.isFinite(cur.rating) || cur.rating < 100) {
        return CHAMPIONSHIP_VERSUS_ELO_DEFAULT;
    }
    return cur.rating;
}

export function ensureChampionshipVersusRatingEntry(
    user: User,
    venue: ChampionshipVersusVenueKind,
    now: number = Date.now(),
): ChampionshipVersusVenueRatingEntry {
    reconcileChampionshipVersusSharedRatings(user, now);
    return user.championshipVersusVenueRatings![venue]!;
}

/**
 * 장내 챔피언십(PVP·펫·페어) 대국 승패 챔프 코인 배율.
 * 원래 `rating * 0.15`(승) / `rating * 0.03`(패) 대비 약 50% 수준.
 */
const VERSUS_CHAMP_COINS_OUTCOME_SCALE = 0.5;

export function champCoinsForVersusWin(ratingBefore: number): number {
    return Math.max(0, Math.floor(ratingBefore * 0.15 * VERSUS_CHAMP_COINS_OUTCOME_SCALE));
}

export function champCoinsForVersusLoss(ratingBefore: number): number {
    return Math.max(0, Math.floor(ratingBefore * 0.03 * VERSUS_CHAMP_COINS_OUTCOME_SCALE));
}
