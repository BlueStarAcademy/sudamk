import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { UserWithStatus } from '../../types.js';
import { RANKING_TIERS } from '../../constants';
import { RANKING_MODAL_SLIM_SCROLL_Y } from '../../shared/constants/rankingModalScrollbar.js';
import { useRanking } from '../../hooks/useRanking.js';
import { pickChampionshipVersusSeasonRankingStats } from '../../shared/utils/championshipVersusElo.js';
import { getCurrentSeason } from '../../shared/utils/timeUtils.js';
import SeasonalBadukRankingRow from './SeasonalBadukRankingRow.js';

const CHAMPIONSHIP_TOP = 100;
const INITIAL_DISPLAY = 30;
const LOAD_MORE_COUNT = 20;
/** 챔피언십 랭킹 행 티어 표시: 랭킹전 최소 판수와 무관하게 목록에 포함된 유저만 집계 */
const MIN_GAMES_FOR_TIER = 1;

const getTier = (score: number, rank: number, totalGames: number) => {
    for (const tier of RANKING_TIERS) {
        if (tier.threshold(score, rank, totalGames)) {
            return tier;
        }
    }
    return RANKING_TIERS[RANKING_TIERS.length - 1];
};

interface ChampionshipRankingListProps {
    currentUser: UserWithStatus;
    onViewUser: (userId: string) => void;
    splitStack?: boolean;
}

