import React from 'react';
import { createPortal } from 'react-dom';
import type { ChampionshipVersusVenueKind, AnalysisResult } from '../../shared/types/entities.js';
import type { LiveGameSession, Match, PlayerForTournament, UserWithStatus } from '../../types.js';
import { CoreStat, LeagueTier, Player } from '../../types/enums.js';
import { AVATAR_POOL, BORDER_POOL } from '../../constants';
import { getChampionshipArenaBackgroundUrl } from '../../shared/constants/tournaments.js';
import {
    CHAMPIONSHIP_ABILITY_KATA_LADDER,
    championshipKataLevelForPly,
    resolveChampionshipVersusPlaybackSpeedChoices,
} from '../../shared/constants/championshipRealMatch.js';
import { getSeasonalRankingTierName, RANKING_TIERS } from '../../shared/constants/ranking.js';
import { RANKED_ELO_BASE_SCORE } from '../../shared/constants/rules.js';
import {
    CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX,
    CHAMPIONSHIP_VERSUS_ENTRY_TICKET_IMAGE,
    CHAMPIONSHIP_VERSUS_LOW_CONDITION_START_WARN_AT,
    CHAMPIONSHIP_VERSUS_OPPONENT_LIST_SIZE,
    CHAMPIONSHIP_VERSUS_OPP_REFRESH_DIAMONDS,
    CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY,
} from '../../shared/constants/championshipVersusVenue.js';
import {
    getChampionshipVersusDuelTicketsForVenue,
    getChampionshipVersusDuelTicketsForVenueUi,
    getChampionshipVersusDuelTicketNextAtForVenue,
} from '../../shared/utils/championshipVersusDuelTickets.js';
import { resolvePublicUrl } from '../../utils/publicAssetUrl.js';
import { calculateTotalStats } from '../../services/statService.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import { getCurrentSeason, getVersusSeasonRemainingDaysHours } from '../../shared/utils/timeUtils.js';
import { ArenaRightSidebarCollapseToggle } from '../game/ArenaRightSidebarCollapseToggle.js';
import Button from '../Button.js';
import Avatar from '../Avatar.js';
import ChampionshipVersusDuelTicketCountdown from '../ChampionshipVersusDuelTicketCountdown.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { ChampionshipAbilityPlayerPanel, ChampionshipRealGoBoard } from '../TournamentBracket.js';
import GameSummaryModal from '../GameSummaryModal.js';
import ConditionPotionModal from '../ConditionPotionModal.js';
import { buildChampionshipVersusKataSummarySession, type VersusKataActorRewardClientPayload } from '../../utils/buildChampionshipVersusKataSummarySession.js';
import { CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST } from './championshipVersusVenueUiConfig.js';
import ChampionshipVersusDuelHistoryModal from '../ChampionshipVersusDuelHistoryModal.js';
import { resourceIcons, specialResourceIcons } from '../resourceIcons.js';
import { getEquippedPairPetInventoryRow } from '../../shared/utils/pairEquippedPet.js';
import { getPairPetDisplayName, getPairPetDefinition } from '../../shared/constants/petLobby.js';
import { resolvePairPetMetaFromInventoryRow } from '../../shared/utils/pairPetRoll.js';
import {
    championshipVersusAbilitySnapshotFromCoreStats,
    mergeChampionshipVersusPairUserPetCoreStats,
    pairPetCoreStatsSixToCoreRecord,
} from '../../shared/utils/championshipVersusKataParticipantStats.js';
import { pairPetKataStatsSixFromEquippedUser } from '../../shared/utils/pairPetKataStatsFromEquippedUser.js';
import {
    CHAMPIONSHIP_REAL_MATCH_SCORING_DELAY_MS,
    championshipPlaybackMoveIntervalMs,
    championshipReplayBoardAfterMoves,
    type ChampionshipPlaybackSpeed,
} from '../../hooks/useTournamentSimulation.js';
import { championshipVersusBoardRulesForActorStrategicTier } from '../../shared/utils/championshipVersusTier.js';
import { champCoinsForVersusLoss, champCoinsForVersusWin } from '../../shared/utils/championshipVersusElo.js';

function readVersusPlaybackSpeedFromStorage(): ChampionshipPlaybackSpeed {
    if (typeof window === 'undefined') return 1;
    try {
        const saved = window.localStorage.getItem('championshipPlaybackSpeed');
        if (saved === '0.5') return 0.5;
        if (saved === '2') return 2;
        if (saved === '3') return 3;
    } catch {
        /* ignore */
    }
    return 1;
}

type OpponentRow = {
    userId: string;
    nickname: string;
    avatarId: string;
    borderId: string;
    league: LeagueTier;
    userLevel: number;
    rating: number;
    globalRank?: number;
    wins: number;
    losses: number;
    totalGoPower: number;
    coreStats: Record<string, number>;
    openingAbility: number;
    midgameAbility: number;
    endgameAbility: number;
    representativePet?: {
        displayName: string;
        image: string | null;
        level?: number;
        coreStats: Record<string, number>;
        openingAbility: number;
        midgameAbility: number;
        endgameAbility: number;
    };
    userPairAnchor?: {
        coreStats: Record<string, number>;
        openingAbility: number;
        midgameAbility: number;
        endgameAbility: number;
    };
};

const championshipFooterButtonBase =
    'rounded-xl border px-4 py-2 text-xs font-black tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_24px_-14px_rgba(0,0,0,0.9)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';
const championshipFooterExitButton = `${championshipFooterButtonBase} border-rose-400/45 bg-gradient-to-b from-rose-600/88 via-rose-800/90 to-rose-950/95 text-rose-50 hover:brightness-110 focus-visible:ring-rose-400/55`;
/** 사이드바 전용 — 데스크톱·모바일 패널에서 세로 공간 절약 */
const championshipVersusStartMatchButtonSidebarClass =
    'group relative isolate flex min-h-[42px] min-w-0 flex-[2.1] basis-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-xl border border-emerald-200/55 bg-gradient-to-b from-emerald-200/98 via-emerald-600 to-emerald-950 px-2 py-1.5 text-emerald-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.38),inset_0_-10px_24px_rgba(6,78,59,0.45),0_8px_28px_-12px_rgba(16,185,129,0.45)] transition-[transform,box-shadow,filter] duration-200 hover:brightness-[1.02] active:scale-[0.985] disabled:cursor-not-allowed disabled:saturate-[0.65] disabled:opacity-40 disabled:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:min-h-[44px] sm:px-2.5 sm:py-2';

/** 네이티브 셸 고정 패널: `Header` 모바일 min-h(`clamp(3.5rem,…,4.85rem)`)와 동일 계열 */
const VERSUS_MOBILE_DRAWER_TOP = 'calc(env(safe-area-inset-top, 0px) + clamp(3.5rem, calc(2.85rem + 2vw), 4.85rem))';
/** `NativeMobileDock`(h-11+테두리) + 하단 광고(~50px)·여유 — 하단 독·광고에 가리지 않도록 */
const VERSUS_MOBILE_DRAWER_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 7.5rem)';
/** 모바일 사이드 열기 탭: 퀵 독 바로 위(드로어 하단 inset + 소간격) */
const VERSUS_MOBILE_SIDEBAR_OPEN_TAB_BOTTOM = 'calc(env(safe-area-inset-bottom, 0px) + 7.5rem + 0.25rem)';

function resolveVersusPetPortraitPublicUrl(image: string | null | undefined, templateId?: string | null): string | null {
    if (typeof image === 'string' && image.trim().length > 0) return resolvePublicUrl(image);
    const def = templateId ? getPairPetDefinition(templateId) : null;
    const u = def?.image;
    return typeof u === 'string' && u.length > 0 ? resolvePublicUrl(u) : null;
}

function stubCoreStats(seed: number): Record<CoreStat, number> {
    const keys = [
        CoreStat.Concentration,
        CoreStat.ThinkingSpeed,
        CoreStat.Judgment,
        CoreStat.Calculation,
        CoreStat.CombatPower,
        CoreStat.Stability,
    ];
    return Object.fromEntries(keys.map((k, i) => [k, 52 + seed * 4 + i * 6])) as Record<CoreStat, number>;
}

function buildDemoOpponentRow(
    base: Omit<OpponentRow, 'totalGoPower' | 'coreStats' | 'openingAbility' | 'midgameAbility' | 'endgameAbility'>,
    seed: number,
): OpponentRow {
    const snap = championshipVersusAbilitySnapshotFromCoreStats(stubCoreStats(seed) as Record<string, number>);
    return {
        ...base,
        totalGoPower: snap.totalGoPower,
        coreStats: snap.coreStats,
        openingAbility: snap.openingAbility,
        midgameAbility: snap.midgameAbility,
        endgameAbility: snap.endgameAbility,
    };
}

const DEMO_OPPONENT_BASES: Omit<
    OpponentRow,
    'totalGoPower' | 'coreStats' | 'openingAbility' | 'midgameAbility' | 'endgameAbility' | 'representativePet' | 'userPairAnchor'
>[] = [
    {
        userId: 'versus-demo-1',
        nickname: '데모_바둑이',
        avatarId: AVATAR_POOL[1]?.id ?? AVATAR_POOL[0].id,
        borderId: BORDER_POOL[0]?.id ?? '',
        league: LeagueTier.Rising,
        userLevel: 38,
        rating: 1205,
        wins: 4,
        losses: 3,
    },
    {
        userId: 'versus-demo-2',
        nickname: '데모_청룡',
        avatarId: AVATAR_POOL[2]?.id ?? AVATAR_POOL[0].id,
        borderId: BORDER_POOL[0]?.id ?? '',
        league: LeagueTier.Ace,
        userLevel: 52,
        rating: 1198,
        wins: 2,
        losses: 2,
    },
    {
        userId: 'versus-demo-3',
        nickname: '데모_한수',
        avatarId: AVATAR_POOL[3]?.id ?? AVATAR_POOL[0].id,
        borderId: BORDER_POOL[0]?.id ?? '',
        league: LeagueTier.Rookie,
        userLevel: 22,
        rating: 1202,
        wins: 6,
        losses: 5,
    },
    {
        userId: 'versus-demo-4',
        nickname: '데모_집중',
        avatarId: AVATAR_POOL[4]?.id ?? AVATAR_POOL[0].id,
        borderId: BORDER_POOL[0]?.id ?? '',
        league: LeagueTier.Diamond,
        userLevel: 61,
        rating: 1210,
        wins: 11,
        losses: 8,
    },
    {
        userId: 'versus-demo-5',
        nickname: '데모_막판',
        avatarId: AVATAR_POOL[5]?.id ?? AVATAR_POOL[0].id,
        borderId: BORDER_POOL[0]?.id ?? '',
        league: LeagueTier.Master,
        userLevel: 74,
        rating: 1192,
        wins: 1,
        losses: 4,
    },
];

function makeDemoOpponentRows(venue: ChampionshipVersusVenueKind): OpponentRow[] {
    return DEMO_OPPONENT_BASES.map((base, i) => {
        const seed = i + 1;
        if (venue === 'pvp') return buildDemoOpponentRow(base, seed);
        const userStats = stubCoreStats(seed) as Record<string, number>;
        const petStats = stubCoreStats(seed + 20) as Record<string, number>;
        const userSnap = championshipVersusAbilitySnapshotFromCoreStats(userStats);
        const petSnap = championshipVersusAbilitySnapshotFromCoreStats(petStats);
        const rep = {
            displayName: `데모펫_${seed}`,
            image: null as string | null,
            level: 4 + seed,
            coreStats: petSnap.coreStats,
            openingAbility: petSnap.openingAbility,
            midgameAbility: petSnap.midgameAbility,
            endgameAbility: petSnap.endgameAbility,
        };
        if (venue === 'pet') {
            return {
                ...base,
                totalGoPower: petSnap.totalGoPower,
                coreStats: petSnap.coreStats,
                openingAbility: petSnap.openingAbility,
                midgameAbility: petSnap.midgameAbility,
                endgameAbility: petSnap.endgameAbility,
                representativePet: rep,
            };
        }
        const merged = mergeChampionshipVersusPairUserPetCoreStats(userSnap.coreStats, petSnap.coreStats);
        const listSnap = championshipVersusAbilitySnapshotFromCoreStats(merged);
        return {
            ...base,
            totalGoPower: listSnap.totalGoPower,
            coreStats: listSnap.coreStats,
            openingAbility: listSnap.openingAbility,
            midgameAbility: listSnap.midgameAbility,
            endgameAbility: listSnap.endgameAbility,
            representativePet: rep,
            userPairAnchor: {
                coreStats: userSnap.coreStats,
                openingAbility: userSnap.openingAbility,
                midgameAbility: userSnap.midgameAbility,
                endgameAbility: userSnap.endgameAbility,
            },
        };
    });
}

function tierIconUrlForVersusRow(row: OpponentRow): string {
    const tierName = getSeasonalRankingTierName(row.rating, 999_999, row.wins + row.losses);
    const t = RANKING_TIERS.find((x) => x.name === tierName) ?? RANKING_TIERS[RANKING_TIERS.length - 1]!;
    return t.icon;
}

function seasonRecordLabel(wins: number, losses: number): string {
    const g = wins + losses;
    const pct = g === 0 ? 0 : Math.round((100 * wins) / g);
    return `${wins}승${losses}패(${pct}%)`;
}

const CHAMPIONSHIP_VERSUS_SESSION_CACHE_VER = 'v1';

function championshipVersusOpponentsSessionKey(uid: string, venue: ChampionshipVersusVenueKind): string {
    return `cvv:opponents:${CHAMPIONSHIP_VERSUS_SESSION_CACHE_VER}:${uid}:${venue}`;
}

function championshipVersusBeatenSessionKey(uid: string, venue: ChampionshipVersusVenueKind): string {
    return `cvv:beaten:${CHAMPIONSHIP_VERSUS_SESSION_CACHE_VER}:${uid}:${venue}`;
}

function readChampionshipVersusOpponentsSession(uid: string, venue: ChampionshipVersusVenueKind): unknown[] | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(championshipVersusOpponentsSessionKey(uid, venue));
        if (!raw) return null;
        const p = JSON.parse(raw) as unknown;
        return Array.isArray(p) && p.length > 0 ? p : null;
    } catch {
        return null;
    }
}

function writeChampionshipVersusOpponentsSession(uid: string, venue: ChampionshipVersusVenueKind, rows: OpponentRow[]): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(championshipVersusOpponentsSessionKey(uid, venue), JSON.stringify(rows));
    } catch {
        /* ignore */
    }
}

function readChampionshipVersusBeatenSession(uid: string, venue: ChampionshipVersusVenueKind): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.sessionStorage.getItem(championshipVersusBeatenSessionKey(uid, venue));
        if (!raw) return [];
        const p = JSON.parse(raw) as unknown;
        return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
    } catch {
        return [];
    }
}

function writeChampionshipVersusBeatenSession(uid: string, venue: ChampionshipVersusVenueKind, beatenIds: string[]): void {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.setItem(championshipVersusBeatenSessionKey(uid, venue), JSON.stringify(beatenIds));
    } catch {
        /* ignore */
    }
}

