import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { User, UserWithStatus, GameMode } from '../../types.js';
import Avatar from '../Avatar.js';
import { RANKING_TIERS, AVATAR_POOL, BORDER_POOL } from '../../constants';
import { readStrategicRankedBlock, readPairRankedBlock } from '../../shared/utils/unifiedRankedStatsMigration.js';
import { RANKED_ELO_BASE_SCORE } from '../../shared/constants/rules.js';
import { RANKING_MODAL_SLIM_SCROLL_Y } from '../../shared/constants/rankingModalScrollbar.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useRanking } from '../../hooks/useRanking.js';
import Button from '../Button.js';

interface RankingListProps {
    currentUser: UserWithStatus;
    mode: GameMode | 'strategic' | 'playful';
    onViewUser: (userId: string) => void;
    onShowTierInfo: () => void;
    onShowPastRankings: (info: { user: UserWithStatus; mode: GameMode | 'strategic' | 'pair' }) => void;
    lobbyType: 'strategic' | 'pair';
    /** 네이티브 전략·놀이 대기실: 페어 경기장 모바일과 유사한 글자 크기 */
    pairAlignedNativeCompact?: boolean;
    /** 랭킹 모달 등 상·하 분할: 패딩·타이틀·행 간격을 더 촘촘히 */
    splitStack?: boolean;
}

const getTier = (score: number, rank: number, totalGames: number) => {
    for (const tier of RANKING_TIERS) {
        if (tier.threshold(score, rank, totalGames)) {
            return tier;
        }
    }
    return RANKING_TIERS[RANKING_TIERS.length - 1];
};

const getCurrentSeasonName = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = now.getMonth(); // 0-11
    let season;
    if (month < 3) season = 1;      // Jan, Feb, Mar
    else if (month < 6) season = 2; // Apr, May, Jun
    else if (month < 9) season = 3; // Jul, Aug, Sep
    else season = 4;                // Oct, Nov, Dec
    return `${year}-${season}시즌`;
};


