import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../hooks/useAppContext.js';
import { RANKING_MODAL_SLIM_SCROLL_Y } from '../shared/constants/rankingModalScrollbar.js';
import { useRanking } from '../hooks/useRanking.js';
import { User } from '../types.js';
import Avatar from './Avatar.js';
import { RankPlaceMark } from './FantasyRankBadge.js';
import UserNicknameText from './UserNicknameText.js';
import { AVATAR_POOL, BORDER_POOL } from '../constants';
import { calculateTotalStats } from '../services/statService.js';
import { getAdventureHuntingScore } from '../shared/utils/adventureHuntingScore.js';
import { getAdventureCodexCompletionBreakdown } from '../utils/adventureCodexCompletion.js';
import MobileRankingGuidePanel from './MobileRankingGuidePanel.js';

function formatMonsterUnderstandingPercent(percent: number): string {
    const clamped = Math.min(100, Math.max(0, percent));
    return clamped >= 10 ? `${Math.round(clamped)}` : `${Math.round(clamped * 10) / 10}`;
}

const IS_DEV = import.meta.env.DEV;
/** 모바일·랭킹 모달 다열: 바둑랭킹(splitStack) 행과 동일한 글자·아바타 스케일 */
const MOBILE_RANK_ROW_CLASS = 'min-h-[3rem]';
const MOBILE_RANK_TEXT_CLASS = 'text-xs sm:text-sm';
const MOBILE_RANK_SCORE_CLASS = 'text-sm font-bold tabular-nums sm:text-base';
const DESKTOP_RANK_SCORE_CLASS = 'text-sm font-semibold tabular-nums sm:text-base';
const DENSE_RANK_SCORE_CLASS = 'text-[9px] font-semibold tabular-nums';

