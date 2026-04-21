import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { User, UserWithStatus, GameMode } from '../../types.js';
import Avatar from '../Avatar.js';
import { RANKING_TIERS, AVATAR_POOL, BORDER_POOL, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../../constants';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useRanking } from '../../hooks/useRanking.js';
import Button from '../Button.js';

interface RankingListProps {
    currentUser: UserWithStatus;
    mode: GameMode | 'strategic' | 'playful';
    onViewUser: (userId: string) => void;
    onShowTierInfo: () => void;
    onShowPastRankings: (info: { user: UserWithStatus; mode: GameMode | 'strategic' | 'playful' }) => void;
    lobbyType: 'strategic' | 'playful';
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


const RankingList: React.FC<RankingListProps> = ({ currentUser, mode, onViewUser, onShowTierInfo, onShowPastRankings, lobbyType }) => {
    const rankingType = lobbyType === 'strategic' ? 'strategic' : 'playful';
    // 대기실에서는 시즌별 티어 랭킹 점수 사용 (매 시즌 시작일에 1200점 부여, 랭킹전을 통해 얻거나 잃은 점수)
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
            // User 타입 호환성을 위한 더미 필드
            stats: {} as any,
            dailyRankings: {} as any
        }));
    }, [rankings]);

    const eligibleRankedUsers = allRankedUsers.filter(u => u.totalGames >= 10);
    const totalEligiblePlayers = eligibleRankedUsers.length;
    const sproutTier = RANKING_TIERS[RANKING_TIERS.length - 1];

    const myRankIndex = allRankedUsers.findIndex(u => u.id === currentUser.id);
    const myRankData = myRankIndex !== -1 ? { 
        user: allRankedUsers[myRankIndex], 
        rank: allRankedUsers[myRankIndex].rank || (myRankIndex + 1), 
        score: allRankedUsers[myRankIndex].avgScore 
    } : null;

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
        const rankAmongEligible = eligibleRankedUsers.findIndex(u => u.id === user.id) + 1;
        if (rankAmongEligible === 0) { // Should not happen if they are eligible, but as a fallback
            return sproutTier;
        }

        return getTier(user.avgScore, rankAmongEligible, user.totalGames);
    }, [eligibleRankedUsers, sproutTier]);


    const renderRankItem = useCallback((user: { id: string; nickname: string; avatarId: string; borderId: string; avgScore: number; totalGames: number; wins: number; losses: number }, rank: number, isMyRankDisplay: boolean) => {
        const wins = user.wins || 0;
        const losses = user.losses || 0;
        const winRate = (wins + losses) > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;
        const score = user.avgScore;
        const tier = getTierForUser(user);
        
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
        
        // 랭킹 표시 아이콘
        const rankDisplay = () => {
            if (rank === 1) return <span className="text-xl" role="img" aria-label="Gold Medal">🥇</span>;
            if (rank === 2) return <span className="text-xl" role="img" aria-label="Silver Medal">🥈</span>;
            if (rank === 3) return <span className="text-xl" role="img" aria-label="Bronze Medal">🥉</span>;
            return <span className={`${rankStyle.rankText} text-xs`}>{rank}</span>;
        };
        
        return (
            <li 
                key={user.id} 
                className={`flex items-center gap-2 rounded-lg p-1.5 lg:p-2 transition-all duration-300 ${rankStyle.container} ${isClickable ? 'cursor-pointer hover:scale-[1.02] hover:-translate-y-0.5' : ''}`}
                onClick={isClickable ? () => onViewUser(user.id) : undefined}
                title={isClickable ? `${user.nickname} 프로필 보기` : ''}
            >
                <div className={rankStyle.glow}></div>
                <div className="w-8 flex items-center justify-center flex-shrink-0 relative z-10">
                    {rankDisplay()}
                </div>
                <div className="relative z-10 flex-shrink-0">
                    <div className="relative">
                        <img 
                            src={tier.icon} 
                            alt={tier.name} 
                            className="w-7 h-7 lg:w-8 lg:h-8 flex-shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-300" 
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
                    size={isTopThree ? 32 : 28} 
                    avatarUrl={avatarUrl} 
                    borderUrl={borderUrl}
                    fixedFrameSize
                    className="relative z-10 transition-transform duration-300 group-hover:scale-105"
                />
                <div className="flex-grow overflow-hidden relative z-10">
                    <p className={`font-bold text-xs lg:text-sm truncate ${isTopThree || isMyRankDisplay ? 'text-white' : 'text-gray-200'} drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}>
                        {user.nickname}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                        <p className={`text-[10px] lg:text-xs font-mono font-semibold ${isTopThree || isMyRankDisplay ? 'text-yellow-300' : 'text-yellow-400'} drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}>
                            {Math.round(score)}점
                        </p>
                        {(isTopThree || isMyRankDisplay) && (
                            <span className="text-[9px] px-1 py-0.5 bg-gradient-to-r from-yellow-500/30 to-amber-500/30 border border-yellow-400/50 rounded-full text-yellow-200 font-semibold">
                                {tier.name}
                            </span>
                        )}
                    </div>
                </div>
                <div className={`text-right text-[9px] lg:text-[10px] flex-shrink-0 w-18 relative z-10 ${isTopThree || isMyRankDisplay ? 'text-gray-200' : 'text-gray-400'}`}>
                    <p className="font-medium">{wins}승 {losses}패</p>
                    <p className={`font-bold ${winRate >= 60 ? 'text-green-400' : winRate >= 50 ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {winRate}%
                    </p>
                </div>
            </li>
        );
    }, [lobbyType, currentUser.id, getTierForUser, onViewUser]);

    const rankingTitle = lobbyType === 'strategic' ? '전략바둑 랭킹' : lobbyType === 'playful' ? '놀이바둑 랭킹' : `${mode} 랭킹`;

    return (
        <div className="p-4 lg:p-5 flex flex-col h-full text-on-panel min-h-0 relative">
            {/* 배경 그라데이션 효과 */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-purple-900/5 to-blue-900/10 pointer-events-none rounded-lg"></div>
            
            <div className="relative z-10 flex justify-between items-center mb-4 border-b-2 border-gradient-to-r from-transparent via-indigo-500/30 to-transparent pb-3 flex-shrink-0 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-8 bg-gradient-to-b from-yellow-400 via-amber-500 to-yellow-400 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.5)]"></div>
                    <div>
                        <h2 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-white via-yellow-200 to-white bg-clip-text text-transparent drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                            {rankingTitle}
                        </h2>
                        <p className="text-xs lg:text-sm text-gray-400 font-medium mt-0.5">
                            {getCurrentSeasonName()}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        onClick={() => onShowPastRankings({ user: currentUser, mode })}
                        colorScheme="none"
                        className="!text-xs !py-1.5 !px-3 bg-gradient-to-r from-purple-600/90 via-indigo-600/90 to-purple-600/90 hover:from-purple-500 hover:via-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-[0_4px_12px_rgba(99,102,241,0.4)] hover:shadow-[0_6px_16px_rgba(99,102,241,0.5)] transition-all duration-200 border border-purple-400/30 hover:border-purple-300/50"
                    >
                        지난 랭킹
                    </Button>
                    <Button 
                        onClick={onShowTierInfo}
                        colorScheme="none"
                        className="!text-xs !py-1.5 !px-3 bg-gradient-to-r from-purple-600/90 via-indigo-600/90 to-purple-600/90 hover:from-purple-500 hover:via-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg shadow-[0_4px_12px_rgba(99,102,241,0.4)] hover:shadow-[0_6px_16px_rgba(99,102,241,0.5)] transition-all duration-200 border border-purple-400/30 hover:border-purple-300/50"
                    >
                        티어 안내
                    </Button>
                </div>
            </div>
            
            {myRankData && (
                <div className="relative z-10 flex-shrink-0 mb-2.5">
                    <div className="mb-1.5 px-1">
                        <span className="text-xs font-semibold text-yellow-400/80 uppercase tracking-wider">내 랭킹</span>
                    </div>
                    {renderRankItem(myRankData.user, myRankData.rank, true)}
                </div>
            )}

            <div className="relative z-10 flex-1 min-h-0 flex flex-col">
                {myRankData && (
                    <div className="mb-1.5 px-1 flex-shrink-0">
                        <span className="text-xs font-semibold text-gray-400/80 uppercase tracking-wider">전체 랭킹</span>
                    </div>
                )}
                <ul className="space-y-1.5 overflow-y-auto pr-2 flex-1 min-h-0">
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