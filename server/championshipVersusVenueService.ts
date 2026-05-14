import type { User, ChampionshipVersusVenueKind, Match, PlayerForTournament, Guild, ChampionshipRealGameState, AnalysisResult } from '../types/index.js';
import { LeagueTier } from '../types/enums.js';
import * as db from './db.js';
import { updateUserCache } from './gameCache.js';
import {
    champCoinsForVersusLoss,
    champCoinsForVersusWin,
    computeEloPairAfterMatch,
    ensureChampionshipVersusRatingEntry,
    getChampionshipVersusDisplayRating,
    isChampionshipVersusVenueKind,
} from '../shared/utils/championshipVersusElo.js';
import {
    CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX,
    CHAMPIONSHIP_VERSUS_DUEL_TICKET_REGEN_MS,
    CHAMPIONSHIP_VERSUS_OPP_REFRESH_DIAMONDS,
    CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY,
} from '../shared/constants/championshipVersusVenue.js';
import { formatKstYmd, getCurrentSeason } from '../shared/utils/timeUtils.js';
import { calculateTotalStats } from './statService.js';
import {
    CHAMPIONSHIP_ABILITY_KATA_LADDER,
    championshipKataLevelForPly,
    CHAMPIONSHIP_REAL_MATCH_RULES_19,
} from '../shared/constants/championshipRealMatch.js';
import { getSeasonalRankingTierName } from '../shared/constants/ranking.js';
import {
    championshipVersusBoardRulesForActorStrategicTier,
    championshipVersusTierBandIndexForTierName,
} from '../shared/utils/championshipVersusTier.js';
import { assignChampionshipCondition, generateChampionshipRealMatch } from './championshipRealMatchService.js';

export type ChampionshipVersusOpponentRow = {
    userId: string;
    nickname: string;
    avatarId: string;
    borderId: string;
    league: string;
    /** 계정 레벨 (표시용) */
    userLevel: number;
    rating: number;
    wins: number;
    losses: number;
    totalGoPower: number;
    coreStats: Record<string, number>;
    openingAbility: number;
    midgameAbility: number;
    endgameAbility: number;
};

function isRealHumanUser(u: User): boolean {
    if (!u?.id) return false;
    if (u.id.startsWith('bot-') || u.id.startsWith('dungeon-bot-')) return false;
    return true;
}

export function normalizeChampionshipVersusDuelTickets(user: User, now: number): void {
    const MAX = CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX;
    const INTERVAL = CHAMPIONSHIP_VERSUS_DUEL_TICKET_REGEN_MS;
    let t = user.championshipVersusDuelTickets;
    if (typeof t !== 'number' || !Number.isFinite(t)) t = MAX;
    t = Math.min(MAX, Math.max(0, Math.floor(t)));
    let nextAt = user.championshipVersusDuelTicketNextAt;

    if (t >= MAX) {
        user.championshipVersusDuelTickets = MAX;
        user.championshipVersusDuelTicketNextAt = undefined;
        return;
    }

    if (typeof nextAt !== 'number' || !Number.isFinite(nextAt)) {
        user.championshipVersusDuelTickets = t;
        user.championshipVersusDuelTicketNextAt = now + INTERVAL;
        return;
    }

    while (t < MAX && now >= nextAt) {
        t += 1;
        nextAt += INTERVAL;
    }
    if (t >= MAX) {
        user.championshipVersusDuelTickets = MAX;
        user.championshipVersusDuelTicketNextAt = undefined;
    } else {
        user.championshipVersusDuelTickets = t;
        user.championshipVersusDuelTicketNextAt = nextAt;
    }
}

export function normalizeChampionshipVersusOppRefreshDay(user: User, now: number): void {
    const today = formatKstYmd(now);
    if (user.championshipVersusOppRefreshDayKST !== today) {
        user.championshipVersusOppRefreshDayKST = today;
        user.championshipVersusOppRefreshFreeUsed = 0;
    }
    let used = user.championshipVersusOppRefreshFreeUsed;
    if (typeof used !== 'number' || !Number.isFinite(used)) used = 0;
    user.championshipVersusOppRefreshFreeUsed = Math.max(0, Math.min(CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY, Math.floor(used)));
}

