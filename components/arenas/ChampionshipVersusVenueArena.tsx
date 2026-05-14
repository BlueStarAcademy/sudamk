import React from 'react';
import { createPortal } from 'react-dom';
import type { ChampionshipVersusVenueKind, AnalysisResult } from '../../shared/types/entities.js';
import type { Match, PlayerForTournament, UserWithStatus } from '../../types.js';
import { CoreStat, LeagueTier } from '../../types/enums.js';
import { AVATAR_POOL, BORDER_POOL } from '../../constants';
import { getChampionshipArenaBackgroundUrl } from '../../shared/constants/tournaments.js';
import {
    CHAMPIONSHIP_ABILITY_KATA_LADDER,
    CHAMPIONSHIP_REAL_MATCH_RULES_19,
    championshipKataLevelForPly,
} from '../../shared/constants/championshipRealMatch.js';
import { getSeasonalRankingTierName, RANKING_TIERS } from '../../shared/constants/ranking.js';
import { RANKED_ELO_BASE_SCORE } from '../../shared/constants/rules.js';
import {
    CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX,
    CHAMPIONSHIP_VERSUS_OPP_REFRESH_DIAMONDS,
    CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY,
} from '../../shared/constants/championshipVersusVenue.js';
import { resolvePublicUrl } from '../../utils/publicAssetUrl.js';
import { calculateTotalStats } from '../../services/statService.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import { getCurrentSeason, getVersusSeasonRemainingDaysHours } from '../../shared/utils/timeUtils.js';
import Button from '../Button.js';
import Avatar from '../Avatar.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { useIsHandheldDevice } from '../../hooks/useIsMobileLayout.js';
import { ChampionshipAbilityPlayerPanel, ChampionshipRealGoBoard } from '../TournamentBracket.js';
import { CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST } from './championshipVersusVenueUiConfig.js';
import { resourceIcons, specialResourceIcons } from '../resourceIcons.js';

