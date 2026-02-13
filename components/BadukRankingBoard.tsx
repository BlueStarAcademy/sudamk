import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import { useRanking } from '../hooks/useRanking.js';
import { User } from '../types.js';
import Avatar from './Avatar.js';
import { AVATAR_POOL, BORDER_POOL, SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants';

interface BadukRankingBoardProps {
    isTopmost?: boolean;
}

const IS_DEV = import.meta.env.DEV;

const RankingRow = ({ user, rank, value, isCurrentUser, onViewUser }: { user: User, rank: number, value: number, isCurrentUser: boolean, onViewUser?: (userId: string) => void }) => {
    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === user.avatarId)?.url, [user.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === user.borderId)?.url, [user.borderId]);

    const handleClick = () => {
        if (!isCurrentUser && onViewUser) {
            onViewUser(user.id);
        }
    };

    return (
        <div 
            className={`flex items-center p-1 rounded-md ${isCurrentUser ? 'bg-blue-500/30' : onViewUser ? 'cursor-pointer hover:bg-secondary/50' : ''}`}
            onClick={handleClick}
            title={!isCurrentUser && onViewUser ? `${user.nickname} 프로필 보기` : ''}
        >
            <span className="w-8 text-center font-bold text-xs">{rank}</span>
            <Avatar userId={user.id} userName={user.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={28} />
            <span className="flex-1 truncate font-semibold ml-1.5 text-xs">{user.nickname}</span>
            <span className="w-16 text-right font-mono text-xs">{value.toLocaleString()}</span>
        </div>
    );
};

const BadukRankingBoard: React.FC<BadukRankingBoardProps> = ({ isTopmost }) => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const [activeTab, setActiveTab] = useState<'strategic' | 'playful'>('strategic');

    const rankingType = activeTab === 'strategic' ? 'strategic' : 'playful';
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
        
        // rankings에서 현재 유저 찾기
        const rank = rankings.findIndex(r => r.user && r.user.id === currentUserWithStatus.id);
        if (rank !== -1) {
            return { user: currentUserWithStatus, value: rankings[rank].value, rank: rankings[rank].rank };
        }
        
        // rankings에 없으면 값만 계산 (10판 이상이어야 표시)
        const mode = activeTab === 'strategic' ? 'strategic' : 'playful';
        const scoreMode = mode === 'strategic' ? 'standard' : 'playful';
        const gameModes = mode === 'strategic' ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;

        let totalGames = 0;
        if (currentUserWithStatus.stats) {
            for (const gameMode of gameModes) {
                const gameStats = currentUserWithStatus.stats[gameMode.mode];
                if (gameStats) {
                    totalGames += (gameStats.wins || 0) + (gameStats.losses || 0);
                }
            }
        }

        if (totalGames < 10) {
            return null;
        }

        const score = currentUserWithStatus.cumulativeRankingScore?.[scoreMode] || 0;
        const rankInList = rankings.findIndex(r => r.user && r.user.id === currentUserWithStatus.id);
        if (rankInList !== -1) {
            return { user: currentUserWithStatus, value: score, rank: rankings[rankInList].rank };
        }
        return { user: currentUserWithStatus, value: score, rank: 'N/A' };
    }, [currentUserWithStatus, activeTab, rankings]);

    return (
        <div className="bg-panel border border-color text-on-panel rounded-lg p-1.5 flex flex-col gap-1 h-full">
            <h3 className="text-center font-semibold text-secondary text-xs flex-shrink-0">바둑 랭킹</h3>
            <div className="flex bg-gray-900/70 p-0.5 rounded-lg flex-shrink-0">
                <button 
                    onClick={() => setActiveTab('strategic')}
                    className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${activeTab === 'strategic' ? 'bg-blue-600' : 'text-gray-400 hover:bg-gray-700/50'}`}
                >
                    전략바둑
                </button>
                <button 
                    onClick={() => setActiveTab('playful')}
                    className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${activeTab === 'playful' ? 'bg-yellow-600' : 'text-gray-400 hover:bg-gray-700/50'}`}
                >
                    놀이바둑
                </button>
            </div>
            <div className="flex-grow overflow-y-auto pr-1 text-xs flex flex-col gap-0.5 min-h-0">
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
                                <RankingRow user={currentUserRanking.user} rank={currentUserRanking.rank as number} value={currentUserRanking.value} isCurrentUser={true} />
                            </div>
                        )}
                        <div className="flex flex-col gap-0.5">
                            {displayedRankings.filter(r => r && r.user && r.user.id).map((r) => (
                                <RankingRow key={r.user.id} user={r.user} rank={r.rank} value={r.value} isCurrentUser={false} onViewUser={handlers.openViewingUser} />
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

export default BadukRankingBoard;