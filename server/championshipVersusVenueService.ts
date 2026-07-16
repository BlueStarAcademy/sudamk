import type {
    User,
    ChampionshipVersusVenueKind,
    Match,
    PlayerForTournament,
    ChampionshipRealGameState,
    AnalysisResult,
    GameSummary,
    Guild,
} from '../types/index.js';
import { LeagueTier } from '../types/enums.js';
import * as db from './db.js';
import { updateUserCache } from './gameCache.js';
import {
    applyVersusGoldRewardVenueMultiplier,
    champCoinsForVersusLoss,
    champCoinsForVersusWin,
    computeEloPairAfterMatch,
    ensureChampionshipVersusRatingEntry,
    getChampionshipVersusDisplayRating,
    isChampionshipVersusVenueKind,
    rollVersusGoldLossFromRating,
    rollVersusGoldWinFromRating,
    rollVersusUserXpLossPoolFromRating,
    rollVersusUserXpWinPoolFromRating,
    splitVersusExperiencePoolForVenue,
    syncVersusSharedRatingFromPvp,
} from '../shared/utils/championshipVersusElo.js';
import { isRewardVipActive } from '../shared/utils/rewardVip.js';
import { applyPairPetRewardXp, rollAndResolveRewardVipPlayGrant } from './summaryService.js';
import { addItemsToInventory } from '../utils/inventoryUtils.js';
import { totalAccumulatedXpFromLevelAndBar, levelAndBarFromTotalAccumulatedXp } from '../shared/utils/userLevelMerge.js';
import type { VersusKataActorRewardClientPayload } from '../utils/buildChampionshipVersusKataSummarySession.js';
import {
    CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX,
    CHAMPIONSHIP_VERSUS_DUEL_TICKET_REGEN_MS,
    CHAMPIONSHIP_VERSUS_OPP_REFRESH_DIAMONDS,
    CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY,
    CHAMPIONSHIP_VERSUS_VENUE_KINDS,
} from '../shared/constants/championshipVersusVenue.js';
import {
    clampChampionshipVersusDuelTicketCount,
    hasPersistedVersusDuelTicketsByVenue,
} from '../shared/utils/championshipVersusDuelTickets.js';
import { formatKstYmd, getCurrentSeason, getStartOfDayKST, isSameDayKST } from '../shared/utils/timeUtils.js';
import { calculateTotalStats } from './statService.js';
import { getSeasonalRankingTierName } from '../shared/constants/ranking.js';
import {
    championshipVersusBoardRulesForActorStrategicTier,
    championshipVersusTierBandIndexForTierName,
} from '../shared/utils/championshipVersusTier.js';
import type { ChampionshipVersusKataConfig } from '../shared/utils/championshipVersusKataResolve.js';
import { getChampionshipAbilityKataLadder } from './championshipAbilityKataStore.js';
import { getKataServerRuntimeSnapshot } from './kataServerRuntimeStore.js';
import { assignChampionshipCondition, generateChampionshipRealMatch } from './championshipRealMatchService.js';
import { getEquippedPairPetInventoryRow } from '../shared/utils/pairEquippedPet.js';
import { resolvePairPetMetaFromInventoryRow } from '../shared/utils/pairPetRoll.js';
import { computePairPetKataCoreStatsSixFromMeta } from '../shared/utils/pairPetKataStatsFromMeta.js';
import { effectivePairPetGradeFromRow } from '../shared/constants/pairPetGrade.js';
import { getPairPetDisplayName } from '../shared/constants/petLobby.js';
import { ItemGrade } from '../types/enums.js';
import {
    championshipVersusAbilitySnapshotFromCoreStats,
    championshipVersusAbilitySnapshotFromPairPetCoreStats,
    mergeChampionshipVersusPairUserPetCoreStats,
    pairPetCoreStatsSixToCoreRecord,
} from '../shared/utils/championshipVersusKataParticipantStats.js';
import { pairPetKataStatsSixFromEquippedUser } from '../shared/utils/pairPetKataStatsFromEquippedUser.js';
import { appendChampionshipVersusDuelWeekLogForUser } from '../shared/utils/championshipVersusDuelWeekLog.js';

const CHAMPIONSHIP_VERSUS_KATA_DUEL_CONCURRENCY = Math.max(
    1,
    Math.min(4, Number(process.env.CHAMPIONSHIP_VERSUS_KATA_DUEL_CONCURRENCY) || 1),
);
let activeChampionshipVersusKataDuelCount = 0;
const championshipVersusKataDuelWaiters: Array<() => void> = [];
const activeChampionshipVersusKataDuelActors = new Set<string>();

async function acquireChampionshipVersusKataDuelSlot(): Promise<() => void> {
    return new Promise((resolve) => {
        const grant = () => {
            activeChampionshipVersusKataDuelCount += 1;
            let released = false;
            resolve(() => {
                if (released) return;
                released = true;
                activeChampionshipVersusKataDuelCount = Math.max(0, activeChampionshipVersusKataDuelCount - 1);
                championshipVersusKataDuelWaiters.shift()?.();
            });
        };
        if (
            activeChampionshipVersusKataDuelCount < CHAMPIONSHIP_VERSUS_KATA_DUEL_CONCURRENCY &&
            championshipVersusKataDuelWaiters.length === 0
        ) {
            grant();
            return;
        }
        championshipVersusKataDuelWaiters.push(grant);
    });
}

function shouldSkipVersusDuelWeekLog(opponentId: string): boolean {
    return opponentId.startsWith('versus-demo-');
}

function recordChampionshipVersusDuelWeekLogsPair(params: {
    actor: User;
    opponent: User;
    venue: ChampionshipVersusVenueKind;
    actorWon: boolean;
    nowMs: number;
    actorRatingBefore: number;
    actorRatingAfter: number;
    opponentRatingBefore: number;
    opponentRatingAfter: number;
}): void {
    if (shouldSkipVersusDuelWeekLog(params.opponent.id)) return;
    const { actor, opponent, venue, actorWon, nowMs } = params;
    appendChampionshipVersusDuelWeekLogForUser(
        actor,
        {
            occurredAt: nowMs,
            venue,
            opponentUserId: opponent.id,
            opponentNickname: opponent.nickname,
            won: actorWon,
            ratingBefore: params.actorRatingBefore,
            ratingAfter: params.actorRatingAfter,
        },
        nowMs,
    );
    appendChampionshipVersusDuelWeekLogForUser(
        opponent,
        {
            occurredAt: nowMs,
            venue,
            opponentUserId: actor.id,
            opponentNickname: actor.nickname,
            won: !actorWon,
            ratingBefore: params.opponentRatingBefore,
            ratingAfter: params.opponentRatingAfter,
        },
        nowMs,
    );
}

