import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import { useRanking } from '../hooks/useRanking.js';
import { RankingEntry } from '../hooks/useRanking.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';
import Avatar from './Avatar.js';

const CHAMPIONSHIP_TOP = 100;
const MOBILE_RANK_ROW_CLASS = 'min-h-[2.75rem]';
const MOBILE_RANK_TEXT_CLASS = 'text-[11px]';
/** 첫 화면에 약 6명 분량이 보이도록 행 높이와 맞춘 초기 로드 개수 */
const INITIAL_DISPLAY = 6;
const LOAD_MORE = 8;

function compactRankAccent(rank: number, isCurrentUser: boolean, dense: boolean, lobbyNativeMobile: boolean): string {
    if (isCurrentUser) {
        return 'ring-1 ring-cyan-400/50 ring-inset bg-gradient-to-r from-cyan-950/55 via-cyan-900/25 to-transparent shadow-[0_0_20px_-10px_rgba(34,211,238,0.35)]';
    }
    if (dense || rank < 1 || rank > 3) return '';
    const bar = lobbyNativeMobile ? 'border-l-[3px]' : 'border-l-[3px]';
    if (rank === 1) return `${bar} border-l-amber-400/90 bg-gradient-to-r from-amber-950/45 to-transparent`;
    if (rank === 2) return `${bar} border-l-slate-300/80 bg-gradient-to-r from-slate-800/40 to-transparent`;
    return `${bar} border-l-amber-700/85 bg-gradient-to-r from-orange-950/35 to-transparent`;
}