/** 서버·세션 캐시에서 복원한 raw 행을 화면용 `OpponentRow`로 맞춘다. */
function normalizeVersusOpponentRowsFromRaw(rows: unknown[]): OpponentRow[] {
    return rows.map((raw, i) => {
        const r = raw as Partial<OpponentRow> & { userId?: string };
        const league = (r.league as LeagueTier) || LeagueTier.Rookie;
        const lv = Math.max(1, Math.floor(Number((r as { userLevel?: unknown }).userLevel) || 1));
        const core = (r as { coreStats?: unknown }).coreStats as Record<string, number> | undefined;
        if (core && typeof (r as { totalGoPower?: unknown }).totalGoPower === 'number' && typeof r.userId === 'string') {
            return { ...r, league, userLevel: lv } as OpponentRow;
        }
        if (typeof r.userId !== 'string') {
            return buildDemoOpponentRow(
                {
                    userId: `versus-cache-${i}`,
                    nickname: '?',
                    avatarId: AVATAR_POOL[0]?.id ?? '',
                    borderId: BORDER_POOL[0]?.id ?? '',
                    league,
                    userLevel: lv,
                    rating: 1200,
                    wins: 0,
                    losses: 0,
                },
                i + 1,
            );
        }
        return buildDemoOpponentRow(
            {
                userId: r.userId,
                nickname: typeof r.nickname === 'string' ? r.nickname : '?',
                avatarId: typeof r.avatarId === 'string' ? r.avatarId : AVATAR_POOL[0]?.id ?? '',
                borderId: typeof r.borderId === 'string' ? r.borderId : BORDER_POOL[0]?.id ?? '',
                league,
                userLevel: lv,
                rating: typeof r.rating === 'number' ? r.rating : 1200,
                wins: typeof r.wins === 'number' ? r.wins : 0,
                losses: typeof r.losses === 'number' ? r.losses : 0,
            },
            i + 1,
        );
    });
}

function opponentRowToTournamentPlayer(row: OpponentRow, venue: ChampionshipVersusVenueKind, seed: number): PlayerForTournament {
    const stats = (row.coreStats as Record<CoreStat, number>) ?? stubCoreStats(seed);
    const nickname =
        venue === 'pet' && row.representativePet?.displayName ? row.representativePet.displayName : row.nickname;
    return {
        id: row.userId,
        nickname,
        avatarId: row.avatarId,
        borderId: row.borderId,
        league: row.league,
        stats,
        wins: row.wins,
        losses: row.losses,
        /** 실제 값은 결투 시 서버 스냅샷으로만 확정 — 목록에서는 미표시 */
        condition: 1000,
    };
}

function userToTournamentPlayer(user: UserWithStatus, venue: ChampionshipVersusVenueKind): PlayerForTournament {
    const snap = user.championshipVersusConditionSnapshot?.[venue];
    const condition =
        snap && typeof snap.condition === 'number' && snap.condition >= 1 && snap.condition <= 100 ? snap.condition : 1000;
    const venueRating = user.championshipVersusVenueRatings?.[venue];
    const wins = Math.max(0, Math.floor(Number(venueRating?.seasonWins) || 0));
    const losses = Math.max(0, Math.floor(Number(venueRating?.seasonLosses) || 0));
    const base = {
        id: user.id,
        nickname: user.nickname,
        avatarId: user.avatarId,
        borderId: user.borderId,
        league: user.league,
        wins,
        losses,
        condition,
    };
    if (venue === 'pvp') {
        return {
            ...base,
            stats: calculateTotalStats(user, 'championshipVenue') as Record<CoreStat, number>,
        };
    }
    if (venue === 'pet') {
        const six = pairPetKataStatsSixFromEquippedUser(user);
        const row = getEquippedPairPetInventoryRow(user);
        if (!six || !row) {
            return {
                ...base,
                stats: stubCoreStats(1) as Record<CoreStat, number>,
            };
        }
        return {
            ...base,
            nickname: getPairPetDisplayName(row),
            stats: pairPetCoreStatsSixToCoreRecord(six) as Record<CoreStat, number>,
        };
    }
    const six = pairPetKataStatsSixFromEquippedUser(user);
    const userCore = calculateTotalStats(user, 'championshipVenue') as Record<string, number>;
    if (!six) {
        return {
            ...base,
            stats: userCore as Record<CoreStat, number>,
        };
    }
    return {
        ...base,
        stats: mergeChampionshipVersusPairUserPetCoreStats(userCore, pairPetCoreStatsSixToCoreRecord(six)) as Record<
            CoreStat,
            number
        >,
    };
}

const VersusRailPetMini: React.FC<{
    tone: 'black' | 'white';
    imageUrl: string | null;
    name: string;
    level: number;
    compact?: boolean;
    isTurnToMove?: boolean;
}> = ({ tone, imageUrl, name, level, compact = false, isTurnToMove = false }) => {
    const toneBorder = isTurnToMove
        ? 'border-2 border-amber-400/90 shadow-[0_0_18px_-5px_rgba(245,158,11,0.45)] ring-1 ring-inset ring-amber-200/20'
        : tone === 'black'
          ? 'border-zinc-600 bg-gradient-to-b from-zinc-800 to-zinc-950'
          : 'border-slate-500 bg-gradient-to-b from-slate-600 via-slate-700 to-slate-900';
    const box = compact ? 'w-[3.35rem] px-1 py-1' : 'w-[4.75rem] px-1.5 py-1.5';
    const imgBox = compact ? 'h-9 w-9' : 'h-11 w-11';
    return (
        <div
            className={`flex shrink-0 flex-col items-center justify-center rounded-lg border text-center shadow-inner ${toneBorder} ${box}`}
        >
            <div className={`font-black uppercase tracking-wide text-amber-100/80 ${compact ? 'text-[7px]' : 'text-[9px]'}`}>대표펫</div>
            <div className={`mt-0.5 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-black/50 ${imgBox}`}>
                {imageUrl ? (
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-slate-600">?</div>
                )}
            </div>
            <div
                className={`mt-0.5 max-w-full truncate font-bold leading-tight text-slate-100 ${compact ? 'text-[8px]' : 'text-[10px]'}`}
                title={name}
            >
                {name}
            </div>
            <div className={`font-black tabular-nums text-emerald-200/90 ${compact ? 'text-[8px]' : 'text-[9px]'}`}>Lv.{level}</div>
        </div>
    );
};

const VersusRailPlayerCard: React.FC<{
    player: PlayerForTournament | null;
    tone: 'black' | 'white';
    currentUserId: string;
    onViewUser: (id: string) => void;
    canUseConditionPotion?: boolean;
    onOpenConditionPotion?: () => void;
    /** 착수 턴일 때 패널 강조(앰버 테두리) */
    isTurnToMove?: boolean;
    /** 펫 챔피언십: 대국자 영역은 펫 초상 */
    portraitSrcOverride?: string | null;
    /** 표시 이름(유저 닉네임 등) — 없으면 player.nickname */
    primaryLineOverride?: string | null;
}> = ({
    player,
    tone,
    currentUserId,
    onViewUser,
    canUseConditionPotion = false,
    onOpenConditionPotion,
    isTurnToMove = false,
    portraitSrcOverride = null,
    primaryLineOverride = null,
}) => {
    const avatarUrl = player ? AVATAR_POOL.find((a) => a.id === player.avatarId)?.url : undefined;
    const borderUrl = player ? BORDER_POOL.find((b) => b.id === player.borderId)?.url : undefined;
    const isCurrentUser = player?.id === currentUserId;
    const demoId = Boolean(player?.id?.startsWith('versus-demo-'));
    const clickable = Boolean(player?.id && !player.id.startsWith('bot-') && !isCurrentUser && !demoId);
    const isRightSide = tone === 'white';
    const toneSurface =
        tone === 'black'
            ? 'bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 text-stone-100 shadow-lg'
            : 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900 text-slate-50 shadow-lg';
    const toneBorder = isTurnToMove
        ? 'border-2 border-amber-400/90 shadow-[0_0_24px_-6px_rgba(245,158,11,0.5)] ring-1 ring-inset ring-amber-200/25'
        : tone === 'black'
          ? 'border-2 border-zinc-600'
          : 'border-2 border-slate-500';
    const mutedText = tone === 'black' ? 'text-slate-400' : 'text-slate-300';
    const strongText = tone === 'black' ? 'text-stone-50' : 'text-slate-50';
    const rawCondition = player?.condition;
    const displayCondition: number | null =
        rawCondition !== undefined && rawCondition !== null && rawCondition !== 1000 ? rawCondition : null;
    const conditionTone =
        typeof displayCondition === 'number' && displayCondition < 40
            ? tone === 'black'
                ? 'text-red-300'
                : 'text-red-200'
            : typeof displayCondition === 'number' && displayCondition >= 80
              ? tone === 'black'
                  ? 'text-emerald-300'
                  : 'text-emerald-200'
              : strongText;
    const scoreBox = (
        <div
            className={`flex w-[4.8rem] shrink-0 flex-col items-center justify-center rounded-lg border-2 px-2 py-1.5 text-center shadow-lg ${
                tone === 'black'
                    ? 'border-zinc-600 bg-gradient-to-br from-zinc-800 to-zinc-950 text-white'
                    : 'border-slate-500 bg-gradient-to-br from-slate-600 to-slate-900 text-slate-50'
            }`}
        >
            <span className={`text-[10px] font-bold leading-none ${tone === 'black' ? 'text-zinc-400' : 'text-slate-300'}`}>점수</span>
            <span className="mt-1 text-xl font-black leading-none tabular-nums">-</span>
        </div>
    );
    const recordWins = player?.wins ?? 0;
    const recordLosses = player?.losses ?? 0;

    return (
        <div
            className={`relative flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 transition-all duration-300 ${isRightSide ? 'flex-row-reverse text-right' : ''} ${toneBorder} ${toneSurface}`}
        >
            <button
                type="button"
                className={`shrink-0 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={clickable && player ? () => onViewUser(player.id) : undefined}
                title={
                    clickable && player
                        ? portraitSrcOverride
                            ? '유저 프로필 보기'
                            : `${primaryLineOverride ?? player.nickname} 프로필 보기`
                        : undefined
                }
            >
                {player ? (
                    portraitSrcOverride ? (
                        <img
                            src={portraitSrcOverride}
                            alt=""
                            className="h-16 w-16 shrink-0 rounded-full border-2 border-white/20 object-cover shadow-md"
                            loading="lazy"
                        />
                    ) : (
                        <Avatar userId={player.id} userName={player.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={64} />
                    )
                ) : (
                    <div className="h-16 w-16 rounded-full bg-slate-800" />
                )}
            </button>
            <div className="min-w-0 flex-1">
                <div className={`flex items-center gap-2 ${isRightSide ? 'justify-end' : ''}`}>
                    <span className={`truncate text-sm font-bold ${strongText}`}>
                        {primaryLineOverride ?? player?.nickname ?? '선수 대기'}
                    </span>
                    {isCurrentUser ? (
                        <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                                tone === 'black' ? 'bg-amber-500/25 text-amber-100' : 'bg-amber-400/30 text-amber-50'
                            }`}
                        >
                            나
                        </span>
                    ) : null}
                    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-semibold ${mutedText}`}>
                        컨디션{' '}
                        <b className={`text-base tabular-nums ${conditionTone}`}>{displayCondition == null ? '-' : displayCondition}</b>
                        {isCurrentUser && canUseConditionPotion && onOpenConditionPotion ? (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (typeof displayCondition === 'number' && displayCondition >= 100) return;
                                    onOpenConditionPotion();
                                }}
                                disabled={typeof displayCondition === 'number' && displayCondition >= 100}
                                className={`ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white transition-colors ${
                                    typeof displayCondition === 'number' && displayCondition >= 100
                                        ? 'cursor-not-allowed bg-gray-600 opacity-50'
                                        : 'bg-green-600 hover:bg-green-700'
                                }`}
                                title={
                                    typeof displayCondition === 'number' && displayCondition >= 100
                                        ? '컨디션이 이미 최대입니다'
                                        : '컨디션 회복제 사용'
                                }
                            >
                                +
                            </button>
                        ) : null}
                    </span>
                </div>
                <div className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] ${isRightSide ? 'justify-end' : ''} ${mutedText}`}>
                    <span>
                        전적{' '}
                        <b className={`tabular-nums ${strongText}`}>
                            {recordWins}승 {recordLosses}패
                        </b>
                    </span>
                </div>
            </div>
            {scoreBox}
        </div>
    );
};

const VersusMobilePureInfoCard: React.FC<{
    player: PlayerForTournament | null;
    side: 'left' | 'right';
    currentUserId: string;
    onViewUser: (id: string) => void;
    canUseConditionPotion?: boolean;
    onOpenConditionPotion?: () => void;
    /** 착수 턴일 때 패널 강조(앰버 테두리) */
    isTurnToMove?: boolean;
    portraitSrcOverride?: string | null;
    primaryLineOverride?: string | null;
    petMini?: React.ReactNode;
}> = ({
    player,
    side,
    currentUserId,
    onViewUser,
    canUseConditionPotion = false,
    onOpenConditionPotion,
    isTurnToMove = false,
    portraitSrcOverride = null,
    primaryLineOverride = null,
    petMini = null,
}) => {
    const isCurrentUser = player?.id === currentUserId;
    const demoId = Boolean(player?.id?.startsWith('versus-demo-'));
    const clickable = Boolean(player?.id && !player.id.startsWith('bot-') && !isCurrentUser && !demoId);
    const avatarUrl = player ? AVATAR_POOL.find((a) => a.id === player.avatarId)?.url : undefined;
    const borderUrl = player ? BORDER_POOL.find((b) => b.id === player.borderId)?.url : undefined;
    const rawCondition = player?.condition;
    const effectiveCondition: number | null =
        rawCondition !== undefined && rawCondition !== null && rawCondition !== 1000 ? rawCondition : null;
    const conditionTone =
        typeof effectiveCondition === 'number' && effectiveCondition < 40
            ? side === 'left'
                ? 'text-red-300'
                : 'text-red-200'
            : typeof effectiveCondition === 'number' && effectiveCondition >= 80
              ? side === 'left'
                  ? 'text-emerald-300'
                  : 'text-emerald-200'
              : side === 'left'
                ? 'text-stone-100'
                : 'text-slate-50';
    const recordWins = player?.wins ?? 0;
    const recordLosses = player?.losses ?? 0;
    const toneSurface =
        side === 'left'
            ? 'bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950 text-stone-100'
            : 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900 text-slate-50';
    const toneBorder = isTurnToMove
        ? 'border-2 border-amber-400/90 shadow-[0_0_18px_-5px_rgba(245,158,11,0.45)] ring-1 ring-inset ring-amber-200/20'
        : side === 'left'
          ? 'border border-zinc-600'
          : 'border border-slate-500';
    const mutedText = side === 'left' ? 'text-slate-400' : 'text-slate-300';
    const strongText = side === 'left' ? 'text-stone-50' : 'text-slate-50';
    const isRightSide = side === 'right';
    const condDisplay = effectiveCondition == null ? '-' : effectiveCondition;

    return (
        <div
            className={`relative flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 shadow-sm ${toneBorder} ${toneSurface} ${
                isRightSide ? 'flex-row-reverse text-right' : ''
            }`}
        >
            <button
                type="button"
                className={`shrink-0 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={clickable && player ? () => onViewUser(player.id) : undefined}
                title={
                    clickable && player
                        ? portraitSrcOverride
                            ? '유저 프로필 보기'
                            : `${primaryLineOverride ?? player.nickname} 프로필 보기`
                        : undefined
                }
            >
                {player ? (
                    portraitSrcOverride ? (
                        <img
                            src={portraitSrcOverride}
                            alt=""
                            className="h-11 w-11 shrink-0 rounded-full border-2 border-white/18 object-cover shadow"
                            loading="lazy"
                        />
                    ) : (
                        <Avatar userId={player.id} userName={player.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={44} />
                    )
                ) : (
                    <div className="h-11 w-11 shrink-0 rounded-full bg-slate-800" />
                )}
            </button>
            <div className="min-w-0 flex-1">
                <div className={`flex items-center gap-1 ${isRightSide ? 'justify-end' : ''}`}>
                    <span className={`truncate text-[11px] font-bold ${strongText}`}>
                        {primaryLineOverride ?? player?.nickname ?? '선수'}
                    </span>
                    {isCurrentUser ? (
                        <span
                            className={`rounded px-1 py-0.5 text-[8px] font-black ${
                                side === 'left' ? 'bg-amber-500/25 text-amber-100' : 'bg-amber-400/30 text-amber-50'
                            }`}
                        >
                            나
                        </span>
                    ) : null}
                </div>
                <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] ${isRightSide ? 'justify-end' : ''} ${mutedText}`}>
                    <span>
                        전적 <b className={`tabular-nums ${strongText}`}>{recordWins}승</b>{' '}
                        <b className={`tabular-nums ${side === 'left' ? 'text-orange-200' : 'text-orange-100'}`}>{recordLosses}패</b>
                    </span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        컨디션 <b className={`text-[12px] tabular-nums ${conditionTone}`}>{condDisplay}</b>
                        {isCurrentUser && canUseConditionPotion && onOpenConditionPotion ? (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (typeof effectiveCondition === 'number' && effectiveCondition >= 100) return;
                                    onOpenConditionPotion();
                                }}
                                disabled={typeof effectiveCondition === 'number' && effectiveCondition >= 100}
                                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-emerald-300/55 bg-emerald-600/85 text-[10px] font-black leading-none text-white shadow"
                                title={
                                    typeof effectiveCondition === 'number' && effectiveCondition >= 100
                                        ? '컨디션이 이미 최대입니다'
                                        : '컨디션 회복'
                                }
                            >
                                +
                            </button>
                        ) : null}
                    </span>
                </div>
            </div>
            {petMini}
        </div>
    );
};