export function championshipVersusEconomyForClient(user: User, now: number) {
    normalizeChampionshipVersusDuelTickets(user, now);
    normalizeChampionshipVersusOppRefreshDay(user, now);
    const freeUsed = user.championshipVersusOppRefreshFreeUsed ?? 0;
    return {
        championshipVersusRefreshFreeUsed: freeUsed,
        championshipVersusRefreshFreeRemaining: Math.max(0, CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY - freeUsed),
        championshipVersusRefreshFreeMax: CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY,
        championshipVersusRefreshDiamondCost: CHAMPIONSHIP_VERSUS_OPP_REFRESH_DIAMONDS,
        championshipVersusDuelTickets: user.championshipVersusDuelTickets ?? CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX,
        championshipVersusDuelTicketsMax: CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX,
        championshipVersusDuelTicketNextAt: user.championshipVersusDuelTicketNextAt,
    };
}

function consumeChampionshipVersusDuelTicket(user: User, now: number): string | undefined {
    normalizeChampionshipVersusDuelTickets(user, now);
    const MAX = CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX;
    const INTERVAL = CHAMPIONSHIP_VERSUS_DUEL_TICKET_REGEN_MS;
    let t = user.championshipVersusDuelTickets ?? 0;
    if (t < 1) return '결투권이 부족합니다.';
    t -= 1;
    user.championshipVersusDuelTickets = t;
    if (t < MAX) {
        const na = user.championshipVersusDuelTicketNextAt;
        if (typeof na !== 'number' || !Number.isFinite(na) || na < now) {
            user.championshipVersusDuelTicketNextAt = now + INTERVAL;
        }
    } else {
        user.championshipVersusDuelTicketNextAt = undefined;
    }
    return undefined;
}

export async function executeChampionshipVersusOpponentListRefresh(
    user: User,
    venue: ChampionshipVersusVenueKind,
    now: number,
): Promise<{ error?: string; myRating?: number; ratingSeasonKey?: string; opponents?: ChampionshipVersusOpponentRow[] }> {
    normalizeChampionshipVersusDuelTickets(user, now);
    normalizeChampionshipVersusOppRefreshDay(user, now);

    let used = user.championshipVersusOppRefreshFreeUsed ?? 0;
    if (used < CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY) {
        user.championshipVersusOppRefreshFreeUsed = used + 1;
    } else {
        if (!user.isAdmin) {
            const d = user.diamonds ?? 0;
            if (d < CHAMPIONSHIP_VERSUS_OPP_REFRESH_DIAMONDS) {
                return { error: '다이아가 부족합니다.' };
            }
            user.diamonds = d - CHAMPIONSHIP_VERSUS_OPP_REFRESH_DIAMONDS;
        }
    }

    ensureChampionshipVersusRatingEntry(user, venue, now);
    const built = await buildChampionshipVersusOpponentList(user, venue, now);
    updateUserCache(user);
    await db.updateUser(user);
    const { broadcastUserUpdate } = await import('./socket.js');
    broadcastUserUpdate(user, [
        'championshipVersusOppRefreshDayKST',
        'championshipVersusOppRefreshFreeUsed',
        'diamonds',
        'championshipVersusDuelTickets',
        'championshipVersusDuelTicketNextAt',
        'championshipVersusVenueRatings',
    ]);

    return { myRating: built.myRating, ratingSeasonKey: built.ratingSeasonKey, opponents: built.opponents };
}

function opponentAbilitySnapshot(u: User): Pick<
    ChampionshipVersusOpponentRow,
    'totalGoPower' | 'coreStats' | 'openingAbility' | 'midgameAbility' | 'endgameAbility'
> {
    const stats = calculateTotalStats(u, 'championshipVenue') as Record<string, number>;
    const rules = CHAMPIONSHIP_REAL_MATCH_RULES_19;
    const oPly = rules.phasePly.opening.to;
    const mPly = rules.phasePly.midgame.to;
    const ePly = rules.phasePly.endgame.to;
    const opening = championshipKataLevelForPly(oPly, stats as any, undefined, CHAMPIONSHIP_ABILITY_KATA_LADDER);
    const midgame = championshipKataLevelForPly(mPly, stats as any, undefined, CHAMPIONSHIP_ABILITY_KATA_LADDER);
    const endgame = championshipKataLevelForPly(ePly, stats as any, undefined, CHAMPIONSHIP_ABILITY_KATA_LADDER);
    const coreKeys = Object.keys(stats);
    let sum = 0;
    for (const k of coreKeys) {
        sum += Number(stats[k]) || 0;
    }
    return {
        totalGoPower: Math.round(sum),
        coreStats: { ...stats },
        openingAbility: opening.abilityScore,
        midgameAbility: midgame.abilityScore,
        endgameAbility: endgame.abilityScore,
    };
}

type VersusOppCand = { u: User; rating: number; diff: number; band: number };