const RankingList: React.FC<RankingListProps> = ({
    currentUser,
    mode,
    onViewUser,
    onShowTierInfo,
    onShowPastRankings,
    lobbyType,
    pairAlignedNativeCompact = false,
    splitStack = false,
}) => {
    const rankingType = lobbyType === 'pair' ? 'pair' : 'strategic';
    /** 페어 시즌 랭킹은 최소 대국 수 기준이 전략과 다를 수 있음 */
    const minGamesForTierList = lobbyType === 'pair' ? 5 : 10;
    // 대기실·랭킹 모달: 시즌별 티어 랭킹 점수 (매 시즌 시작일에 1200점 부여, 랭킹전을 통해 얻거나 잃은 점수)
    const { rankings, loading, error, total } = useRanking(rankingType, undefined, undefined, true);
    
    const allRankedUsers = useMemo(() => {
        return rankings.map(entry => ({
            id: entry.id,
            nickname: entry.nickname,
            avatarId: entry.avatarId,
            borderId: entry.borderId,
            avgScore: entry.score,
            rank: entry.rank,
            totalGames: entry.totalGames,
            wins: entry.wins,
            losses: entry.losses,
            league: entry.league,
            userLevel: entry.userLevel,
            // User 타입 호환성을 위한 더미 필드
            stats: {} as any,
            dailyRankings: {} as any
        }));
    }, [rankings]);

    const eligibleRankedUsers = allRankedUsers.filter(u => u.totalGames >= minGamesForTierList);
    const totalEligiblePlayers = eligibleRankedUsers.length;
    const sproutTier = RANKING_TIERS[RANKING_TIERS.length - 1];

    const myRankIndex = allRankedUsers.findIndex(u => u.id === currentUser.id);

    /** API 목록에 없어도 내 랭킹 블록 표시(랭킹전 최소 판수 미만은 대시 플레이스홀더) */
    const myRankDataResolved = useMemo(() => {
        if (myRankIndex !== -1) {
            const row = allRankedUsers[myRankIndex];
            return {
                user: row,
                rank: row.rank || myRankIndex + 1,
                score: row.avgScore,
                dashPlaceholder: false as const,
            };
        }
        const u = currentUser;
        if (lobbyType === 'pair') {
            const pairBlk = readPairRankedBlock(
                (u.stats ?? {}) as Record<string, { wins?: number; losses?: number; rankingScore?: number }>,
            );
            const wins = pairBlk.wins;
            const losses = pairBlk.losses;
            const totalGames = wins + losses;
            const pairDr = u.dailyRankings?.pair;
            /** API·랭킹 행과 동일: 시즌 점수 = 기준(1200) + dailyRankings에 저장된 델타 */
            const seasonScore =
                pairDr && typeof pairDr.rank === 'number'
                    ? RANKED_ELO_BASE_SCORE + (typeof pairDr.score === 'number' ? pairDr.score : 0)
                    : pairBlk.rankingScore;
            const rank = eligibleRankedUsers.filter((x) => x.avgScore > seasonScore).length + 1;
            const dashPlaceholder = totalGames < minGamesForTierList;
            return {
                user: {
                    id: u.id,
                    nickname: u.nickname,
                    avatarId: u.avatarId,
                    borderId: u.borderId,
                    avgScore: seasonScore,
                    rank,
                    totalGames,
                    wins,
                    losses,
                    userLevel: typeof u.userLevel === 'number' ? u.userLevel : undefined,
                    stats: {} as any,
                    dailyRankings: {} as any,
                },
                rank,
                score: seasonScore,
                dashPlaceholder,
            };
        }
        if (lobbyType === 'strategic') {
            const blk = readStrategicRankedBlock(u.stats as Record<string, { wins?: number; losses?: number; rankingScore?: number }>);
            const wins = blk.wins;
            const losses = blk.losses;
            const totalGames = wins + losses;
            const strategicDr = u.dailyRankings?.strategic;
            /** API·랭킹 행과 동일: 시즌 점수 = 기준(1200) + dailyRankings에 저장된 델타 */
            const seasonScore =
                strategicDr && typeof strategicDr.rank === 'number'
                    ? RANKED_ELO_BASE_SCORE + (typeof strategicDr.score === 'number' ? strategicDr.score : 0)
                    : blk.rankingScore;
            const rank = eligibleRankedUsers.filter((x) => x.avgScore > seasonScore).length + 1;
            const dashPlaceholder = totalGames < minGamesForTierList;
            return {
                user: {
                    id: u.id,
                    nickname: u.nickname,
                    avatarId: u.avatarId,
                    borderId: u.borderId,
                    avgScore: seasonScore,
                    rank,
                    totalGames,
                    wins,
                    losses,
                    userLevel: typeof u.userLevel === 'number' ? u.userLevel : undefined,
                    stats: {} as any,
                    dailyRankings: {} as any,
                },
                rank,
                score: seasonScore,
                dashPlaceholder,
            };
        }
        return null;
    }, [
        myRankIndex,
        allRankedUsers,
        currentUser,
        lobbyType,
        minGamesForTierList,
        eligibleRankedUsers,
    ]);

    // 페이지네이션: 초기 30명, 스크롤 시 20명씩 추가
    const INITIAL_DISPLAY = 30;
    const LOAD_MORE_COUNT = 20;
    const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY);
    const loadMoreRef = useRef<HTMLLIElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        // displayCount가 변경되면 observer 재설정
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        if (loadMoreRef.current && displayCount < allRankedUsers.length) {
            observerRef.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting) {
                        setDisplayCount(prev => Math.min(prev + LOAD_MORE_COUNT, allRankedUsers.length));
                    }
                },
                { threshold: 0.1 }
            );
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [displayCount, allRankedUsers.length]);

    // 탭 변경 시 displayCount 리셋
    useEffect(() => {
        setDisplayCount(INITIAL_DISPLAY);
    }, [lobbyType]);

    const topUsers = allRankedUsers.slice(0, displayCount);

    const getTierForUser = useCallback((user: { id: string; avgScore: number; totalGames: number }) => {
        let rankAmongEligible = eligibleRankedUsers.findIndex((e) => e.id === user.id) + 1;
        if (rankAmongEligible === 0 && user.totalGames >= minGamesForTierList) {
            rankAmongEligible = eligibleRankedUsers.filter((e) => e.avgScore > user.avgScore).length + 1;
        }
        if (rankAmongEligible === 0) {
            return sproutTier;
        }

        return getTier(user.avgScore, rankAmongEligible, user.totalGames);
    }, [eligibleRankedUsers, sproutTier, minGamesForTierList]);


    /** 전략·페어 시즌 랭킹: 아바타 옆 정보 한 줄·큰 글자 */
    const seasonalBadukInlineLayout = lobbyType === 'strategic' || lobbyType === 'pair';

    const renderRankItem = useCallback(
        (
            user: {
                id: string;
                nickname: string;
                avatarId: string;
                borderId: string;
                avgScore: number;
                totalGames: number;
                wins: number;
                losses: number;
                userLevel?: number;
            },
            rank: number,
            isMyRankDisplay: boolean,
            dashPlaceholder = false,
        ) => {
        const wins = user.wins || 0;
        const losses = user.losses || 0;
        const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
        const score = user.avgScore;
        const tier = getTierForUser(user);
        const displayLevel =
            user.userLevel != null && Number.isFinite(Number(user.userLevel))
                ? Math.max(1, Math.floor(Number(user.userLevel)))
                : user.id === currentUser.id
                  ? Math.max(1, Math.floor(Number(currentUser.userLevel) || 1))
                  : null;
        
        const isCurrentUserInList = !isMyRankDisplay && user.id === currentUser.id;
        const isTopThree = rank <= 3 && !isMyRankDisplay;
        
        // 상위 3위에 대한 특별한 스타일링
        const getRankStyle = () => {
            if (isMyRankDisplay) {
                return {
                    container: 'group relative overflow-hidden bg-gradient-to-r from-yellow-900/50 via-amber-900/40 to-yellow-900/50 border-2 border-yellow-500/60 shadow-[0_4px_20px_rgba(234,179,8,0.3)]',
                    rankText: 'text-yellow-400 font-bold',
                    glow: 'absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-transparent to-yellow-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                };
            }
            if (rank === 1) {
                return {
                    container: 'group relative overflow-hidden bg-gradient-to-r from-amber-900/40 via-yellow-900/30 to-amber-900/40 border-2 border-amber-400/70 shadow-[0_4px_20px_rgba(251,191,36,0.4)]',
                    rankText: 'text-amber-300 font-bold text-lg',
                    glow: 'absolute inset-0 bg-gradient-to-r from-amber-500/30 via-transparent to-amber-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                };
            }
            if (rank === 2) {
                return {
                    container: 'group relative overflow-hidden bg-gradient-to-r from-slate-700/40 via-slate-600/30 to-slate-700/40 border-2 border-slate-400/70 shadow-[0_4px_20px_rgba(148,163,184,0.3)]',
                    rankText: 'text-slate-300 font-bold text-lg',
                    glow: 'absolute inset-0 bg-gradient-to-r from-slate-400/20 via-transparent to-slate-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                };
            }
            if (rank === 3) {
                return {
                    container: 'group relative overflow-hidden bg-gradient-to-r from-orange-900/40 via-amber-900/30 to-orange-900/40 border-2 border-orange-500/70 shadow-[0_4px_20px_rgba(249,115,22,0.3)]',
                    rankText: 'text-orange-300 font-bold text-lg',
                    glow: 'absolute inset-0 bg-gradient-to-r from-orange-500/20 via-transparent to-orange-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                };
            }
            if (isCurrentUserInList) {
                return {
                    container: 'group relative overflow-hidden bg-gradient-to-r from-blue-900/50 via-indigo-900/40 to-blue-900/50 border-2 border-blue-500/60 shadow-[0_4px_15px_rgba(59,130,246,0.3)]',
                    rankText: 'text-blue-300 font-semibold',
                    glow: 'absolute inset-0 bg-gradient-to-r from-blue-500/20 via-transparent to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
                };
            }
            return {
                container: 'group relative overflow-hidden bg-gradient-to-br from-gray-800/40 via-gray-900/30 to-gray-800/40 border border-gray-700/50 shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:border-gray-600/70 hover:shadow-[0_4px_12px_rgba(0,0,0,0.4)]',
                rankText: 'text-gray-300 font-semibold',
                glow: 'absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300'
            };
        };

        const rankStyle = getRankStyle();
        const isClickable = !isMyRankDisplay && user.id !== currentUser.id;
        const avatarUrl = AVATAR_POOL.find(a => a.id === user.avatarId)?.url;
        const borderUrl = BORDER_POOL.find(b => b.id === user.borderId)?.url;
        
        const rankSmall = pairAlignedNativeCompact || splitStack;

        // 랭킹 표시 아이콘 (메달·숫자 크기)
        const rankDisplay = () => {
            const medalSeasonal = rankSmall
                ? 'text-3xl leading-none sm:text-4xl'
                : 'text-4xl leading-none sm:text-5xl';
            const medalLegacy = rankSmall ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl';
            const numSeasonal = rankSmall
                ? 'text-base sm:text-lg tabular-nums'
                : 'text-lg sm:text-xl lg:text-2xl tabular-nums';
            const numLegacy = rankSmall ? 'text-xs sm:text-sm' : 'text-sm sm:text-base';

            if (dashPlaceholder) {
                return (
                    <span className={`${rankStyle.rankText} ${seasonalBadukInlineLayout ? numSeasonal : numLegacy} tabular-nums`}>-</span>
                );
            }

            if (rank === 1) {
                return (
                    <span className={seasonalBadukInlineLayout ? medalSeasonal : medalLegacy} role="img" aria-label="Gold Medal">
                        🥇
                    </span>
                );
            }
            if (rank === 2) {
                return (
                    <span className={seasonalBadukInlineLayout ? medalSeasonal : medalLegacy} role="img" aria-label="Silver Medal">
                        🥈
                    </span>
                );
            }
            if (rank === 3) {
                return (
                    <span className={seasonalBadukInlineLayout ? medalSeasonal : medalLegacy} role="img" aria-label="Bronze Medal">
                        🥉
                    </span>
                );
            }
            return (
                <span className={`${rankStyle.rankText} ${seasonalBadukInlineLayout ? numSeasonal : numLegacy}`}>
                    {rank}
                </span>
            );
        };

        const winRateClass =
            winRate >= 60 ? 'text-green-400' : winRate >= 50 ? 'text-yellow-400' : 'text-gray-400';

        if (seasonalBadukInlineLayout) {
            const rowPad = rankSmall ? 'gap-1.5 p-1.5 sm:gap-2 sm:p-2' : 'gap-2 p-2 sm:gap-2.5 sm:p-2.5';
            const tierIconCls = rankSmall ? 'h-9 w-9 sm:h-10 sm:w-10' : 'h-11 w-11 sm:h-12 sm:w-12';
            const avatarSz = rankSmall ? (isTopThree ? 40 : 38) : isTopThree ? 48 : 46;
            const lineCls = rankSmall
                ? 'text-xs sm:text-sm'
                : 'text-sm sm:text-base lg:text-lg';

            return (
                <li
                    key={user.id}
                    className={`flex min-w-0 items-center ${rowPad} rounded-lg transition-all duration-300 ${rankStyle.container} ${isClickable ? 'cursor-pointer hover:scale-[1.01] hover:-translate-y-0.5' : ''}`}
                    onClick={isClickable ? () => onViewUser(user.id) : undefined}
                    title={isClickable ? `${user.nickname} 프로필 보기` : ''}
                >
                    <div className={rankStyle.glow} />
                    <div
                        className={`relative z-10 flex shrink-0 items-center justify-center ${
                            rankSmall ? 'w-10 sm:w-11' : 'w-12 sm:w-14'
                        }`}
                    >
                        {rankDisplay()}
                    </div>
                    <div
                        className={`relative z-10 flex shrink-0 flex-col items-center ${
                            rankSmall ? 'w-[3.5rem] sm:w-[3.75rem]' : 'w-[3.75rem] sm:w-16'
                        }`}
                    >
                        <div className="relative flex justify-center">
                            <img
                                src={tier.icon}
                                alt={tier.name}
                                className={`flex-shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-105 ${tierIconCls}`}
                                title={tier.name}
                            />
                            {(isTopThree || isMyRankDisplay) && (
                                <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-br from-white/20 to-transparent blur-sm" />
                            )}
                        </div>
                        <span
                            className={`mt-0.5 max-w-full text-center font-extrabold leading-tight text-gray-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)] ${
                                rankSmall ? 'text-[9px] sm:text-[10px]' : 'text-[10px] sm:text-xs'
                            }`}
                        >
                            {tier.name}
                        </span>
                    </div>
                    <Avatar
                        userId={user.id}
                        userName={user.nickname}
                        size={avatarSz}
                        avatarUrl={avatarUrl}
                        borderUrl={borderUrl}
                        fixedFrameSize
                        className="relative z-10 shrink-0 transition-transform duration-300 group-hover:scale-105"
                    />
                    <div
                        className={`relative z-10 flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 sm:items-center ${lineCls}`}
                    >
                        <span className="shrink-0 font-extrabold tabular-nums text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]">
                            Lv.{displayLevel ?? '—'}
                        </span>
                        <span
                            className={`min-w-0 flex-1 font-bold whitespace-normal break-words drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] ${
                                isTopThree || isMyRankDisplay ? 'text-white' : 'text-gray-100'
                            }`}
                        >
                            {user.nickname}
                        </span>
                    </div>
                    <div className="relative z-10 flex shrink-0 flex-col items-end gap-0.5 text-right">
                        <span
                            className={`font-mono font-black tabular-nums leading-none tracking-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)] ${
                                isTopThree || isMyRankDisplay ? 'text-yellow-100' : 'text-yellow-300'
                            } ${
                                rankSmall ? 'text-base sm:text-lg' : 'text-lg sm:text-2xl lg:text-3xl'
                            }`}
                        >
                            {dashPlaceholder ? '—' : `${Math.round(score)}점`}
                        </span>
                        <div
                            className={`font-semibold tabular-nums text-gray-200 ${
                                rankSmall ? 'text-[9px] sm:text-[11px]' : 'text-xs sm:text-sm'
                            }`}
                        >
                            {dashPlaceholder ? (
                                <span>—</span>
                            ) : (
                                <>
                                    <span>
                                        {wins}승 {losses}패
                                    </span>
                                    <span className={`ml-1.5 font-bold ${winRateClass}`}>{winRate}%</span>
                                </>
                            )}
                        </div>
                    </div>
                </li>
            );
        }

        return (
            <li 
                key={user.id} 
                className={`flex items-center gap-2 rounded-lg p-1.5 lg:p-2 transition-all duration-300 ${rankStyle.container} ${isClickable ? 'cursor-pointer hover:scale-[1.02] hover:-translate-y-0.5' : ''}`}
                onClick={isClickable ? () => onViewUser(user.id) : undefined}
                title={isClickable ? `${user.nickname} 프로필 보기` : ''}
            >
                <div className={rankStyle.glow}></div>
                <div
                    className={`relative z-10 flex flex-shrink-0 items-center justify-center ${
                        pairAlignedNativeCompact ? 'w-9 sm:w-10' : 'w-10 sm:w-12'
                    }`}
                >
                    {rankDisplay()}
                </div>
                <div className="relative z-10 flex-shrink-0">
                    <div className="relative">
                        <img 
                            src={tier.icon} 
                            alt={tier.name} 
                            className={`flex-shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-110 ${
                                pairAlignedNativeCompact ? 'h-9 w-9 sm:h-10 sm:w-10' : 'h-10 w-10 lg:h-11 lg:w-11'
                            }`}
                            title={tier.name}
                        />
                        {(isTopThree || isMyRankDisplay) && (
                            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-lg blur-sm"></div>
                        )}
                    </div>
                </div>
                <Avatar 
                    userId={user.id} 
                    userName={user.nickname} 
                    size={pairAlignedNativeCompact ? (isTopThree ? 34 : 32) : isTopThree ? 36 : 34} 
                    avatarUrl={avatarUrl} 
                    borderUrl={borderUrl}
                    fixedFrameSize
                    className="relative z-10 transition-transform duration-300 group-hover:scale-105"
                />
                <div className="flex-grow overflow-hidden relative z-10">
                    <p
                        className={`truncate font-bold ${isTopThree || isMyRankDisplay ? 'text-white' : 'text-gray-200'} drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] ${
                            pairAlignedNativeCompact ? 'text-xs sm:text-sm lg:text-base' : 'text-sm lg:text-base'
                        }`}
                    >
                        {user.nickname}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <p
                            className={`font-mono font-semibold ${isTopThree || isMyRankDisplay ? 'text-yellow-300' : 'text-yellow-400'} drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] ${
                                pairAlignedNativeCompact ? 'text-[0.65rem] sm:text-xs lg:text-sm' : 'text-xs lg:text-sm'
                            }`}
                        >
                            {dashPlaceholder ? '—' : `${Math.round(score)}점`}
                        </p>
                        {(isTopThree || isMyRankDisplay) && (
                            <span className="text-[9px] px-1 py-0.5 bg-gradient-to-r from-yellow-500/30 to-amber-500/30 border border-yellow-400/50 rounded-full text-yellow-200 font-semibold">
                                {tier.name}
                            </span>
                        )}
                    </div>
                </div>
                <div
                    className={`relative z-10 w-18 flex-shrink-0 text-right ${
                        pairAlignedNativeCompact ? 'text-xs sm:text-sm lg:text-base' : 'text-xs sm:text-sm'
                    } ${isTopThree || isMyRankDisplay ? 'text-gray-200' : 'text-gray-400'}`}
                >
                    {dashPlaceholder ? (
                        <p className="font-medium">—</p>
                    ) : (
                        <>
                            <p className="font-medium">
                                {wins}승 {losses}패
                            </p>
                            <p className={`font-bold ${winRateClass}`}>{winRate}%</p>
                        </>
                    )}
                </div>
            </li>
        );
    }, [lobbyType, minGamesForTierList, currentUser.id, currentUser.userLevel, seasonalBadukInlineLayout, getTierForUser, onViewUser, pairAlignedNativeCompact, splitStack]);

    const rankingTitle =
        lobbyType === 'strategic' ? '전략바둑 랭킹' : lobbyType === 'pair' ? '페어 바둑 랭킹' : `${mode} 랭킹`;

    const panelTight = pairAlignedNativeCompact || splitStack;
    const headerTitleClass = splitStack
        ? 'text-lg sm:text-xl'
        : pairAlignedNativeCompact
          ? 'text-base sm:text-lg lg:text-xl'
          : 'text-xl sm:text-2xl lg:text-3xl';

    return (
        <div
            className={`relative flex h-full min-h-0 flex-col text-on-panel ${
                splitStack ? 'p-2 sm:p-2.5' : pairAlignedNativeCompact ? 'p-2 sm:p-3 lg:p-4' : 'p-4 lg:p-5'
            }`}
        >
            {/* 배경 그라데이션 효과 */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-purple-900/5 to-blue-900/10 pointer-events-none rounded-lg"></div>
            
            <div
                className={`relative z-10 flex flex-shrink-0 flex-wrap items-center justify-between gap-2 border-b-2 border-gradient-to-r from-transparent via-indigo-500/30 to-transparent sm:gap-3 ${
                    panelTight ? 'mb-1.5 pb-1.5' : 'mb-4 pb-3'
                }`}
            >
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div
                        className={`w-1 shrink-0 rounded-full bg-gradient-to-b from-yellow-400 via-amber-500 to-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.5)] ${
                            panelTight ? 'h-5' : 'h-8'
                        }`}
                    />
                    <div className="min-w-0">
                        <h2
                            className={`font-bold bg-gradient-to-r from-white via-yellow-200 to-white bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${headerTitleClass}`}
                        >
                            {rankingTitle}
                        </h2>
                        <p
                            className={`mt-0.5 font-medium text-gray-400 ${
                                panelTight ? 'text-xs sm:text-sm' : 'text-sm lg:text-base'
                            }`}
                        >
                            {getCurrentSeasonName()}
                        </p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <Button 
                        onClick={() =>
                            onShowPastRankings({
                                user: currentUser,
                                mode: lobbyType === 'pair' ? 'pair' : 'strategic',
                            })
                        }
                        colorScheme="none"
                        className={`!rounded-lg border border-purple-400/30 bg-gradient-to-r from-purple-600/90 via-indigo-600/90 to-purple-600/90 font-bold text-white shadow-[0_4px_12px_rgba(99,102,241,0.4)] transition-all duration-200 hover:border-purple-300/50 hover:from-purple-500 hover:via-indigo-500 hover:to-purple-500 hover:shadow-[0_6px_16px_rgba(99,102,241,0.5)] ${
                            panelTight
                                ? '!px-2 !py-1 !text-xs sm:!text-[13px]'
                                : '!px-3 !py-1.5 !text-sm'
                        }`}
                    >
                        지난 랭킹
                    </Button>
                    <Button 
                        onClick={onShowTierInfo}
                        colorScheme="none"
                        className={`!rounded-lg border border-purple-400/30 bg-gradient-to-r from-purple-600/90 via-indigo-600/90 to-purple-600/90 font-bold text-white shadow-[0_4px_12px_rgba(99,102,241,0.4)] transition-all duration-200 hover:border-purple-300/50 hover:from-purple-500 hover:via-indigo-500 hover:to-purple-500 hover:shadow-[0_6px_16px_rgba(99,102,241,0.5)] ${
                            panelTight
                                ? '!px-2 !py-1 !text-xs sm:!text-[13px]'
                                : '!px-3 !py-1.5 !text-sm'
                        }`}
                    >
                        티어 안내
                    </Button>
                </div>
            </div>
            
            {myRankDataResolved && (
                <div className={`relative z-10 flex-shrink-0 ${panelTight ? 'mb-1.5' : 'mb-2.5'}`}>
                    <div className={`px-1 ${panelTight ? 'mb-1' : 'mb-1.5'}`}>
                        <span
                            className={`font-semibold uppercase tracking-wider text-yellow-400/80 ${
                                panelTight ? 'text-xs sm:text-sm' : 'text-sm'
                            }`}
                        >
                            내 랭킹
                        </span>
                    </div>
                    {renderRankItem(
                        myRankDataResolved.user,
                        myRankDataResolved.rank,
                        true,
                        myRankDataResolved.dashPlaceholder === true,
                    )}
                </div>
            )}

            <div className="relative z-10 flex-1 min-h-0 flex flex-col">
                {myRankDataResolved && (
                    <div className={`px-1 flex-shrink-0 ${panelTight ? 'mb-1' : 'mb-1.5'}`}>
                        <span
                            className={`font-semibold uppercase tracking-wider text-gray-400/80 ${
                                panelTight ? 'text-xs sm:text-sm' : 'text-sm'
                            }`}
                        >
                            전체 랭킹
                        </span>
                    </div>
                )}
                <ul
                    className={`overflow-y-auto pr-2 flex-1 min-h-0 ${RANKING_MODAL_SLIM_SCROLL_Y} ${panelTight ? 'space-y-1' : 'space-y-1.5'}`}
                >
                     {loading ? (
                         <li className="flex items-center justify-center py-12">
                             <div className="text-center">
                                 <div className="inline-block w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-2"></div>
                                 <p className="text-gray-400 text-sm">랭킹을 불러오는 중...</p>
                             </div>
                         </li>
                     ) : error ? (
                         <li className="flex items-center justify-center py-12">
                             <p className="text-center text-red-400 text-sm font-medium bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-2">
                                 랭킹을 불러오는데 실패했습니다.
                             </p>
                         </li>
                     ) : topUsers.length > 0 ? (
                         <>
                             {topUsers.map((user) => {
                                 const rank = user.rank || 1;
                                 return renderRankItem(user, rank, false);
                             })}
                             {displayCount < allRankedUsers.length && (
                                 <li ref={loadMoreRef} className="text-center text-gray-500 py-4 text-xs">
                                     <div className="inline-flex items-center gap-2">
                                         <div className="w-4 h-4 border-2 border-gray-500/30 border-t-gray-500 rounded-full animate-spin"></div>
                                         <span>더 많은 랭킹 로딩 중...</span>
                                     </div>
                                 </li>
                             )}
                         </>
                     ) : (
                         <li className="flex items-center justify-center py-12">
                             <p className="text-center text-gray-400 text-sm bg-gray-800/30 border border-gray-700/50 rounded-lg px-4 py-2">
                                 랭킹 정보가 없습니다.
                             </p>
                         </li>
                     )}
                </ul>
            </div>
        </div>
    );
};

export default RankingList;