export type ChampionshipVersusRepresentativePetSnapshot = {
    displayName: string;
    image: string | null;
    /** 페어/펫 챔피언십 목록·UI 표시용 */
    level: number;
    coreStats: Record<string, number>;
    openingAbility: number;
    midgameAbility: number;
    endgameAbility: number;
};

/** 페어 챔피언십: 유저(장비) 쪽 KATA 스냅 — 합산과 별도로 패널 표시용 */
export type ChampionshipVersusUserPairAnchorSnapshot = {
    coreStats: Record<string, number>;
    openingAbility: number;
    midgameAbility: number;
    endgameAbility: number;
};

export type ChampionshipVersusOpponentRow = {
    userId: string;
    nickname: string;
    avatarId: string;
    borderId: string;
    league: string;
    /** 계정 레벨 (표시용) */
    userLevel: number;
    rating: number;
    /** 해당 경기장 시즌 전체 유저 기준 순위(동점 공동 순위) */
    globalRank?: number;
    wins: number;
    losses: number;
    totalGoPower: number;
    coreStats: Record<string, number>;
    openingAbility: number;
    midgameAbility: number;
    endgameAbility: number;
    representativePet?: ChampionshipVersusRepresentativePetSnapshot;
    userPairAnchor?: ChampionshipVersusUserPairAnchorSnapshot;
};

function isRealHumanUser(u: User): boolean {
    if (!u?.id) return false;
    if (u.id.startsWith('bot-') || u.id.startsWith('dungeon-bot-')) return false;
    return true;
}

/** KST 당일·경기장별 컨디션 고정(1~100). 날짜가 바뀌면 새로 부여 */
export function resolveChampionshipVersusConditionForDay(
    user: User,
    venue: ChampionshipVersusVenueKind,
    now: number,
): { condition: number; assignedNew: boolean } {
    const todayStart = getStartOfDayKST(now);
    if (!user.championshipVersusConditionSnapshot) user.championshipVersusConditionSnapshot = {};
    const snap = user.championshipVersusConditionSnapshot[venue];
    if (
        snap &&
        typeof snap.condition === 'number' &&
        snap.condition >= 1 &&
        snap.condition <= 100 &&
        typeof snap.dateStartOfDayKST === 'number' &&
        isSameDayKST(snap.dateStartOfDayKST, now)
    ) {
        return { condition: snap.condition, assignedNew: false };
    }
    const condition = assignChampionshipCondition();
    user.championshipVersusConditionSnapshot[venue] = { condition, dateStartOfDayKST: todayStart };
    return { condition, assignedNew: true };
}

/** 챔피언십 대전장(PVP·펫·페어): 경기 시작 전 컨디션 회복제 — 던전과 동일 규칙 */
export async function applyChampionshipVersusConditionPotion(
    user: User,
    venue: ChampionshipVersusVenueKind,
    potionType: 'small' | 'medium' | 'large',
    now: number,
): Promise<{ error?: string; user?: User }> {
    const { rollConditionPotionRecovery } = await import('../shared/constants/conditionPotion.js');
    const {
        buildConditionPotionUserPatch,
        applyConditionPotionPatchInPlace,
        CONDITION_POTION_USE_BROADCAST_FIELDS,
    } = await import('../shared/conditionPotion/apply.js');
    const { findConditionPotionInInventory } = await import('../shared/utils/conditionPotionInventory.js');

    // 호출부가 이미 재수화했을 수 있으나, 단독 호출·캐시 경량 조회 대비로 한 번 더 보장한다.
    const invMissingPotion =
        !Array.isArray(user.inventory) ||
        user.inventory.length === 0 ||
        findConditionPotionInInventory(user.inventory, potionType) === -1;
    if (invMissingPotion) {
        const freshInvUser = await db.getUser(user.id, { includeEquipment: true, includeInventory: true });
        if (freshInvUser?.inventory) {
            user.inventory = freshInvUser.inventory;
        }
    }

    resolveChampionshipVersusConditionForDay(user, venue, now);
    const recovery = rollConditionPotionRecovery(potionType);
    const result = buildConditionPotionUserPatch(user, { kind: 'versus', venue }, potionType, recovery);
    if (!result.ok) return { error: result.error };

    applyConditionPotionPatchInPlace(user, result.patch);

    const { updateUserCache } = await import('./gameCache.js');
    try {
        updateUserCache(user);
        await db.updateUser(user, { allowInventoryEquipmentClear: true });
        const { broadcastUserUpdate } = await import('./socket.js');
        broadcastUserUpdate(user, [...CONDITION_POTION_USE_BROADCAST_FIELDS]);
        return { user };
    } catch (e: any) {
        console.error('[applyChampionshipVersusConditionPotion]', e);
        return { error: '데이터 저장 중 오류가 발생했습니다.' };
    }
}

function migrateLegacyVersusDuelTicketsToByVenue(user: User): void {
    if (hasPersistedVersusDuelTicketsByVenue(user)) return;
    const MAX = CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX;
    let legacyT = user.championshipVersusDuelTickets;
    if (typeof legacyT !== 'number' || !Number.isFinite(legacyT)) legacyT = MAX;
    legacyT = clampChampionshipVersusDuelTicketCount(legacyT);
    const legacyNext = user.championshipVersusDuelTicketNextAt;
    const nextOk = typeof legacyNext === 'number' && Number.isFinite(legacyNext);
    if (!user.championshipVersusDuelTicketsByVenue) user.championshipVersusDuelTicketsByVenue = {};
    if (!user.championshipVersusDuelTicketNextAtByVenue) user.championshipVersusDuelTicketNextAtByVenue = {};
    const byT = user.championshipVersusDuelTicketsByVenue;
    const byN = user.championshipVersusDuelTicketNextAtByVenue;
    for (const k of CHAMPIONSHIP_VERSUS_VENUE_KINDS) {
        const existing = byT[k];
        if (typeof existing === 'number' && Number.isFinite(existing)) {
            continue;
        }
        byT[k] = legacyT;
        if (legacyT < MAX && nextOk) {
            byN[k] = legacyNext;
        } else {
            delete byN[k];
        }
    }
}