function sortVersusOppCand(a: VersusOppCand, b: VersusOppCand): number {
    if (a.diff !== b.diff) return a.diff - b.diff;
    return a.u.nickname.localeCompare(b.u.nickname, 'ko');
}

export async function buildChampionshipVersusOpponentList(
    self: User,
    venue: ChampionshipVersusVenueKind,
    now: number,
): Promise<{ myRating: number; ratingSeasonKey: string; opponents: ChampionshipVersusOpponentRow[] }> {
    ensureChampionshipVersusRatingEntry(self, venue, now);
    const selfEntry = self.championshipVersusVenueRatings![venue]!;
    const myRating = selfEntry.rating;
    const selfGames = Math.max(0, (selfEntry.seasonWins ?? 0) + (selfEntry.seasonLosses ?? 0));
    const selfTierName = getSeasonalRankingTierName(myRating, 999_999, selfGames);
    let selfBand = championshipVersusTierBandIndexForTierName(selfTierName);
    if (selfBand < 0) selfBand = 0;

    const all = await db.getAllUsers();
    const candidates: VersusOppCand[] = [];
    for (const u of all) {
        if (!isRealHumanUser(u) || u.id === self.id) continue;
        ensureChampionshipVersusRatingEntry(u, venue, now);
        const e = u.championshipVersusVenueRatings![venue]!;
        const r = getChampionshipVersusDisplayRating(u, venue, now);
        const games = Math.max(0, (e.seasonWins ?? 0) + (e.seasonLosses ?? 0));
        const tierName = getSeasonalRankingTierName(r, 999_999, games);
        let band = championshipVersusTierBandIndexForTierName(tierName);
        if (band < 0) band = 999;
        candidates.push({ u, rating: r, diff: Math.abs(r - myRating), band });
    }

    const picked: VersusOppCand[] = [];
    const used = new Set<string>();

    const takeFromBand = (band: number) => {
        const pool = candidates.filter((c) => c.band === band && !used.has(c.u.id)).sort(sortVersusOppCand);
        for (const c of pool) {
            if (picked.length >= 5) return;
            picked.push(c);
            used.add(c.u.id);
        }
    };

    takeFromBand(selfBand);
    for (let d = 1; picked.length < 5 && d <= 4; d++) {
        takeFromBand(selfBand + d);
        takeFromBand(selfBand - d);
    }
    if (picked.length < 5) {
        const rest = candidates.filter((c) => !used.has(c.u.id)).sort(sortVersusOppCand);
        for (const c of rest) {
            if (picked.length >= 5) break;
            picked.push(c);
            used.add(c.u.id);
        }
    }

    const opponents: ChampionshipVersusOpponentRow[] = picked.map(({ u, rating }) => {
        ensureChampionshipVersusRatingEntry(u, venue, now);
        const e = u.championshipVersusVenueRatings![venue]!;
        const snap = opponentAbilitySnapshot(u);
        return {
            userId: u.id,
            nickname: u.nickname,
            avatarId: u.avatarId,
            borderId: u.borderId,
            league: String(u.league ?? ''),
            userLevel: Math.max(1, Math.floor(Number(u.userLevel) || 1)),
            rating,
            wins: e.seasonWins,
            losses: e.seasonLosses,
            ...snap,
        };
    });
    return {
        myRating,
        ratingSeasonKey: selfEntry.ratingSeasonKey,
        opponents,
    };
}

export async function applyChampionshipVersusDuelRatingAndCoins(
    actor: User,
    venue: ChampionshipVersusVenueKind,
    opponent: User,
    actorWon: boolean,
    now: number,
): Promise<{
    actorCoinsDelta: number;
    opponentCoinsDelta: number;
    actorVenueRatingBefore: number;
    actorVenueRatingAfter: number;
}> {
    ensureChampionshipVersusRatingEntry(actor, venue, now);
    ensureChampionshipVersusRatingEntry(opponent, venue, now);
    const aEntry = actor.championshipVersusVenueRatings![venue]!;
    const oEntry = opponent.championshipVersusVenueRatings![venue]!;
    const ra = aEntry.rating;
    const ro = oEntry.rating;
    const actorVenueRatingBefore = ra;

    const winnerRatingBefore = actorWon ? ra : ro;
    const loserRatingBefore = actorWon ? ro : ra;

    const { winnerNext, loserNext } = computeEloPairAfterMatch(winnerRatingBefore, loserRatingBefore);

    const winCoins = champCoinsForVersusWin(winnerRatingBefore);
    const lossCoins = champCoinsForVersusLoss(loserRatingBefore);

    if (actorWon) {
        aEntry.rating = winnerNext;
        oEntry.rating = loserNext;
        actor.champCoins = (actor.champCoins ?? 0) + winCoins;
        opponent.champCoins = (opponent.champCoins ?? 0) + lossCoins;
        aEntry.seasonWins += 1;
        oEntry.seasonLosses += 1;
    } else {
        oEntry.rating = winnerNext;
        aEntry.rating = loserNext;
        opponent.champCoins = (opponent.champCoins ?? 0) + winCoins;
        actor.champCoins = (actor.champCoins ?? 0) + lossCoins;
        oEntry.seasonWins += 1;
        aEntry.seasonLosses += 1;
    }

    return {
        actorCoinsDelta: actorWon ? winCoins : lossCoins,
        opponentCoinsDelta: actorWon ? lossCoins : winCoins,
        actorVenueRatingBefore,
        actorVenueRatingAfter: aEntry.rating,
    };
}

