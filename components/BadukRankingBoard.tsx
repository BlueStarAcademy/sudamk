import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../hooks/useAppContext.js';
import { RANKING_MODAL_SLIM_SCROLL_Y } from '../shared/constants/rankingModalScrollbar.js';
import { useRanking } from '../hooks/useRanking.js';
import { User } from '../types.js';
import Avatar from './Avatar.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';
import { readPairRankedBlock, readStrategicRankedBlock } from '../shared/utils/unifiedRankedStatsMigration.js';
import { RANKED_ELO_BASE_SCORE } from '../shared/constants/rules.js';
import MobileRankingGuidePanel from './MobileRankingGuidePanel.js';

interface BadukRankingBoardProps {
    isTopmost?: boolean;
    dense?: boolean;
    mobileSplitLarge?: boolean;
    /** 모바일 랭킹 퀵 모달에서는 가이드를 별도 팁 모달로 표시 */
    hideInlineGuide?: boolean;
}

const IS_DEV = import.meta.env.DEV;
const MOBILE_RANK_ROW_CLASS = 'min-h-[2.75rem]';
const MOBILE_RANK_TEXT_CLASS = 'text-[11px]';

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
    user: User & { userLevel?: number };
    rank: number;
    value: number;
    isCurrentUser: boolean;
    onViewUser?: (userId: string) => void;
    dense?: boolean;
    mobileWide?: boolean;
}) => {
    const { t } = useTranslation('game');
    const displayLevel =
        user.userLevel != null && Number.isFinite(Number(user.userLevel))
            ? Math.max(1, Math.floor(Number(user.userLevel)))
            : null;
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
                title={!isCurrentUser && onViewUser ? t('rankingBoard.viewProfile', { name: user.nickname }) : ''}
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
                <Avatar userId={user.id} userName={user.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={34} fixedFrameSize />
                <div className={`ml-1.5 flex min-w-0 flex-1 flex-col gap-0.5 leading-tight ${MOBILE_RANK_TEXT_CLASS}`}>
                    <span className="shrink-0 font-extrabold tabular-nums text-amber-200">Lv.{displayLevel ?? '—'}</span>
                    <span className="min-w-0 truncate font-semibold">{user.nickname}</span>
                </div>
                <span className={`w-[4.25rem] shrink-0 text-right font-mono ${MOBILE_RANK_TEXT_CLASS} tabular-nums`}>{value.toLocaleString()}</span>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center rounded-md ${dense ? 'px-0.5 py-0' : 'p-1'} ${accent} ${!isCurrentUser && onViewUser ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
            onClick={handleClick}
            title={!isCurrentUser && onViewUser ? t('rankingBoard.viewProfile', { name: user.nickname }) : ''}
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
            <Avatar userId={user.id} userName={user.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={dense ? 20 : 28} fixedFrameSize />
            <div
                className={`ml-1 flex min-w-0 flex-1 flex-col gap-px leading-tight ${dense ? 'text-[8px]' : 'ml-1.5 text-xs'}`}
            >
                <span className={`shrink-0 font-extrabold tabular-nums ${dense ? 'text-[7px]' : 'text-[10px]'} text-amber-200`}>
                    Lv.{displayLevel ?? '—'}
                </span>
                <span className="min-w-0 truncate font-semibold">{user.nickname}</span>
            </div>
            <span className={`text-right font-mono ${dense ? 'w-10 text-[7px]' : 'w-16 text-xs'}`}>{value.toLocaleString()}</span>
        </div>
    );
};

const BadukRankingBoard: React.FC<BadukRankingBoardProps> = ({ isTopmost, dense, mobileSplitLarge, hideInlineGuide }) => {
    const { t } = useTranslation('game');
    const rowDense = Boolean(dense && !mobileSplitLarge);
    const wide = Boolean(mobileSplitLarge);
    const { currentUserWithStatus, handlers } = useAppContext();
    const [activeTab, setActiveTab] = useState<'strategic' | 'pair'>('strategic');

    const rankingType = activeTab === 'strategic' ? 'strategic' : 'pair';
    const pairSeason = activeTab === 'pair';
    const { rankings: rankingEntries, loading, error } = useRanking(rankingType, undefined, undefined, pairSeason ? true : false);

    const rankings = useMemo(() => {
        return rankingEntries.map(entry => ({
            user: {
                id: entry.id,
                nickname: entry.nickname,
                avatarId: entry.avatarId,
                borderId: entry.borderId,
                userLevel: entry.userLevel,
            } as User,
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
        if (activeTab === 'pair') {
            const pairBlk = readPairRankedBlock(currentUserWithStatus.stats);
            const totalGames = pairBlk.wins + pairBlk.losses;
            if (totalGames < 5) return null;
            const rankInList = rankings.findIndex(r => r.user && r.user.id === currentUserWithStatus.id);
            if (rankInList !== -1) {
                return {
                    user: currentUserWithStatus,
                    value: rankings[rankInList].value,
                    rank: rankings[rankInList].rank,
                };
            }
            const dr = currentUserWithStatus.dailyRankings?.pair;
            const score =
                dr && typeof dr.score === 'number' && Number.isFinite(dr.score)
                    ? RANKED_ELO_BASE_SCORE + dr.score
                    : pairBlk.rankingScore;
            return { user: currentUserWithStatus, value: score, rank: 'N/A' as const };
        }

        const scoreMode = 'standard';
        const stratBlk = readStrategicRankedBlock(currentUserWithStatus.stats);
        const totalGames = stratBlk.wins + stratBlk.losses;

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
        <div
            className={`relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-emerald-500/20 bg-gradient-to-b from-zinc-900/95 via-zinc-950 to-black text-on-panel shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-black/30 ${
                wide ? 'gap-1 p-2' : rowDense ? 'gap-0.5 p-0.5' : 'gap-1.5 p-2'
            }`}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent" aria-hidden />
            <h3
                className={`relative z-[1] flex-shrink-0 text-center font-black tracking-tight ${
                    wide
                        ? 'bg-gradient-to-r from-emerald-100 via-teal-50 to-cyan-200/90 bg-clip-text text-base text-transparent'
                        : rowDense
                          ? 'text-[8px] leading-tight text-secondary'
                          : 'bg-gradient-to-r from-emerald-100 via-teal-50 to-cyan-200/90 bg-clip-text text-xs text-transparent sm:text-sm'
                }`}
            >
                {t('rankingBoard.badukTitle')}
            </h3>
            <div className={`relative z-[1] grid flex-shrink-0 grid-cols-2 gap-0.5 rounded-xl border border-white/10 bg-black/45 p-1 shadow-inner ${wide ? '' : rowDense ? 'p-px' : ''}`}>
                <button
                    type="button"
                    onClick={() => setActiveTab('strategic')}
                    className={`rounded-lg font-semibold transition-all ${
                        wide ? 'py-1.5 text-[11px]' : rowDense ? 'py-0.5 text-[7px]' : 'py-1.5 text-xs'
                    } ${
                        activeTab === 'strategic'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md shadow-emerald-500/25'
                            : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                    }`}
                >
                    {t('rankingBoard.tabStrategic')}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('pair')}
                    className={`rounded-lg font-semibold transition-all ${
                        wide ? 'py-1.5 text-[11px]' : rowDense ? 'py-0.5 text-[7px]' : 'py-1.5 text-xs'
                    } ${
                        activeTab === 'pair'
                            ? 'bg-gradient-to-r from-cyan-600 to-sky-700 text-white shadow-md shadow-cyan-500/25'
                            : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                    }`}
                >
                    {t('rankingBoard.tabPair')}
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
                            {t('rankingBoard.loading')}
                        </div>
                    ) : error ? (
                        <div className={`flex h-full items-center justify-center text-red-400 ${wide ? 'px-1 text-center text-base leading-snug' : 'text-xs'}`}>
                            {t('rankingBoard.loadFailed')}
                        </div>
                    ) : rankings.length === 0 ? (
                        <div className={`flex h-full items-center justify-center text-gray-400 ${wide ? 'px-1 text-center text-base leading-snug' : 'text-xs'}`}>
                            {t('rankingBoard.empty')}
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
                                className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto ${RANKING_MODAL_SLIM_SCROLL_Y} ${!wide && !rowDense ? 'pr-1' : 'pr-0.5'}`}
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
                                            {t('rankingBoard.loadingMore')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
                {wide && !hideInlineGuide && activeTab === 'strategic' && (
                    <div className="flex min-h-0 flex-[3] flex-col overflow-hidden">
                        <MobileRankingGuidePanel variant="baduk-strategic" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default BadukRankingBoard;