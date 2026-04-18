import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import { useRanking } from '../hooks/useRanking.js';
import { User } from '../types.js';
import Avatar from './Avatar.js';
import UserNicknameText from './UserNicknameText.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';
import { calculateTotalStats } from '../services/statService.js';
import MobileRankingGuidePanel from './MobileRankingGuidePanel.js';

const IS_DEV = import.meta.env.DEV;
const MOBILE_RANK_ROW_CLASS = 'min-h-[2.75rem]';
const MOBILE_RANK_TEXT_CLASS = 'text-[11px]';

/** 랭킹 모달용: 1~3위 강조 / 본인 행 강조 */
function rankRowAccent(rank: number | string, isCurrentUser: boolean, dense: boolean, mobileWide: boolean): string {
    if (isCurrentUser) {
        return 'ring-1 ring-cyan-400/50 ring-inset bg-gradient-to-r from-cyan-950/55 via-cyan-900/25 to-transparent shadow-[0_0_24px_-10px_rgba(34,211,238,0.4)]';
    }
    if (dense || typeof rank !== 'number' || rank < 1 || rank > 3) return '';
    const bar = mobileWide ? 'border-l-[3px]' : 'border-l-[3px]';
    if (rank === 1) return `${bar} border-l-amber-400/90 bg-gradient-to-r from-amber-950/50 to-transparent shadow-[inset_6px_0_20px_-12px_rgba(251,191,36,0.2)]`;
    if (rank === 2) return `${bar} border-l-slate-300/80 bg-gradient-to-r from-slate-800/45 to-transparent`;
    return `${bar} border-l-amber-700/85 bg-gradient-to-r from-orange-950/40 to-transparent`;
}