function resolveRankingRowUserLevel(
    user: { id: string; userLevel?: number },
    currentUserId?: string,
    currentUserLevel?: number,
): number | null {
    if (user.userLevel != null && Number.isFinite(Number(user.userLevel))) {
        return Math.max(1, Math.floor(Number(user.userLevel)));
    }
    if (
        currentUserId &&
        user.id === currentUserId &&
        currentUserLevel != null &&
        Number.isFinite(Number(currentUserLevel))
    ) {
        return Math.max(1, Math.floor(Number(currentUserLevel)));
    }
    return null;
}

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
    currentUserId,
    currentUserLevel,
    monsterUnderstandingPercent,
}: {
    user: User & { userLevel?: number };
    rank: number;
    value: number;
    isCurrentUser: boolean;
    onViewUser?: (userId: string) => void;
    dense?: boolean;
    /** 모바일 2열 랭킹: 큰 글자·행 높이 */
    mobileWide?: boolean;
    currentUserId?: string;
    currentUserLevel?: number;
    /** 탐험 랭킹 전용: 점수 왼쪽에 몬스터 이해도 % 표시 */
    monsterUnderstandingPercent?: number;
}) => {
    const { t } = useTranslation('game');
    const displayLevel = resolveRankingRowUserLevel(user, currentUserId, currentUserLevel);
    const avatarUrl = useMemo(() => AVATAR_POOL.find(a => a.id === user.avatarId)?.url, [user.avatarId]);
    const borderUrl = useMemo(() => BORDER_POOL.find(b => b.id === user.borderId)?.url, [user.borderId]);
    const understandingLabel =
        monsterUnderstandingPercent != null && Number.isFinite(monsterUnderstandingPercent)
            ? t('rankingBoard.monsterUnderstanding', {
                  percent: formatMonsterUnderstandingPercent(monsterUnderstandingPercent),
              })
            : null;

    const handleClick = () => {
        if (!isCurrentUser && onViewUser) {
            onViewUser(user.id);
        }
    };

    const accent = rankRowAccent(rank, isCurrentUser, Boolean(dense), Boolean(mobileWide));

    if (mobileWide) {
        const isTopThree = typeof rank === 'number' && rank >= 1 && rank <= 3;
        const avatarSize = isTopThree ? 40 : 38;
        return (
            <div
                className={`flex ${MOBILE_RANK_ROW_CLASS} items-center gap-1.5 rounded-lg p-1.5 transition-colors sm:gap-2 sm:p-2 ${accent} ${!isCurrentUser && onViewUser ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
                onClick={handleClick}
                title={!isCurrentUser && onViewUser ? t('rankingBoard.viewProfile', { name: user.nickname }) : ''}
            >
                <div className="flex w-10 shrink-0 items-center justify-center sm:w-11">
                    <RankPlaceMark
                        rank={rank}
                        size="sm"
                        fallbackClassName={`${MOBILE_RANK_TEXT_CLASS} font-black tabular-nums text-primary`}
                    />
                </div>
                <Avatar userId={user.id} userName={user.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={avatarSize} fixedFrameSize />
                <div className={`flex min-w-0 flex-1 flex-col gap-0.5 leading-tight ${MOBILE_RANK_TEXT_CLASS}`}>
                    <span className="shrink-0 font-extrabold tabular-nums text-amber-200">Lv.{displayLevel ?? '—'}</span>
                    <UserNicknameText
                        user={{
                            nickname: user.nickname,
                            isAdmin: user.isAdmin,
                            staffNicknameDisplayEligibility: user.staffNicknameDisplayEligibility,
                        }}
                        className="min-w-0 truncate font-bold"
                    />
                </div>
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    {understandingLabel && (
                        <span
                            className="max-w-[5.5rem] truncate text-right text-[10px] font-semibold leading-tight text-violet-200/90 sm:max-w-none sm:text-xs"
                            title={understandingLabel}
                        >
                            {understandingLabel}
                        </span>
                    )}
                    <span className={`w-[5rem] shrink-0 text-right font-mono sm:w-24 ${MOBILE_RANK_SCORE_CLASS}`}>
                        {value.toLocaleString()}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center rounded-md ${dense ? 'px-0.5 py-0' : 'p-1'} ${accent} ${!isCurrentUser && onViewUser ? 'cursor-pointer hover:bg-white/[0.04]' : ''}`}
            onClick={handleClick}
            title={!isCurrentUser && onViewUser ? t('rankingBoard.viewProfile', { name: user.nickname }) : ''}
        >
            <div className={`flex shrink-0 items-center justify-center ${dense ? 'w-5' : 'w-8'}`}>
                <RankPlaceMark
                    rank={rank}
                    size={dense ? 'xs' : 'sm'}
                    fallbackClassName={`text-center font-bold tabular-nums ${dense ? 'text-[8px]' : 'text-xs'}`}
                />
            </div>
            <Avatar userId={user.id} userName={user.nickname} avatarUrl={avatarUrl} borderUrl={borderUrl} size={dense ? 20 : 28} fixedFrameSize />
            <div
                className={`ml-1 flex min-w-0 flex-1 flex-col gap-px leading-tight ${dense ? 'text-[8px]' : 'ml-1.5 text-xs'}`}
            >
                <span className={`shrink-0 font-extrabold tabular-nums ${dense ? 'text-[7px]' : 'text-[10px]'} text-amber-200`}>
                    Lv.{displayLevel ?? '—'}
                </span>
                <UserNicknameText
                    user={{
                        nickname: user.nickname,
                        isAdmin: user.isAdmin,
                        staffNicknameDisplayEligibility: user.staffNicknameDisplayEligibility,
                    }}
                    className="min-w-0 truncate font-semibold"
                />
            </div>
            <div className={`flex shrink-0 items-center ${dense ? 'gap-0.5' : 'gap-1.5'}`}>
                {understandingLabel && (
                    <span
                        className={`text-right font-semibold leading-tight text-violet-200/90 ${
                            dense ? 'max-w-[3.25rem] truncate text-[7px]' : 'text-[10px] sm:text-xs'
                        }`}
                        title={understandingLabel}
                    >
                        {understandingLabel}
                    </span>
                )}
                <span
                    className={`text-right font-mono ${dense ? `w-11 ${DENSE_RANK_SCORE_CLASS}` : `w-20 ${DESKTOP_RANK_SCORE_CLASS}`}`}
                >
                    {value.toLocaleString()}
                </span>
            </div>
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
    /** 상위 UI에서 탭을 나눌 때: 내부 탭 바 숨김·랭킹 종류 고정 */
    lockedTab?: 'combat' | 'manner' | 'adventure';
    /** 랭킹 모달 다열 배치 시 헤더 문구(기본: 게임 랭킹) */
    panelTitle?: string;
}

const GameRankingBoard: React.FC<GameRankingBoardProps> = ({
    isTopmost,
    dense,
    mobileSplitLarge,
    hideInlineGuide,
    lockedTab,
    panelTitle,
}) => {
    const { t } = useTranslation('game');
    const rowDense = Boolean(dense && !mobileSplitLarge);
    const wide = Boolean(mobileSplitLarge);
    const { currentUserWithStatus, handlers } = useAppContext();
    const [freeTab, setFreeTab] = useState<'combat' | 'manner' | 'adventure'>('combat');
    const activeTab = lockedTab ?? freeTab;

    const rankingType =
        activeTab === 'combat' ? 'combat' : activeTab === 'adventure' ? 'adventure' : 'manner';
    const { rankings: rankingEntries, loading, error } = useRanking(rankingType);

    const currentUserLevel = currentUserWithStatus?.userLevel;
    const currentUserId = currentUserWithStatus?.id;

    const currentUserUnderstandingPercent = useMemo(() => {
        if (activeTab !== 'adventure' || !currentUserWithStatus) return undefined;
        try {
            return getAdventureCodexCompletionBreakdown(currentUserWithStatus.adventureProfile).overallPercent;
        } catch {
            return 0;
        }
    }, [activeTab, currentUserWithStatus]);

    const rankings = useMemo(() => {
        return rankingEntries.map((entry) => {
            let monsterUnderstandingPercent: number | undefined;
            if (activeTab === 'adventure') {
                if (
                    entry.monsterUnderstandingPercent != null &&
                    Number.isFinite(Number(entry.monsterUnderstandingPercent))
                ) {
                    monsterUnderstandingPercent = Number(entry.monsterUnderstandingPercent);
                } else if (entry.id === currentUserId && currentUserUnderstandingPercent != null) {
                    // 구버전 API 캐시일 때 내 행만 클라이언트로 보정
                    monsterUnderstandingPercent = currentUserUnderstandingPercent;
                }
            }
            return {
                user: {
                    id: entry.id,
                    nickname: entry.nickname,
                    avatarId: entry.avatarId,
                    borderId: entry.borderId,
                    userLevel:
                        entry.userLevel ??
                        (entry.id === currentUserId && typeof currentUserLevel === 'number'
                            ? currentUserLevel
                            : undefined),
                } as User,
                value: entry.score,
                rank: entry.rank,
                monsterUnderstandingPercent,
            };
        });
    }, [
        rankingEntries,
        currentUserId,
        currentUserLevel,
        activeTab,
        currentUserUnderstandingPercent,
    ]);

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
    }, [activeTab, lockedTab]);

    const displayedRankings = rankings.slice(0, displayCount);

    const currentUserRanking = useMemo(() => {
        if (!currentUserWithStatus) return null;
        const rank = rankings.findIndex(r => r.user && r.user.id === currentUserWithStatus.id);
        if (rank !== -1) {
            return { ...rankings[rank], rank: rank + 1 };
        }
        
        let value;
        let monsterUnderstandingPercent: number | undefined;
        if (activeTab === 'combat') {
            const totalStats = calculateTotalStats(currentUserWithStatus);
            value = Object.values(totalStats).reduce((acc, val) => acc + val, 0);
        } else if (activeTab === 'adventure') {
            value = getAdventureHuntingScore(currentUserWithStatus.adventureProfile).score;
            monsterUnderstandingPercent = currentUserUnderstandingPercent ?? 0;
        } else {
            value = currentUserWithStatus.mannerScore;
        }
        
        return { user: currentUserWithStatus, value, rank: 'N/A' as const, monsterUnderstandingPercent };
    }, [rankings, currentUserWithStatus, activeTab, currentUserUnderstandingPercent]);

    return (
        <div
            className={`relative flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-amber-500/20 bg-gradient-to-b from-zinc-900/95 via-zinc-950 to-black text-on-panel shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-black/30 ${
                wide ? 'gap-1.5 p-2.5' : rowDense ? 'gap-0.5 p-0.5' : 'gap-1.5 p-2'
            }`}
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/35 to-transparent" aria-hidden />
            <h3
                className={`relative z-[1] flex-shrink-0 text-center font-black tracking-tight ${
                    wide
                        ? 'bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-200/90 bg-clip-text text-lg text-transparent sm:text-xl'
                        : rowDense
                          ? 'text-[8px] leading-tight text-secondary'
                          : 'bg-gradient-to-r from-amber-100 via-yellow-50 to-amber-200/90 bg-clip-text text-xs text-transparent sm:text-sm'
                }`}
            >
                {panelTitle ?? t('rankingBoard.title')}
            </h3>
            {!lockedTab && (
                <div
                    className={`relative z-[1] flex flex-shrink-0 rounded-xl border border-white/10 bg-black/45 p-1 shadow-inner ${wide ? '' : rowDense ? 'p-px' : ''}`}
                >
                    <button
                        type="button"
                        onClick={() => setFreeTab('combat')}
                        className={`flex-1 rounded-lg font-semibold transition-all ${
                            wide ? 'py-1.5 text-[11px]' : rowDense ? 'py-0.5 text-[7px]' : 'py-1.5 text-xs'
                        } ${
                            activeTab === 'combat'
                                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-blue-500/25'
                                : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                        }`}
                    >
                        {t('rankingBoard.tabAbility')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setFreeTab('adventure')}
                        className={`flex-1 rounded-lg font-semibold transition-all ${
                            wide ? 'py-1.5 text-[11px]' : rowDense ? 'py-0.5 text-[7px]' : 'py-1.5 text-xs'
                        } ${
                            activeTab === 'adventure'
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/25'
                                : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                        }`}
                    >
                        {t('rankingBoard.tabAdventure')}
                    </button>
                    <button
                        type="button"
                        onClick={() => setFreeTab('manner')}
                        className={`flex-1 rounded-lg font-semibold transition-all ${
                            wide ? 'py-1.5 text-[11px]' : rowDense ? 'py-0.5 text-[7px]' : 'py-1.5 text-xs'
                        } ${
                            activeTab === 'manner'
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-md shadow-amber-500/25'
                                : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                        }`}
                    >
                        {t('rankingBoard.tabManner')}
                    </button>
                </div>
            )}
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
                        <div className={`flex h-full items-center justify-center text-gray-400 ${wide ? 'px-1 text-center text-sm leading-snug sm:text-base' : 'text-xs'}`}>
                            {t('rankingBoard.loading')}
                        </div>
                    ) : error ? (
                        <div className={`flex h-full items-center justify-center text-red-400 ${wide ? 'px-1 text-center text-sm leading-snug sm:text-base' : 'text-xs'}`}>
                            {t('rankingBoard.loadFailed')}
                        </div>
                    ) : rankings.length === 0 ? (
                        <div className={`flex h-full items-center justify-center text-gray-400 ${wide ? 'px-1 text-center text-sm leading-snug sm:text-base' : 'text-xs'}`}>
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
                                        currentUserId={currentUserId}
                                        currentUserLevel={currentUserLevel}
                                        monsterUnderstandingPercent={currentUserRanking.monsterUnderstandingPercent}
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
                                            isCurrentUser={r.user.id === currentUserId}
                                            onViewUser={handlers.openViewingUser}
                                            dense={rowDense}
                                            mobileWide={wide}
                                            currentUserId={currentUserId}
                                            currentUserLevel={currentUserLevel}
                                            monsterUnderstandingPercent={r.monsterUnderstandingPercent}
                                        />
                                    ))}
                                    {displayCount < rankings.length && (
                                        <div ref={loadMoreRef} className={`py-2 text-center text-gray-400 ${wide ? 'text-sm sm:text-base' : 'text-xs'}`}>
                                            {t('rankingBoard.loadingMore')}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
                {wide && !hideInlineGuide && (
                    <div className="flex min-h-0 flex-[3] flex-col overflow-hidden">
                        <MobileRankingGuidePanel
                            variant={
                                activeTab === 'combat'
                                    ? 'game-combat'
                                    : activeTab === 'adventure'
                                      ? 'game-adventure'
                                      : 'game-manner'
                            }
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default GameRankingBoard;