const ChampionshipRankingList: React.FC<ChampionshipRankingListProps> = ({
    currentUser,
    onViewUser,
    splitStack = false,
}) => {
    const { rankings, loading, error } = useRanking('championship', CHAMPIONSHIP_TOP, 0);

    const allRankedUsers = useMemo(() => {
        return rankings.map((entry) => ({
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
                stats: {} as Record<string, unknown>,
                dailyRankings: {} as Record<string, unknown>,
            }));
    }, [rankings]);

    const eligibleRankedUsers = allRankedUsers.filter((u) => u.totalGames >= MIN_GAMES_FOR_TIER);
    const sproutTier = RANKING_TIERS[RANKING_TIERS.length - 1];

    const myRankIndex = allRankedUsers.findIndex((u) => u.id === currentUser.id);

    const myRankDataResolved = useMemo(() => {
        if (myRankIndex !== -1) {
            const row = allRankedUsers[myRankIndex];
            return {
                user: row,
                rank: row.rank || myRankIndex + 1,
                dashPlaceholder: false as const,
            };
        }
        const versus = pickChampionshipVersusSeasonRankingStats(currentUser);
        if (!versus) {
            return {
                user: {
                    id: currentUser.id,
                    nickname: currentUser.nickname,
                    avatarId: currentUser.avatarId,
                    borderId: currentUser.borderId,
                    avgScore: 0,
                    rank: 0,
                    totalGames: 0,
                    wins: 0,
                    losses: 0,
                    userLevel: typeof currentUser.userLevel === 'number' ? currentUser.userLevel : undefined,
                    stats: {} as Record<string, unknown>,
                    dailyRankings: {} as Record<string, unknown>,
                },
                rank: 0,
                dashPlaceholder: true as const,
            };
        }
        const score = versus.rating;
        const rank = eligibleRankedUsers.filter((x) => x.avgScore > score).length + 1;
        return {
            user: {
                id: currentUser.id,
                nickname: currentUser.nickname,
                avatarId: currentUser.avatarId,
                borderId: currentUser.borderId,
                avgScore: score,
                rank,
                totalGames: versus.seasonWins + versus.seasonLosses,
                wins: versus.seasonWins,
                losses: versus.seasonLosses,
                userLevel: typeof currentUser.userLevel === 'number' ? currentUser.userLevel : undefined,
                stats: {} as Record<string, unknown>,
                dailyRankings: {} as Record<string, unknown>,
            },
            rank,
            dashPlaceholder: false as const,
        };
    }, [myRankIndex, allRankedUsers, currentUser, eligibleRankedUsers]);

    const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY);
    const loadMoreRef = useRef<HTMLLIElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        if (loadMoreRef.current && displayCount < allRankedUsers.length) {
            observerRef.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting) {
                        setDisplayCount((prev) => Math.min(prev + LOAD_MORE_COUNT, allRankedUsers.length));
                    }
                },
                { threshold: 0.1 },
            );
            observerRef.current.observe(loadMoreRef.current);
        }

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [displayCount, allRankedUsers.length]);

    useEffect(() => {
        setDisplayCount(INITIAL_DISPLAY);
    }, []);

    const topUsers = allRankedUsers.slice(0, displayCount);

    const getTierForUser = useCallback(
        (user: { id: string; avgScore: number; totalGames: number }) => {
            let rankAmongEligible = eligibleRankedUsers.findIndex((e) => e.id === user.id) + 1;
            if (rankAmongEligible === 0 && user.totalGames >= MIN_GAMES_FOR_TIER) {
                rankAmongEligible = eligibleRankedUsers.filter((e) => e.avgScore > user.avgScore).length + 1;
            }
            if (rankAmongEligible === 0) {
                return sproutTier;
            }
            return getTier(user.avgScore, rankAmongEligible, user.totalGames);
        },
        [eligibleRankedUsers, sproutTier],
    );

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
            const tier = getTierForUser(user);
            const rankSmall = splitStack;
            return (
                <SeasonalBadukRankingRow
                    user={user}
                    rank={rank}
                    isMyRankDisplay={isMyRankDisplay}
                    dashPlaceholder={dashPlaceholder}
                    rankSmall={rankSmall}
                    tier={tier}
                    onViewUser={onViewUser}
                    currentUserId={currentUser.id}
                    currentUserLevel={Number(currentUser.userLevel) || 1}
                />
            );
        },
        [currentUser.id, currentUser.userLevel, getTierForUser, onViewUser, splitStack],
    );

    const panelTight = splitStack;
    const headerTitleClass = splitStack ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl lg:text-3xl';

    return (
        <div
            className={`relative flex h-full min-h-0 flex-col text-on-panel ${
                splitStack ? 'p-2 sm:p-2.5' : 'p-4 lg:p-5'
            }`}
        >
            <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-br from-indigo-900/10 via-purple-900/5 to-blue-900/10"></div>

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
                            className={`bg-gradient-to-r from-white via-yellow-200 to-white bg-clip-text font-bold text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] ${headerTitleClass}`}
                        >
                            챔피언십 랭킹
                        </h2>
                        <p
                            className={`mt-0.5 font-medium text-gray-400 ${
                                panelTight ? 'text-xs sm:text-sm' : 'text-sm lg:text-base'
                            }`}
                        >
                            {getCurrentSeason().name}
                        </p>
                    </div>
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

            <div className="relative z-10 flex min-h-0 flex-1 flex-col">
                {myRankDataResolved && (
                    <div className={`flex-shrink-0 px-1 ${panelTight ? 'mb-1' : 'mb-1.5'}`}>
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
                    className={`min-h-0 flex-1 space-y-1 overflow-y-auto pr-2 sm:space-y-1.5 ${RANKING_MODAL_SLIM_SCROLL_Y}`}
                >
                    {loading ? (
                        <li className="flex items-center justify-center py-12">
                            <div className="text-center">
                                <div className="mb-2 inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-500/30 border-t-indigo-500"></div>
                                <p className="text-sm text-gray-400">랭킹을 불러오는 중...</p>
                            </div>
                        </li>
                    ) : error ? (
                        <li className="flex items-center justify-center py-12">
                            <p className="rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-2 text-center text-sm font-medium text-red-400">
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
                                <li ref={loadMoreRef} className="py-4 text-center text-xs text-gray-500">
                                    <div className="inline-flex items-center gap-2">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500/30 border-t-gray-500"></div>
                                        <span>더 많은 랭킹 로딩 중...</span>
                                    </div>
                                </li>
                            )}
                        </>
                    ) : (
                        <li className="flex items-center justify-center py-12">
                            <p className="rounded-lg border border-gray-700/50 bg-gray-800/30 px-4 py-2 text-center text-sm text-gray-400">
                                랭킹 정보가 없습니다.
                            </p>
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
};

export default ChampionshipRankingList;