/** 게임/바둑 랭킹과 동일한 한 줄 행 (compact용) */
const CompactRankRow: React.FC<{
    entry: RankingEntry;
    isCurrentUser: boolean;
    onViewUser?: (userId: string) => void;
    dense?: boolean;
    lobbyNativeMobile?: boolean;
}> = ({ entry, isCurrentUser, onViewUser, dense, lobbyNativeMobile = false }) => {
    const avatarUrl = AVATAR_POOL.find(a => a.id === entry.avatarId)?.url;
    const borderUrl = BORDER_POOL.find(b => b.id === entry.borderId)?.url;
    const r = entry.rank === 0 ? 0 : entry.rank;
    const accent = compactRankAccent(r, isCurrentUser, Boolean(dense), lobbyNativeMobile);
    return (
        <div
            className={`flex items-center rounded-md ${dense ? 'px-0.5 py-0' : lobbyNativeMobile ? 'px-1.5 py-0.5' : 'p-1'} ${lobbyNativeMobile ? MOBILE_RANK_ROW_CLASS : ''} ${accent} ${!isCurrentUser && onViewUser ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
            onClick={!isCurrentUser && onViewUser ? () => onViewUser(entry.id) : undefined}
            title={!isCurrentUser ? `${entry.nickname} 프로필 보기` : ''}
        >
            <span
                className={`text-center font-bold ${dense ? 'w-5 text-[8px]' : lobbyNativeMobile ? `w-8 ${MOBILE_RANK_TEXT_CLASS}` : 'w-8 text-xs'} ${
                    !dense && r === 1
                        ? 'text-amber-300'
                        : !dense && r === 2
                          ? 'text-slate-200'
                          : !dense && r === 3
                            ? 'text-amber-600/90'
                            : ''
                }`}
            >
                {entry.rank === 0 ? '-' : entry.rank}
            </span>
            <Avatar userId={entry.id} userName={entry.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={dense ? 20 : lobbyNativeMobile ? 34 : 28} />
            <span
                className={`ml-1 flex-1 truncate font-semibold ${dense ? 'text-[8px]' : lobbyNativeMobile ? `ml-1.5 ${MOBILE_RANK_TEXT_CLASS}` : 'ml-1.5 text-xs'}`}
            >
                {entry.nickname}
            </span>
            <span
                className={`text-right font-mono ${dense ? 'w-10 text-[7px]' : lobbyNativeMobile ? `w-[4.25rem] ${MOBILE_RANK_TEXT_CLASS}` : 'w-16 text-xs'}`}
            >
                {entry.score.toLocaleString()}
            </span>
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
            className={`flex min-h-[3.5rem] items-center rounded-lg p-2.5 lg:p-3 ${isCurrentUser ? 'bg-blue-900/60 border border-blue-600' : 'bg-gray-900/50'} ${!isCurrentUser ? 'cursor-pointer hover:bg-gray-700/50' : ''}`}
            onClick={!isCurrentUser ? () => onViewUser(entry.id) : undefined}
            title={!isCurrentUser ? `${entry.nickname} 프로필 보기` : ''}
        >
            <div className="w-14 flex-shrink-0 flex flex-col items-center justify-center text-center">
                {rankDisplay}
            </div>
            <Avatar userId={entry.id} userName={entry.nickname} size={40} avatarUrl={avatarUrl} borderUrl={borderUrl} />
            <div className="ml-2.5 lg:ml-3 flex-grow overflow-hidden">
                <p className="truncate font-semibold text-base">{entry.nickname}</p>
                <p className="font-mono text-sm text-yellow-400">{entry.score.toLocaleString()}점</p>
            </div>
        </li>
    );
};

interface ChampionshipRankingPanelProps {
    /** 홈화면용: 게임/바둑 랭킹과 동일한 패널 디자인 */
    compact?: boolean;
    /** compact 모드에서 더 작게 (3열 랭킹 등) */
    dense?: boolean;
    /** 네이티브 챔피언십 3열 레이아웃: 글자를 하단 독 수준 이상으로 키움 */
    lobbyNativeMobile?: boolean;
    /** 챔피언십 로비 배경 위: 패널 뒤 블러 */
    lobbyGlass?: boolean;
}

const ChampionshipRankingPanel: React.FC<ChampionshipRankingPanelProps> = ({
    compact = false,
    dense = false,
    lobbyNativeMobile = false,
    lobbyGlass = false,
}) => {
    const { currentUserWithStatus, handlers } = useAppContext();
    const { rankings, loading, error } = useRanking('championship', CHAMPIONSHIP_TOP, 0);

    /** 0점 유저는 표시하지 않음 (API와 동일, 캐시 지연 대비 클라이언트에서도 재필터) */
    const visibleRankings = useMemo(() => {
        const filtered = rankings.filter(e => e.score > 0);
        return filtered.map((e, i) => ({ ...e, rank: i + 1 }));
    }, [rankings]);

    const [displayCount, setDisplayCount] = useState(INITIAL_DISPLAY);
    const loadMoreRef = useRef<HTMLDivElement | HTMLLIElement>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        if (observerRef.current) observerRef.current.disconnect();
        if (loadMoreRef.current && displayCount < visibleRankings.length) {
            observerRef.current = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting) {
                        setDisplayCount(prev => Math.min(prev + LOAD_MORE, visibleRankings.length));
                    }
                },
                { threshold: 0.1 }
            );
            observerRef.current.observe(loadMoreRef.current);
        }
        return () => { observerRef.current?.disconnect(); };
    }, [displayCount, visibleRankings.length]);

    const displayedEntries = useMemo(() => visibleRankings.slice(0, displayCount), [visibleRankings, displayCount]);

    const myEntry = useMemo(() => {
        if (!currentUserWithStatus) return null;
        return visibleRankings.find(e => e.id === currentUserWithStatus.id) ?? null;
    }, [visibleRankings, currentUserWithStatus]);

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
            <div
                className={
                    compact
                        ? `border border-color rounded-lg p-1.5 h-full flex items-center justify-center text-gray-500 text-xs bg-panel ${lobbyGlass ? 'backdrop-blur-xl backdrop-saturate-150 [transform:translateZ(0)]' : ''}`
                        : `rounded-lg p-4 flex flex-col shadow-lg h-full min-h-0 items-center justify-center text-gray-500 ${lobbyGlass ? 'border border-color/50 bg-gray-900/45 backdrop-blur-xl backdrop-saturate-150' : 'bg-gray-800'}`
                }
            >
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
            <div
                className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-fuchsia-500/20 bg-gradient-to-b from-zinc-900/95 via-zinc-950 to-black text-on-panel shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-black/30 ${dense ? 'gap-0.5 p-0.5' : 'gap-1.5 p-2'} ${lobbyGlass ? 'backdrop-blur-xl backdrop-saturate-150 [transform:translateZ(0)]' : ''}`}
            >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/35 to-transparent" aria-hidden />
                <h3
                    className={`relative z-[1] flex-shrink-0 text-center font-black tracking-tight ${
                        dense
                            ? 'text-[8px] leading-tight text-secondary'
                            : lobbyNativeMobile
                              ? 'bg-gradient-to-r from-fuchsia-100 via-violet-50 to-amber-100/90 bg-clip-text text-base text-transparent'
                              : 'bg-gradient-to-r from-fuchsia-100 via-violet-50 to-amber-100/90 bg-clip-text text-sm text-transparent'
                    }`}
                >
                    챔피언십 랭킹
                </h3>
                <div className={`flex min-h-0 flex-grow flex-col overflow-y-auto pr-0.5 ${dense ? 'gap-0.5 text-[8px]' : 'gap-1 pr-1'}`}
                >
                    {loading && rankings.length === 0 ? (
                        <div className={`flex h-full items-center justify-center text-gray-400 ${lobbyNativeMobile ? 'text-[11px]' : 'text-xs'}`}>데이터 로딩 중...</div>
                    ) : error ? (
                        <div className={`flex h-full items-center justify-center text-red-400 ${lobbyNativeMobile ? 'text-[11px]' : 'text-xs'}`}>랭킹을 불러오는데 실패했습니다.</div>
                    ) : (
                        <>
                            {currentUserEntry && (
                                <div className="sticky top-0 z-10 border-b border-cyan-500/25 bg-gradient-to-r from-cyan-950/40 to-transparent pb-1 pt-0.5">
                                    <CompactRankRow
                                        entry={currentUserEntry}
                                        isCurrentUser={true}
                                        onViewUser={handlers.openViewingUser}
                                        dense={dense}
                                        lobbyNativeMobile={lobbyNativeMobile}
                                    />
                                </div>
                            )}
                            {visibleRankings.length === 0 ? (
                                <div className={`flex flex-1 items-center justify-center py-3 text-center text-gray-400 ${lobbyNativeMobile ? 'text-[11px]' : 'text-xs'}`}>
                                    랭킹에 표시할 점수가 있는 유저가 없습니다.
                                </div>
                            ) : (
                                <div className={`flex flex-col ${dense ? 'gap-0.5' : 'gap-1'}`}>
                                    {displayedEntries.map((entry) => (
                                        <CompactRankRow
                                            key={entry.id}
                                            entry={entry}
                                            isCurrentUser={entry.id === currentUserWithStatus.id}
                                            onViewUser={handlers.openViewingUser}
                                            dense={dense}
                                            lobbyNativeMobile={lobbyNativeMobile}
                                        />
                                    ))}
                                    {displayCount < visibleRankings.length && (
                                        <div ref={loadMoreRef as React.RefObject<HTMLDivElement>} className={`py-2 text-center text-gray-400 ${lobbyNativeMobile ? 'text-[11px]' : 'text-xs'}`}>로딩 중...</div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    }

    // 챔피언십 대기실용: 기존 디자인
    return (
        <div
            className={`rounded-lg p-4 flex flex-col shadow-lg h-full min-h-0 ${
                lobbyGlass
                    ? 'border border-color/50 bg-gray-900/45 backdrop-blur-xl backdrop-saturate-150 [transform:translateZ(0)]'
                    : 'bg-gray-800'
            }`}
        >
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
                            <div className="flex min-h-[3.5rem] items-center rounded-lg border border-yellow-700 bg-yellow-900/40 p-2.5 lg:p-3">
                                <div className="w-14 flex-shrink-0 flex flex-col items-center justify-center text-center">
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
                                    size={40}
                                    avatarUrl={AVATAR_POOL.find(a => a.id === currentUserWithStatus.avatarId)?.url}
                                    borderUrl={BORDER_POOL.find(b => b.id === currentUserWithStatus.borderId)?.url}
                                />
                                <div className="ml-2.5 lg:ml-3 flex-grow overflow-hidden">
                                    <p className="truncate font-semibold text-base">{currentUserWithStatus.nickname}</p>
                                    <p className="font-mono text-sm text-yellow-400">{myRankDisplay.score.toLocaleString()}점</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <ul className="min-h-0 flex-grow space-y-3 overflow-y-auto pr-2">
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
                                {displayCount < visibleRankings.length && (
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