/**
 * 요청에 실린 `actor`는 게임 캐시 행이라 `championshipVersusDuelTicketsByVenue`가 일부만 있거나 낡을 수 있다.
 * 그 상태로 `normalizeChampionshipVersusDuelTickets`를 돌리면 빠진 경기장 키가 만땅으로 채워져 DB에 저장되어,
 * 다른 경기장에서 대국 후 «회복시간이 남았는데 이용권이 돌아온 것처럼» 보이는 버그가 난다.
 */
function hydrateVersusDuelTicketsFromAuthoritativeUser(actor: User, authoritative: User): void {
    actor.championshipVersusDuelTicketsByVenue = authoritative.championshipVersusDuelTicketsByVenue;
    actor.championshipVersusDuelTicketNextAtByVenue = authoritative.championshipVersusDuelTicketNextAtByVenue;
    actor.championshipVersusDuelTickets = authoritative.championshipVersusDuelTickets;
    actor.championshipVersusDuelTicketNextAt = authoritative.championshipVersusDuelTicketNextAt;
}

/** PVP 풀을 구 단일 필드에 미러(구 API·로그 호환) */
function syncLegacyVersusDuelTicketMirrorFromPvp(user: User): void {
    const pvp = user.championshipVersusDuelTicketsByVenue?.pvp;
    user.championshipVersusDuelTickets = typeof pvp === 'number' ? clampChampionshipVersusDuelTicketCount(pvp) : user.championshipVersusDuelTickets;
    const n = user.championshipVersusDuelTicketNextAtByVenue?.pvp;
    user.championshipVersusDuelTicketNextAt = typeof n === 'number' && Number.isFinite(n) ? n : undefined;
}

function normalizeChampionshipVersusDuelTicketsForVenue(user: User, venue: ChampionshipVersusVenueKind, now: number): void {
    const MAX = CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX;
    const INTERVAL = CHAMPIONSHIP_VERSUS_DUEL_TICKET_REGEN_MS;
    if (!user.championshipVersusDuelTicketsByVenue) user.championshipVersusDuelTicketsByVenue = {};
    if (!user.championshipVersusDuelTicketNextAtByVenue) user.championshipVersusDuelTicketNextAtByVenue = {};
    const byT = user.championshipVersusDuelTicketsByVenue;
    const byN = user.championshipVersusDuelTicketNextAtByVenue;

    let t = byT[venue];
    if (typeof t !== 'number' || !Number.isFinite(t)) t = MAX;
    t = clampChampionshipVersusDuelTicketCount(t);
    let nextAt = byN[venue];

    if (t >= MAX) {
        byT[venue] = MAX;
        delete byN[venue];
        return;
    }

    if (typeof nextAt !== 'number' || !Number.isFinite(nextAt)) {
        byT[venue] = t;
        byN[venue] = now + INTERVAL;
        return;
    }

    while (t < MAX && now >= nextAt) {
        t += 1;
        nextAt += INTERVAL;
    }
    if (t >= MAX) {
        byT[venue] = MAX;
        delete byN[venue];
    } else {
        byT[venue] = t;
        byN[venue] = nextAt;
    }
}

export function normalizeChampionshipVersusDuelTickets(user: User, now: number): void {
    migrateLegacyVersusDuelTicketsToByVenue(user);
    for (const venue of CHAMPIONSHIP_VERSUS_VENUE_KINDS) {
        normalizeChampionshipVersusDuelTicketsForVenue(user, venue, now);
    }
    syncLegacyVersusDuelTicketMirrorFromPvp(user);
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
    const byT = user.championshipVersusDuelTicketsByVenue ?? {};
    const byN = user.championshipVersusDuelTicketNextAtByVenue ?? {};
    const ticketsByVenue = {
        pvp: clampChampionshipVersusDuelTicketCount(byT.pvp ?? CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX),
        pet: clampChampionshipVersusDuelTicketCount(byT.pet ?? CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX),
        petpair: clampChampionshipVersusDuelTicketCount(byT.petpair ?? CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX),
    };
    const nextByVenue: Partial<Record<ChampionshipVersusVenueKind, number>> = {};
    for (const k of CHAMPIONSHIP_VERSUS_VENUE_KINDS) {
        const na = byN[k];
        if (ticketsByVenue[k] < CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX && typeof na === 'number' && Number.isFinite(na)) {
            nextByVenue[k] = na;
        }
    }
    return {
        championshipVersusRefreshFreeUsed: freeUsed,
        championshipVersusRefreshFreeRemaining: Math.max(0, CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY - freeUsed),
        championshipVersusRefreshFreeMax: CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY,
        championshipVersusRefreshDiamondCost: CHAMPIONSHIP_VERSUS_OPP_REFRESH_DIAMONDS,
        championshipVersusDuelTickets: user.championshipVersusDuelTickets ?? CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX,
        championshipVersusDuelTicketsMax: CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX,
        championshipVersusDuelTicketNextAt: user.championshipVersusDuelTicketNextAt,
        championshipVersusDuelTicketsByVenue: ticketsByVenue,
        championshipVersusDuelTicketNextAtByVenue: nextByVenue,
    };
}

function consumeChampionshipVersusDuelTicket(user: User, venue: ChampionshipVersusVenueKind, now: number): string | undefined {
    normalizeChampionshipVersusDuelTickets(user, now);
    const MAX = CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX;
    const INTERVAL = CHAMPIONSHIP_VERSUS_DUEL_TICKET_REGEN_MS;
    if (!user.championshipVersusDuelTicketsByVenue) user.championshipVersusDuelTicketsByVenue = {};
    if (!user.championshipVersusDuelTicketNextAtByVenue) user.championshipVersusDuelTicketNextAtByVenue = {};
    const byT = user.championshipVersusDuelTicketsByVenue;
    const byN = user.championshipVersusDuelTicketNextAtByVenue;
    let t = clampChampionshipVersusDuelTicketCount(byT[venue]);
    if (t < 1) return '결투권이 부족합니다.';
    t -= 1;
    byT[venue] = t;
    if (t < MAX) {
        const na = byN[venue];
        if (typeof na !== 'number' || !Number.isFinite(na) || na < now) {
            byN[venue] = now + INTERVAL;
        }
    } else {
        delete byN[venue];
    }
    syncLegacyVersusDuelTicketMirrorFromPvp(user);
    return undefined;
}

