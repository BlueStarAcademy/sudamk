
import React, { useMemo, useState } from 'react';
import { UserWithStatus, GameMode, ServerAction } from '../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, RANKING_TIERS } from '../constants';
import DraggableWindow from './DraggableWindow.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { getCurrentSeason } from '../utils/timeUtils.js';
import { PairArenaStatsPanel } from './PairArenaDetailedStatsModal.js';
import ConfirmModal from './ConfirmModal.js';
import { readStrategicRankedMatchRecord } from '../shared/utils/unifiedRankedStatsMigration.js';

interface DetailedStatsModalProps {
    currentUser: UserWithStatus;
    statsType: 'strategic' | 'playful' | 'both';
    onClose: () => void;
    onAction: (action: ServerAction) => void;
}

const DIAMOND_ICON = '/images/icon/Zem.webp';

const SINGLE_RESET_COST = 300;
const CATEGORY_RESET_COST = 500;

/** 대기실·프로필과 동일: 시즌 표시 점수 = 1200 + dailyRankings에 저장된 델타 */
const SEASON_BASE_SCORE = 1200;

/** `UserProfileModal` / 대기실과 동일한 랭킹전 티어 산정 */
const getTier = (score: number, rank: number, totalGames: number) => {
    for (const tier of RANKING_TIERS) {
        if (tier.threshold(score, rank, totalGames)) return tier;
    }
    return RANKING_TIERS[RANKING_TIERS.length - 1];
};

type StatsResetConfirm =
    | { type: 'single'; mode: GameMode; displayName: string }
    | { type: 'category'; category: 'strategic' | 'playful' };

const DiamondPrice: React.FC<{ amount: number; className?: string; iconClassName?: string }> = ({
    amount,
    className = '',
    iconClassName = 'h-[1em] w-[1em] min-w-[1em]',
}) => (
    <span
        className={`inline-flex items-center gap-0.5 tabular-nums ${className}`}
        aria-label={`다이아 ${amount.toLocaleString()}`}
    >
        <img src={DIAMOND_ICON} alt="" className={`object-contain ${iconClassName}`} aria-hidden />
        <span className="font-semibold">{amount.toLocaleString()}</span>
    </span>
);