export async function executeChampionshipVersusKataDuel(
    actor: User,
    venue: ChampionshipVersusVenueKind,
    opponentUserId: string,
    now: number,
): Promise<{
    error?: string;
    actor?: User;
    opponent?: User;
    match?: Match;
    championshipRealGame?: ChampionshipRealGameState;
    analysis?: AnalysisResult;
    actorWon?: boolean;
    actorVenueRatingBefore?: number;
    actorVenueRatingAfter?: number;
    actorVenueRatingDelta?: number;
    champCoinsDelta?: number;
    guildCoinsDelta?: number;
}> {
    if (!opponentUserId || opponentUserId === actor.id) {
        return { error: '유효하지 않은 상대입니다.' };
    }
    normalizeChampionshipVersusDuelTickets(actor, now);
    const t0 = actor.championshipVersusDuelTickets ?? 0;
    if (t0 < 1) {
        return { error: '결투권이 부족합니다.' };
    }

    const opponent = await db.getUser(opponentUserId, { includeEquipment: true, includeInventory: false });
    if (!opponent || !isRealHumanUser(opponent)) {
        return { error: '상대 유저를 찾을 수 없습니다.' };
    }

    const rules = championshipVersusBoardRulesForActorStrategicTier(actor);
    const statsActor = calculateTotalStats(actor, 'championshipVenue') as Record<string, number>;
    const statsOpp = calculateTotalStats(opponent, 'championshipVenue') as Record<string, number>;

    const p1: PlayerForTournament = {
        id: actor.id,
        nickname: actor.nickname,
        avatarId: actor.avatarId,
        borderId: actor.borderId,
        league: (actor.league ?? LeagueTier.Rookie) as LeagueTier,
        stats: statsActor as any,
        originalStats: JSON.parse(JSON.stringify(statsActor)) as any,
        wins: 0,
        losses: 0,
        condition: assignChampionshipCondition(),
    };
    const p2: PlayerForTournament = {
        id: opponent.id,
        nickname: opponent.nickname,
        avatarId: opponent.avatarId,
        borderId: opponent.borderId,
        league: (opponent.league ?? LeagueTier.Rookie) as LeagueTier,
        stats: statsOpp as any,
        originalStats: JSON.parse(JSON.stringify(statsOpp)) as any,
        wins: 0,
        losses: 0,
        condition: assignChampionshipCondition(),
    };

    const matchId = `versus-kata-${actor.id}-${now}`;
    const match: Match = {
        id: matchId,
        players: [p1, p2],
        winner: null,
        isFinished: true,
        commentary: [],
        isUserMatch: true,
        finalScore: null,
    };

    let generation: Awaited<ReturnType<typeof generateChampionshipRealMatch>>;
    try {
        generation = await generateChampionshipRealMatch(match, [p1, p2], actor, rules);
    } catch (err: any) {
        console.error('[executeChampionshipVersusKataDuel] generateChampionshipRealMatch failed:', err?.message || err);
        return { error: '실제 대국 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
    }

    const ticketErr = consumeChampionshipVersusDuelTicket(actor, now);
    if (ticketErr) {
        return { error: ticketErr };
    }

    generation.game.status = 'finished';

    const actorWon = generation.winner.id === actor.id;
    const ratingRes = await applyChampionshipVersusDuelRatingAndCoins(actor, venue, opponent, actorWon, now);

    let guildCoinsDelta = 0;
    if (actor.guildId) {
        const base = rules.boardSize;
        guildCoinsDelta = actorWon ? Math.round(48 + base * 2.2) : Math.round(14 + base * 0.6);
        actor.guildCoins = (actor.guildCoins ?? 0) + guildCoinsDelta;
        if (actorWon) {
            try {
                const guilds = (await db.getKV<Record<string, Guild>>('guilds')) || {};
                const { updateGuildMissionProgress } = await import('./guildService.js');
                await updateGuildMissionProgress(actor.guildId, 'strategicWins', 1, guilds);
                await db.setKV('guilds', guilds);
            } catch (e) {
                console.warn('[executeChampionshipVersusKataDuel] guild mission update skipped:', e);
            }
        }
    }

    const fs = generation.game.finalScore;
    let player1Score = 0;
    let player2Score = 0;
    if (fs) {
        const actorIsBlack = generation.game.blackPlayerId === actor.id;
        player1Score = actorIsBlack ? fs.black : fs.white;
        player2Score = actorIsBlack ? fs.white : fs.black;
    }
    match.championshipRealGame = generation.game;
    match.winner = generation.winner;
    match.finalScore = { player1: player1Score, player2: player2Score };

    updateUserCache(actor);
    updateUserCache(opponent);
    await db.updateUser(actor);
    await db.updateUser(opponent);

    const { broadcastUserUpdate } = await import('./socket.js');
    broadcastUserUpdate(actor, [
        'championshipVersusVenueRatings',
        'champCoins',
        'guildCoins',
        'championshipVersusDuelTickets',
        'championshipVersusDuelTicketNextAt',
    ]);
    broadcastUserUpdate(opponent, ['championshipVersusVenueRatings', 'champCoins']);

    return {
        actor,
        opponent,
        match,
        championshipRealGame: generation.game,
        analysis: generation.analysis,
        actorWon,
        actorVenueRatingBefore: ratingRes.actorVenueRatingBefore,
        actorVenueRatingAfter: ratingRes.actorVenueRatingAfter,
        actorVenueRatingDelta: ratingRes.actorVenueRatingAfter - ratingRes.actorVenueRatingBefore,
        champCoinsDelta: ratingRes.actorCoinsDelta,
        guildCoinsDelta,
    };
}

export async function applyChampionshipVersusDuelResult(
    actor: User,
    venue: ChampionshipVersusVenueKind,
    opponentUserId: string,
    actorWon: boolean,
    now: number,
): Promise<{ error?: string; actor: User; opponent: User; actorCoinsDelta: number; opponentCoinsDelta: number }> {
    if (!opponentUserId || opponentUserId === actor.id) {
        return { error: '유효하지 않은 상대입니다.', actor, opponent: actor, actorCoinsDelta: 0, opponentCoinsDelta: 0 };
    }
    const opponent = await db.getUser(opponentUserId, { includeEquipment: false, includeInventory: false });
    if (!opponent || !isRealHumanUser(opponent)) {
        return { error: '상대 유저를 찾을 수 없습니다.', actor, opponent: actor, actorCoinsDelta: 0, opponentCoinsDelta: 0 };
    }

    const ticketErr = consumeChampionshipVersusDuelTicket(actor, now);
    if (ticketErr) {
        return { error: ticketErr, actor, opponent, actorCoinsDelta: 0, opponentCoinsDelta: 0 };
    }

    const { actorCoinsDelta, opponentCoinsDelta } = await applyChampionshipVersusDuelRatingAndCoins(actor, venue, opponent, actorWon, now);

    updateUserCache(actor);
    updateUserCache(opponent);
    await db.updateUser(actor);
    await db.updateUser(opponent);

    const { broadcastUserUpdate } = await import('./socket.js');
    broadcastUserUpdate(actor, [
        'championshipVersusVenueRatings',
        'champCoins',
        'championshipVersusDuelTickets',
        'championshipVersusDuelTicketNextAt',
    ]);
    broadcastUserUpdate(opponent, ['championshipVersusVenueRatings', 'champCoins']);

    return {
        actor,
        opponent,
        actorCoinsDelta,
        opponentCoinsDelta,
    };
}

export function parseVersusVenuePayload(venue: unknown): ChampionshipVersusVenueKind | null {
    return isChampionshipVersusVenueKind(venue) ? venue : null;
}

export function championshipVersusSelfNeedsRatingPersist(self: User, venue: ChampionshipVersusVenueKind, now: number): boolean {
    const prior = self.championshipVersusVenueRatings?.[venue] as any;
    if (!prior) return true;
    if (prior.ratingMonthKST && !prior.ratingSeasonKey) return true;
    if (prior.ratingSeasonKey !== getCurrentSeason(now).name) return true;
    if (typeof prior.seasonWins !== 'number' || typeof prior.seasonLosses !== 'number') return true;
    return false;
}
