import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import { useRanking } from '../hooks/useRanking.js';
import { User } from '../types.js';
import Avatar from './Avatar.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';
import { calculateTotalStats } from '../services/statService.js';

const IS_DEV = import.meta.env.DEV;

const RankingRow = ({
    user,
    rank,
    value,
    isCurrentUser,
    onViewUser,
    dense,
}: {
    user: User;
    rank: number;
    value: number;
    isCurrentUser: boolean;
    onViewUser?: (userId: string) => void;
    dense?: boolean;
}) => {
    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === user.avatarId)?.url, [user.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === user.borderId)?.url, [user.borderId]);

    const handleClick = () => {
        if (!isCurrentUser && onViewUser) {
            onViewUser(user.id);
        }
    };

    return (
        <div
            className={`flex items-center rounded-md ${dense ? 'px-0.5 py-0' : 'p-1'} ${isCurrentUser ? 'bg-blue-500/30' : onViewUser ? 'cursor-pointer hover:bg-secondary/50' : ''}`}
            onClick={handleClick}
            title={!isCurrentUser && onViewUser ? `${user.nickname} 프로필 보기` : ''}
        >
            <span className={`text-center font-bold ${dense ? 'w-5 text-[8px]' : 'w-8 text-xs'}`}>{rank}</span>
            <Avatar userId={user.id} userName={user.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={dense ? 20 : 28} />
            <span className={`ml-1 flex-1 truncate font-semibold ${dense ? 'text-[8px]' : 'ml-1.5 text-xs'}`}>{user.nickname}</span>
            <span className={`text-right font-mono ${dense ? 'w-10 text-[7px]' : 'w-16 text-xs'}`}>{value.toLocaleString()}</span>
        </div>
    );
};

interface GameRankingBoardProps {
    isTopmost?: boolean;
    /** 네이티브 모바일 3열 랭킹용 */
    dense?: boolean;
}

const GameRankingBoard: React.FC<GameRankingBoardProps> = ({ isTopmost, dense }) => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const [activeTab, setActiveTab] = useState<'combat' | 'manner'>('combat');

    const rankingType = activeTab === 'combat' ? 'combat' : 'manner';
    const { rankings: rankingEntries, loading, error } = useRanking(rankingType);

    const rankings = useMemo(() => {
        return rankingEntries.map(entry => ({
            user: {
                id: entry.id,
                nickname: entry.nickname,
                avatarId: entry.avatarId,
                borderId: entry.borderId
            } as any,
            value: entry.score,
            rank: entry.rank
        }));
    }, [rankingEntries]);

    // 페이지네이션: 초기 10명, 스크롤 시 10명씩 추가
    const [displayCount, setDisplayCount] = useState(10);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        if (observerRef.current) {
            observerRef.current.disconnect();
        }

        if (loadMoreRef.current && displayCount < rankings.length) {
            observerRef.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting) {
                        setDisplayCount(prev => Math.min(prev + 10, rankings.length));
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
    }, [displayCount, rankings.length]);

    // 탭 변경 시 displayCount 리셋
    useEffect(() => {
        setDisplayCount(10);
    }, [activeTab]);

    const displayedRankings = rankings.slice(0, displayCount);

    const currentUserRanking = useMemo(() => {
        if (!currentUserWithStatus) return null;
        const rank = rankings.findIndex(r => r.user && r.user.id === currentUserWithStatus.id);
        if (rank !== -1) {
            return { ...rankings[rank], rank: rank + 1 };
        }
        
        let value;
        if (activeTab === 'combat') {
            const totalStats = calculateTotalStats(currentUserWithStatus);
            value = Object.values(totalStats).reduce((acc, val) => acc + val, 0);
        } else {
            value = currentUserWithStatus.mannerScore;
        }
        
        return { user: currentUserWithStatus, value, rank: 'N/A' };
    }, [rankings, currentUserWithStatus, activeTab]);

    return (
        <div
            className={`bg-panel text-on-panel flex h-full min-h-0 flex-col rounded-lg border border-color ${dense ? 'gap-0.5 p-0.5' : 'gap-1 p-1.5'}`}
        >
            <h3 className={`text-center font-semibold text-secondary flex-shrink-0 ${dense ? 'text-[8px] leading-tight' : 'text-xs'}`}>게임 랭킹</h3>
            <div className={`flex flex-shrink-0 rounded-lg bg-gray-900/70 ${dense ? 'p-px' : 'p-0.5'}`}>
                <button
                    onClick={() => setActiveTab('combat')}
                    className={`flex-1 rounded-md font-semibold transition-all ${dense ? 'py-0.5 text-[7px]' : 'py-1 text-xs'} ${activeTab === 'combat' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}
                >
                    바둑능력
                </button>
                <button
                    onClick={() => setActiveTab('manner')}
                    className={`flex-1 rounded-md font-semibold transition-all ${dense ? 'py-0.5 text-[7px]' : 'py-1 text-xs'} ${activeTab === 'manner' ? 'bg-yellow-600' : 'text-gray-400 hover:bg-gray-700/50'}`}
                >
                    매너
                </button>
            </div>
            <div className={`flex min-h-0 flex-grow flex-col gap-0.5 overflow-y-auto pr-0.5 ${dense ? 'text-[8px]' : 'pr-1 text-xs'}`}
            >
                {loading ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                        데이터 로딩 중...
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-red-400 text-xs">
                        랭킹을 불러오는데 실패했습니다.
                    </div>
                ) : rankings.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-400 text-xs">
                        랭킹 데이터가 없습니다.
                    </div>
                ) : (
                    <>
                        {currentUserRanking && (
                            <div className="sticky top-0 bg-panel z-10">
                                <RankingRow
                                    user={currentUserRanking.user}
                                    rank={currentUserRanking.rank as number}
                                    value={currentUserRanking.value}
                                    isCurrentUser={true}
                                    dense={dense}
                                />
                            </div>
                        )}
                        <div className="flex flex-col gap-0.5">
                            {displayedRankings.filter(r => r && r.user && r.user.id).map((r) => (
                                <RankingRow
                                    key={r.user.id}
                                    user={r.user}
                                    rank={r.rank}
                                    value={r.value}
                                    isCurrentUser={false}
                                    onViewUser={handlers.openViewingUser}
                                    dense={dense}
                                />
                            ))}
                            {displayCount < rankings.length && (
                                <div ref={loadMoreRef} className="text-center text-gray-400 py-2 text-xs">
                                    로딩 중...
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GameRankingBoard;