const DetailedStatsModal: React.FC<DetailedStatsModalProps> = ({ currentUser, statsType, onClose, onAction }) => {
    const [combinedTab, setCombinedTab] = useState<'strategic' | 'pair'>('strategic');
    const [statsResetConfirm, setStatsResetConfirm] = useState<StatsResetConfirm | null>(null);
    const isPairTab = statsType === 'both' && combinedTab === 'pair';
    const isStrategic =
        statsType === 'playful' ? false : statsType === 'strategic' ? true : statsType === 'both' ? combinedTab === 'strategic' : true;
    const showUnifiedRanking = isStrategic;
    /** 카테고리 일괄 초기화: 놀이는 전적만, 전략은 시즌 랭킹 연동 초기화 */
    const categoryResetTarget: 'strategic' | 'playful' = statsType === 'playful' ? 'playful' : 'strategic';
    const { isNativeMobile } = useNativeMobileShell();
    const title =
        statsType === 'both' ? 'PVP 경기장 상세 전적' : isStrategic ? '전략 바둑 상세 전적' : '놀이 바둑 상세 전적';
    const modes = isStrategic ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
    const { stats, diamonds } = currentUser;

    const canAffordSingle = diamonds >= SINGLE_RESET_COST;
    const canAffordCategory = diamonds >= CATEGORY_RESET_COST;

    const theme = useMemo(
        () =>
            isStrategic
                ? {
                      accent: 'border-amber-500/35',
                      rowHover: 'hover:bg-amber-400/[0.07]',
                      labelMuted: 'text-amber-200/55',
                      unifiedBg:
                          'border-amber-400/35 bg-gradient-to-r from-amber-950/45 via-zinc-950/80 to-black/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_28px_-18px_rgba(251,191,36,0.35)]',
                      unifiedScore: 'text-amber-100',
                      winText: 'text-amber-100/95',
                      singleBtn:
                          'border border-amber-400/45 bg-gradient-to-r from-amber-900/45 to-zinc-900/85 text-amber-50 hover:border-amber-300/70 hover:from-amber-800/50 hover:to-zinc-800/90 active:translate-y-px disabled:opacity-40',
                      categoryBtn:
                          'border border-amber-400/40 bg-gradient-to-r from-slate-950/90 via-zinc-950/90 to-amber-950/35 text-amber-50/95 hover:border-amber-300/55 hover:from-zinc-900/90 hover:to-amber-900/40 active:translate-y-px disabled:opacity-40',
                  }
                : {
                      accent: 'border-fuchsia-500/35',
                      rowHover: 'hover:bg-fuchsia-400/[0.07]',
                      labelMuted: 'text-fuchsia-200/50',
                      unifiedBg:
                          'border-fuchsia-400/35 bg-gradient-to-r from-fuchsia-950/40 via-zinc-950/80 to-black/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_28px_-18px_rgba(217,70,239,0.35)]',
                      unifiedScore: 'text-fuchsia-100',
                      winText: 'text-fuchsia-100/95',
                      singleBtn:
                          'border border-fuchsia-400/45 bg-gradient-to-r from-fuchsia-900/40 to-zinc-900/85 text-fuchsia-50 hover:border-fuchsia-300/65 hover:from-fuchsia-800/45 hover:to-zinc-800/90 active:translate-y-px disabled:opacity-40',
                      categoryBtn:
                          'border border-fuchsia-400/40 bg-gradient-to-r from-slate-950/90 via-zinc-950/90 to-fuchsia-950/30 text-fuchsia-50/95 hover:border-fuchsia-300/55 hover:from-zinc-900/90 hover:to-fuchsia-900/38 active:translate-y-px disabled:opacity-40',
                  },
        [isStrategic]
    );

    const unifiedRanking = useMemo(() => {
        if (!isStrategic) {
            return { score: SEASON_BASE_SCORE, rank: null as number | null, totalGames: 0 };
        }
        const dr = currentUser.dailyRankings?.strategic;
        const modeList = SPECIAL_GAME_MODES;
        const rankedRec = readStrategicRankedMatchRecord(currentUser.stats);
        const totalGames = rankedRec.wins + rankedRec.losses;
        if (dr && typeof dr.rank === 'number') {
            const delta = typeof dr.score === 'number' ? dr.score : 0;
            const seasonScore = SEASON_BASE_SCORE + delta;
            return {
                score: Math.round(seasonScore),
                rank: dr.rank,
                totalGames,
            };
        }
        let sum = 0;
        let count = 0;
        for (const m of modeList) {
            const s = currentUser.stats?.[m.mode];
            if (s && typeof s.rankingScore === 'number') {
                sum += s.rankingScore;
                count++;
            }
        }
        const seasonScore = count > 0 ? sum / count : SEASON_BASE_SCORE;
        return {
            score: Math.round(seasonScore),
            rank: null as number | null,
            totalGames,
        };
    }, [currentUser.dailyRankings, currentUser.stats, isStrategic]);

    const strategicSeasonTier = useMemo(() => {
        if (!isStrategic) return null;
        const rank = unifiedRanking.rank ?? 99_999;
        return {
            tier: getTier(unifiedRanking.score, rank, unifiedRanking.totalGames),
            seasonLabel: getCurrentSeason().name,
            rank: unifiedRanking.rank,
        };
    }, [isStrategic, unifiedRanking]);

    const statsResetConfirmMessage = useMemo(() => {
        if (!statsResetConfirm) return '';
        if (statsResetConfirm.type === 'single') {
            return `「${statsResetConfirm.displayName}」 모드의 승·패만 초기화합니다.`;
        }
        if (statsResetConfirm.category === 'strategic') {
            return '전략 모드 전체와 시즌 랭킹 점수를 함께 초기화합니다.';
        }
        return '놀이 모드 전체의 승·패를 초기화합니다.';
    }, [statsResetConfirm]);

    const handleResetSingle = (mode: GameMode, displayName: string) => {
        if (!canAffordSingle) return;
        setStatsResetConfirm({ type: 'single', mode, displayName });
    };

    const handleResetAll = () => {
        if (!canAffordCategory) return;
        setStatsResetConfirm({ type: 'category', category: categoryResetTarget });
    };

    const executeStatsResetConfirm = () => {
        const c = statsResetConfirm;
        if (!c) return;
        if (c.type === 'single') {
            onAction({ type: 'RESET_SINGLE_STAT', payload: { mode: c.mode } });
        } else {
            onAction({ type: 'RESET_STATS_CATEGORY', payload: { category: c.category } });
        }
    };

    const unifiedLabel = '전략 바둑 통합 랭킹';

    return (
        <>
            <DraggableWindow
                title={title}
                onClose={onClose}
                windowId="detailed-stats"
                initialWidth={isNativeMobile ? 420 : 660}
                initialHeight={isNativeMobile ? 620 : 640}
                bodyPaddingClassName={isNativeMobile ? 'p-2.5' : 'p-2.5 sm:p-3.5'}
            >
                <div className="space-y-2.5 text-primary sm:space-y-3">
                    {statsType === 'both' && (
                        <div className="flex gap-1 rounded-lg border border-white/10 bg-black/30 p-1" role="tablist" aria-label="상세 전적 구분">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={combinedTab === 'strategic'}
                                onClick={() => setCombinedTab('strategic')}
                                className={`min-h-0 min-w-0 flex-1 rounded-md px-2.5 py-2.5 text-sm font-bold transition-all sm:px-3 sm:py-2.5 sm:text-base ${
                                    combinedTab === 'strategic'
                                        ? 'border border-cyan-400/50 bg-cyan-950/60 text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                                        : 'border border-transparent text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                                }`}
                            >
                                전략
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={combinedTab === 'pair'}
                                onClick={() => setCombinedTab('pair')}
                                className={`min-h-0 min-w-0 flex-1 rounded-md px-2.5 py-2.5 text-sm font-bold transition-all sm:px-3 sm:py-2.5 sm:text-base ${
                                    combinedTab === 'pair'
                                        ? 'border border-violet-400/50 bg-violet-950/55 text-violet-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                                        : 'border border-transparent text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                                }`}
                            >
                                페어
                            </button>
                        </div>
                    )}
                    {showUnifiedRanking && strategicSeasonTier && (
                        <div
                            className={`relative overflow-hidden rounded-xl border px-3.5 py-3 sm:px-4 sm:py-3.5 ${theme.unifiedBg}`}
                        >
                            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" aria-hidden />
                            <div className="flex items-center justify-between gap-2 sm:gap-3">
                                <div className="min-w-0">
                                    <p className={`text-xs font-semibold uppercase tracking-[0.11em] ${theme.labelMuted}`}>{unifiedLabel}</p>
                                    <p className="mt-1 text-xs font-semibold text-amber-100/75 sm:text-sm">
                                        현재 시즌 · {strategicSeasonTier.seasonLabel}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2.5 sm:gap-3">
                                        <img
                                            src={strategicSeasonTier.tier.icon}
                                            alt=""
                                            className="h-11 w-11 shrink-0 rounded-lg border border-white/15 bg-black/30 object-contain p-1 shadow-sm ring-1 ring-white/10 sm:h-12 sm:w-12"
                                            aria-hidden
                                        />
                                        <span className={`text-base font-bold sm:text-lg ${strategicSeasonTier.tier.color}`}>
                                            {strategicSeasonTier.tier.name}
                                        </span>
                                        <p className={`text-2xl font-black tabular-nums tracking-tight sm:text-3xl ${theme.unifiedScore}`}>
                                            {unifiedRanking.score.toLocaleString()}
                                            <span className="ml-1 text-[0.7em] font-semibold text-secondary/85">점</span>
                                        </p>
                                    </div>
                                    {typeof strategicSeasonTier.rank === 'number' && (
                                        <p className="mt-1.5 text-xs font-semibold text-amber-200/60 tabular-nums sm:text-[13px]">
                                            랭킹 {strategicSeasonTier.rank.toLocaleString()}위
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    disabled={!canAffordCategory}
                                    title={
                                        canAffordCategory
                                            ? `다이아 ${CATEGORY_RESET_COST.toLocaleString()} — 전략 전체`
                                            : `다이아 부족 (필요 ${CATEGORY_RESET_COST.toLocaleString()})`
                                    }
                                    onClick={handleResetAll}
                                    className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm ${theme.categoryBtn}`}
                                >
                                    <span>전체 초기화</span>
                                    <DiamondPrice amount={CATEGORY_RESET_COST} iconClassName="h-4 w-4 min-w-[1rem] sm:h-[1.125rem] sm:w-[1.125rem] sm:min-w-[1.125rem]" className="text-cyan-100/90" />
                                </button>
                            </div>
                        </div>
                    )}

                    {!showUnifiedRanking && statsType === 'playful' && (
                        <div className="flex justify-end">
                            <button
                                type="button"
                                disabled={!canAffordCategory}
                                title={
                                    canAffordCategory
                                        ? `다이아 ${CATEGORY_RESET_COST.toLocaleString()} — 놀이 전체`
                                        : `다이아 부족 (필요 ${CATEGORY_RESET_COST.toLocaleString()})`
                                }
                                onClick={handleResetAll}
                                className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm ${theme.categoryBtn}`}
                            >
                                <span>전체 초기화</span>
                                <DiamondPrice amount={CATEGORY_RESET_COST} iconClassName="h-4 w-4 min-w-[1rem] sm:h-[1.125rem] sm:w-[1.125rem] sm:min-w-[1.125rem]" className="text-cyan-100/90" />
                            </button>
                        </div>
                    )}

                    {isPairTab ? (
                        <PairArenaStatsPanel currentUser={currentUser} onAction={onAction} />
                    ) : (
                        <div className="overflow-x-hidden">
                            <div className={`rounded-lg border p-2.5 sm:p-3 ${theme.accent} bg-slate-950/40`}>
                                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                                    {modes.map(({ mode, name, image }) => {
                                        const gameStats = stats?.[mode];
                                        const wins = gameStats?.wins ?? 0;
                                        const losses = gameStats?.losses ?? 0;
                                        const totalGames = wins + losses;
                                        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
                                        const aiW = gameStats?.aiWins ?? 0;
                                        const aiL = gameStats?.aiLosses ?? 0;
                                        const aiTot = aiW + aiL;
                                        const aiWr = aiTot > 0 ? Math.round((aiW / aiTot) * 100) : 0;

                                        return (
                                            <div
                                                key={mode}
                                                className={`flex min-h-[10.75rem] flex-col items-center rounded-lg border border-white/10 bg-black/25 px-2 py-3 shadow-sm transition-colors sm:min-h-[11.5rem] sm:px-2.5 ${theme.rowHover}`}
                                            >
                                                <div className="mb-2 flex flex-col items-center gap-2 text-center">
                                                    <img
                                                        src={image}
                                                        alt=""
                                                        className="h-[3.75rem] w-[3.75rem] shrink-0 rounded-lg border border-white/15 bg-black/25 object-contain p-1 sm:h-[4.25rem] sm:w-[4.25rem]"
                                                        aria-hidden
                                                    />
                                                    <p className="line-clamp-2 text-center text-sm font-semibold leading-snug tracking-tight text-primary sm:line-clamp-1 sm:text-base">
                                                        {name}
                                                    </p>
                                                </div>
                                                <div
                                                    className={`mb-1 flex min-w-0 flex-col items-center justify-center gap-y-0.5 text-[11px] tabular-nums sm:text-xs ${theme.winText}`}
                                                >
                                                    <span className="shrink-0 text-center leading-tight">
                                                        <span className="text-secondary/80">PVP </span>
                                                        <span className="font-bold">{wins}</span>
                                                        <span className="text-secondary/75">승 </span>
                                                        <span className="font-bold text-slate-200">{losses}</span>
                                                        <span className="text-secondary/75">패</span>
                                                        <span className="ml-1 text-sky-200/95">({winRate}%)</span>
                                                    </span>
                                                    {aiTot > 0 ? (
                                                        <span className="shrink-0 text-center leading-tight text-violet-200/90">
                                                            <span className="text-violet-300/70">AI </span>
                                                            <span className="font-bold">{aiW}</span>승{' '}
                                                            <span className="font-bold">{aiL}</span>패 ({aiWr}%)
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <button
                                                    type="button"
                                                    disabled={!canAffordSingle}
                                                    title={
                                                        canAffordSingle
                                                            ? `다이아 ${SINGLE_RESET_COST} — 이 모드만 초기화`
                                                            : `다이아 부족 (필요 ${SINGLE_RESET_COST})`
                                                    }
                                                    onClick={() => handleResetSingle(mode, name)}
                                                    className={`mt-auto inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors sm:h-9 sm:px-3 sm:text-sm ${theme.singleBtn}`}
                                                >
                                                    <span>초기화</span>
                                                    <DiamondPrice
                                                        amount={SINGLE_RESET_COST}
                                                        className="text-cyan-100/90"
                                                        iconClassName="h-4 w-4 min-w-[1rem] sm:h-[1.125rem] sm:w-[1.125rem] sm:min-w-[1.125rem]"
                                                    />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DraggableWindow>
            {statsResetConfirm && (
                <ConfirmModal
                    title="전적 초기화"
                    variant="premium-ledger"
                    ledgerCost={
                        statsResetConfirm.type === 'single' ? SINGLE_RESET_COST : CATEGORY_RESET_COST
                    }
                    message={statsResetConfirmMessage}
                    confirmText="초기화하기"
                    cancelText="취소"
                    onCancel={() => setStatsResetConfirm(null)}
                    onConfirm={executeStatsResetConfirm}
                    windowId="detailed-stats-reset-confirm"
                    isTopmost
                />
            )}
        </>
    );
};

export default DetailedStatsModal;