type OpponentRow = {
    userId: string;
    nickname: string;
    avatarId: string;
    borderId: string;
    league: LeagueTier;
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

const championshipFooterButtonBase =
    'rounded-xl border px-4 py-2 text-xs font-black tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_10px_24px_-14px_rgba(0,0,0,0.9)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';
const championshipFooterExitButton = `${championshipFooterButtonBase} border-rose-400/45 bg-gradient-to-b from-rose-600/88 via-rose-800/90 to-rose-950/95 text-rose-50 hover:brightness-110`;

function buildDemoOpponentRow(
    base: Omit<OpponentRow, 'totalGoPower' | 'coreStats' | 'openingAbility' | 'midgameAbility' | 'endgameAbility'>,
    seed: number,
): OpponentRow {
    const stats = stubCoreStats(seed) as Record<string, number>;
    const rules = CHAMPIONSHIP_REAL_MATCH_RULES_19;
    const opening = championshipKataLevelForPly(rules.phasePly.opening.to, stats as any, undefined, CHAMPIONSHIP_ABILITY_KATA_LADDER);
    const midgame = championshipKataLevelForPly(rules.phasePly.midgame.to, stats as any, undefined, CHAMPIONSHIP_ABILITY_KATA_LADDER);
    const endgame = championshipKataLevelForPly(rules.phasePly.endgame.to, stats as any, undefined, CHAMPIONSHIP_ABILITY_KATA_LADDER);
    let sum = 0;
    for (const k of Object.keys(stats)) {
        sum += Number(stats[k]) || 0;
    }
    return {
        ...base,
        coreStats: stats,
        totalGoPower: Math.round(sum),
        openingAbility: opening.abilityScore,
        midgameAbility: midgame.abilityScore,
        endgameAbility: endgame.abilityScore,
    };
}

const DEMO_OPPONENTS: OpponentRow[] = [
    buildDemoOpponentRow(
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
        1,
    ),
    buildDemoOpponentRow(
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
        2,
    ),
    buildDemoOpponentRow(
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
        3,
    ),
    buildDemoOpponentRow(
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
        4,
    ),
    buildDemoOpponentRow(
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
        5,
    ),
];

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

function opponentRowToTournamentPlayer(row: OpponentRow, seed: number): PlayerForTournament {
    const stats = (row.coreStats as Record<CoreStat, number>) ?? stubCoreStats(seed);
    return {
        id: row.userId,
        nickname: row.nickname,
        avatarId: row.avatarId,
        borderId: row.borderId,
        league: row.league,
        stats,
        wins: row.wins,
        losses: row.losses,
        condition: 82 + (seed % 5),
    };
}

function userToTournamentPlayer(user: UserWithStatus): PlayerForTournament {
    return {
        id: user.id,
        nickname: user.nickname,
        avatarId: user.avatarId,
        borderId: user.borderId,
        league: user.league,
        stats: calculateTotalStats(user, 'championshipVenue') as Record<CoreStat, number>,
        wins: 0,
        losses: 0,
        condition: 88,
    };
}

const VersusRailPlayerCard: React.FC<{
    player: PlayerForTournament | null;
    tone: 'blue' | 'rose';
    currentUserId: string;
    onViewUser: (id: string) => void;
}> = ({ player, tone, currentUserId, onViewUser }) => {
    const avatarUrl = player ? AVATAR_POOL.find((a) => a.id === player.avatarId)?.url : undefined;
    const borderUrl = player ? BORDER_POOL.find((b) => b.id === player.borderId)?.url : undefined;
    const isCurrentUser = player?.id === currentUserId;
    const demoId = Boolean(player?.id?.startsWith('versus-demo-'));
    const clickable = Boolean(player?.id && !player.id.startsWith('bot-') && !isCurrentUser && !demoId);
    const isRightSide = tone === 'rose';
    const toneClass =
        tone === 'blue'
            ? 'border-blue-400/30 bg-gradient-to-br from-gray-800 to-black text-blue-100 shadow-lg'
            : 'border-rose-400/30 bg-gradient-to-br from-gray-800 to-black text-rose-100 shadow-lg';
    const mutedText = 'text-slate-300';
    const strongText = 'text-slate-50';
    const rawCondition = player?.condition;
    const displayCondition: number | null =
        rawCondition !== undefined && rawCondition !== null && rawCondition !== 1000 ? rawCondition : null;
    const conditionTone =
        typeof displayCondition === 'number' && displayCondition < 40
            ? 'text-red-300'
            : typeof displayCondition === 'number' && displayCondition >= 80
              ? 'text-emerald-300'
              : strongText;
    const scoreBox = (
        <div className="flex w-[4.8rem] shrink-0 flex-col items-center justify-center rounded-lg border-2 border-gray-600 bg-gradient-to-br from-gray-800 to-black px-2 py-1.5 text-center text-white shadow-lg">
            <span className="text-[10px] font-bold leading-none text-gray-300">점수</span>
            <span className="mt-1 text-xl font-black leading-none tabular-nums">-</span>
        </div>
    );
    const recordWins = player?.wins ?? 0;
    const recordLosses = player?.losses ?? 0;

    return (
        <div
            className={`relative flex min-w-0 flex-1 items-center gap-3 rounded-lg border-2 px-3 py-2 transition-all duration-300 ${isRightSide ? 'flex-row-reverse text-right' : ''} ${toneClass}`}
        >
            <button
                type="button"
                className={`shrink-0 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={clickable && player ? () => onViewUser(player.id) : undefined}
                title={clickable && player ? `${player.nickname} 프로필 보기` : undefined}
            >
                {player ? (
                    <Avatar userId={player.id} userName={player.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={64} />
                ) : (
                    <div className="h-16 w-16 rounded-full bg-slate-800" />
                )}
            </button>
            <div className="min-w-0 flex-1">
                <div className={`flex items-center gap-2 ${isRightSide ? 'justify-end' : ''}`}>
                    <span className={`truncate text-sm font-bold ${strongText}`}>{player?.nickname ?? '선수 대기'}</span>
                    {isCurrentUser ? (
                        <span className="rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-100">나</span>
                    ) : null}
                    <span className={`whitespace-nowrap text-[12px] font-semibold ${mutedText}`}>
                        컨디션{' '}
                        <b className={`text-base tabular-nums ${conditionTone}`}>{displayCondition == null ? '-' : displayCondition}</b>
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
}> = ({ player, side, currentUserId, onViewUser }) => {
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
            ? 'text-red-300'
            : typeof effectiveCondition === 'number' && effectiveCondition >= 80
              ? 'text-emerald-300'
              : side === 'left'
                ? 'text-slate-100'
                : 'text-slate-50';
    const recordWins = player?.wins ?? 0;
    const recordLosses = player?.losses ?? 0;
    const toneClass =
        side === 'left'
            ? 'border-blue-400/40 bg-gradient-to-br from-slate-800 to-black text-blue-50'
            : 'border-rose-400/40 bg-gradient-to-br from-slate-800 to-black text-rose-50';
    const mutedText = 'text-slate-300';
    const strongText = 'text-slate-50';
    const isRightSide = side === 'right';
    const condDisplay = effectiveCondition == null ? '-' : effectiveCondition;

    return (
        <div
            className={`relative flex min-w-0 flex-1 items-center gap-1.5 rounded-md border px-1.5 py-1 ${toneClass} ${
                isRightSide ? 'flex-row-reverse text-right' : ''
            }`}
        >
            <button
                type="button"
                className={`shrink-0 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                onClick={clickable && player ? () => onViewUser(player.id) : undefined}
            >
                {player ? (
                    <Avatar userId={player.id} userName={player.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={44} />
                ) : (
                    <div className="h-11 w-11 shrink-0 rounded-full bg-slate-800" />
                )}
            </button>
            <div className="min-w-0 flex-1">
                <div className={`flex items-center gap-1 ${isRightSide ? 'justify-end' : ''}`}>
                    <span className={`truncate text-[11px] font-bold ${strongText}`}>{player?.nickname ?? '선수'}</span>
                    {isCurrentUser ? (
                        <span className="rounded bg-amber-400/18 px-1 py-0.5 text-[8px] font-black text-amber-100">나</span>
                    ) : null}
                </div>
                <div className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] ${isRightSide ? 'justify-end' : ''} ${mutedText}`}>
                    <span>
                        전적 <b className={`tabular-nums ${strongText}`}>{recordWins}승</b>{' '}
                        <b className="tabular-nums text-rose-200/85">{recordLosses}패</b>
                    </span>
                    <span className="whitespace-nowrap">
                        컨디션 <b className={`text-[12px] tabular-nums ${conditionTone}`}>{condDisplay}</b>
                    </span>
                </div>
            </div>
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
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = React.useState(false);
    const [duelModalOpen, setDuelModalOpen] = React.useState(false);
    const [kataBusy, setKataBusy] = React.useState(false);
    const [completedVersusMatch, setCompletedVersusMatch] = React.useState<Match | null>(null);
    const [kataResultOpen, setKataResultOpen] = React.useState(false);
    const [kataResultPayload, setKataResultPayload] = React.useState<{
        analysis: AnalysisResult;
        actorWon: boolean;
        actorVenueRatingBefore: number;
        actorVenueRatingAfter: number;
        actorVenueRatingDelta: number;
        champCoinsDelta: number;
        guildCoinsDelta: number;
    } | null>(null);
    const [duelSubmitting, setDuelSubmitting] = React.useState(false);
    const [oppRefreshFreeRemaining, setOppRefreshFreeRemaining] = React.useState(CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY);

    /** `useApp`이 매 렌더 새 `handlers` 객체를 만들므로, 의존성에 넣으면 GET이 무한 반복된다. */
    const handleActionRef = React.useRef(handlers.handleAction);
    handleActionRef.current = handlers.handleAction;

    /** 동일 유저·경기장에서 이미 성공적으로 받은 매칭 목록이 있으면 GET 재호출 생략(「새로고침」은 force로 무시). */
    const stableVersusListKeyRef = React.useRef<string | null>(null);

    const refreshOpponents = React.useCallback(async (opts?: { force?: boolean }) => {
        if (!CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST) {
            setOpponents(DEMO_OPPONENTS);
            setMyRating(RANKED_ELO_BASE_SCORE);
            setRatingSeasonKey(getCurrentSeason().name);
            setLoadError(null);
            setLoading(false);
            stableVersusListKeyRef.current = 'demo';
            setOppRefreshFreeRemaining(CHAMPIONSHIP_VERSUS_OPP_REFRESH_FREE_PER_DAY);
            return;
        }
        const uid = currentUserWithStatus?.id;
        if (!uid) return;

        const sessionKey = `${venue}:${uid}`;
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
            setOpponents(
                rows.map((r, i) => {
                    const league = (r.league as LeagueTier) || LeagueTier.Rookie;
                    const lv = Math.max(1, Math.floor(Number((r as { userLevel?: unknown }).userLevel) || 1));
                    const core = (r as any).coreStats as Record<string, number> | undefined;
                    if (core && typeof (r as any).totalGoPower === 'number') {
                        return { ...r, league, userLevel: lv } as OpponentRow;
                    }
                    return buildDemoOpponentRow(
                        {
                            userId: r.userId,
                            nickname: r.nickname,
                            avatarId: r.avatarId,
                            borderId: r.borderId,
                            league,
                            userLevel: lv,
                            rating: r.rating,
                            wins: r.wins,
                            losses: r.losses,
                        },
                        i + 1,
                    );
                }),
            );
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
            if (cur && opponents.some((o) => o.userId === cur)) return cur;
            return opponents[0].userId;
        });
    }, [opponents]);

    const onViewUser = React.useCallback(
        (id: string) => {
            if (id.startsWith('versus-demo-')) return;
            handlers.openViewingUser(id);
        },
        [handlers],
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

    React.useEffect(() => {
        setCompletedVersusMatch(null);
    }, [selectedRow?.userId, venue]);

    const p1 = React.useMemo(() => userToTournamentPlayer(user), [user]);
    const p2Seed = selectedRow ? opponents.indexOf(selectedRow) + 1 : 1;
    const p2 = React.useMemo(() => {
        if (!selectedRow) return opponentRowToTournamentPlayer(DEMO_OPPONENTS[0], 1);
        return opponentRowToTournamentPlayer(selectedRow, p2Seed);
    }, [selectedRow, p2Seed, opponents]);

    const p1Stats = calculateTotalStats(user, 'championshipVenue') as Record<string, number>;
    const p2Stats = p2.stats as Record<string, number>;
    const matchForDisplay = React.useMemo(() => buildVersusShellMatch(p1, p2), [p1, p2]);
    const matchForBoard = completedVersusMatch ?? matchForDisplay;

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

    const duelTickets = React.useMemo(() => {
        const raw = user.championshipVersusDuelTickets;
        const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX;
        return Math.max(0, Math.min(CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX, Math.floor(n)));
    }, [user.championshipVersusDuelTickets, user.id]);

    /** 장내 티어 점수(ELO) 높은 순 — 동점은 공동 순위(1,1,3…) */
    const opponentTierScoreRankByUserId = React.useMemo(() => {
        const m = new Map<string, number>();
        if (opponents.length === 0) return m;
        const sorted = [...opponents].sort((a, b) => b.rating - a.rating);
        let rank = 1;
        for (let i = 0; i < sorted.length; i++) {
            const row = sorted[i]!;
            if (i > 0 && row.rating < sorted[i - 1]!.rating) rank = i + 1;
            m.set(row.userId, rank);
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
        if (!selectedRow || kataBusy) return;
        setKataBusy(true);
        try {
            const res = (await handleActionKataRef.current({
                type: 'START_CHAMPIONSHIP_VERSUS_KATA_DUEL',
                payload: { venue, opponentUserId: selectedRow.userId },
            })) as Record<string, unknown> & { error?: string; clientResponse?: Record<string, unknown> };
            if (res?.error) throw new Error(String(res.error));
            const kd = (res.championshipVersusKataDuel ?? res.clientResponse?.championshipVersusKataDuel) as
                | {
                      match?: Match;
                      analysis?: AnalysisResult;
                      actorWon?: boolean;
                      actorVenueRatingBefore?: number;
                      actorVenueRatingAfter?: number;
                      actorVenueRatingDelta?: number;
                      champCoinsDelta?: number;
                      guildCoinsDelta?: number;
                  }
                | undefined;
            if (!kd?.match || !kd.analysis) throw new Error('응답 형식이 올바르지 않습니다.');
            setCompletedVersusMatch(JSON.parse(JSON.stringify(kd.match)) as Match);
            setKataResultPayload({
                analysis: kd.analysis,
                actorWon: !!kd.actorWon,
                actorVenueRatingBefore: typeof kd.actorVenueRatingBefore === 'number' ? kd.actorVenueRatingBefore : 0,
                actorVenueRatingAfter: typeof kd.actorVenueRatingAfter === 'number' ? kd.actorVenueRatingAfter : 0,
                actorVenueRatingDelta: typeof kd.actorVenueRatingDelta === 'number' ? kd.actorVenueRatingDelta : 0,
                champCoinsDelta: typeof kd.champCoinsDelta === 'number' ? kd.champCoinsDelta : 0,
                guildCoinsDelta: typeof kd.guildCoinsDelta === 'number' ? kd.guildCoinsDelta : 0,
            });
            setKataResultOpen(true);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : '경기 시작에 실패했습니다.';
            window.alert(msg);
        } finally {
            setKataBusy(false);
        }
    };

    const winCoinPreview = Math.max(0, Math.floor(myRating * 0.15));
    const lossCoinPreview = Math.max(0, Math.floor(myRating * 0.03));

    const championshipBoardHostClipClass = 'overflow-hidden';

    const championshipScoringCountdownPanel = (
        <div className="flex w-36 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-stone-600/80 bg-gradient-to-br from-gray-800 to-black px-3 py-2 text-center shadow-lg">
            <div className="text-[11px] font-bold tracking-wide text-amber-100">계가까지</div>
            <div className="mt-0.5 text-2xl font-black tabular-nums text-white">-/{180}</div>
            <div className="text-[10px] font-semibold text-slate-400">수 남음</div>
        </div>
    );

    const championshipPlayerRail =
        matchForBoard && (p1 || p2) ? (
            <div className="flex w-full flex-shrink-0 justify-center">
                <div className="min-w-0 w-full min-[1025px]:px-1 flex-1 px-2 pt-1">
                    <section className="flex min-h-[74px] shrink-0 flex-row items-stretch gap-2 overflow-hidden rounded-lg border-2 border-stone-500 bg-stone-800/95 p-2 shadow-xl">
                        <VersusRailPlayerCard player={p1} tone="blue" currentUserId={user.id} onViewUser={onViewUser} />
                        {championshipScoringCountdownPanel}
                        <VersusRailPlayerCard player={p2} tone="rose" currentUserId={user.id} onViewUser={onViewUser} />
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
                    시즌 종료까지 {seasonRemaining.days}일 {seasonRemaining.hours}시간 남음
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
                onClick={() => {
                    if (!selectedRow) return;
                    if (!CHAMPIONSHIP_VERSUS_VENUE_USE_LIVE_OPPONENT_LIST || selectedRow.userId.startsWith('versus-demo-')) {
                        setDuelModalOpen(true);
                        return;
                    }
                    void runVersusKataDuel();
                }}
                disabled={!selectedRow || duelTickets < 1 || kataBusy}
                colorScheme="none"
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-300/55 bg-gradient-to-b from-emerald-500/92 to-emerald-950/95 !px-3 !py-2.5 text-sm font-black text-emerald-50 shadow-md disabled:opacity-40 sm:!py-3 sm:!text-base"
            >
                {kataBusy ? (
                    <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-emerald-200 border-t-transparent sm:h-6 sm:w-6" />
                ) : (
                    <img src={resourceIcons.actionPlus} alt="" className="h-5 w-5 shrink-0 object-contain opacity-95 sm:h-6 sm:w-6" />
                )}
                경기 시작
            </Button>
            <Button
                type="button"
                onClick={() => replaceAppHash('#/tournament')}
                colorScheme="none"
                className={`flex min-h-[44px] flex-1 items-center justify-center !px-3 !py-2.5 !text-sm sm:!py-3 sm:!text-base ${championshipFooterExitButton}`}
                title="경기장을 나갑니다."
            >
                나가기
            </Button>
        </>
    );

    /** 우측 사이드바 상단: 시즌·내 정보·티어·점수·승패 코인·결투권 */
    const versusSidebarSelfSummary = (
        <section className="relative shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-slate-800/50 via-slate-950/90 to-black/95 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_28px_-14px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-amber-400/10">
            <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_70%_at_50%_-10%,rgba(251,191,36,0.08),transparent_50%)]"
                aria-hidden
            />
            <div className="relative space-y-3">
                <div className="text-center">
                    <p className="text-[10px] font-semibold tracking-wide text-amber-200/65">시즌</p>
                    <p className="mt-0.5 text-[11px] font-bold leading-snug text-slate-100">
                        <span className="font-black text-amber-100">{seasonName}</span>
                        <span className="mx-1 text-amber-200/45">·</span>
                        <span className="text-slate-300">
                            종료까지 {seasonRemaining.days}일 {seasonRemaining.hours}시간
                        </span>
                    </p>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-black/30 px-2 py-2 ring-1 ring-inset ring-white/[0.04]">
                    <Avatar userId={user.id} userName={user.nickname} size={48} avatarUrl={myAvatarUrl} borderUrl={myBorderUrl} />
                    <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-white">{user.nickname}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                            <span className="font-bold tabular-nums text-amber-100/90">Lv.{user.userLevel ?? 1}</span>
                            <span className="text-slate-500">|</span>
                            <span className="font-semibold text-cyan-100/85">{myTierName}</span>
                        </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-center gap-0.5">
                        <img
                            src={resolvePublicUrl(myTierIconUrl)}
                            alt=""
                            className="h-9 w-9 object-contain drop-shadow-md sm:h-10 sm:w-10"
                        />
                        <span className="text-lg font-black tabular-nums leading-none text-white sm:text-xl">{myRating}</span>
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">ELO</span>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1 rounded-lg border border-emerald-400/35 bg-emerald-950/25 px-2 py-1.5 shadow-inner">
                        <span className="text-[10px] font-black tracking-wide text-emerald-200/90">승리 시</span>
                        <div className="flex items-center gap-1.5">
                            <img src={specialResourceIcons.champCoins} alt="" className="h-5 w-5 object-contain" />
                            <span className="text-base font-black tabular-nums text-emerald-50">{winCoinPreview}</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg border border-slate-500/45 bg-black/35 px-2 py-1.5 shadow-inner">
                        <span className="text-[10px] font-black tracking-wide text-slate-400">패배 시</span>
                        <div className="flex items-center gap-1.5">
                            <img src={specialResourceIcons.champCoins} alt="" className="h-5 w-5 object-contain opacity-90" />
                            <span className="text-base font-black tabular-nums text-slate-100">{lossCoinPreview}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-full border border-amber-400/35 bg-gradient-to-r from-amber-500/12 via-black/40 to-black/60 px-3 py-1.5 shadow-inner ring-1 ring-amber-300/12">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200/75">결투권</span>
                    <span className="flex items-center gap-1.5 text-[12px] font-black tabular-nums text-amber-50">
                        <img src={resourceIcons.actionPlus} alt="" className="h-4 w-4 object-contain opacity-95" />
                        {duelTickets}/{CHAMPIONSHIP_VERSUS_DUEL_TICKETS_MAX}
                    </span>
                </div>
            </div>
        </section>
    );

    const versusSidebarFooterActions = (
        <div className="flex w-full shrink-0 gap-2 border-t border-white/[0.08] bg-gradient-to-t from-black/55 via-slate-950/90 to-transparent px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5">
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
                                        player={p1}
                                        stats={p1Stats}
                                        match={matchForBoard}
                                        currentPhase="none"
                                        tone="blue"
                                        sideLabel="챔피언십 능력치"
                                        abilityKataLadder={CHAMPIONSHIP_ABILITY_KATA_LADDER}
                                    />
                                    <div
                                        className={`relative flex h-full min-h-0 min-w-0 flex-1 items-center justify-center bg-transparent p-0 ${championshipBoardHostClipClass}`}
                                    >
                                        <ChampionshipRealGoBoard
                                            match={matchForBoard}
                                            currentUser={user}
                                            tournamentFinished={!!completedVersusMatch?.isFinished}
                                            tournamentForResult={null}
                                            dungeonBoardCenterMode="players_entering"
                                            finalStandings={null}
                                        />
                                    </div>
                                    <ChampionshipAbilityPlayerPanel
                                        player={p2}
                                        stats={p2Stats}
                                        match={matchForBoard}
                                        currentPhase="none"
                                        tone="rose"
                                        sideLabel="챔피언십 능력치"
                                        abilityKataLadder={CHAMPIONSHIP_ABILITY_KATA_LADDER}
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
        (player: PlayerForTournament | null, stats: Record<string, number>, tone: 'blue' | 'rose') => {
            const activePhaseKey: 'opening' | 'midgame' | 'endgame' | null = null;
            const accentTone =
                tone === 'blue'
                    ? 'border-blue-300/45 bg-gradient-to-br from-[#172c48] via-[#0e1b2d] to-[#050911]'
                    : 'border-rose-300/45 bg-gradient-to-br from-[#481724] via-[#250d15] to-[#090406]';
            const valueColor = tone === 'blue' ? 'text-blue-50' : 'text-rose-50';
            const metaPly = (phase: (typeof MOBILE_PHASE_META)[number]) => phase.ply19;
            return (
                <div className={`flex min-w-0 flex-1 flex-col gap-1 rounded-md border ${accentTone} p-1`}>
                    <div className="grid grid-cols-3 gap-x-0.5 gap-y-0.5">
                        {[
                            CoreStat.Concentration,
                            CoreStat.ThinkingSpeed,
                            CoreStat.Judgment,
                            CoreStat.Calculation,
                            CoreStat.CombatPower,
                            CoreStat.Stability,
                        ].map((stat) => (
                            <div
                                key={stat}
                                className="flex items-baseline justify-between gap-0.5 rounded bg-black/35 px-1 py-0.5 text-[9px] leading-none"
                            >
                                <span className="truncate text-slate-400">{stat}</span>
                                <span className={`text-[10px] font-bold tabular-nums ${valueColor}`}>{Math.round(stats?.[stat] ?? 0)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-0.5">
                        {MOBILE_PHASE_META.map((phase) => {
                            const ply = metaPly(phase);
                            const fromSnapshot = player?.id
                                ? matchForBoard?.championshipRealGame?.phaseStatsByPlayerId?.[player.id]?.[phase.key]
                                : undefined;
                            const level = championshipKataLevelForPly(ply, stats as any, undefined, CHAMPIONSHIP_ABILITY_KATA_LADDER);
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
        },
        [matchForBoard],
    );

    const mobileChampionshipPlayerInfoRow =
        matchForBoard && (p1 || p2) ? (
            <section className="flex shrink-0 flex-row items-stretch gap-1 rounded-md border border-stone-500/70 bg-stone-900/48 p-1 shadow-md backdrop-blur-md">
                <VersusMobilePureInfoCard player={p1} side="left" currentUserId={user.id} onViewUser={onViewUser} />
                <VersusMobilePureInfoCard player={p2} side="right" currentUserId={user.id} onViewUser={onViewUser} />
            </section>
        ) : null;

    const mobileChampionshipAbilityRow =
        matchForBoard && (p1 || p2) ? (
            <section className="flex shrink-0 flex-row items-stretch gap-1 rounded-md border border-slate-700/45 bg-gradient-to-b from-[#111827]/55 to-[#070b12]/62 p-1 shadow-md backdrop-blur-md">
                {renderMobileChampionshipAbilityPanel(p1, p1Stats, 'blue')}
                {renderMobileChampionshipAbilityPanel(p2, p2Stats, 'rose')}
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
                dungeonBoardCenterMode="players_entering"
                finalStandings={null}
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
                {mobileChampionshipBoardSection}
            </div>
        </main>
    );

    const opponentSidebarInner = (
        <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden px-1.5 pb-0.5 text-slate-100">
            <div className="shrink-0">{versusSidebarSelfSummary}</div>

            <div className="shrink-0 border-b border-white/[0.07] px-1 pb-2 pt-0.5">
                <h3 className="text-center text-[15px] font-black tracking-tight text-white">상대 선수</h3>
                <p className="mt-0.5 text-center text-[10px] font-medium text-slate-500">장내 ELO 기준 추천 5인</p>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden py-2">
                    <div className="flex w-full max-w-[17.5rem] flex-col gap-0 overflow-y-auto overflow-x-hidden [scrollbar-color:rgba(148,163,184,0.35)_transparent] [scrollbar-width:thin] sm:max-w-[18.5rem]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400">
                                <div className="h-9 w-9 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-300" />
                                <span className="text-xs font-medium tracking-wide text-slate-400">매칭 목록 불러오는 중</span>
                            </div>
                        ) : loadError ? (
                            <div className="rounded-xl border border-rose-500/35 bg-rose-950/35 px-3 py-3 text-center text-xs leading-relaxed text-rose-100 shadow-inner ring-1 ring-rose-400/15">
                                {loadError}
                            </div>
                        ) : opponents.length === 0 ? (
                            <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-8 text-center text-xs text-slate-500 ring-1 ring-inset ring-white/[0.04]">
                                표시할 상대가 없습니다.
                            </div>
                        ) : (
                            <ul className="flex list-none flex-col gap-2.5 p-0">
                                {opponents.map((o) => {
                                    const selected = (selectedId ?? opponents[0]?.userId) === o.userId;
                                    const demoRow = o.userId.startsWith('versus-demo-');
                                    const oAvatar = AVATAR_POOL.find((a) => a.id === o.avatarId)?.url;
                                    const profileSrc = resolvePublicUrl(oAvatar || '/images/profiles/profile1.webp');
                                    const tierIcon = resolvePublicUrl(tierIconUrlForVersusRow(o));
                                    return (
                                        <li key={o.userId} className="w-full">
                                            <div
                                                className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 ${
                                                    selected
                                                        ? 'border-amber-400/55 bg-gradient-to-br from-amber-950/50 via-slate-950/92 to-black shadow-[0_10px_36px_-12px_rgba(245,158,11,0.22),inset_0_1px_0_rgba(255,255,255,0.08)] ring-2 ring-amber-400/20'
                                                        : 'border-white/[0.07] bg-gradient-to-br from-slate-800/55 via-slate-950/90 to-black/95 shadow-[0_6px_28px_-14px_rgba(0,0,0,0.75)] ring-1 ring-inset ring-white/[0.04] hover:border-amber-300/25 hover:shadow-[0_10px_32px_-14px_rgba(245,158,11,0.12)]'
                                                }`}
                                            >
                                                <div
                                                    className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-20%,rgba(251,191,36,0.07),transparent_55%)] opacity-90"
                                                    aria-hidden
                                                />
                                                <div
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => setSelectedId(o.userId)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            setSelectedId(o.userId);
                                                        }
                                                    }}
                                                    className="relative z-[1] flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 sm:gap-3 sm:px-3.5 sm:py-3"
                                                >
                                                    <span
                                                        className="flex h-10 w-8 shrink-0 items-center justify-center rounded-full border border-amber-400/35 bg-gradient-to-b from-amber-500/25 via-amber-950/40 to-black text-sm font-black tabular-nums text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ring-1 ring-black/50 sm:h-11 sm:w-9 sm:text-base"
                                                        title="장내 티어 점수(ELO) 순위"
                                                    >
                                                        {opponentTierScoreRankByUserId.get(o.userId) ?? '—'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className="relative z-[2] flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-white/15 bg-slate-950 p-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_8px_rgba(0,0,0,0.5)] ring-1 ring-black/50 transition hover:border-amber-400/45 hover:shadow-[0_0_0_1px_rgba(251,191,36,0.25)] active:scale-[0.96] sm:h-11 sm:w-11"
                                                        title={demoRow ? '프로필' : `${o.nickname} 프로필 보기`}
                                                        aria-label={demoRow ? '프로필' : `${o.nickname} 프로필 보기`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (demoRow) setSelectedId(o.userId);
                                                            else handlers.openViewingUser(o.userId);
                                                        }}
                                                    >
                                                        <img src={profileSrc} alt="" className="h-full w-full object-cover" loading="lazy" />
                                                    </button>
                                                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/50 p-0.5 shadow-inner ring-1 ring-inset ring-white/[0.05] sm:h-11 sm:w-11">
                                                        <img src={tierIcon} alt="" className="h-full w-full object-contain drop-shadow-md" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex min-w-0 items-baseline gap-1.5">
                                                            <span className="shrink-0 rounded bg-black/35 px-1 py-0.5 text-[10px] font-black tabular-nums text-amber-100/95 ring-1 ring-amber-400/20 sm:text-[11px]">
                                                                Lv.{o.userLevel}
                                                            </span>
                                                            <span className="truncate text-sm font-bold tracking-tight text-white group-hover:text-amber-50/95">
                                                                {o.nickname}
                                                            </span>
                                                        </div>
                                                        <div className="mt-0.5 text-[10.5px] font-semibold tabular-nums text-cyan-200/80 sm:text-[11.5px]">
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

                        <div className="mt-3 w-full shrink-0 border-t border-white/[0.07] pt-3">
                            <Button
                                type="button"
                                colorScheme="none"
                                disabled={loading}
                                onClick={() => void refreshOpponents({ force: true })}
                                className="!flex w-full !items-center !justify-center gap-2 !rounded-xl !border !border-amber-400/30 !bg-gradient-to-b !from-slate-700/50 !via-slate-900/80 !to-black !py-2.5 !text-xs !font-bold !text-amber-50 !shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_24px_-12px_rgba(0,0,0,0.85)] !ring-1 !ring-inset !ring-white/10 transition hover:!border-amber-300/50 hover:!brightness-110 active:!scale-[0.99] disabled:!opacity-45 sm:!py-3 sm:!text-[13px]"
                            >
                                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-amber-300/40 text-[10px] leading-none text-amber-200">
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
                        className={`relative max-h-full min-h-0 flex-shrink-0 self-stretch transition-[width] duration-200 ${
                            isRightSidebarCollapsed ? 'w-0' : 'w-[320px] xl:w-[360px]'
                        }`}
                    >
                        {!isRightSidebarCollapsed && (
                            <div className="relative flex h-full max-h-full min-h-0 items-stretch overflow-hidden rounded-2xl border border-amber-500/38 bg-gradient-to-b from-[#222b3b] via-[#111827] to-[#050608] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.075),0_20px_52px_-18px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-amber-300/10">
                                <div
                                    className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/35 to-transparent"
                                    aria-hidden
                                />
                                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{opponentSidebarInner}</div>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsRightSidebarCollapsed((prev) => !prev)}
                            className="absolute top-1/2 -left-6 z-[120] flex h-9 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-slate-600/80 bg-slate-900/90 text-gray-300 transition-colors hover:bg-slate-800/90 hover:text-white"
                            title={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                            aria-label={isRightSidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
                        >
                            <span className="text-sm font-bold leading-none">{isRightSidebarCollapsed ? '<' : '>'}</span>
                        </button>
                    </div>
                )}

                {isMobile && (
                    <>
                        <div
                            className={`fixed right-0 z-50 flex w-[280px] flex-col overflow-hidden bg-gradient-to-b from-[#222b3b] via-[#111827] to-[#050608] shadow-2xl transition-transform duration-300 ease-in-out ${isMobileSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
                            style={{
                                top: 'env(safe-area-inset-top, 0px)',
                                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 4.5rem)',
                            }}
                        >
                            <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
                                <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-950 px-3 py-2">
                                    <span className="text-sm font-bold text-amber-100">중계 · 대진표</span>
                                    <button
                                        type="button"
                                        onClick={() => setIsMobileSidebarOpen(false)}
                                        className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200"
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

            {isMobile && !isMobileSidebarOpen ? (
                <div className="pointer-events-auto fixed bottom-0 left-0 right-0 z-[35] flex gap-2 border-t border-white/10 bg-gradient-to-t from-black via-slate-950 to-slate-900/98 px-2 py-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.55)]">
                    {versusPrimaryActions}
                </div>
            ) : null}

            {isMobile && !isMobileSidebarOpen && (
                <button
                    type="button"
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="fixed top-1/2 right-0 z-30 flex h-24 w-9 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-l-xl border border-r-0 border-amber-300/55 bg-slate-950/95 text-amber-100 shadow-2xl active:translate-x-0.5"
                    aria-label="중계 및 대진표 열기"
                    title="중계 및 대진표 열기"
                >
                    <span className="text-base font-black leading-none">‹</span>
                    <span className="text-[10px] font-bold leading-tight">중계</span>
                    <span className="text-[10px] font-bold leading-tight">대진표</span>
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
                            className="max-w-md w-full rounded-2xl border border-amber-400/40 bg-gradient-to-b from-slate-900 via-slate-950 to-black p-5 shadow-2xl ring-1 ring-amber-300/15"
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
            {kataResultOpen &&
                kataResultPayload &&
                typeof document !== 'undefined' &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[460] flex items-center justify-center bg-black/75 p-3 sm:p-4"
                        role="dialog"
                        aria-modal="true"
                        onClick={() => setKataResultOpen(false)}
                    >
                        <div
                            className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-500/50 bg-gradient-to-b from-slate-900 via-slate-950 to-black p-4 shadow-2xl ring-1 ring-white/10 sm:p-5"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 className="text-center text-lg font-black text-amber-100 sm:text-xl">경기 결과</h2>
                            <p
                                className={`mt-2 text-center text-base font-black sm:text-lg ${
                                    kataResultPayload.actorWon ? 'text-emerald-300' : 'text-rose-300'
                                }`}
                            >
                                {kataResultPayload.actorWon ? '승리' : '패배'}
                            </p>
                            {(() => {
                                const sd = kataResultPayload.analysis.scoreDetails;
                                if (!sd) {
                                    return (
                                        <p className="mt-4 text-center text-sm text-slate-400">점수 상세를 불러오지 못했습니다.</p>
                                    );
                                }
                                const rowClass = 'flex min-w-0 justify-between gap-2 text-xs sm:text-[0.8125rem]';
                                const labelClass = 'shrink-0 whitespace-nowrap text-slate-400';
                                const valClass = 'tabular-nums text-right font-medium text-slate-100';
                                return (
                                    <div className="mt-4 space-y-2">
                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                            <div className="space-y-0.5 rounded-md bg-gray-800/50 px-2 py-1.5">
                                                <h3 className="mb-0.5 text-center text-[0.7rem] font-bold sm:text-xs">흑</h3>
                                                <div className={rowClass}>
                                                    <span className={labelClass}>영토</span>
                                                    <span className={valClass}>{sd.black.territory.toFixed(0)}</span>
                                                </div>
                                                <div className={rowClass}>
                                                    <span className={labelClass}>따낸 돌</span>
                                                    <span className={valClass}>{sd.black.liveCaptures ?? 0}</span>
                                                </div>
                                                <div className={rowClass}>
                                                    <span className={labelClass}>사석</span>
                                                    <span className={valClass}>{Math.round(Number(sd.black.deadStones ?? 0))}</span>
                                                </div>
                                                <div className={`${rowClass} border-t border-gray-600 pt-1 text-sm font-bold`}>
                                                    <span className="shrink-0 whitespace-nowrap">총점</span>
                                                    <span className="tabular-nums text-yellow-300">{sd.black.total.toFixed(1)}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-0.5 rounded-md bg-gray-800/50 px-2 py-1.5">
                                                <h3 className="mb-0.5 text-center text-[0.7rem] font-bold sm:text-xs">백</h3>
                                                <div className={rowClass}>
                                                    <span className={labelClass}>영토</span>
                                                    <span className={valClass}>{sd.white.territory.toFixed(0)}</span>
                                                </div>
                                                <div className={rowClass}>
                                                    <span className={labelClass}>따낸 돌</span>
                                                    <span className={valClass}>{sd.white.liveCaptures ?? 0}</span>
                                                </div>
                                                <div className={rowClass}>
                                                    <span className={labelClass}>사석</span>
                                                    <span className={valClass}>{Math.round(Number(sd.white.deadStones ?? 0))}</span>
                                                </div>
                                                <div className={rowClass}>
                                                    <span className={labelClass}>덤</span>
                                                    <span className={valClass}>{sd.white.komi}</span>
                                                </div>
                                                <div className={`${rowClass} border-t border-gray-600 pt-1 text-sm font-bold`}>
                                                    <span className="shrink-0 whitespace-nowrap">총점</span>
                                                    <span className="tabular-nums text-yellow-300">{sd.white.total.toFixed(1)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                            <div className="mt-5 space-y-2 rounded-lg border border-slate-600/60 bg-black/35 px-3 py-2.5 text-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-bold text-slate-300">시즌 랭킹 점수 (장)</span>
                                    <span className="tabular-nums font-black text-white">
                                        {kataResultPayload.actorVenueRatingBefore} → {kataResultPayload.actorVenueRatingAfter}
                                        <span
                                            className={
                                                kataResultPayload.actorVenueRatingDelta >= 0 ? ' text-emerald-300' : ' text-rose-300'
                                            }
                                        >
                                            {' '}
                                            ({kataResultPayload.actorVenueRatingDelta >= 0 ? '+' : ''}
                                            {kataResultPayload.actorVenueRatingDelta})
                                        </span>
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-bold text-slate-300">챔피언십 코인</span>
                                    <span className="flex items-center gap-1.5 font-black tabular-nums text-emerald-200">
                                        <img src={specialResourceIcons.champCoins} alt="" className="h-5 w-5 object-contain" />+
                                        {kataResultPayload.champCoinsDelta}
                                    </span>
                                </div>
                                {kataResultPayload.guildCoinsDelta > 0 ? (
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="font-bold text-slate-300">길드 코인</span>
                                        <span className="font-black tabular-nums text-amber-200">
                                            +{kataResultPayload.guildCoinsDelta}
                                        </span>
                                    </div>
                                ) : (
                                    <p className="text-[11px] text-slate-500">길드 미가입 시 길드 코인은 지급되지 않습니다.</p>
                                )}
                            </div>
                            <div className="mt-5 flex justify-center">
                                <Button
                                    type="button"
                                    colorScheme="none"
                                    className="!px-6 !py-2.5 text-sm font-bold"
                                    onClick={() => setKataResultOpen(false)}
                                >
                                    확인
                                </Button>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
};

export default ChampionshipVersusVenueArena;