export async function executeChampionshipVersusOpponentListRefresh(
    user: User,
    venue: ChampionshipVersusVenueKind,
    now: number,
): Promise<{ error?: string; myRating?: number; myGlobalRank?: number; ratingSeasonKey?: string; opponents?: ChampionshipVersusOpponentRow[] }> {
    normalizeChampionshipVersusDuelTickets(user, now);
    normalizeChampionshipVersusOppRefreshDay(user, now);
    resolveChampionshipVersusConditionForDay(user, venue, now);

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
        'championshipVersusDuelTicketsByVenue',
        'championshipVersusDuelTicketNextAtByVenue',
        'championshipVersusVenueRatings',
        'championshipVersusConditionSnapshot',
    ]);

    return { myRating: built.myRating, myGlobalRank: built.myGlobalRank, ratingSeasonKey: built.ratingSeasonKey, opponents: built.opponents };
}

function opponentUserChampionshipSnapshot(u: User): Pick<
    ChampionshipVersusOpponentRow,
    'totalGoPower' | 'coreStats' | 'openingAbility' | 'midgameAbility' | 'endgameAbility'
> {
    const stats = calculateTotalStats(u, 'championshipVenue') as Record<string, number>;
    return championshipVersusAbilitySnapshotFromCoreStats(stats, getChampionshipAbilityKataLadder());
}

