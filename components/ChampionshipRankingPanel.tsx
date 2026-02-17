import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import { useRanking } from '../hooks/useRanking.js';
import { RankingEntry } from '../hooks/useRanking.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';
import Avatar from './Avatar.js';

const CHAMPIONSHIP_TOP = 100;
const INITIAL_DISPLAY = 10;
const LOAD_MORE = 10;

/** 게임/바둑 랭킹과 동일한 한 줄 행 (compact용) */
const CompactRankRow: React.FC<{
    entry: RankingEntry;
    isCurrentUser: boolean;
    onViewUser?: (userId: string) => void;
}> = ({ entry, isCurrentUser, onViewUser }) => {
    const avatarUrl = AVATAR_POOL.find(a => a.id === entry.avatarId)?.url;
    const borderUrl = BORDER_POOL.find(b => b.id === entry.borderId)?.url;
    return (
        <div
            className={`flex items-center p-1 rounded-md ${isCurrentUser ? 'bg-blue-500/30' : onViewUser ? 'cursor-pointer hover:bg-secondary/50' : ''}`}
            onClick={!isCurrentUser && onViewUser ? () => onViewUser(entry.id) : undefined}
            title={!isCurrentUser ? `${entry.nickname} 프로필 보기` : ''}
        >
            <span className="w-8 text-center font-bold text-xs">{entry.rank === 0 ? '-' : entry.rank}</span>
            <Avatar userId={entry.id} userName={entry.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={28} />
            <span className="flex-1 truncate font-semibold ml-1.5 text-xs">{entry.nickname}</span>
            <span className="w-16 text-right font-mono text-xs">{entry.score.toLocaleString()}</span>
        </div>
    );
};

const RankRow: React.FC<{
    entry: RankingEntry;
    isCurrentUser: boolean;
    onViewUser: (userId: string) => void;
}> = ({ entry, isCurrentUser, onViewUser }) => {
    const rankDisplay = useMemo(() => {
        if (entry.rank === 1) return <span className="text-3xl" role="img" aria-label="Gold Trophy">🥇</span>;
        if (entry.rank === 2) return <span className="text-3xl" role="img" aria-label="Silver Trophy">🥈</span>;
        if (entry.rank === 3) return <span className="text-3xl" role="img" aria-label="Bronze Trophy">🥉</span>;
        return <span className="text-2xl font-bold text-gray-300">{entry.rank}</span>;
    }, [entry.rank]);
    const avatarUrl = AVATAR_POOL.find(a => a.id === entry.avatarId)?.url;
    const borderUrl = BORDER_POOL.find(b => b.id === entry.borderId)?.url;

    return (
        <li
            className={`flex items-center rounded-lg p-1.5 lg:p-2 ${isCurrentUser ? 'bg-blue-900/60 border border-blue-600' : 'bg-gray-900/50'} ${!isCurrentUser ? 'cursor-pointer hover:bg-gray-700/50' : ''}`}
            onClick={!isCurrentUser ? () => onViewUser(entry.id) : undefined}
            title={!isCurrentUser ? `${entry.nickname} 프로필 보기` : ''}
        >
            <div className="w-12 text-center flex-shrink-0 flex flex-col items-center justify-center">
                {rankDisplay}
            </div>
            <Avatar userId={entry.id} userName={entry.nickname} size={32} avatarUrl={avatarUrl} borderUrl={borderUrl} />
            <div className="ml-2 lg:ml-3 flex-grow overflow-hidden">
                <p className="font-semibold text-sm truncate">{entry.nickname}</p>
                <p className="text-xs text-yellow-400 font-mono">{entry.score.toLocaleString()}점</p>
            </div>
        </li>
    );
};

interface ChampionshipRankingPanelProps {
    /** 홈화면용: 게임/바둑 랭킹과 동일한 패널 디자인 */
    compact?: boolean;
}

const ChampionshipRankingPanel: React.FC<ChampionshipRankingPanelProps> = ({ compact = false }) => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const { rankings, loading, error, total } = useRanking('championship', CHAMPIONSHIP_TOP, 0);

    const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY);
    const loadMoreRef = useRef<HTMLDivElement | HTMLLIElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        if (observerRef.current) observerRef.current.disconnect();
        if (loadMoreRef.current && displayCount < rankings.length) {
            observerRef.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting) {
                        setDisplayCount(prev => Math.min(prev + LOAD_MORE, rankings.length));
                    }
                },
                { threshold: 0.1 }
            );
            observerRef.current.observe(loadMoreRef.current);
        }
        return () => { observerRef.current?.disconnect(); };
    }, [displayCount, rankings.length]);

    const displayedEntries = useMemo(() => rankings.slice(0, displayCount), [rankings, displayCount]);

    const myEntry = useMemo(() => {
        if (!currentUserWithStatus) return null;
        return rankings.find(e => e.id === currentUserWithStatus.id) ?? null;
    }, [rankings, currentUserWithStatus]);

    const myRankDisplay = useMemo(() => {
        if (!currentUserWithStatus) return null;
        const score = currentUserWithStatus.cumulativeTournamentScore ?? 0;
        if (myEntry) {
            return { rank: myEntry.rank, score: myEntry.score };
        }
        return { rank: null as number | null, score };
    }, [currentUserWithStatus, myEntry]);

    if (!currentUserWithStatus) {
        return (
            <div className={compact ? 'bg-panel border border-color rounded-lg p-1.5 h-full flex items-center justify-center text-gray-500 text-xs' : 'bg-gray-800 rounded-lg p-4 flex flex-col shadow-lg h-full min-h-0 items-center justify-center text-gray-500'}>
                랭킹 정보를 불러오는 중...
            </div>
        );
    }

    // 홈화면용: 게임/바둑 랭킹과 동일한 패널 디자인
    if (compact) {
        const myRank = myRankDisplay?.rank != null ? myRankDisplay.rank : 0;
        const myScore = myRankDisplay?.score ?? 0;
        const currentUserEntry: RankingEntry = myEntry || {
            id: currentUserWithStatus.id,
            nickname: currentUserWithStatus.nickname,
            avatarId: currentUserWithStatus.avatarId,
            borderId: currentUserWithStatus.borderId,
            rank: myRank,
            score: myScore,
            totalGames: 0,
            wins: 0,
            losses: 0,
        };

        return (
            <div className="bg-panel border border-color text-on-panel rounded-lg p-1.5 flex flex-col gap-1 h-full">
                <h3 className="text-center font-semibold text-secondary text-xs flex-shrink-0">챔피언십 랭킹</h3>
                <div className="flex-grow overflow-y-auto pr-1 text-xs flex flex-col gap-0.5 min-h-0">
                    {loading && rankings.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-400 text-xs">데이터 로딩 중...</div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-full text-red-400 text-xs">랭킹을 불러오는데 실패했습니다.</div>
                    ) : rankings.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-400 text-xs">랭킹 데이터가 없습니다.</div>
                    ) : (
                        <>
                            {currentUserEntry && (
                                <div className="sticky top-0 bg-panel z-10">
                                    <CompactRankRow
                                        entry={currentUserEntry}
                                        isCurrentUser={true}
                                        onViewUser={handlers.openViewingUser}
                                    />
                                </div>
                            )}
                            <div className="flex flex-col gap-0.5">
                                {displayedEntries.map((entry) => (
                                    <CompactRankRow
                                        key={entry.id}
                                        entry={entry}
                                        isCurrentUser={entry.id === currentUserWithStatus.id}
                                        onViewUser={handlers.openViewingUser}
                                    />
                                ))}
                                {displayCount < rankings.length && (
                                    <div ref={loadMoreRef as React.RefObject<HTMLDivElement>} className="text-center text-gray-400 py-2 text-xs">로딩 중...</div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // 챔피언십 대기실용: 기존 디자인
    return (
        <div className="bg-gray-800 rounded-lg p-4 flex flex-col shadow-lg h-full min-h-0">
            <div className="flex justify-between items-center mb-3 border-b border-gray-700 pb-2 flex-shrink-0">
                <h2 className="text-xl font-bold">챔피언십 랭킹</h2>
                <span className="text-xs text-gray-400">동네+전국+월드 합산 · Top {CHAMPIONSHIP_TOP}</span>
            </div>

            {loading && rankings.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-500">랭킹 불러오는 중...</div>
            ) : error ? (
                <div className="flex-1 flex items-center justify-center text-red-400 text-sm">{error}</div>
            ) : (
                <>
                    {myRankDisplay && (
                        <div className="flex-shrink-0 mb-3">
                            <div className="flex items-center rounded-lg bg-yellow-900/40 border border-yellow-700 p-1.5 lg:p-2">
                                <div className="w-12 text-center flex-shrink-0 flex flex-col items-center justify-center">
                                    {myRankDisplay.rank === null ? (
                                        <span className="text-2xl font-bold text-gray-400">-</span>
                                    ) : myRankDisplay.rank === 1 ? (
                                        <span className="text-3xl">🥇</span>
                                    ) : myRankDisplay.rank === 2 ? (
                                        <span className="text-3xl">🥈</span>
                                    ) : myRankDisplay.rank === 3 ? (
                                        <span className="text-3xl">🥉</span>
                                    ) : (
                                        <span className="text-2xl font-bold text-gray-300">{myRankDisplay.rank}</span>
                                    )}
                                </div>
                                <Avatar
                                    userId={currentUserWithStatus.id}
                                    userName={currentUserWithStatus.nickname}
                                    size={32}
                                    avatarUrl={AVATAR_POOL.find(a => a.id === currentUserWithStatus.avatarId)?.url}
                                    borderUrl={BORDER_POOL.find(b => b.id === currentUserWithStatus.borderId)?.url}
                                />
                                <div className="ml-2 lg:ml-3 flex-grow overflow-hidden">
                                    <p className="font-semibold text-sm truncate">{currentUserWithStatus.nickname}</p>
                                    <p className="text-xs text-yellow-400 font-mono">{myRankDisplay.score.toLocaleString()}점</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <ul className="space-y-2 overflow-y-auto pr-2 flex-grow min-h-0">
                        {displayedEntries.length > 0 ? (
                            <>
                                {displayedEntries.map((entry) => (
                                    <RankRow
                                        key={entry.id}
                                        entry={entry}
                                        isCurrentUser={entry.id === currentUserWithStatus.id}
                                        onViewUser={handlers.openViewingUser}
                                    />
                                ))}
                                {displayCount < rankings.length && (
                                    <li ref={loadMoreRef as React.RefObject<HTMLLIElement>} className="text-center text-gray-500 py-2 text-xs">스크롤하여 더 보기...</li>
                                )}
                            </>
                        ) : (
                            <p className="text-center text-gray-500 pt-8">랭크된 유저가 없습니다.</p>
                        )}
                    </ul>
                </>
            )}
        </div>
    );
};

export default ChampionshipRankingPanel;