function buildVersusShellMatch(p1: PlayerForTournament, p2: PlayerForTournament | null): Match | null {
    if (!p2) return null;
    return {
        id: 'versus-shell-match',
        players: [p1, p2],
        winner: null,
        isFinished: false,
        commentary: [],
        isUserMatch: true,
        finalScore: null,
    };
}

const MOBILE_PHASE_META = [
    { key: 'opening' as const, label: '초반', ply19: 1, ply13: 1, ply9: 1 },
    { key: 'midgame' as const, label: '중반', ply19: 61, ply13: 31, ply9: 15 },
    { key: 'endgame' as const, label: '종반', ply19: 121, ply13: 61, ply9: 29 },
];

const ChampionshipVersusVenueArena: React.FC<{ venue: ChampionshipVersusVenueKind }> = ({ venue }) => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const currentUserRef = React.useRef<UserWithStatus | null>(null);
    currentUserRef.current = currentUserWithStatus ?? null;
    const { isNativeMobile } = useNativeMobileShell();
    const isHandheldViewport = useIsHandheldDevice(1025);
    const isMobile = isNativeMobile || isHandheldViewport;

    const [opponents, setOpponents] = React.useState<OpponentRow[]>([]);
    const [myRating, setMyRating] = React.useState(RANKED_ELO_BASE_SCORE);
    const [ratingSeasonKey, setRatingSeasonKey] = React.useState('');
    const [loading, setLoading] = React.useState(CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST);
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = React.useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(true);
    const [duelModalOpen, setDuelModalOpen] = React.useState(false);
    const [lowConditionVersusStartModalOpen, setLowConditionVersusStartModalOpen] = React.useState(false);
    const [lowConditionStartPending, setLowConditionStartPending] = React.useState<null | 'demo' | 'live'>(null);
    const [kataBusy, setKataBusy] = React.useState(false);
    const [completedVersusMatch, setCompletedVersusMatch] = React.useState<Match | null>(null);
    const [versusSummarySession, setVersusSummarySession] = React.useState<LiveGameSession | null>(null);
    const [duelSubmitting, setDuelSubmitting] = React.useState(false);
    const [oppRefreshFreeRemaining, setOppRefreshFreeRemaining] = React.useState(CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY);
    const [versusPlaybackMatch, setVersusPlaybackMatch] = React.useState<Match | null>(null);
    /** 재생·계가·종료 판에서 `GoBoard` 영토/사석 오버레이용(서버 수동 계가 `analysis`) */
    const [versusTerritoryAnalysis, setVersusTerritoryAnalysis] = React.useState<AnalysisResult | null>(null);
    const [versusReplayActive, setVersusReplayActive] = React.useState(false);
    const [versusPlaybackSpeed, setVersusPlaybackSpeed] = React.useState<ChampionshipPlaybackSpeed>(() => readVersusPlaybackSpeedFromStorage());
    const [showConditionPotionModal, setShowConditionPotionModal] = React.useState(false);
    /** 브라우저 탭 세션 한정: 승리한 상대는 재도전 불가(페이지 새로고침 시 초기화). */
    const [beatenOpponentIds, setBeatenOpponentIds] = React.useState<string[]>([]);
    /** 전원 격파 직후 `location.reload`가 React Strict Mode 등으로 이중 호출되는 것을 막는다. */
    const versusAllOpponentsBeatenReloadRef = React.useRef(false);
    const [versusDuelHistoryOpen, setVersusDuelHistoryOpen] = React.useState(false);

    const versusPlaybackSpeedRef = React.useRef<ChampionshipPlaybackSpeed>(versusPlaybackSpeed);
    versusPlaybackSpeedRef.current = versusPlaybackSpeed;

    const versusKataPlaybackTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const versusKataPlyRef = React.useRef(0);
    const versusKataFinalMatchRef = React.useRef<Match | null>(null);
    const versusKataPendingResultRef = React.useRef<{
        analysis: AnalysisResult;
        actorVenueRatingBefore: number;
        actorVenueRatingAfter: number;
        actorVenueRatingDelta: number;
        champCoinsDelta: number;
        rewards: VersusKataActorRewardClientPayload;
    } | null>(null);
    /** 승리 시 `setBeatenOpponentIds`를 재생 중에 호출하면 `selectedRow`가 바뀌며 재생이 끊긴다 — 모달 확인·상대 변경 시에만 flush. */
    const versusKataSessionBeatOpponentIdRef = React.useRef<string | null>(null);
    type VersusKataDuelResultPayload = {
        analysis: AnalysisResult;
        actorVenueRatingBefore: number;
        actorVenueRatingAfter: number;
        actorVenueRatingDelta: number;
        champCoinsDelta: number;
        rewards: VersusKataActorRewardClientPayload;
    };

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem('championshipPlaybackSpeed', String(versusPlaybackSpeed));
        } catch {
            /* ignore */
        }
    }, [versusPlaybackSpeed]);

    const clearVersusKataPlaybackTimers = React.useCallback(() => {
        if (versusKataPlaybackTimerRef.current != null) {
            clearTimeout(versusKataPlaybackTimerRef.current);
            versusKataPlaybackTimerRef.current = null;
        }
    }, []);

    React.useEffect(() => {
        return () => {
            clearVersusKataPlaybackTimers();
        };
    }, [clearVersusKataPlaybackTimers]);

    const flushVersusSessionBeatMarkRef = React.useCallback(() => {
        const bid = versusKataSessionBeatOpponentIdRef.current;
        if (!bid) return;
        versusKataSessionBeatOpponentIdRef.current = null;
        const cu = currentUserRef.current;
        if (!cu) return;
        setBeatenOpponentIds((prev) => {
            if (prev.includes(bid)) return prev;
            const next = [...prev, bid];
            writeChampionshipVersusBeatenSession(cu.id, venue, next);
            return next;
        });
    }, [venue]);

    const finalizeVersusKataReplay = React.useCallback(
        (fallbackMatch?: Match) => {
            const done = versusKataFinalMatchRef.current ?? fallbackMatch;
            const payload = versusKataPendingResultRef.current;
            const cu = currentUserRef.current;
            clearVersusKataPlaybackTimers();
            versusKataFinalMatchRef.current = null;
            versusKataPendingResultRef.current = null;
            setVersusPlaybackMatch(null);
            setVersusReplayActive(false);
            if (!done?.championshipRealGame) return;
            setCompletedVersusMatch(done);
            if (!cu) return;
            const analysis = payload?.analysis ?? versusTerritoryAnalysis;
            if (!analysis) return;
            const rewards: VersusKataActorRewardClientPayload =
                payload?.rewards ??
                ({
                    goldDelta: 0,
                    userXpDelta: 0,
                    goldBefore: Number(cu.gold) || 0,
                    userXpBefore: Number(cu.userXp) || 0,
                    userLevelBefore: Number(cu.userLevel) || 1,
                    userLevelAfter: Number(cu.userLevel) || 1,
                    userXpAfter: Number(cu.userXp) || 0,
                    overallRecord: { wins: 0, losses: 0 },
                    vipPlayRewardSlot: { locked: true },
                } as VersusKataActorRewardClientPayload);
            try {
                setVersusSummarySession(
                    buildChampionshipVersusKataSummarySession({
                        match: done,
                        analysis,
                        currentUser: cu,
                        venue,
                        actorVenueRatingBefore: payload?.actorVenueRatingBefore ?? 0,
                        actorVenueRatingAfter: payload?.actorVenueRatingAfter ?? 0,
                        actorVenueRatingDelta: payload?.actorVenueRatingDelta ?? 0,
                        champCoinsDelta: payload?.champCoinsDelta ?? 0,
                        rewards,
                    }),
                );
            } catch (err) {
                console.warn('[ChampionshipVersusVenueArena] summary session build failed', err);
            }
        },
        [clearVersusKataPlaybackTimers, venue, versusTerritoryAnalysis],
    );

    const beginVersusKataReplay = React.useCallback(
        (
            finalMatch: Match,
            resultPayload: {
                analysis: AnalysisResult;
                actorVenueRatingBefore: number;
                actorVenueRatingAfter: number;
                actorVenueRatingDelta: number;
                champCoinsDelta: number;
                rewards: VersusKataActorRewardClientPayload;
            },
        ) => {
            const src = finalMatch.championshipRealGame;
            if (!src) return false;
            const moves = Array.isArray(src.moves) ? src.moves : [];
            if (moves.length === 0) {
                setVersusTerritoryAnalysis(resultPayload.analysis);
                versusKataFinalMatchRef.current = finalMatch;
                versusKataPendingResultRef.current = resultPayload;
                finalizeVersusKataReplay(finalMatch);
                return true;
            }
            clearVersusKataPlaybackTimers();
            setVersusTerritoryAnalysis(resultPayload.analysis);
            versusKataFinalMatchRef.current = finalMatch;
            versusKataPlyRef.current = 0;
            versusKataPendingResultRef.current = resultPayload;
            setVersusReplayActive(true);

            const initial: Match = {
                ...finalMatch,
                isFinished: false,
                championshipRealGame: {
                    ...src,
                    boardState: championshipReplayBoardAfterMoves(src.boardSize, moves, 0),
                    currentPly: 0,
                    lastMove: null,
                    moves: [...moves],
                    status: 'playing',
                    timeMetrics: {
                        generatedAt: src.timeMetrics?.generatedAt ?? Date.now(),
                        generationMs: src.timeMetrics?.generationMs ?? 0,
                        playbackStartedAt: src.timeMetrics?.playbackStartedAt,
                        playbackCompletedAt: src.timeMetrics?.playbackCompletedAt,
                        scoringStartedAt: src.timeMetrics?.scoringStartedAt,
                        scoringCompletedAt: src.timeMetrics?.scoringCompletedAt,
                    },
                },
            };
            setVersusPlaybackMatch(initial);

            const tick = () => {
                versusKataPlyRef.current += 1;
                const capped = Math.min(versusKataPlyRef.current, moves.length);
                const atScoring = capped >= moves.length;

                setVersusPlaybackMatch({
                    ...finalMatch,
                    isFinished: false,
                    championshipRealGame: {
                        ...src,
                        boardState: atScoring
                            ? src.boardState
                            : championshipReplayBoardAfterMoves(src.boardSize, moves, capped),
                        currentPly: atScoring ? moves.length : capped,
                        lastMove:
                            capped <= 0 ? null : { x: moves[capped - 1]!.x, y: moves[capped - 1]!.y },
                        moves,
                        status: atScoring ? 'scoring' : 'playing',
                        timeMetrics: {
                            generatedAt: src.timeMetrics?.generatedAt ?? Date.now(),
                            generationMs: src.timeMetrics?.generationMs ?? 0,
                            playbackStartedAt: src.timeMetrics?.playbackStartedAt,
                            playbackCompletedAt: src.timeMetrics?.playbackCompletedAt,
                            scoringStartedAt: src.timeMetrics?.scoringStartedAt,
                            scoringCompletedAt: src.timeMetrics?.scoringCompletedAt,
                        },
                    },
                });

                if (atScoring) {
                    versusKataPlaybackTimerRef.current = setTimeout(() => {
                        versusKataPlaybackTimerRef.current = null;
                        finalizeVersusKataReplay(finalMatch);
                    }, CHAMPIONSHIP_REAL_MATCH_SCORING_DELAY_MS);
                    return;
                }

                versusKataPlaybackTimerRef.current = setTimeout(
                    tick,
                    championshipPlaybackMoveIntervalMs(versusPlaybackSpeedRef.current),
                );
            };

            versusKataPlaybackTimerRef.current = setTimeout(
                tick,
                championshipPlaybackMoveIntervalMs(versusPlaybackSpeedRef.current),
            );
            return true;
        },
        [clearVersusKataPlaybackTimers, finalizeVersusKataReplay],
    );

    React.useEffect(() => {
        const status = versusPlaybackMatch?.championshipRealGame?.status;
        if (!versusReplayActive || status !== 'scoring') return;
        const watchdog = window.setTimeout(() => {
            if (versusPlaybackMatch?.championshipRealGame?.status === 'scoring') {
                finalizeVersusKataReplay(versusPlaybackMatch);
            }
        }, CHAMPIONSHIP_REAL_MATCH_SCORING_DELAY_MS + 1400);
        return () => window.clearTimeout(watchdog);
    }, [versusReplayActive, versusPlaybackMatch, finalizeVersusKataReplay]);

    /** `useApp`이 매 렌더 새 `handlers` 객체를 만들므로, 의존성에 넣으면 GET이 무한 반복된다. */
    const handleActionRef = React.useRef(handlers.handleAction);
    handleActionRef.current = handlers.handleAction;

    /** 동일 유저·경기장에서 이미 목록을 확보했으면 GET 재호출 생략; 탭 단위 목록은 `sessionStorage`로 재입장 시에도 유지. */
    const stableVersusListKeyRef = React.useRef<string | null>(null);

    const refreshOpponents = React.useCallback(async (opts?: { force?: boolean }) => {
        if (!CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST) {
            setOpponents(makeDemoOpponentRows(venue));
            setMyRating(RANKED_ELO_BASE_SCORE);
            setRatingSeasonKey(getCurrentSeason().name);
            setLoadError(null);
            setLoading(false);
            stableVersusListKeyRef.current = 'demo';
            setOppRefreshFreeRemaining(CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY);
            setBeatenOpponentIds([]);
            return;
        }
        const uid = currentUserWithStatus?.id;
        if (!uid) return;

        const sessionKey = `${venue}:${uid}`;

        if (!opts?.force) {
            const cachedRaw = readChampionshipVersusOpponentsSession(uid, venue);
            if (cachedRaw) {
                const mapped = normalizeVersusOpponentRowsFromRaw(cachedRaw);
                const beatenStored = readChampionshipVersusBeatenSession(uid, venue);
                const beatenFiltered = beatenStored.filter((id) => mapped.some((o) => o.userId === id));
                setOpponents(mapped);
                setBeatenOpponentIds(beatenFiltered);
                if (beatenFiltered.length !== beatenStored.length) {
                    writeChampionshipVersusBeatenSession(uid, venue, beatenFiltered);
                }
                setLoadError(null);
                setLoading(false);
                stableVersusListKeyRef.current = sessionKey;
                void (async () => {
                    try {
                        const res = (await handleActionRef.current({
                            type: 'GET_CHAMPIONSHIP_VERSUS_VENUE_STATE',
                            payload: { venue },
                        })) as {
                            championshipVersusRefreshFreeRemaining?: number;
                            error?: string;
                        };
                        if (res?.error) return;
                        if (typeof res?.championshipVersusRefreshFreeRemaining === 'number') {
                            setOppRefreshFreeRemaining(res.championshipVersusRefreshFreeRemaining);
                        }
                    } catch {
                        /* ignore */
                    }
                })();
                return;
            }
        }

        if (opts?.force) {
            stableVersusListKeyRef.current = null;
        } else if (stableVersusListKeyRef.current === sessionKey) {
            return;
        }

        setLoading(true);
        setLoadError(null);
        try {
            const res = (await handleActionRef.current({
                type: opts?.force ? 'REFRESH_CHAMPIONSHIP_VERSUS_OPPONENT_LIST' : 'GET_CHAMPIONSHIP_VERSUS_VENUE_STATE',
                payload: { venue },
            })) as {
                championshipVersusOpponents?: OpponentRow[];
                championshipVersusMyRating?: number;
                championshipVersusRatingSeasonKey?: string;
                championshipVersusRatingMonthKST?: string;
                championshipVersusRefreshFreeRemaining?: number;
                error?: string;
            };
            if (res?.error) {
                setLoadError(res.error);
                return;
            }
            const rows = Array.isArray(res?.championshipVersusOpponents) ? res.championshipVersusOpponents : [];
            const mapped = normalizeVersusOpponentRowsFromRaw(rows as unknown[]);
            setOpponents(mapped);
            writeChampionshipVersusOpponentsSession(uid, venue, mapped);
            if (opts?.force) {
                setBeatenOpponentIds([]);
                writeChampionshipVersusBeatenSession(uid, venue, []);
            } else {
                const beatenStored = readChampionshipVersusBeatenSession(uid, venue);
                const beatenFiltered = beatenStored.filter((id) => mapped.some((o) => o.userId === id));
                setBeatenOpponentIds(beatenFiltered);
                if (beatenFiltered.length !== beatenStored.length) {
                    writeChampionshipVersusBeatenSession(uid, venue, beatenFiltered);
                }
            }
            if (typeof res?.championshipVersusMyRating === 'number') setMyRating(res.championshipVersusMyRating);
            if (typeof res?.championshipVersusRefreshFreeRemaining === 'number') {
                setOppRefreshFreeRemaining(res.championshipVersusRefreshFreeRemaining);
            }
            const sk = res?.championshipVersusRatingSeasonKey ?? res?.championshipVersusRatingMonthKST;
            if (typeof sk === 'string') setRatingSeasonKey(sk);
            stableVersusListKeyRef.current = sessionKey;
        } catch (e: any) {
            setLoadError(e?.message || '불러오기에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    }, [venue, currentUserWithStatus?.id]);

    React.useEffect(() => {
        void refreshOpponents();
    }, [refreshOpponents]);

    /** 목록은 고정하되, 대국 후 `updatedUser` 머지로 바뀌는 내 레이팅·시즌키만 동기화 */
    React.useEffect(() => {
        if (!CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST) return;
        const u = currentUserWithStatus;
        if (!u) return;
        const e = u.championshipVersusVenueRatings?.[venue];
        if (e && typeof e.rating === 'number') setMyRating(e.rating);
        if (typeof e?.ratingSeasonKey === 'string') setRatingSeasonKey(e.ratingSeasonKey);
    }, [currentUserWithStatus?.championshipVersusVenueRatings, currentUserWithStatus?.id, venue]);

    React.useEffect(() => {
        if (opponents.length === 0) return;
        setSelectedId((cur) => {
            const inList = (id: string | null) => Boolean(id && opponents.some((o) => o.userId === id));
            /** 승리 확정 후에도 직전 상대에 머문다 — 확인 직후 자동으로 다른 줄을 고르면 `selectedRow`가 바뀌며 종료 판이 지워진다. 다음 상대는 사용자가 직접 고른 뒤 「경기 시작」으로 넘긴다. */
            if (cur && inList(cur)) return cur;
            const firstOpen = opponents.find((o) => !beatenOpponentIds.includes(o.userId));
            return (firstOpen ?? opponents[0])!.userId;
        });
    }, [opponents, beatenOpponentIds]);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST) return;
        const uid = currentUserWithStatus?.id;
        if (!uid) return;
        const n = CHAMPIONSHIP_VERSUS_OPPONENT_LIST_SIZE;
        if (opponents.length !== n || beatenOpponentIds.length !== n) return;
        if (!opponents.every((o) => beatenOpponentIds.includes(o.userId))) return;
        if (versusAllOpponentsBeatenReloadRef.current) return;
        versusAllOpponentsBeatenReloadRef.current = true;
        try {
            window.sessionStorage.removeItem(championshipVersusOpponentsSessionKey(uid, venue));
            window.sessionStorage.removeItem(championshipVersusBeatenSessionKey(uid, venue));
        } catch {
            /* ignore */
        }
        window.location.reload();
    }, [beatenOpponentIds, currentUserWithStatus?.id, opponents, venue]);

    const onViewUser = React.useCallback(
        (id: string) => {
            if (id.startsWith('versus-demo-')) return;
            handlers.openViewingUser(id);
        },
        [handlers],
    );

    const myVersusConditionForPotion = React.useMemo(() => {
        const u = currentUserWithStatus;
        if (!u) return 1000;
        const s = u.championshipVersusConditionSnapshot?.[venue];
        if (s && typeof s.condition === 'number' && s.condition >= 1 && s.condition <= 100) return s.condition;
        return 1000;
    }, [currentUserWithStatus, venue]);

    const canUseVersusConditionPotion = React.useMemo(
        () => Boolean(currentUserWithStatus && !kataBusy && !duelSubmitting && !versusReplayActive),
        [currentUserWithStatus, kataBusy, duelSubmitting, versusReplayActive],
    );

    if (!currentUserWithStatus) {
        return (
            <div className="p-4 text-center text-white">
                <p>사용자 정보를 불러오는 중입니다...</p>
                <Button onClick={() => replaceAppHash('#/tournament')} className="mt-4">
                    로비로
                </Button>
            </div>
        );
    }

    const user = currentUserWithStatus;
    const myAvatarUrl = AVATAR_POOL.find((a) => a.id === user.avatarId)?.url;
    const myBorderUrl = BORDER_POOL.find((b) => b.id === user.borderId)?.url;
    const selectedRow = React.useMemo(() => {
        if (opponents.length === 0) return null;
        const sid = selectedId ?? opponents[0].userId;
        return opponents.find((o) => o.userId === sid) ?? opponents[0];
    }, [opponents, selectedId]);

    /** 상대만 바꿀 때는 직전 대국 판면을 유지한다. 초기화는 `runVersusKataDuel` 시작 또는 경기장(`venue`) 변경 시에만 수행한다. */
    React.useEffect(() => {
        flushVersusSessionBeatMarkRef();
    }, [selectedRow?.userId, flushVersusSessionBeatMarkRef]);

    React.useEffect(() => {
        flushVersusSessionBeatMarkRef();
        setCompletedVersusMatch(null);
        setVersusSummarySession(null);
        setVersusTerritoryAnalysis(null);
        clearVersusKataPlaybackTimers();
        setVersusPlaybackMatch(null);
        versusKataFinalMatchRef.current = null;
        versusKataPendingResultRef.current = null;
        setVersusReplayActive(false);
        setLowConditionVersusStartModalOpen(false);
        setLowConditionStartPending(null);
    }, [venue, clearVersusKataPlaybackTimers, flushVersusSessionBeatMarkRef]);

    const p1 = React.useMemo(() => userToTournamentPlayer(user, venue), [user, venue]);
    const p2Seed = selectedRow ? opponents.indexOf(selectedRow) + 1 : 1;
    const p2 = React.useMemo(() => {
        if (!selectedRow) return opponentRowToTournamentPlayer(makeDemoOpponentRows(venue)[0]!, venue, 1);
        return opponentRowToTournamentPlayer(selectedRow, venue, p2Seed);
    }, [selectedRow, p2Seed, opponents, venue]);

    const p1Stats = p1.stats as Record<string, number>;
    const p2Stats = p2.stats as Record<string, number>;

    const p1PairSplit = React.useMemo(() => {
        if (venue !== 'petpair') return null;
        const six = pairPetKataStatsSixFromEquippedUser(user);
        if (!six) return null;
        return {
            userStats: calculateTotalStats(user, 'championshipVenue') as Record<string, number>,
            petStats: pairPetCoreStatsSixToCoreRecord(six),
        };
    }, [user, venue]);

    const p2PairSplit = React.useMemo(() => {
        if (venue !== 'petpair' || !selectedRow?.userPairAnchor || !selectedRow.representativePet) return null;
        return {
            userStats: selectedRow.userPairAnchor.coreStats,
            petStats: selectedRow.representativePet.coreStats,
        };
    }, [venue, selectedRow]);

    const p1EquippedPetVisual = React.useMemo(() => {
        if (venue !== 'pet' && venue !== 'petpair') return null;
        const row = getEquippedPairPetInventoryRow(user);
        if (!row) return null;
        const meta = resolvePairPetMetaFromInventoryRow(row);
        return {
            url: resolveVersusPetPortraitPublicUrl(row.image as string | null, row.templateId),
            name: getPairPetDisplayName(row),
            level: meta.level,
        };
    }, [user, venue]);

    const p2EquippedPetVisual = React.useMemo(() => {
        if (venue !== 'pet' && venue !== 'petpair') return null;
        const rep = selectedRow?.representativePet;
        if (!rep) return null;
        const lvl =
            typeof rep.level === 'number' && Number.isFinite(rep.level) && rep.level >= 1 ? Math.floor(rep.level) : 1;
        return {
            url: resolveVersusPetPortraitPublicUrl(rep.image, null),
            name: rep.displayName,
            level: lvl,
        };
    }, [selectedRow, venue]);

    const matchForDisplay = React.useMemo(() => buildVersusShellMatch(p1, p2), [p1, p2]);
    const matchForBoard = React.useMemo(() => {
        const base = versusPlaybackMatch ?? completedVersusMatch ?? matchForDisplay;
        if (!versusSummarySession || !base?.championshipRealGame) return base;
        const rg = base.championshipRealGame;
        /** 결과 모달이 열린 뒤에도 바둑판에 영토·사석이 남도록 종료 판면을 유지한다(계가 연출 재표시 방지). */
        return {
            ...base,
            isFinished: true,
            championshipRealGame: {
                ...rg,
                status: 'finished' as const,
            },
        };
    }, [versusPlaybackMatch, completedVersusMatch, matchForDisplay, versusSummarySession]);

    type VersusSideSeat = {
        player: PlayerForTournament;
        stats: Record<string, number>;
        pairSplit: typeof p1PairSplit;
        petVisual: typeof p1EquippedPetVisual;
    };
    const versusSeatBlack = React.useMemo((): VersusSideSeat => {
        const rg = matchForBoard?.championshipRealGame;
        if (!rg) {
            return { player: p1, stats: p1Stats, pairSplit: p1PairSplit, petVisual: p1EquippedPetVisual };
        }
        return rg.blackPlayerId === p1.id
            ? { player: p1, stats: p1Stats, pairSplit: p1PairSplit, petVisual: p1EquippedPetVisual }
            : { player: p2, stats: p2Stats, pairSplit: p2PairSplit, petVisual: p2EquippedPetVisual };
    }, [matchForBoard, p1, p2, p1Stats, p2Stats, p1PairSplit, p2PairSplit, p1EquippedPetVisual, p2EquippedPetVisual]);

    const versusSeatWhite = React.useMemo((): VersusSideSeat => {
        const rg = matchForBoard?.championshipRealGame;
        if (!rg) {
            return { player: p2, stats: p2Stats, pairSplit: p2PairSplit, petVisual: p2EquippedPetVisual };
        }
        return rg.whitePlayerId === p1.id
            ? { player: p1, stats: p1Stats, pairSplit: p1PairSplit, petVisual: p1EquippedPetVisual }
            : { player: p2, stats: p2Stats, pairSplit: p2PairSplit, petVisual: p2EquippedPetVisual };
    }, [matchForBoard, p1, p2, p1Stats, p2Stats, p1PairSplit, p2PairSplit, p1EquippedPetVisual, p2EquippedPetVisual]);

    /** `경기 시작` 이후 서버 기보 수신 전에만 중앙 입장 안내 — 입장 직후부터 표시되면 안 됨 */
    const versusMobileSessionActive = React.useMemo(
        () => Boolean(matchForBoard?.championshipRealGame) || kataBusy || versusReplayActive,
        [matchForBoard?.championshipRealGame, kataBusy, versusReplayActive],
    );

    React.useEffect(() => {
        if (!isMobile) return;
        if (versusMobileSessionActive) setIsMobileSidebarOpen(false);
    }, [isMobile, versusMobileSessionActive]);

    const versusBoardCenterMode =
        matchForBoard?.championshipRealGame != null ? null : kataBusy ? ('players_entering' as const) : null;

    const versusPetPlayersEnteringHint =
        venue === 'petpair'
            ? '선수들이 펫과 함께 입장하고 있습니다. 잠시만 기다려주세요.'
            : venue === 'pet'
              ? '펫들이 입장하고 있습니다. 잠시만 기다려주세요.'
              : undefined;

    /** 서버 `executeChampionshipVersusKataDuel`과 동일: 통합 전략 시즌 티어 → 실대국 판·maxPly */
    const versusKataRulesPreview = React.useMemo(() => championshipVersusBoardRulesForActorStrategicTier(user), [user]);

    const versusBoardSizeForUi =
        matchForBoard?.championshipRealGame?.boardSize ?? versusKataRulesPreview.boardSize;

    const versusPlaybackSpeedChoices = React.useMemo(
        () => resolveChampionshipVersusPlaybackSpeedChoices(versusBoardSizeForUi) as readonly ChampionshipPlaybackSpeed[],
        [versusBoardSizeForUi],
    );

    React.useEffect(() => {
        if (versusPlaybackSpeedChoices.includes(versusPlaybackSpeed)) return;
        const next = (versusPlaybackSpeedChoices.includes(1) ? 1 : versusPlaybackSpeedChoices[0]!) as ChampionshipPlaybackSpeed;
        setVersusPlaybackSpeed(next);
    }, [versusPlaybackSpeedChoices, versusPlaybackSpeed]);

    const versusChampionshipTurnUi = React.useMemo(() => {
        const off = { blackUser: false, blackPet: false, whiteUser: false, whitePet: false };
        const rg = matchForBoard?.championshipRealGame;
        if (!rg || rg.status !== 'playing') return off;
        const total = rg.moves?.length ?? 0;
        const ply = Math.min(Math.max(0, Math.floor(Number(rg.currentPly ?? 0))), total);
        if (ply >= total) return off;

        const order = rg.pairTurnOrder;
        if (venue === 'petpair' && order && order.length === 4) {
            const next = order[ply % 4]!;
            const bid = rg.blackPlayerId;
            const wid = rg.whitePlayerId;
            return {
                blackUser: next.player === Player.Black && next.kind === 'user' && next.participantId === bid,
                blackPet: next.player === Player.Black && next.participantId === `pet-ai-${bid}`,
                whiteUser: next.player === Player.White && next.kind === 'user' && next.participantId === wid,
                whitePet: next.player === Player.White && next.participantId === `pet-ai-${wid}`,
            };
        }

        const blackTurn = ply % 2 === 0;
        if (venue === 'petpair') {
            return {
                blackUser: blackTurn,
                blackPet: blackTurn,
                whiteUser: !blackTurn,
                whitePet: !blackTurn,
            };
        }
        return {
            blackUser: blackTurn,
            blackPet: false,
            whiteUser: !blackTurn,
            whitePet: false,
        };
    }, [
        venue,
        matchForBoard?.id,
        matchForBoard?.championshipRealGame?.status,
        matchForBoard?.championshipRealGame?.currentPly,
        matchForBoard?.championshipRealGame?.moves?.length,
        matchForBoard?.championshipRealGame?.pairTurnOrder,
        matchForBoard?.championshipRealGame?.blackPlayerId,
        matchForBoard?.championshipRealGame?.whitePlayerId,
    ]);

    /** PVE 챔피언십(`TournamentBracket` `currentPhase`)과 동일: 실대국 `currentPly`·`maxPly`로 초·중·종 구간 강조 */
    const versusChampionshipAbilityPhase = React.useMemo((): 'early' | 'mid' | 'end' | 'none' => {
        const rg = matchForBoard?.championshipRealGame;
        if (!rg) return 'none';
        if (rg.status !== 'playing' && rg.status !== 'scoring') return 'none';
        const ply = rg.currentPly || matchForBoard?.timeElapsed || 1;
        const maxPly = Math.max(1, rg.maxPly || 1);
        const third = Math.max(1, Math.floor(maxPly / 3));
        const openingEnd = third;
        const midEnd = 2 * third;
        if (ply <= openingEnd) return 'early';
        if (ply <= midEnd) return 'mid';
        return 'end';
    }, [
        matchForBoard?.timeElapsed,
        matchForBoard?.championshipRealGame?.currentPly,
        matchForBoard?.championshipRealGame?.status,
        matchForBoard?.championshipRealGame?.maxPly,
    ]);

    const mySeasonGames = React.useMemo(() => {
        const e = user.championshipVersusVenueRatings?.[venue];
        return (e?.seasonWins ?? 0) + (e?.seasonLosses ?? 0);
    }, [user.championshipVersusVenueRatings, venue]);

    const myTierName = React.useMemo(
        () => getSeasonalRankingTierName(myRating, 999_999, mySeasonGames),
        [myRating, mySeasonGames],
    );

    const myTierIconUrl = React.useMemo(() => {
        const t = RANKING_TIERS.find((x) => x.name === myTierName) ?? RANKING_TIERS[RANKING_TIERS.length - 1]!;
        return t.icon;
    }, [myTierName]);

    const duelTicketsRaw = React.useMemo(() => {
        return getChampionshipVersusDuelTicketsForVenue(user, venue);
    }, [
        user.championshipVersusDuelTicketsByVenue,
        user.championshipVersusDuelTickets,
        venue,
        user.id,
    ]);
    const duelTicketNextAt = React.useMemo(
        () => getChampionshipVersusDuelTicketNextAtForVenue(user, venue),
        [user.championshipVersusDuelTicketNextAtByVenue, user.championshipVersusDuelTicketNextAt, venue, user.id],
    );
    const [duelTicketUiTick, setDuelTicketUiTick] = React.useState(0);
    React.useEffect(() => {
        if (duelTicketsRaw >= CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX) return;
        const id = window.setInterval(() => setDuelTicketUiTick((n) => n + 1), 1000);
        return () => window.clearInterval(id);
    }, [duelTicketsRaw, duelTicketNextAt, venue, user.id]);
    const duelTickets = React.useMemo(
        () => getChampionshipVersusDuelTicketsForVenueUi(user, venue, Date.now()),
        [
            user.championshipVersusDuelTicketsByVenue,
            user.championshipVersusDuelTickets,
            user.championshipVersusDuelTicketNextAtByVenue,
            user.championshipVersusDuelTicketNextAt,
            venue,
            user.id,
            duelTicketsRaw,
            duelTicketNextAt,
            duelTicketUiTick,
        ],
    );

    /** 경기장 시즌 전체 유저 기준 순위(동점 공동 순위). 구 캐시는 목록 내 ELO 순위로 폴백. */
    const opponentGlobalRankByUserId = React.useMemo(() => {
        const m = new Map<string, number>();
        if (opponents.length === 0) return m;
        for (const o of opponents) {
            if (typeof o.globalRank === 'number' && Number.isFinite(o.globalRank) && o.globalRank > 0) {
                m.set(o.userId, Math.floor(o.globalRank));
            }
        }
        if (m.size === opponents.length) return m;
        const sorted = [...opponents].sort((a, b) => b.rating - a.rating);
        let rank = 1;
        for (let i = 0; i < sorted.length; i++) {
            const row = sorted[i]!;
            if (i > 0 && row.rating < sorted[i - 1]!.rating) rank = i + 1;
            if (!m.has(row.userId)) m.set(row.userId, rank);
        }
        return m;
    }, [opponents]);

    const seasonName = ratingSeasonKey || getCurrentSeason().name;
    const [seasonCountdownTick, setSeasonCountdownTick] = React.useState(0);
    React.useEffect(() => {
        const id = window.setInterval(() => setSeasonCountdownTick((n) => n + 1), 60_000);
        return () => window.clearInterval(id);
    }, []);
    const seasonRemaining = React.useMemo(
        () => getVersusSeasonRemainingDaysHours(Date.now()),
        [seasonCountdownTick, seasonName],
    );
    const oppRefreshUsesDiamond =
        CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST && oppRefreshFreeRemaining <= 0;

    const handleActionKataRef = React.useRef(handlers.handleAction);
    handleActionKataRef.current = handlers.handleAction;

    const submitDuelResult = async (won: boolean) => {
        if (!selectedRow || duelSubmitting) return;
        if (selectedRow.userId.startsWith('versus-demo-')) {
            setDuelModalOpen(false);
            return;
        }
        setDuelSubmitting(true);
        try {
            const res = (await handlers.handleAction({
                type: 'REPORT_CHAMPIONSHIP_VERSUS_DUEL_RESULT',
                payload: { venue, opponentUserId: selectedRow.userId, won },
            })) as { error?: string };
            if (res?.error) throw new Error(res.error);
            setDuelModalOpen(false);
            /** 매칭 5명은 유지; 레이팅·시즌키는 위 `useEffect`가 `updatedUser` 머지로 반영 */
        } catch (err: any) {
            window.alert(err?.message || '결과 반영에 실패했습니다.');
        } finally {
            setDuelSubmitting(false);
        }
    };

    const runVersusKataDuel = async () => {
        if (!selectedRow || kataBusy || versusReplayActive) return;
        if (CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST && beatenOpponentIds.includes(selectedRow.userId)) return;
        setKataBusy(true);
        setCompletedVersusMatch(null);
        setVersusSummarySession(null);
        setVersusPlaybackMatch(null);
        versusKataFinalMatchRef.current = null;
        versusKataPendingResultRef.current = null;
        setVersusReplayActive(false);
        setVersusTerritoryAnalysis(null);
        clearVersusKataPlaybackTimers();
        versusKataSessionBeatOpponentIdRef.current = null;
        try {
            const res = (await handleActionKataRef.current({
                type: 'START_CHAMPIONSHIP_VERSUS_KATA_DUEL',
                payload: { venue, opponentUserId: selectedRow.userId },
            })) as Record<string, unknown> & { error?: string; clientResponse?: Record<string, unknown> };
            if (res?.error) throw new Error(String(res.error));
            const kd = (res.championshipVersusKataDuel ?? res.clientResponse?.championshipVersusKataDuel) as
                | {
                      match?: Match;
                      championshipRealGame?: Match['championshipRealGame'];
                      analysis?: AnalysisResult;
                      actorWon?: boolean;
                      actorVenueRatingBefore?: number;
                      actorVenueRatingAfter?: number;
                      actorVenueRatingDelta?: number;
                      champCoinsDelta?: number;
                      versusActorRewards?: VersusKataActorRewardClientPayload;
                  }
                | undefined;
            if (!kd?.match || !kd.analysis) throw new Error('응답 형식이 올바르지 않습니다.');
            const finalMatch = JSON.parse(JSON.stringify(kd.match)) as Match;
            const finalGame =
                finalMatch.championshipRealGame ??
                (kd.championshipRealGame ? (JSON.parse(JSON.stringify(kd.championshipRealGame)) as Match['championshipRealGame']) : null);
            if (!finalGame) throw new Error('대국 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
            if (!Array.isArray(finalGame.moves)) {
                finalGame.moves = [];
            }
            finalMatch.championshipRealGame = finalGame;
            const actorWon = kd.actorWon === true;
            const beatenOppId = selectedRow.userId;
            versusKataSessionBeatOpponentIdRef.current =
                CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST &&
                actorWon &&
                beatenOppId &&
                !beatenOppId.startsWith('versus-demo-')
                    ? beatenOppId
                    : null;
            const cu = currentUserRef.current;
            const rewardsPayload: VersusKataActorRewardClientPayload | null =
                kd.versusActorRewards ??
                (cu
                    ? {
                          goldDelta: 0,
                          userXpDelta: 0,
                          goldBefore: Number(cu.gold) || 0,
                          userXpBefore: Number(cu.userXp) || 0,
                          userLevelBefore: Number(cu.userLevel) || 1,
                          userLevelAfter: Number(cu.userLevel) || 1,
                          userXpAfter: Number(cu.userXp) || 0,
                          overallRecord: { wins: 0, losses: 0 },
                          vipPlayRewardSlot: { locked: true },
                      }
                    : null);
            if (!rewardsPayload) throw new Error('응답 형식이 올바르지 않습니다.');
            const resultPayload: VersusKataDuelResultPayload = {
                analysis: kd.analysis,
                actorVenueRatingBefore: typeof kd.actorVenueRatingBefore === 'number' ? kd.actorVenueRatingBefore : 0,
                actorVenueRatingAfter: typeof kd.actorVenueRatingAfter === 'number' ? kd.actorVenueRatingAfter : 0,
                actorVenueRatingDelta: typeof kd.actorVenueRatingDelta === 'number' ? kd.actorVenueRatingDelta : 0,
                champCoinsDelta: typeof kd.champCoinsDelta === 'number' ? kd.champCoinsDelta : 0,
                rewards: rewardsPayload,
            };
            if (!beginVersusKataReplay(finalMatch, resultPayload)) {
                setVersusTerritoryAnalysis(resultPayload.analysis);
                setCompletedVersusMatch(finalMatch);
                if (cu) {
                    setVersusSummarySession(
                        buildChampionshipVersusKataSummarySession({
                            match: finalMatch,
                            analysis: resultPayload.analysis,
                            currentUser: cu,
                            venue,
                            actorVenueRatingBefore: resultPayload.actorVenueRatingBefore,
                            actorVenueRatingAfter: resultPayload.actorVenueRatingAfter,
                            actorVenueRatingDelta: resultPayload.actorVenueRatingDelta,
                            champCoinsDelta: resultPayload.champCoinsDelta,
                            rewards: resultPayload.rewards,
                        }),
                    );
                }
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '경기 시작에 실패했습니다.';
            window.alert(msg);
        } finally {
            setKataBusy(false);
        }
    };

    const openVersusKataDuelStartFlow = React.useCallback(() => {
        if (!selectedRow) return;
        const isDemoPath = !CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST || selectedRow.userId.startsWith('versus-demo-');
        const c = myVersusConditionForPotion;
        const needsLowConditionWarning = c >= 1 && c <= CHAMPIONSHIP_VERSUS_LOW_CONDITION_START_WARN_AT;
        if (needsLowConditionWarning) {
            setLowConditionStartPending(isDemoPath ? 'demo' : 'live');
            setLowConditionVersusStartModalOpen(true);
            return;
        }
        if (isDemoPath) {
            setDuelModalOpen(true);
        } else {
            void runVersusKataDuel();
        }
    }, [selectedRow, myVersusConditionForPotion, runVersusKataDuel]);

    const winCoinPreview = champCoinsForVersusWin(myRating);
    const lossCoinPreview = champCoinsForVersusLoss(myRating);

    const championshipBoardHostClipClass = 'overflow-hidden';

    const realGameForCountdown = matchForBoard?.championshipRealGame;
    const maxPlyToScoring = realGameForCountdown?.maxPly ?? versusKataRulesPreview.maxPly;
    const remainingPlyToScoring = realGameForCountdown
        ? Math.max(0, realGameForCountdown.maxPly - (realGameForCountdown.currentPly ?? 0))
        : maxPlyToScoring;

    const renderChampionshipScoringCountdownPanel = (showRemainderCaption: boolean) => (
        <div className="flex w-36 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-zinc-600 bg-gradient-to-br from-zinc-800 to-zinc-950 px-3 py-2 text-center shadow-lg">
            <div className="text-[11px] font-bold tracking-wide text-amber-100">계가까지</div>
            <div className="mt-0.5 text-2xl font-black tabular-nums text-white">
                {remainingPlyToScoring}/{maxPlyToScoring}
            </div>
            {showRemainderCaption ? (
                <div className="text-[10px] font-semibold text-slate-400">수 남음</div>
            ) : null}
        </div>
    );
    const championshipScoringCountdownPanel = renderChampionshipScoringCountdownPanel(true);
    const championshipScoringCountdownPanelMobile = renderChampionshipScoringCountdownPanel(false);

    const championshipPlayerRail =
        matchForBoard && (versusSeatBlack.player || versusSeatWhite.player) ? (
            <div className="flex w-full flex-shrink-0 justify-center">
                <div className="min-w-0 w-full min-[1025px]:px-1 flex-1 px-2 pt-1">
                    <section className="flex min-h-[74px] shrink-0 flex-row items-stretch gap-2 overflow-hidden rounded-lg border-2 border-zinc-600 bg-zinc-950 p-2 shadow-xl">
                        {venue === 'petpair' ? (
                            <div className="flex min-w-0 flex-1 items-stretch gap-2">
                                <VersusRailPlayerCard
                                    player={versusSeatBlack.player}
                                    tone="black"
                                    currentUserId={user.id}
                                    onViewUser={onViewUser}
                                    canUseConditionPotion={canUseVersusConditionPotion && versusSeatBlack.player.id === user.id}
                                    onOpenConditionPotion={() => setShowConditionPotionModal(true)}
                                    isTurnToMove={versusChampionshipTurnUi.blackUser}
                                />
                                {versusSeatBlack.petVisual ? (
                                    <VersusRailPetMini
                                        tone="black"
                                        imageUrl={versusSeatBlack.petVisual.url}
                                        name={versusSeatBlack.petVisual.name}
                                        level={versusSeatBlack.petVisual.level}
                                        isTurnToMove={versusChampionshipTurnUi.blackPet}
                                    />
                                ) : null}
                            </div>
                        ) : (
                            <VersusRailPlayerCard
                                player={versusSeatBlack.player}
                                tone="black"
                                currentUserId={user.id}
                                onViewUser={onViewUser}
                                canUseConditionPotion={canUseVersusConditionPotion && versusSeatBlack.player.id === user.id}
                                onOpenConditionPotion={() => setShowConditionPotionModal(true)}
                                portraitSrcOverride={venue === 'pet' ? versusSeatBlack.petVisual?.url ?? null : null}
                                isTurnToMove={versusChampionshipTurnUi.blackUser}
                            />
                        )}
                        {championshipScoringCountdownPanel}
                        {venue === 'petpair' ? (
                            <div className="flex min-w-0 flex-1 flex-row-reverse items-stretch gap-2">
                                <VersusRailPlayerCard
                                    player={versusSeatWhite.player}
                                    tone="white"
                                    currentUserId={user.id}
                                    onViewUser={onViewUser}
                                    canUseConditionPotion={canUseVersusConditionPotion && versusSeatWhite.player.id === user.id}
                                    onOpenConditionPotion={() => setShowConditionPotionModal(true)}
                                    isTurnToMove={versusChampionshipTurnUi.whiteUser}
                                />
                                {versusSeatWhite.petVisual ? (
                                    <VersusRailPetMini
                                        tone="white"
                                        imageUrl={versusSeatWhite.petVisual.url}
                                        name={versusSeatWhite.petVisual.name}
                                        level={versusSeatWhite.petVisual.level}
                                        isTurnToMove={versusChampionshipTurnUi.whitePet}
                                    />
                                ) : null}
                            </div>
                        ) : (
                            <VersusRailPlayerCard
                                player={versusSeatWhite.player}
                                tone="white"
                                currentUserId={user.id}
                                onViewUser={onViewUser}
                                canUseConditionPotion={canUseVersusConditionPotion && versusSeatWhite.player.id === user.id}
                                onOpenConditionPotion={() => setShowConditionPotionModal(true)}
                                portraitSrcOverride={venue === 'pet' ? versusSeatWhite.petVisual?.url ?? null : null}
                                isTurnToMove={versusChampionshipTurnUi.whiteUser}
                            />
                        )}
                    </section>
                </div>
            </div>
        ) : null;

    const versusSeasonRewardRow = (
        <div className="flex min-w-0 w-full min-[720px]:flex-1 flex-wrap items-center gap-x-2.5 gap-y-2 sm:gap-x-3 sm:gap-y-2">
            <span className="shrink-0 max-w-[min(100%,18rem)] text-[11px] font-bold leading-snug text-slate-200 sm:max-w-none sm:text-xs">
                <span className="font-black tracking-wide text-amber-100/95">{seasonName}</span>
                <span className="mx-1 font-black text-amber-200/55">·</span>
                <span className="text-slate-200">
                    시즌 종료 {seasonRemaining.days}일 {seasonRemaining.hours}시간 남음
                </span>
            </span>
            <span className="hidden h-8 w-px shrink-0 self-stretch bg-gradient-to-b from-transparent via-slate-500/60 to-transparent sm:block" aria-hidden />
            <Avatar userId={user.id} userName={user.nickname} size={44} avatarUrl={myAvatarUrl} borderUrl={myBorderUrl} />
            <div className="min-w-0 max-w-[9rem] sm:max-w-[13rem]">
                <div className="truncate text-sm font-bold leading-tight text-white sm:text-base">{user.nickname}</div>
            </div>
            <span className="shrink-0 rounded-lg border border-amber-400/35 bg-black/40 px-2 py-1 text-xs font-black tabular-nums text-amber-50 shadow-inner sm:text-[13px]">
                Lv.{user.userLevel ?? 1}
            </span>
            <img
                src={resolvePublicUrl(myTierIconUrl)}
                alt=""
                className="h-10 w-10 shrink-0 object-contain drop-shadow-md sm:h-11 sm:w-11 lg:h-12 lg:w-12"
            />
            <span className="shrink-0 text-xl font-black tabular-nums tracking-tight text-white sm:text-2xl">{myRating}</span>
            <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-950/35 px-2.5 py-1 shadow-inner sm:px-3 sm:py-1.5">
                <span className="text-[10px] font-black tracking-wide text-emerald-200 sm:text-xs">승리시</span>
                <img src={specialResourceIcons.champCoins} alt="" className="h-5 w-5 object-contain sm:h-6 sm:w-6" />
                <span className="text-base font-black tabular-nums text-emerald-50 sm:text-lg">{winCoinPreview}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-500/55 bg-black/40 px-2.5 py-1 shadow-inner sm:px-3 sm:py-1.5">
                <span className="text-[10px] font-black tracking-wide text-slate-400 sm:text-xs">패배시</span>
                <img src={specialResourceIcons.champCoins} alt="" className="h-5 w-5 object-contain sm:h-6 sm:w-6" />
                <span className="text-base font-black tabular-nums text-slate-100 sm:text-lg">{lossCoinPreview}</span>
            </div>
        </div>
    );

    const versusPrimaryActions = (
        <>
            <Button
                type="button"
                bare
                onClick={() => {
                    openVersusKataDuelStartFlow();
                }}
                disabled={!selectedRow || duelTickets < 1 || kataBusy || versusReplayActive || (CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST && Boolean(selectedRow && beatenOpponentIds.includes(selectedRow.userId)))}
                colorScheme="none"
                className={championshipVersusStartMatchButtonSidebarClass}
            >
                <span
                    className="pointer-events-none absolute -left-[20%] top-[-30%] h-[160%] w-[55%] rotate-[18deg] bg-gradient-to-r from-white/35 via-white/[0.07] to-transparent opacity-80 blur-md transition-opacity duration-300 group-hover:opacity-100"
                    aria-hidden
                />
                <span
                    className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(120%_80%_at_50%_-20%,rgba(255,255,255,0.35),transparent_55%)]"
                    aria-hidden
                />
                <span className="pointer-events-none absolute inset-x-2 top-0 h-px bg-white/45" aria-hidden />
                <span className="pointer-events-none absolute inset-px rounded-[11px] ring-1 ring-inset ring-white/15" aria-hidden />
                <span className="relative flex w-full flex-col items-center gap-0.5">
                    {kataBusy ? (
                        <>
                            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-100 border-t-transparent sm:h-5 sm:w-5" />
                            <span className="text-[10px] font-black tracking-wide text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] sm:text-xs">
                                경기 시작
                            </span>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center justify-center gap-1 leading-none">
                                <img
                                    src={CHAMPIONSHIP_VERSUS_ENTRY_TICKET_IMAGE[venue]}
                                    alt=""
                                    className="h-3 w-3 shrink-0 object-contain opacity-95 drop-shadow sm:h-3.5 sm:w-3.5"
                                />
                                <span className="text-[10px] font-black tabular-nums text-emerald-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] sm:text-[11px]">
                                    {duelTickets}/{CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX}
                                </span>
                                <ChampionshipVersusDuelTicketCountdown
                                    current={duelTickets}
                                    max={CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX}
                                    nextAt={duelTicketNextAt}
                                    className="text-[8px] font-mono font-bold tabular-nums text-emerald-100/95 sm:text-[9px]"
                                />
                            </div>
                            <span className="text-[11px] font-black leading-tight tracking-wide text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] sm:text-xs">
                                경기 시작
                            </span>
                        </>
                    )}
                </span>
            </Button>
            <Button
                type="button"
                bare
                onClick={() => replaceAppHash('#/tournament')}
                colorScheme="none"
                className={`flex min-h-[40px] min-w-[4.75rem] flex-1 basis-0 items-center justify-center !px-2 !py-2 !text-xs sm:min-h-[42px] sm:!text-sm ${championshipFooterExitButton} focus-visible:ring-offset-slate-950`}
                title="경기장을 나갑니다."
            >
                나가기
            </Button>
        </>
    );

    /** 우측 사이드바 상단: 시즌·내 정보·티어·점수·승패 코인 */
    const versusSidebarSelfSummary = (
        <section className="relative shrink-0 overflow-hidden rounded-lg border border-white/12 bg-gradient-to-br from-slate-800/95 via-slate-950/96 to-black/96 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_6px_20px_-12px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-amber-400/15">
            <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_70%_at_50%_-10%,rgba(251,191,36,0.1),transparent_50%)]"
                aria-hidden
            />
            <div className="relative space-y-2">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 text-center">
                        <p className="text-[10px] font-bold tracking-[0.12em] text-amber-200/90">시즌</p>
                        <p className="mt-0.5 text-[11px] font-bold leading-snug text-slate-50 sm:text-xs">
                            <span className="font-black text-amber-50">{seasonName}</span>
                            <span className="mx-0.5 font-black text-amber-200/60">·</span>
                            <span className="text-slate-200">
                                종료 {seasonRemaining.days}일 {seasonRemaining.hours}시간
                            </span>
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setVersusDuelHistoryOpen(true)}
                        className="shrink-0 rounded-md border border-amber-400/55 bg-black/50 px-2 py-1 text-[10px] font-black tracking-wide text-amber-50 shadow-inner ring-1 ring-inset ring-amber-300/20 transition hover:border-amber-300/80 hover:bg-amber-950/40 active:scale-[0.98] sm:text-[11px]"
                    >
                        대전정보
                    </button>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-white/10 bg-zinc-900/92 px-2 py-1.5 ring-1 ring-inset ring-white/[0.06]">
                    <Avatar userId={user.id} userName={user.nickname} size={40} avatarUrl={myAvatarUrl} borderUrl={myBorderUrl} />
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-black leading-tight text-white sm:text-sm">{user.nickname}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[10px] text-slate-300">
                            <span className="font-bold tabular-nums text-amber-100">Lv.{user.userLevel ?? 1}</span>
                            <span className="text-slate-500">|</span>
                            <span className="font-semibold text-amber-200">{myTierName}</span>
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-0">
                        <img
                            src={resolvePublicUrl(myTierIconUrl)}
                            alt=""
                            className="h-7 w-7 object-contain drop-shadow-md sm:h-8 sm:w-8"
                        />
                        <span className="text-sm font-black tabular-nums leading-none text-white sm:text-base">{myRating}</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                    <div className="flex flex-col gap-0.5 rounded-md border border-emerald-400/45 bg-emerald-950/35 px-2 py-1.5 shadow-inner">
                        <span className="text-[10px] font-black tracking-wide text-emerald-100">승리 시</span>
                        <div className="flex items-center gap-1">
                            <img src={specialResourceIcons.champCoins} alt="" className="h-4 w-4 object-contain" />
                            <span className="text-sm font-black tabular-nums text-emerald-50">{winCoinPreview}</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-0.5 rounded-md border border-slate-500/55 bg-zinc-950/90 px-2 py-1.5 shadow-inner">
                        <span className="text-[10px] font-black tracking-wide text-slate-300">패배 시</span>
                        <div className="flex items-center gap-1">
                            <img src={specialResourceIcons.champCoins} alt="" className="h-4 w-4 object-contain opacity-90" />
                            <span className="text-sm font-black tabular-nums text-slate-50">{lossCoinPreview}</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );

    const versusSidebarFooterActions = (
        <div className="flex w-full shrink-0 gap-2 border-t border-white/12 bg-gradient-to-t from-black/92 via-slate-950/95 to-slate-950 px-2 pb-[max(0.85rem,calc(env(safe-area-inset-bottom,0px)+0.55rem))] pt-2">
            {versusPrimaryActions}
        </div>
    );

    const championshipMainGameRoom = (
        <main className={`flex min-h-0 min-w-0 flex-1 items-stretch justify-center ${championshipBoardHostClipClass}`}>
            <div className="flex h-full max-h-full w-full max-w-full min-h-0 flex-col items-stretch gap-0.5 lg:gap-1.5">
                {championshipPlayerRail}
                <div className={`relative min-h-0 w-full min-w-0 flex-1 ${championshipBoardHostClipClass}`}>
                    <div className="absolute inset-0 flex min-h-0 flex-col">
                        <div className={`relative flex h-full w-full min-h-0 min-w-0 flex-col ${championshipBoardHostClipClass}`}>
                            <div className={`flex min-h-0 w-full flex-1 items-center justify-center transition-opacity duration-500 ${championshipBoardHostClipClass}`}>
                                <div className="flex h-full w-full min-w-0 items-stretch justify-center gap-1.5 px-1 py-1">
                                    <ChampionshipAbilityPlayerPanel
                                        player={versusSeatBlack.player}
                                        stats={versusSeatBlack.stats}
                                        match={matchForBoard}
                                        currentPhase={versusChampionshipAbilityPhase}
                                        tone="black"
                                        sideLabel={venue === 'petpair' ? '페어 능력치' : '챔피언십 능력치'}
                                        abilityKataLadder={CHAMPIONSHIP_ABILITY_KATA_LADDER}
                                        splitPairAbilities={
                                            versusSeatBlack.pairSplit
                                                ? {
                                                      userBlockTitle: '유저',
                                                      userStats: versusSeatBlack.pairSplit.userStats,
                                                      petBlockTitle: '펫 능력치',
                                                      petStats: versusSeatBlack.pairSplit.petStats,
                                                  }
                                                : null
                                        }
                                        pairSplitTurnHighlight={
                                            venue === 'petpair' && versusSeatBlack.pairSplit
                                                ? {
                                                      user: versusChampionshipTurnUi.blackUser,
                                                      pet: versusChampionshipTurnUi.blackPet,
                                                  }
                                                : null
                                        }
                                    />
                                    <div
                                        className={`relative flex h-full min-h-0 min-w-0 flex-1 items-center justify-center bg-transparent p-0 ${championshipBoardHostClipClass}`}
                                    >
                                        <ChampionshipRealGoBoard
                                            match={matchForBoard}
                                            currentUser={user}
                                            tournamentFinished={!!completedVersusMatch?.isFinished}
                                            tournamentForResult={null}
                                            dungeonBoardCenterMode={versusBoardCenterMode}
                                            dungeonPlayersEnteringHint={versusPetPlayersEnteringHint}
                                            finalStandings={null}
                                            suppressFinishedResultCard
                                            territoryAnalysis={versusTerritoryAnalysis}
                                        />
                                    </div>
                                    <ChampionshipAbilityPlayerPanel
                                        player={versusSeatWhite.player}
                                        stats={versusSeatWhite.stats}
                                        match={matchForBoard}
                                        currentPhase={versusChampionshipAbilityPhase}
                                        tone="white"
                                        sideLabel={venue === 'petpair' ? '페어 능력치' : '챔피언십 능력치'}
                                        abilityKataLadder={CHAMPIONSHIP_ABILITY_KATA_LADDER}
                                        splitPairAbilities={
                                            versusSeatWhite.pairSplit
                                                ? {
                                                      userBlockTitle: '유저',
                                                      userStats: versusSeatWhite.pairSplit.userStats,
                                                      petBlockTitle: '펫 능력치',
                                                      petStats: versusSeatWhite.pairSplit.petStats,
                                                  }
                                                : null
                                        }
                                        pairSplitTurnHighlight={
                                            venue === 'petpair' && versusSeatWhite.pairSplit
                                                ? {
                                                      user: versusChampionshipTurnUi.whiteUser,
                                                      pet: versusChampionshipTurnUi.whitePet,
                                                  }
                                                : null
                                        }
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );

    const renderMobileChampionshipAbilityPanel = React.useCallback(
        (
            player: PlayerForTournament | null,
            stats: Record<string, number>,
            tone: 'black' | 'white',
            split: { userStats: Record<string, number>; petStats: Record<string, number> } | null,
            pairSplitTurnHighlight: { user: boolean; pet: boolean } | null,
        ) => {
            const activePhaseKey: 'opening' | 'midgame' | 'endgame' | null =
                versusChampionshipAbilityPhase === 'early'
                    ? 'opening'
                    : versusChampionshipAbilityPhase === 'mid'
                      ? 'midgame'
                      : versusChampionshipAbilityPhase === 'end'
                        ? 'endgame'
                        : null;
            const accentTone =
                tone === 'black'
                    ? 'border-zinc-600 bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-950'
                    : 'border-slate-500 bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900';
            const valueColor = tone === 'black' ? 'text-stone-100' : 'text-slate-50';
            const boardSize = matchForBoard?.championshipRealGame?.boardSize ?? versusBoardSizeForUi;
            const metaPly = (phase: (typeof MOBILE_PHASE_META)[number]) =>
                boardSize === 13 ? phase.ply13 : boardSize === 9 ? phase.ply9 : phase.ply19;

            const oneBlock = (blockStats: Record<string, number>, subLabel: string | null, turnHighlight = false) => (
                <div
                    className={`flex min-w-0 flex-1 flex-col gap-0.5 rounded-md border ${accentTone} p-1 ${
                        turnHighlight ? 'ring-2 ring-amber-400/88 shadow-[0_0_14px_-4px_rgba(245,158,11,0.42)] ring-inset' : ''
                    }`}
                >
                    {subLabel ? (
                        <div className="shrink-0 text-center text-[8px] font-black uppercase tracking-wide text-amber-100/90">
                            {subLabel}
                        </div>
                    ) : null}
                    <div className="grid grid-cols-3 gap-0.5">
                        {MOBILE_PHASE_META.map((phase) => {
                            const ply = metaPly(phase);
                            const fromSnapshot =
                                !split && player?.id
                                    ? matchForBoard?.championshipRealGame?.phaseStatsByPlayerId?.[player.id]?.[phase.key]
                                    : undefined;
                            const level = championshipKataLevelForPly(
                                ply,
                                blockStats as any,
                                undefined,
                                CHAMPIONSHIP_ABILITY_KATA_LADDER,
                            );
                            const computed = fromSnapshot ?? level;
                            const isActive = activePhaseKey === phase.key;
                            return (
                                <div
                                    key={phase.key}
                                    className={`flex items-center justify-between gap-1 rounded px-1 py-0.5 text-[9px] leading-none ${
                                        isActive
                                            ? 'border border-amber-300/65 bg-amber-500/22 text-amber-100'
                                            : 'border border-slate-600/45 bg-black/25 text-slate-300'
                                    }`}
                                >
                                    <span className="font-semibold">{phase.label}</span>
                                    <span className={`text-[11px] font-black tabular-nums ${valueColor}`}>{computed.abilityScore}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            );

            if (split) {
                return (
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        {oneBlock(split.userStats, '유저', Boolean(pairSplitTurnHighlight?.user))}
                        {oneBlock(split.petStats, '펫 능력치', Boolean(pairSplitTurnHighlight?.pet))}
                    </div>
                );
            }
            return oneBlock(stats, null, false);
        },
        [matchForBoard, versusBoardSizeForUi, versusChampionshipAbilityPhase],
    );

    const mobileChampionshipPlayerInfoRow =
        matchForBoard && (versusSeatBlack.player || versusSeatWhite.player) ? (
            <section className="flex shrink-0 flex-row items-stretch gap-1 rounded-md border border-stone-500/70 bg-stone-900/90 p-1 shadow-md">
                {venue === 'petpair' ? (
                    <>
                        <div className="flex min-w-0 flex-1 items-stretch gap-0.5">
                            <VersusMobilePureInfoCard
                                player={versusSeatBlack.player}
                                side="left"
                                currentUserId={user.id}
                                onViewUser={onViewUser}
                                canUseConditionPotion={canUseVersusConditionPotion && versusSeatBlack.player.id === user.id}
                                onOpenConditionPotion={() => setShowConditionPotionModal(true)}
                                isTurnToMove={versusChampionshipTurnUi.blackUser}
                            />
                            {versusSeatBlack.petVisual ? (
                                <VersusRailPetMini
                                    compact
                                    tone="black"
                                    imageUrl={versusSeatBlack.petVisual.url}
                                    name={versusSeatBlack.petVisual.name}
                                    level={versusSeatBlack.petVisual.level}
                                    isTurnToMove={versusChampionshipTurnUi.blackPet}
                                />
                            ) : null}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-row-reverse items-stretch gap-0.5">
                            <VersusMobilePureInfoCard
                                player={versusSeatWhite.player}
                                side="right"
                                currentUserId={user.id}
                                onViewUser={onViewUser}
                                canUseConditionPotion={canUseVersusConditionPotion && versusSeatWhite.player.id === user.id}
                                onOpenConditionPotion={() => setShowConditionPotionModal(true)}
                                isTurnToMove={versusChampionshipTurnUi.whiteUser}
                            />
                            {versusSeatWhite.petVisual ? (
                                <VersusRailPetMini
                                    compact
                                    tone="white"
                                    imageUrl={versusSeatWhite.petVisual.url}
                                    name={versusSeatWhite.petVisual.name}
                                    level={versusSeatWhite.petVisual.level}
                                    isTurnToMove={versusChampionshipTurnUi.whitePet}
                                />
                            ) : null}
                        </div>
                    </>
                ) : (
                    <>
                        <VersusMobilePureInfoCard
                            player={versusSeatBlack.player}
                            side="left"
                            currentUserId={user.id}
                            onViewUser={onViewUser}
                            canUseConditionPotion={canUseVersusConditionPotion && versusSeatBlack.player.id === user.id}
                            onOpenConditionPotion={() => setShowConditionPotionModal(true)}
                            portraitSrcOverride={venue === 'pet' ? versusSeatBlack.petVisual?.url ?? null : null}
                            isTurnToMove={versusChampionshipTurnUi.blackUser}
                        />
                        <VersusMobilePureInfoCard
                            player={versusSeatWhite.player}
                            side="right"
                            currentUserId={user.id}
                            onViewUser={onViewUser}
                            canUseConditionPotion={canUseVersusConditionPotion && versusSeatWhite.player.id === user.id}
                            onOpenConditionPotion={() => setShowConditionPotionModal(true)}
                            portraitSrcOverride={venue === 'pet' ? versusSeatWhite.petVisual?.url ?? null : null}
                            isTurnToMove={versusChampionshipTurnUi.whiteUser}
                        />
                    </>
                )}
            </section>
        ) : null;

    const mobileChampionshipAbilityRow =
        matchForBoard && (versusSeatBlack.player || versusSeatWhite.player) ? (
            <section className="flex shrink-0 flex-row items-stretch gap-1 rounded-md border border-slate-700/45 bg-gradient-to-b from-[#111827]/88 to-[#070b12]/90 p-1 shadow-md">
                {renderMobileChampionshipAbilityPanel(
                    versusSeatBlack.player,
                    versusSeatBlack.stats,
                    'black',
                    versusSeatBlack.pairSplit,
                    venue === 'petpair' && versusSeatBlack.pairSplit
                        ? { user: versusChampionshipTurnUi.blackUser, pet: versusChampionshipTurnUi.blackPet }
                        : null,
                )}
                {renderMobileChampionshipAbilityPanel(
                    versusSeatWhite.player,
                    versusSeatWhite.stats,
                    'white',
                    versusSeatWhite.pairSplit,
                    venue === 'petpair' && versusSeatWhite.pairSplit
                        ? { user: versusChampionshipTurnUi.whiteUser, pet: versusChampionshipTurnUi.whitePet }
                        : null,
                )}
            </section>
        ) : null;

    const mobileChampionshipBoardSection = (
        <div
            className={`relative flex min-h-[min(22dvh,260px)] w-full min-w-0 flex-1 items-center justify-center rounded-md bg-transparent p-1 ${championshipBoardHostClipClass}`}
        >
            <ChampionshipRealGoBoard
                match={matchForBoard}
                currentUser={user}
                tournamentFinished={!!completedVersusMatch?.isFinished}
                tournamentForResult={null}
                dungeonBoardCenterMode={versusBoardCenterMode}
                dungeonPlayersEnteringHint={versusPetPlayersEnteringHint}
                finalStandings={null}
                suppressFinishedResultCard
                territoryAnalysis={versusTerritoryAnalysis}
            />
        </div>
    );

    const mobileChampionshipMainGameRoom = (
        <main className={`flex min-h-0 min-w-0 flex-1 flex-col items-stretch justify-center bg-transparent ${championshipBoardHostClipClass}`}>
            <div
                className={`flex min-h-0 w-full max-w-full flex-1 flex-col items-stretch gap-1 overflow-y-auto overflow-x-hidden bg-transparent px-1 py-1 ${championshipBoardHostClipClass}`}
                style={{ WebkitOverflowScrolling: 'touch' }}
            >
                {mobileChampionshipPlayerInfoRow}
                {mobileChampionshipAbilityRow}
                {matchForBoard && (versusSeatBlack.player || versusSeatWhite.player) ? (
                    <section className="flex shrink-0 justify-center px-0.5 py-0.5" aria-label="계가까지 남은 수">
                        {championshipScoringCountdownPanelMobile}
                    </section>
                ) : null}
                {mobileChampionshipBoardSection}
            </div>
        </main>
    );

    const disableOpponentControls = versusMobileSessionActive;

    const opponentSidebarInner = (
        <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-hidden px-1.5 pb-0.5 text-slate-100">
            <div className="shrink-0">{versusSidebarSelfSummary}</div>

            <div className="shrink-0 border-b border-white/10 px-0.5 pb-1 pt-0">
                <h3 className="text-center text-sm font-black tracking-wide text-amber-50 drop-shadow-sm sm:text-[15px]">
                    상대 선수
                </h3>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-0.5 py-0.5">
                    <div className="flex min-h-0 w-full max-w-full flex-1 flex-col gap-0 self-stretch overflow-y-auto overflow-x-hidden overscroll-y-contain px-0.5 py-0.5 [scrollbar-color:rgba(148,163,184,0.45)_rgba(15,23,42,0.5)] [scrollbar-width:thin]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-6 text-slate-300">
                                <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-300" />
                                <span className="text-sm font-semibold tracking-wide">매칭 목록 불러오는 중</span>
                            </div>
                        ) : loadError ? (
                            <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-2 py-2 text-center text-xs leading-relaxed text-rose-50 shadow-inner ring-1 ring-rose-400/20">
                                {loadError}
                            </div>
                        ) : opponents.length === 0 ? (
                            <div className="rounded-xl border border-white/12 bg-black/35 px-2 py-5 text-center text-xs text-slate-300 ring-1 ring-inset ring-white/[0.06]">
                                표시할 상대가 없습니다.
                            </div>
                        ) : (
                            <ul className="flex list-none flex-col gap-1.5 p-0">
                                {opponents.map((o) => {
                                    const selected = (selectedId ?? opponents[0]?.userId) === o.userId;
                                    const demoRow = o.userId.startsWith('versus-demo-');
                                    const isSessionBeaten =
                                        CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST && beatenOpponentIds.includes(o.userId);
                                    const isOpponentSelectDisabled = disableOpponentControls || isSessionBeaten;
                                    const oAvatar = AVATAR_POOL.find((a) => a.id === o.avatarId)?.url;
                                    const showPetAux = (venue === 'pet' || venue === 'petpair') && o.representativePet;
                                    const userAvatarSrc = resolvePublicUrl(oAvatar || '/images/profiles/profile1.webp');
                                    const petLv =
                                        showPetAux &&
                                        typeof o.representativePet!.level === 'number' &&
                                        Number.isFinite(o.representativePet!.level) &&
                                        o.representativePet!.level >= 1
                                            ? Math.floor(o.representativePet!.level)
                                            : showPetAux
                                              ? 1
                                              : null;
                                    const tierIcon = resolvePublicUrl(tierIconUrlForVersusRow(o));
                                    return (
                                        <li key={o.userId} className="w-full">
                                            <div
                                                className={`group relative overflow-hidden rounded-xl border transition-all duration-200 ${
                                                    isSessionBeaten
                                                        ? 'border-emerald-500/35 bg-gradient-to-br from-emerald-950/40 via-slate-950/88 to-black/92 opacity-[0.72] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-inset ring-emerald-500/15'
                                                        : selected
                                                          ? 'border-amber-400/55 bg-gradient-to-br from-amber-950/50 via-slate-950/90 to-black/94 shadow-[0_10px_36px_-12px_rgba(245,158,11,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] ring-2 ring-amber-400/20'
                                                          : 'border-white/[0.07] bg-gradient-to-br from-slate-800/85 via-slate-950/90 to-black/94 shadow-[0_6px_28px_-14px_rgba(0,0,0,0.75)] ring-1 ring-inset ring-white/[0.04] hover:border-amber-300/25 hover:shadow-[0_10px_32px_-14px_rgba(245,158,11,0.12)]'
                                                }`}
                                            >
                                                {isSessionBeaten ? (
                                                    <div className="pointer-events-none absolute right-2 top-2 z-[3] rounded-md border border-emerald-400/50 bg-emerald-950/90 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-100 shadow-md ring-1 ring-emerald-400/25 sm:right-2.5 sm:top-2.5 sm:px-2 sm:text-[10px]">
                                                        승리
                                                    </div>
                                                ) : null}
                                                <div
                                                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-20%,rgba(251,191,36,0.07),transparent_55%)] opacity-90"
                                                    aria-hidden
                                                />
                                                <div
                                                    role="button"
                                                    tabIndex={isOpponentSelectDisabled ? -1 : 0}
                                                    onClick={() => {
                                                        if (isOpponentSelectDisabled) return;
                                                        setSelectedId(o.userId);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (isOpponentSelectDisabled) return;
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            setSelectedId(o.userId);
                                                        }
                                                    }}
                                                    className={`relative z-[1] flex w-full items-center gap-1.5 px-2 py-2 text-left outline-none sm:gap-2 sm:px-2.5 sm:py-2.5 ${
                                                        isOpponentSelectDisabled
                                                            ? 'cursor-not-allowed opacity-95'
                                                            : 'cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400/50'
                                                    }`}
                                                >
                                                    <span
                                                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-400/35 bg-gradient-to-b from-amber-500/25 via-amber-950/40 to-black text-[9px] font-black tabular-nums leading-none text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-black/50 sm:h-7 sm:w-7 sm:text-[10px]"
                                                        title="전체 유저 기준 순위"
                                                    >
                                                        {opponentGlobalRankByUserId.get(o.userId) ?? '—'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        disabled={disableOpponentControls}
                                                        className="relative z-[2] flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-white/15 bg-slate-950 p-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_8px_rgba(0,0,0,0.5)] ring-1 ring-black/50 transition hover:border-amber-400/45 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.25)] active:scale-[0.96] sm:h-9 sm:w-9"
                                                        title={demoRow ? '프로필' : `${o.nickname} 프로필 보기`}
                                                        aria-label={demoRow ? '프로필' : `${o.nickname} 프로필 보기`}
                                                        onClick={(e) => {
                                                            if (disableOpponentControls) return;
                                                            e.stopPropagation();
                                                            if (demoRow) setSelectedId(o.userId);
                                                            else handlers.openViewingUser(o.userId);
                                                        }}
                                                    >
                                                        <img src={userAvatarSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
                                                    </button>
                                                    <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-black/50 p-0.5 shadow-inner ring-1 ring-inset ring-white/[0.05] sm:h-9 sm:w-9">
                                                        <img src={tierIcon} alt="" className="h-full w-full object-contain drop-shadow-md" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex min-w-0 flex-col gap-0.5">
                                                            <div className="flex min-w-0 items-start gap-1.5">
                                                                <span className="shrink-0 rounded bg-black/45 px-1 py-0.5 text-[9px] font-black tabular-nums text-amber-50 ring-1 ring-amber-400/35 sm:text-[10px]">
                                                                    Lv.{o.userLevel}
                                                                </span>
                                                                <span className="min-w-0 flex-1 whitespace-normal break-words text-[13px] font-bold leading-snug tracking-tight text-white group-hover:text-amber-50">
                                                                    {o.nickname}
                                                                </span>
                                                            </div>
                                                            {showPetAux && petLv != null ? (
                                                                <span className="whitespace-normal break-words text-[10px] font-semibold leading-snug text-slate-300">
                                                                    Lv.{petLv} {o.representativePet!.displayName}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <div className="mt-0.5 text-[10px] font-semibold tabular-nums text-cyan-100 sm:text-[11px]">
                                                            {seasonRecordLabel(o.wins, o.losses)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        <div className="mt-2 w-full shrink-0 border-t border-white/10 pt-2">
                            <Button
                                type="button"
                                colorScheme="none"
                                disabled={loading || disableOpponentControls}
                                onClick={() => void refreshOpponents({ force: true })}
                                className="!flex w-full !items-center !justify-center gap-1.5 !rounded-lg !border !border-amber-400/45 !bg-gradient-to-b !from-slate-600/55 !via-slate-900/88 !to-black !py-2 !text-[11px] !font-bold !text-amber-50 !shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_6px_20px_-12px_rgba(0,0,0,0.85)] !ring-1 !ring-inset !ring-white/10 transition hover:!border-amber-300/60 hover:!brightness-110 active:!scale-[0.99] disabled:!opacity-45 sm:!text-xs"
                            >
                                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-amber-300/40 text-[9px] leading-none text-amber-200">
                                    ↻
                                </span>
                                <span>새로고침</span>
                                {!CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST ? (
                                    <span className="tabular-nums text-amber-200/80">
                                        ({CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY}/{CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY})
                                    </span>
                                ) : oppRefreshUsesDiamond ? (
                                    <span className="flex items-center gap-1 font-mono tabular-nums text-sky-200/95">
                                        <img src={resourceIcons.diamonds} alt="" className="h-3.5 w-3.5 object-contain" />
                                        {CHAMPIONSHIP_VERSUS_OPP_REFRESH_DIAMONDS}
                                    </span>
                                ) : (
                                    <span className="tabular-nums text-amber-200/85">
                                        ({oppRefreshFreeRemaining}/{CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY})
                                    </span>
                                )}
                            </Button>
                            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
                                <span className="text-[10px] font-bold tracking-wide text-cyan-100">배속</span>
                                {versusPlaybackSpeedChoices.map((speed) => {
                                    const isActive = versusPlaybackSpeed === speed;
                                    const titleBySpeed: Record<string, string> = {
                                        '0.5': '3초에 한 수',
                                        '1': '1.5초에 한 수',
                                        '2': '1초에 한 수',
                                        '3': '0.5초에 한 수',
                                    };
                                    return (
                                        <button
                                            key={speed}
                                            type="button"
                                            onClick={() => setVersusPlaybackSpeed(speed)}
                                            title={titleBySpeed[String(speed)]}
                                            className={`min-w-[2.35rem] rounded border px-1.5 py-0.5 text-[10px] font-black tracking-wider transition ${
                                                isActive
                                                    ? 'border-cyan-200/90 bg-cyan-500/35 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]'
                                                    : 'border-slate-500/55 bg-slate-900/75 text-slate-200 hover:border-cyan-300/65 hover:bg-slate-800/90 hover:text-cyan-50'
                                            }`}
                                        >
                                            x{speed}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {versusSidebarFooterActions}
        </div>
    );

    return (
        <div className="relative flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden p-1 text-white lg:p-2" style={{ height: '100%', maxHeight: '100%' }}>
            <div
                className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{
                    backgroundImage: `url(${resolvePublicUrl(getChampionshipArenaBackgroundUrl(venue))})`,
                }}
                aria-hidden
            />
            <div className={`relative z-10 flex min-h-0 flex-1 flex-row gap-2 ${championshipBoardHostClipClass}`}>
                {isMobile ? mobileChampionshipMainGameRoom : championshipMainGameRoom}

                {!isMobile && (
                    <div
                        className={`relative overflow-visible max-h-full min-h-0 flex-shrink-0 self-stretch transition-[width] duration-200 ${
                            isRightSidebarCollapsed ? 'w-0' : 'w-[320px] xl:w-[360px]'
                        }`}
                    >
                        {!isRightSidebarCollapsed && (
                            <div className="relative isolate flex h-full max-h-full min-h-0 items-stretch overflow-hidden rounded-2xl border border-amber-500/50 bg-gradient-to-b from-slate-800 via-[#1a2436] to-zinc-950 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_20px_52px_-18px_rgba(0,0,0,0.88)] ring-1 ring-inset ring-amber-400/18 before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-2xl before:bg-[radial-gradient(120%_90%_at_100%_0%,rgba(251,191,36,0.12),transparent_55%)]">
                                <div
                                    className="pointer-events-none absolute inset-x-3 top-0 z-10 h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent"
                                    aria-hidden
                                />
                                <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{opponentSidebarInner}</div>
                            </div>
                        )}
                        <ArenaRightSidebarCollapseToggle
                            collapsed={isRightSidebarCollapsed}
                            onToggle={() => setIsRightSidebarCollapsed((prev) => !prev)}
                            tone="championship"
                        />
                    </div>
                )}

                {isMobile && (
                    <>
                        <div
                            className={`fixed right-0 z-50 isolate flex w-[min(19.5rem,calc(100vw-3rem))] flex-col overflow-hidden border-l border-amber-400/55 bg-gradient-to-b from-slate-800 via-[#1a2436] to-zinc-950 shadow-2xl transition-transform duration-300 ease-in-out before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-[radial-gradient(120%_90%_at_100%_0%,rgba(251,191,36,0.12),transparent_55%)] ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
                            style={{
                                top: VERSUS_MOBILE_DRAWER_TOP,
                                bottom: VERSUS_MOBILE_DRAWER_BOTTOM,
                            }}
                        >
                            <div className="relative z-10 flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                                <div className="flex shrink-0 items-center justify-end border-b border-slate-600/80 bg-slate-900/95 px-2.5 py-2">
                                    <span className="sr-only">부가 정보 패널</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsMobileSidebarOpen(false)}
                                        className="rounded-lg border border-slate-500/70 bg-slate-800/90 px-2.5 py-1.5 text-xs font-bold text-slate-100 shadow-sm transition hover:border-slate-400 hover:bg-slate-700/90 active:scale-[0.98]"
                                    >
                                        닫기
                                    </button>
                                </div>
                                {opponentSidebarInner}
                            </div>
                        </div>
                        {isMobileSidebarOpen && <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setIsMobileSidebarOpen(false)} />}
                    </>
                )}
            </div>

            {isMobile && !isMobileSidebarOpen && (
                <button
                    type="button"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="fixed right-0 z-[36] flex h-[6.25rem] w-[2.65rem] flex-col items-center justify-center gap-1 rounded-l-2xl border-2 border-r-0 border-amber-200/75 bg-gradient-to-b from-amber-400/95 via-amber-600/92 to-slate-950 text-white shadow-[0_6px_28px_-4px_rgba(245,158,11,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] ring-2 ring-amber-300/35 active:translate-x-0.5"
                    style={{ bottom: VERSUS_MOBILE_SIDEBAR_OPEN_TAB_BOTTOM }}
                    aria-label="우측 패널 열기"
                    title="우측 패널 열기"
                >
                    <span className="text-2xl font-black leading-none tracking-tight text-white drop-shadow-md">‹</span>
                    <span className="h-8 w-1 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.55)]" aria-hidden />
                </button>
            )}
            {duelModalOpen &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[450] flex items-center justify-center bg-black/70 p-4"
                        role="dialog"
                        aria-modal="true"
                        onClick={() => !duelSubmitting && setDuelModalOpen(false)}
                    >
                        <div
                            className="max-w-md w-full rounded-2xl border border-amber-400/40 bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-black/96 p-5 shadow-2xl ring-1 ring-amber-300/15"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-lg font-black text-amber-100">대국 결과</h2>
                            <p className="mt-3 text-center text-sm font-bold text-white">{selectedRow?.nickname ?? '—'}</p>
                            <div className="mt-5 flex flex-wrap justify-end gap-2">
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    className="!py-2 !px-4 text-xs"
                                    disabled={duelSubmitting}
                                    onClick={() => setDuelModalOpen(false)}
                                >
                                    취소
                                </Button>
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    className="!py-2 !px-4 text-xs border border-rose-400/50 bg-rose-950/50 text-rose-100"
                                    disabled={duelSubmitting}
                                    onClick={() => void submitDuelResult(false)}
                                >
                                    패배
                                </Button>
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    className="!py-2 !px-4 text-xs border border-emerald-400/50 bg-emerald-950/50 text-emerald-100"
                                    disabled={duelSubmitting}
                                    onClick={() => void submitDuelResult(true)}
                                >
                                    승리
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
            {lowConditionVersusStartModalOpen &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[455] flex items-center justify-center bg-black/60 p-4"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="versus-low-condition-start-title"
                        onClick={() => {
                            setLowConditionVersusStartModalOpen(false);
                            setLowConditionStartPending(null);
                        }}
                    >
                        <div
                            className="max-w-md w-full rounded-2xl border border-amber-400/50 bg-gradient-to-b from-slate-900 via-slate-950 to-zinc-950 p-5 shadow-2xl ring-1 ring-amber-300/20"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 id="versus-low-condition-start-title" className="text-lg font-black text-amber-100">
                                컨디션 낮음
                            </h2>
                            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-200">
                                현재 컨디션{' '}
                                <span className="font-black tabular-nums text-amber-200">
                                    {myVersusConditionForPotion >= 1 && myVersusConditionForPotion <= 100
                                        ? myVersusConditionForPotion
                                        : '—'}
                                </span>
                                입니다. 컨디션이 낮으면{' '}
                                <span className="font-bold text-rose-200/95">실수</span>가 나올 확률이 높아지고{' '}
                                <span className="font-bold text-emerald-200/95">신의 한수</span>가 나올 확률은 낮아집니다. 그래도
                                경기를 시작할까요?
                            </p>
                            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    className="order-3 w-full !py-2.5 !text-xs sm:order-1 sm:w-auto sm:!px-4"
                                    onClick={() => {
                                        setLowConditionVersusStartModalOpen(false);
                                        setLowConditionStartPending(null);
                                    }}
                                >
                                    취소
                                </Button>
                                {canUseVersusConditionPotion ? (
                                    <Button
                                        type="button"
                                        colorScheme="none"
                                        className="order-2 w-full !border !border-sky-400/45 !bg-sky-950/45 !py-2.5 !text-xs !text-sky-100 sm:w-auto sm:!px-4"
                                        onClick={() => {
                                            setLowConditionVersusStartModalOpen(false);
                                            setLowConditionStartPending(null);
                                            setShowConditionPotionModal(true);
                                        }}
                                    >
                                        컨디션 회복제 사용
                                    </Button>
                                ) : null}
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    className="order-1 w-full !border !border-amber-400/50 !bg-amber-950/40 !py-2.5 !text-xs !text-amber-50 sm:order-3 sm:w-auto sm:!px-4"
                                    onClick={() => {
                                        const pending = lowConditionStartPending;
                                        setLowConditionVersusStartModalOpen(false);
                                        setLowConditionStartPending(null);
                                        if (pending === 'demo') {
                                            setDuelModalOpen(true);
                                        } else if (pending === 'live') {
                                            void runVersusKataDuel();
                                        }
                                    }}
                                >
                                    그래도 시작
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
            {showConditionPotionModal && canUseVersusConditionPotion ? (
                <ConditionPotionModal
                    currentUser={user}
                    currentCondition={myVersusConditionForPotion}
                    onClose={() => setShowConditionPotionModal(false)}
                    onConfirm={async (potionType) => {
                        const result = await handlers.handleAction({
                            type: 'USE_CONDITION_POTION',
                            payload: { versusVenue: venue, potionType },
                        });
                        if (!(result && typeof result === 'object' && 'error' in result && result.error)) {
                            setShowConditionPotionModal(false);
                        }
                        return result as { error?: string } | void;
                    }}
                    isTopmost={true}
                />
            ) : null}
            {versusSummarySession ? (
                <GameSummaryModal
                    session={versusSummarySession}
                    currentUser={user}
                    onConfirm={() => {
                        flushVersusSessionBeatMarkRef();
                        setVersusSummarySession(null);
                    }}
                />
            ) : null}
            <ChampionshipVersusDuelHistoryModal
                open={versusDuelHistoryOpen}
                onClose={() => setVersusDuelHistoryOpen(false)}
                entries={user.championshipVersusDuelWeekLog}
                filterVenue={venue}
            />
        </div>
    );
};

export default ChampionshipVersusVenueArena;