function representativePetSnapshotFromUser(u: User): ChampionshipVersusRepresentativePetSnapshot | null {
    const row = getEquippedPairPetInventoryRow(u);
    if (!row) return null;
    const meta = resolvePairPetMetaFromInventoryRow(row);
    const grade = effectivePairPetGradeFromRow(row) ?? ItemGrade.Normal;
    const six = computePairPetKataCoreStatsSixFromMeta(meta, grade);
    const coreStats = pairPetCoreStatsSixToCoreRecord(six);
    const snap = championshipVersusAbilitySnapshotFromPairPetCoreStats(coreStats);
    return {
        displayName: getPairPetDisplayName(row),
        image: typeof row.image === 'string' && row.image.length > 0 ? row.image : null,
        level: meta.level,
        coreStats: snap.coreStats,
        openingAbility: snap.openingAbility,
        midgameAbility: snap.midgameAbility,
        endgameAbility: snap.endgameAbility,
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
): Promise<{ myRating: number; myGlobalRank?: number; ratingSeasonKey: string; opponents: ChampionshipVersusOpponentRow[] }> {
    ensureChampionshipVersusRatingEntry(self, venue, now);
    const selfEntry = self.championshipVersusVenueRatings![venue]!;
    const myRating = selfEntry.rating;
    if (venue === 'pet' || venue === 'petpair') {
        let selfHasPet = Boolean(getEquippedPairPetInventoryRow(self));
        if (!selfHasPet) {
            const fullSelf = await db.getUser(self.id, { includeEquipment: true, includeInventory: true });
            selfHasPet = Boolean(fullSelf && getEquippedPairPetInventoryRow(fullSelf));
        }
        if (!selfHasPet) {
            return {
                myRating,
                myGlobalRank: 1,
                ratingSeasonKey: selfEntry.ratingSeasonKey,
                opponents: [],
            };
        }
    }
    const selfGames = Math.max(0, (selfEntry.seasonWins ?? 0) + (selfEntry.seasonLosses ?? 0));
    const selfTierName = getSeasonalRankingTierName(myRating, 999_999, selfGames);
    let selfBand = championshipVersusTierBandIndexForTierName(selfTierName);
    if (selfBand < 0) selfBand = 0;

    const all = await db.getAllUsers({
        includeEquipment: true,
        includeInventory: venue !== 'pvp',
    });
    const candidates: VersusOppCand[] = [];
    for (const u of all) {
        if (!isRealHumanUser(u) || u.id === self.id) continue;
        if ((venue === 'pet' || venue === 'petpair') && !getEquippedPairPetInventoryRow(u)) continue;
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

    const globalRankByUserId = new Map<string, number>();
    {
        const globalRows = [
            ...candidates.map((c) => ({ userId: c.u.id, rating: c.rating })),
            { userId: self.id, rating: myRating },
        ].sort((a, b) => b.rating - a.rating);
        let rank = 1;
        for (let i = 0; i < globalRows.length; i++) {
            if (i > 0 && globalRows[i]!.rating < globalRows[i - 1]!.rating) rank = i + 1;
            globalRankByUserId.set(globalRows[i]!.userId, rank);
        }
    }

    const opponents: ChampionshipVersusOpponentRow[] = picked.map(({ u, rating }) => {
        ensureChampionshipVersusRatingEntry(u, venue, now);
        const e = u.championshipVersusVenueRatings![venue]!;
        const userSnap = opponentUserChampionshipSnapshot(u);
        const rep = venue === 'pvp' ? null : representativePetSnapshotFromUser(u);

        let listSnap = userSnap;
        const base: ChampionshipVersusOpponentRow = {
            userId: u.id,
            nickname: u.nickname,
            avatarId: u.avatarId,
            borderId: u.borderId,
            league: String(u.league ?? ''),
            userLevel: Math.max(1, Math.floor(Number(u.userLevel) || 1)),
            rating,
            globalRank: globalRankByUserId.get(u.id),
            wins: e.seasonWins,
            losses: e.seasonLosses,
            totalGoPower: 0,
            coreStats: {},
            openingAbility: 0,
            midgameAbility: 0,
            endgameAbility: 0,
        };

        if (venue === 'pvp') {
            listSnap = userSnap;
        } else if (venue === 'pet' && rep) {
            listSnap = championshipVersusAbilitySnapshotFromPairPetCoreStats(rep.coreStats);
        } else if (venue === 'petpair' && rep) {
            const merged = mergeChampionshipVersusPairUserPetCoreStats(userSnap.coreStats, rep.coreStats);
            listSnap = championshipVersusAbilitySnapshotFromCoreStats(merged, getChampionshipAbilityKataLadder());
            base.userPairAnchor = {
                coreStats: { ...userSnap.coreStats },
                openingAbility: userSnap.openingAbility,
                midgameAbility: userSnap.midgameAbility,
                endgameAbility: userSnap.endgameAbility,
            };
        }

        if (rep) {
            base.representativePet = rep;
        }

        return {
            ...base,
            totalGoPower: listSnap.totalGoPower,
            coreStats: listSnap.coreStats,
            openingAbility: listSnap.openingAbility,
            midgameAbility: listSnap.midgameAbility,
            endgameAbility: listSnap.endgameAbility,
        };
    });
    return {
        myRating,
        myGlobalRank: globalRankByUserId.get(self.id),
        ratingSeasonKey: selfEntry.ratingSeasonKey,
        opponents,
    };
}

async function grantVersusEconomyRewardsForParticipants(
    actor: User,
    opponent: User,
    venue: ChampionshipVersusVenueKind,
    actorWon: boolean,
    raBefore: number,
    roBefore: number,
    now: number,
): Promise<{ actorPayload: VersusKataActorRewardClientPayload }> {
    const actorGoldDelta = applyVersusGoldRewardVenueMultiplier(
        actorWon ? rollVersusGoldWinFromRating(raBefore) : rollVersusGoldLossFromRating(raBefore),
        venue,
    );
    const oppWon = !actorWon;
    const oppGoldDelta = applyVersusGoldRewardVenueMultiplier(
        oppWon ? rollVersusGoldWinFromRating(roBefore) : rollVersusGoldLossFromRating(roBefore),
        venue,
    );

    const actorXpPool = actorWon ? rollVersusUserXpWinPoolFromRating(raBefore) : rollVersusUserXpLossPoolFromRating(raBefore);
    const oppXpPool = oppWon ? rollVersusUserXpWinPoolFromRating(roBefore) : rollVersusUserXpLossPoolFromRating(roBefore);

    const actorSplit = splitVersusExperiencePoolForVenue(venue, actorXpPool);
    const oppSplit = splitVersusExperiencePoolForVenue(venue, oppXpPool);

    const goldBefore = actor.gold ?? 0;
    const userXpBefore = actor.userXp ?? 0;
    const userLevelBefore = Math.max(1, Math.floor(Number(actor.userLevel) || 1));

    actor.gold = goldBefore + actorGoldDelta;
    opponent.gold = (opponent.gold ?? 0) + oppGoldDelta;

    let userXpDelta = 0;
    let userLevelAfter = userLevelBefore;
    let userXpAfter = userXpBefore;
    if (actorSplit.userPart > 0) {
        userXpDelta = actorSplit.userPart;
        const totalAfter = totalAccumulatedXpFromLevelAndBar(userLevelBefore, userXpBefore) + actorSplit.userPart;
        const resolved = levelAndBarFromTotalAccumulatedXp(totalAfter);
        actor.userLevel = resolved.userLevel;
        actor.userXp = resolved.userXp;
        userLevelAfter = resolved.userLevel;
        userXpAfter = resolved.userXp;
    }

    let pairPetXp: GameSummary['pairPetXp'] | undefined;
    let pairPetLevel: GameSummary['pairPetLevel'] | undefined;
    if (actorSplit.petPart > 0) {
        const petGrowth = applyPairPetRewardXp(actor, actorSplit.petPart);
        if (petGrowth) {
            pairPetXp = petGrowth.xp;
            pairPetLevel = petGrowth.level;
        }
    }

    const oppLevelBefore = Math.max(1, Math.floor(Number(opponent.userLevel) || 1));
    const oppXpBefore = opponent.userXp ?? 0;
    if (oppSplit.userPart > 0) {
        const totalAfter = totalAccumulatedXpFromLevelAndBar(oppLevelBefore, oppXpBefore) + oppSplit.userPart;
        const resolved = levelAndBarFromTotalAccumulatedXp(totalAfter);
        opponent.userLevel = resolved.userLevel;
        opponent.userXp = resolved.userXp;
    }
    if (oppSplit.petPart > 0) {
        applyPairPetRewardXp(opponent, oppSplit.petPart);
    }

    const venueEntry = actor.championshipVersusVenueRatings?.[venue];
    const overallRecord = {
        wins: Math.max(0, Math.floor(venueEntry?.seasonWins ?? 0)),
        losses: Math.max(0, Math.floor(venueEntry?.seasonLosses ?? 0)),
    };

    let vipGoldBonus = 0;
    let vipPlayRewardSlot: VersusKataActorRewardClientPayload['vipPlayRewardSlot'];

    if (!actorWon || !isRewardVipActive(actor, now)) {
        vipPlayRewardSlot = { locked: true };
    } else {
        if (!Array.isArray(actor.inventory)) {
            const fu = await db.getUser(actor.id, { includeEquipment: true, includeInventory: true });
            if (fu) {
                actor.inventory = fu.inventory;
                actor.inventorySlots = fu.inventorySlots;
            } else {
                actor.inventory = [];
            }
        }
        if (!actor.inventorySlots) {
            actor.inventorySlots = { equipment: 30, consumable: 30, material: 30 };
        }

        const vip = rollAndResolveRewardVipPlayGrant();
        vipGoldBonus = vip.goldBonus;
        if (vipGoldBonus > 0) {
            actor.gold = (actor.gold ?? 0) + vipGoldBonus;
        }

        const grantedItem = vip.grantedDisplay;
        if (vip.inventoryItem) {
            const { success, updatedInventory } = addItemsToInventory(actor.inventory, actor.inventorySlots, [vip.inventoryItem]);
            if (success) {
                actor.inventory = updatedInventory;
                try {
                    const { recordGuildEpicPlusEquipmentAcquisition } = await import('./guildService.js');
                    await recordGuildEpicPlusEquipmentAcquisition(actor, [vip.inventoryItem]);
                } catch (e) {
                    console.warn('[grantVersusEconomyRewardsForParticipants] guild epic record skipped', e);
                }
            } else {
                console.error(`[ChampionshipVersus] VIP inventory add failed for ${actor.id}; forcing stack.`);
                const vipGrant = vip.inventoryItem;
                const vipQty = Math.max(1, vipGrant.quantity ?? 1);
                const forcedInventory = [...actor.inventory];
                const stack = forcedInventory.find(
                    (it) => it.name === vipGrant.name && (it.source ?? null) === (vipGrant.source ?? null),
                );
                if (stack) {
                    stack.quantity = Math.max(1, stack.quantity ?? 1) + vipQty;
                } else {
                    forcedInventory.push({ ...vipGrant, quantity: vipQty });
                }
                actor.inventory = forcedInventory;
                try {
                    const { recordGuildEpicPlusEquipmentAcquisition } = await import('./guildService.js');
                    await recordGuildEpicPlusEquipmentAcquisition(actor, [vip.inventoryItem]);
                } catch (e) {
                    console.warn('[grantVersusEconomyRewardsForParticipants] guild epic record skipped', e);
                }
            }
        }

        vipPlayRewardSlot = {
            locked: false,
            grantedItem,
        };
    }

    return {
        actorPayload: {
            goldDelta: actorGoldDelta,
            userXpDelta,
            goldBefore,
            userXpBefore,
            userLevelBefore,
            userLevelAfter,
            userXpAfter,
            ...(vipGoldBonus > 0 ? { vipGoldBonus } : {}),
            ...(pairPetXp ? { pairPetXp } : {}),
            ...(pairPetLevel ? { pairPetLevel } : {}),
            overallRecord,
            vipPlayRewardSlot,
        },
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
    ensureChampionshipVersusRatingEntry(actor, 'pvp', now);
    ensureChampionshipVersusRatingEntry(opponent, 'pvp', now);
    ensureChampionshipVersusRatingEntry(actor, venue, now);
    ensureChampionshipVersusRatingEntry(opponent, venue, now);
    const aPvp = actor.championshipVersusVenueRatings!.pvp!;
    const oPvp = opponent.championshipVersusVenueRatings!.pvp!;
    const aVenue = actor.championshipVersusVenueRatings![venue]!;
    const oVenue = opponent.championshipVersusVenueRatings![venue]!;
    const ra = aPvp.rating;
    const ro = oPvp.rating;
    const actorVenueRatingBefore = ra;

    const winnerRatingBefore = actorWon ? ra : ro;
    const loserRatingBefore = actorWon ? ro : ra;

    const { winnerNext, loserNext } = computeEloPairAfterMatch(winnerRatingBefore, loserRatingBefore);

    const winCoins = champCoinsForVersusWin(winnerRatingBefore);
    const lossCoins = champCoinsForVersusLoss(loserRatingBefore);

    if (actorWon) {
        aPvp.rating = winnerNext;
        oPvp.rating = loserNext;
        actor.champCoins = (actor.champCoins ?? 0) + winCoins;
        opponent.champCoins = (opponent.champCoins ?? 0) + lossCoins;
        aVenue.seasonWins += 1;
        oVenue.seasonLosses += 1;
    } else {
        oPvp.rating = winnerNext;
        aPvp.rating = loserNext;
        opponent.champCoins = (opponent.champCoins ?? 0) + winCoins;
        actor.champCoins = (actor.champCoins ?? 0) + lossCoins;
        oVenue.seasonWins += 1;
        aVenue.seasonLosses += 1;
    }

    syncVersusSharedRatingFromPvp(actor);
    syncVersusSharedRatingFromPvp(opponent);

    return {
        actorCoinsDelta: actorWon ? winCoins : lossCoins,
        opponentCoinsDelta: actorWon ? lossCoins : winCoins,
        actorVenueRatingBefore,
        actorVenueRatingAfter: aPvp.rating,
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
    versusActorRewards?: VersusKataActorRewardClientPayload;
}> {
    const actorRunKey = `${actor.id}:${venue}`;
    if (activeChampionshipVersusKataDuelActors.has(actorRunKey)) {
        return { error: '이미 챔피언십 경기를 시작하는 중입니다. 잠시만 기다려 주세요.' };
    }
    activeChampionshipVersusKataDuelActors.add(actorRunKey);
    const releaseDuelSlot = await acquireChampionshipVersusKataDuelSlot();
    try {
        return await executeChampionshipVersusKataDuelUnlocked(actor, venue, opponentUserId, now);
    } finally {
        releaseDuelSlot();
        activeChampionshipVersusKataDuelActors.delete(actorRunKey);
    }
}

async function executeChampionshipVersusKataDuelUnlocked(
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
    versusActorRewards?: VersusKataActorRewardClientPayload;
}> {
    if (!opponentUserId || opponentUserId === actor.id) {
        return { error: '유효하지 않은 상대입니다.' };
    }

    const opponent = await db.getUser(opponentUserId, { includeEquipment: true, includeInventory: true });
    if (!opponent || !isRealHumanUser(opponent)) {
        return { error: '상대 유저를 찾을 수 없습니다.' };
    }

    const needPetPayload = venue === 'pet' || venue === 'petpair';
    const authoritativeActor = await db.getUser(actor.id, {
        includeEquipment: needPetPayload,
        includeInventory: needPetPayload,
    });
    if (!authoritativeActor) {
        return { error: '유저 정보를 불러오지 못했습니다.' };
    }
    hydrateVersusDuelTicketsFromAuthoritativeUser(actor, authoritativeActor);
    if (needPetPayload) {
        actor.inventory = authoritativeActor.inventory;
        actor.equipment = authoritativeActor.equipment;
        actor.equippedPairPetTemplateId = authoritativeActor.equippedPairPetTemplateId;
        actor.equippedPairPetInventoryItemId = authoritativeActor.equippedPairPetInventoryItemId;
        actor.pairPetTrainingSlots = authoritativeActor.pairPetTrainingSlots;
        if (!getEquippedPairPetInventoryRow(actor)) {
            return { error: '대표 펫을 장착해야 이 경기장에서 대국할 수 있습니다.' };
        }
        if (!getEquippedPairPetInventoryRow(opponent)) {
            return { error: '상대 유저가 대표 펫을 장착하지 않아 대국할 수 없습니다.' };
        }
    }

    normalizeChampionshipVersusDuelTickets(actor, now);
    const t0 = clampChampionshipVersusDuelTicketCount(actor.championshipVersusDuelTicketsByVenue?.[venue]);
    if (t0 < 1) {
        return { error: '결투권이 부족합니다.' };
    }

    const rules = championshipVersusBoardRulesForActorStrategicTier(actor);
    let statsActor: Record<string, number>;
    let statsOpp: Record<string, number>;
    let p1Nickname = actor.nickname;
    let p2Nickname = opponent.nickname;

    if (venue === 'pvp') {
        statsActor = calculateTotalStats(actor, 'championshipVenue') as Record<string, number>;
        statsOpp = calculateTotalStats(opponent, 'championshipVenue') as Record<string, number>;
    } else if (venue === 'pet') {
        const aSix = pairPetKataStatsSixFromEquippedUser(actor);
        const oSix = pairPetKataStatsSixFromEquippedUser(opponent);
        if (!aSix || !oSix) return { error: '대표 펫을 장착한 유저만 이 경기장에서 대국할 수 있습니다.' };
        statsActor = pairPetCoreStatsSixToCoreRecord(aSix);
        statsOpp = pairPetCoreStatsSixToCoreRecord(oSix);
        p1Nickname = getPairPetDisplayName(getEquippedPairPetInventoryRow(actor)!);
        p2Nickname = getPairPetDisplayName(getEquippedPairPetInventoryRow(opponent)!);
    } else {
        const aSix = pairPetKataStatsSixFromEquippedUser(actor);
        const oSix = pairPetKataStatsSixFromEquippedUser(opponent);
        if (!aSix || !oSix) return { error: '대표 펫을 장착한 유저만 이 경기장에서 대국할 수 있습니다.' };
        const ua = calculateTotalStats(actor, 'championshipVenue') as Record<string, number>;
        const uo = calculateTotalStats(opponent, 'championshipVenue') as Record<string, number>;
        statsActor = mergeChampionshipVersusPairUserPetCoreStats(ua, pairPetCoreStatsSixToCoreRecord(aSix));
        statsOpp = mergeChampionshipVersusPairUserPetCoreStats(uo, pairPetCoreStatsSixToCoreRecord(oSix));
    }

    const actorCond = resolveChampionshipVersusConditionForDay(actor, venue, now).condition;
    const opponentCond = resolveChampionshipVersusConditionForDay(opponent, venue, now).condition;

    const p1: PlayerForTournament = {
        id: actor.id,
        nickname: p1Nickname,
        avatarId: actor.avatarId,
        borderId: actor.borderId,
        league: (actor.league ?? LeagueTier.Rookie) as LeagueTier,
        stats: statsActor as any,
        originalStats: JSON.parse(JSON.stringify(statsActor)) as any,
        wins: 0,
        losses: 0,
        condition: actorCond,
    };
    const p2: PlayerForTournament = {
        id: opponent.id,
        nickname: p2Nickname,
        avatarId: opponent.avatarId,
        borderId: opponent.borderId,
        league: (opponent.league ?? LeagueTier.Rookie) as LeagueTier,
        stats: statsOpp as any,
        originalStats: JSON.parse(JSON.stringify(statsOpp)) as any,
        wins: 0,
        losses: 0,
        condition: opponentCond,
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

    const userLadder = getChampionshipAbilityKataLadder();
    const pairPetLadder = getKataServerRuntimeSnapshot().pairPet.abilityKataLadder;
    let kataConfig: ChampionshipVersusKataConfig;
    if (venue === 'pet') {
        kataConfig = { mode: 'petOnly', pairPetLadder };
    } else if (venue === 'petpair') {
        const aSix = pairPetKataStatsSixFromEquippedUser(actor)!;
        const oSix = pairPetKataStatsSixFromEquippedUser(opponent)!;
        kataConfig = {
            mode: 'petPairSplit',
            userLadder,
            pairPetLadder,
            userCoreByUserId: {
                [actor.id]: calculateTotalStats(actor, 'championshipVenue') as Record<string, number>,
                [opponent.id]: calculateTotalStats(opponent, 'championshipVenue') as Record<string, number>,
            },
            petSixByUserId: { [actor.id]: aSix, [opponent.id]: oSix },
        };
    } else {
        kataConfig = { mode: 'userOnly', userLadder };
    }

    let generation: Awaited<ReturnType<typeof generateChampionshipRealMatch>>;
    try {
        if (venue === 'petpair') {
            generation = await generateChampionshipRealMatch(match, [p1, p2], actor, rules, {
                kataConfig,
                petPairDuel: {
                    petDisplayNameByUserId: {
                        [actor.id]: getPairPetDisplayName(getEquippedPairPetInventoryRow(actor)!),
                        [opponent.id]: getPairPetDisplayName(getEquippedPairPetInventoryRow(opponent)!),
                    },
                },
            });
        } else {
            generation = await generateChampionshipRealMatch(match, [p1, p2], actor, rules, { kataConfig });
        }
    } catch (err: any) {
        console.error('[executeChampionshipVersusKataDuel] generateChampionshipRealMatch failed:', err?.message || err);
        return { error: '실제 대국 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.' };
    }

    const ticketErr = consumeChampionshipVersusDuelTicket(actor, venue, now);
    if (ticketErr) {
        return { error: ticketErr };
    }

    generation.game.status = 'finished';

    const actorWon = generation.winner.id === actor.id;
    ensureChampionshipVersusRatingEntry(actor, 'pvp', now);
    ensureChampionshipVersusRatingEntry(opponent, 'pvp', now);
    const raBefore = actor.championshipVersusVenueRatings!.pvp!.rating;
    const roBefore = opponent.championshipVersusVenueRatings!.pvp!.rating;

    const ratingRes = await applyChampionshipVersusDuelRatingAndCoins(actor, venue, opponent, actorWon, now);
    const raAfter = actor.championshipVersusVenueRatings!.pvp!.rating;
    const roAfter = opponent.championshipVersusVenueRatings!.pvp!.rating;
    recordChampionshipVersusDuelWeekLogsPair({
        actor,
        opponent,
        venue,
        actorWon,
        nowMs: now,
        actorRatingBefore: raBefore,
        actorRatingAfter: raAfter,
        opponentRatingBefore: roBefore,
        opponentRatingAfter: roAfter,
    });
    const { actorPayload: versusActorRewards } = await grantVersusEconomyRewardsForParticipants(
        actor,
        opponent,
        venue,
        actorWon,
        raBefore,
        roBefore,
        now,
    );

    if (actorWon && actor.guildId) {
        try {
            const guilds = (await db.getKV<Record<string, Guild>>('guilds')) || {};
            const { updateGuildMissionProgress } = await import('./guildService.js');
            await updateGuildMissionProgress(actor.guildId, 'strategicWins', 1, guilds);
            await db.setKV('guilds', guilds);
        } catch (e) {
            console.warn('[executeChampionshipVersusKataDuel] guild mission update skipped:', e);
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
    // Actor UI reveals rating/record/reward changes after replay completes.
    // The HTTP payload carries the updated user for that local reveal; avoid an early WebSocket merge.
    broadcastUserUpdate(opponent, [
        'championshipVersusVenueRatings',
        'champCoins',
        'gold',
        'userXp',
        'userLevel',
        'inventory',
        'championshipVersusConditionSnapshot',
        'championshipVersusDuelWeekLog',
    ]);

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
        versusActorRewards,
    };
}

export async function applyChampionshipVersusDuelResult(
    actor: User,
    venue: ChampionshipVersusVenueKind,
    opponentUserId: string,
    actorWon: boolean,
    now: number,
): Promise<{
    error?: string;
    actor: User;
    opponent: User;
    actorCoinsDelta: number;
    opponentCoinsDelta: number;
    versusActorRewards?: VersusKataActorRewardClientPayload;
}> {
    if (!opponentUserId || opponentUserId === actor.id) {
        return { error: '유효하지 않은 상대입니다.', actor, opponent: actor, actorCoinsDelta: 0, opponentCoinsDelta: 0 };
    }
    const opponent = await db.getUser(opponentUserId, { includeEquipment: true, includeInventory: true });
    if (!opponent || !isRealHumanUser(opponent)) {
        return { error: '상대 유저를 찾을 수 없습니다.', actor, opponent: actor, actorCoinsDelta: 0, opponentCoinsDelta: 0 };
    }

    if (venue === 'pet' || venue === 'petpair') {
        const fullActor = await db.getUser(actor.id, { includeEquipment: true, includeInventory: true });
        if (!fullActor || !getEquippedPairPetInventoryRow(fullActor)) {
            return { error: '대표 펫을 장착해야 이 경기장에서 대국할 수 있습니다.', actor, opponent, actorCoinsDelta: 0, opponentCoinsDelta: 0 };
        }
        if (!getEquippedPairPetInventoryRow(opponent)) {
            return { error: '상대 유저가 대표 펫을 장착하지 않아 대국할 수 없습니다.', actor, opponent, actorCoinsDelta: 0, opponentCoinsDelta: 0 };
        }
        hydrateVersusDuelTicketsFromAuthoritativeUser(actor, fullActor);
        actor.inventory = fullActor.inventory;
        actor.equipment = fullActor.equipment;
        actor.equippedPairPetTemplateId = fullActor.equippedPairPetTemplateId;
        actor.equippedPairPetInventoryItemId = fullActor.equippedPairPetInventoryItemId;
        actor.pairPetTrainingSlots = fullActor.pairPetTrainingSlots;
    } else {
        const snap = await db.getUser(actor.id);
        if (snap) hydrateVersusDuelTicketsFromAuthoritativeUser(actor, snap);
    }

    const ticketErr = consumeChampionshipVersusDuelTicket(actor, venue, now);
    if (ticketErr) {
        return { error: ticketErr, actor, opponent, actorCoinsDelta: 0, opponentCoinsDelta: 0 };
    }

    ensureChampionshipVersusRatingEntry(actor, 'pvp', now);
    ensureChampionshipVersusRatingEntry(opponent, 'pvp', now);
    const raBefore = actor.championshipVersusVenueRatings!.pvp!.rating;
    const roBefore = opponent.championshipVersusVenueRatings!.pvp!.rating;

    const { actorCoinsDelta, opponentCoinsDelta } = await applyChampionshipVersusDuelRatingAndCoins(actor, venue, opponent, actorWon, now);
    const raAfter = actor.championshipVersusVenueRatings!.pvp!.rating;
    const roAfter = opponent.championshipVersusVenueRatings!.pvp!.rating;
    recordChampionshipVersusDuelWeekLogsPair({
        actor,
        opponent,
        venue,
        actorWon,
        nowMs: now,
        actorRatingBefore: raBefore,
        actorRatingAfter: raAfter,
        opponentRatingBefore: roBefore,
        opponentRatingAfter: roAfter,
    });
    const { actorPayload: versusActorRewards } = await grantVersusEconomyRewardsForParticipants(
        actor,
        opponent,
        venue,
        actorWon,
        raBefore,
        roBefore,
        now,
    );

    if (actorWon && actor.guildId) {
        try {
            const guilds = (await db.getKV<Record<string, Guild>>('guilds')) || {};
            const { updateGuildMissionProgress } = await import('./guildService.js');
            await updateGuildMissionProgress(actor.guildId, 'strategicWins', 1, guilds);
            await db.setKV('guilds', guilds);
        } catch (e) {
            console.warn('[applyChampionshipVersusDuelResult] guild mission update skipped:', e);
        }
    }

    updateUserCache(actor);
    updateUserCache(opponent);
    await db.updateUser(actor);
    await db.updateUser(opponent);

    const { broadcastUserUpdate } = await import('./socket.js');
    broadcastUserUpdate(actor, [
        'championshipVersusVenueRatings',
        'champCoins',
        'gold',
        'userXp',
        'userLevel',
        'inventory',
        'championshipVersusDuelTickets',
        'championshipVersusDuelTicketNextAt',
        'championshipVersusDuelTicketsByVenue',
        'championshipVersusDuelTicketNextAtByVenue',
        'championshipVersusDuelWeekLog',
    ]);
    broadcastUserUpdate(opponent, [
        'championshipVersusVenueRatings',
        'champCoins',
        'gold',
        'userXp',
        'userLevel',
        'inventory',
        'championshipVersusDuelWeekLog',
    ]);

    return {
        actor,
        opponent,
        actorCoinsDelta,
        opponentCoinsDelta,
        versusActorRewards,
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