const RankingRow = ({
    user,
    rank,
    value,
    isCurrentUser,
    onViewUser,
    dense,
    mobileWide,
}: {
    user: User;
    rank: number;
    value: number;
    isCurrentUser: boolean;
    onViewUser?: (userId: string) => void;
    dense?: boolean;
    /** 모바일 2열 랭킹: 큰 글자·행 높이 */
    mobileWide?: boolean;
}) => {
    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === user.avatarId)?.url, [user.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === user.borderId)?.url, [user.borderId]);

    const handleClick = () => {
        if (!isCurrentUser && onViewUser) {
            onViewUser(user.id);
        }
    };

    const accent = rankRowAccent(rank, isCurrentUser, Boolean(dense), Boolean(mobileWide));

    if (mobileWide) {
        return (
            <div
                className={`flex ${MOBILE_RANK_ROW_CLASS} items-center rounded-lg px-1.5 py-0.5 transition-colors ${accent} ${!isCurrentUser && onViewUser ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
                onClick={handleClick}
                title={!isCurrentUser && onViewUser ? `${user.nickname} 프로필 보기` : ''}
            >
                <span
                    className={`w-8 shrink-0 text-center ${MOBILE_RANK_TEXT_CLASS} font-black tabular-nums ${
                        typeof rank === 'number' && rank === 1
                            ? 'text-amber-300'
                            : typeof rank === 'number' && rank === 2
                              ? 'text-slate-200'
                              : typeof rank === 'number' && rank === 3
                                ? 'text-amber-600/90'
                                : 'text-primary'
                    }`}
                >
                    {rank}
                </span>
                <Avatar userId={user.id} userName={user.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={34} />
                <UserNicknameText
                    user={{
                        nickname: user.nickname,
                        isAdmin: user.isAdmin,
                        staffNicknameDisplayEligibility: user.staffNicknameDisplayEligibility,
                    }}
                    className={`ml-1.5 min-w-0 flex-1 truncate ${MOBILE_RANK_TEXT_CLASS} font-semibold`}
                />
                <span className={`w-[4.25rem] shrink-0 text-right font-mono ${MOBILE_RANK_TEXT_CLASS} tabular-nums`}>{value.toLocaleString()}</span>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center rounded-md ${dense ? 'px-0.5 py-0' : 'p-1'} ${accent} ${!isCurrentUser && onViewUser ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
            onClick={handleClick}
            title={!isCurrentUser && onViewUser ? `${user.nickname} 프로필 보기` : ''}
        >
            <span
                className={`text-center font-bold ${dense ? 'w-5 text-[8px]' : 'w-8 text-xs'} ${
                    !dense && typeof rank === 'number' && rank === 1
                        ? 'text-amber-300'
                        : !dense && typeof rank === 'number' && rank === 2
                          ? 'text-slate-200'
                          : !dense && typeof rank === 'number' && rank === 3
                            ? 'text-amber-600/90'
                            : ''
                }`}
            >
                {rank}
            </span>
            <Avatar userId={user.id} userName={user.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={dense ? 20 : 28} />
            <UserNicknameText
                user={{
                    nickname: user.nickname,
                    isAdmin: user.isAdmin,
                    staffNicknameDisplayEligibility: user.staffNicknameDisplayEligibility,
                }}
                className={`ml-1 flex-1 truncate font-semibold ${dense ? 'text-[8px]' : 'ml-1.5 text-xs'}`}
            />
            <span className={`text-right font-mono ${dense ? 'w-10 text-[7px]' : 'w-16 text-xs'}`}>{value.toLocaleString()}</span>
        </div>
    );
};

interface GameRankingBoardProps {
    isTopmost?: boolean;
    /** 네이티브 모바일 3열 랭킹용 */
    dense?: boolean;
    /** 모바일 랭킹 탭 2열: 큰 텍스트·약 10명 분량 높이 */
    mobileSplitLarge?: boolean;
    /** 모바일 랭킹 퀵 모달에서는 가이드를 별도 팁 모달로 표시 */
    hideInlineGuide?: boolean;
}

const GameRankingBoard: React.FC<GameRankingBoardProps> = ({ isTopmost, dense, mobileSplitLarge, hideInlineGuide }) => {
    const rowDense = Boolean(dense && !mobileSplitLarge);
    const wide = Boolean(mobileSplitLarge);
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
            className={`relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/95 via-zinc-950 to-black text-on-panel shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-black/30 ${
                wide ? 'gap-1 p-2' : rowDense ? 'gap-0.5 p-0.5' : 'gap-1.5 p-2'
            }`}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/35 to-transparent" aria-hidden />
            <h3
                className={`relative z-[1] flex-shrink-0 text-center font-black tracking-tight ${
                    wide
                        ? 'bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-200/90 bg-clip-text text-base text-transparent'
                        : rowDense
                          ? 'text-[8px] leading-tight text-secondary'
                          : 'bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-200/90 bg-clip-text text-xs text-transparent sm:text-sm'
                }`}
            >
                게임 랭킹
            </h3>
            <div
                className={`relative z-[1] flex flex-shrink-0 rounded-xl border border-white/10 bg-black/45 p-1 shadow-inner ${wide ? '' : rowDense ? 'p-px' : ''}`}
            >
                <button
                    type="button"
                    onClick={() => setActiveTab('combat')}
                    className={`flex-1 rounded-lg font-semibold transition-all ${
                        wide ? 'py-1.5 text-[11px]' : rowDense ? 'py-0.5 text-[7px]' : 'py-1.5 text-xs'
                    } ${
                        activeTab === 'combat'
                            ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-blue-500/25'
                            : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                    }`}
                >
                    바둑능력
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('manner')}
                    className={`flex-1 rounded-lg font-semibold transition-all ${
                        wide ? 'py-1.5 text-[11px]' : rowDense ? 'py-0.5 text-[7px]' : 'py-1.5 text-xs'
                    } ${
                        activeTab === 'manner'
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-md shadow-amber-500/25'
                            : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                    }`}
                >
                    매너
                </button>
            </div>
            <div
                className={
                    wide
                        ? 'flex min-h-0 flex-1 flex-col gap-1 overflow-hidden'
                        : `flex min-h-0 flex-1 flex-col overflow-hidden ${rowDense ? 'text-[8px]' : 'text-xs'}`
                }
            >
                <div
                    className={
                        wide
                            ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                            : 'flex min-h-0 flex-1 flex-col overflow-hidden'
                    }
                >
                    {loading ? (
                        <div className={`flex h-full items-center justify-center text-gray-400 ${wide ? 'px-1 text-center text-base leading-snug' : 'text-xs'}`}>
                            데이터 로딩 중...
                        </div>
                    ) : error ? (
                        <div className={`flex h-full items-center justify-center text-red-400 ${wide ? 'px-1 text-center text-base leading-snug' : 'text-xs'}`}>
                            랭킹을 불러오는데 실패했습니다.
                        </div>
                    ) : rankings.length === 0 ? (
                        <div className={`flex h-full items-center justify-center text-gray-400 ${wide ? 'px-1 text-center text-base leading-snug' : 'text-xs'}`}>
                            랭킹 데이터가 없습니다.
                        </div>
                    ) : (
                        <>
                            {currentUserRanking && (
                                <div className="z-10 flex-shrink-0 border-b border-cyan-500/25 bg-gradient-to-r from-cyan-950/40 to-transparent pb-1.5 pt-0.5">
                                    <RankingRow
                                        user={currentUserRanking.user}
                                        rank={currentUserRanking.rank as number}
                                        value={currentUserRanking.value}
                                        isCurrentUser={true}
                                        dense={rowDense}
                                        mobileWide={wide}
                                    />
                                </div>
                            )}
                            <div
                                className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto ${!wide && !rowDense ? 'pr-1' : 'pr-0.5'}`}
                            >
                                <div className="flex flex-col gap-0.5">
                                    {displayedRankings.filter(r => r && r.user && r.user.id).map((r) => (
                                        <RankingRow
                                            key={r.user.id}
                                            user={r.user}
                                            rank={r.rank}
                                            value={r.value}
                                            isCurrentUser={false}
                                            onViewUser={handlers.openViewingUser}
                                            dense={rowDense}
                                            mobileWide={wide}
                                        />
                                    ))}
                                    {displayCount < rankings.length && (
                                        <div ref={loadMoreRef} className={`py-2 text-center text-gray-400 ${wide ? 'text-sm' : 'text-xs'}`}>
                                            로딩 중...
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
                {wide && !hideInlineGuide && (
                    <div className="flex min-h-0 flex-[3] flex-col overflow-hidden">
                        <MobileRankingGuidePanel variant={activeTab === 'combat' ? 'game-combat' : 'game-manner'} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameRankingBoard;