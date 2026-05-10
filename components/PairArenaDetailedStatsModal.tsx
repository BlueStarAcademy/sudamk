import React, { useMemo, useState } from 'react';
import { UserWithStatus, GameMode, ServerAction } from '../types.js';
import { SPECIAL_GAME_MODES, RANKING_TIERS } from '../constants';
import DraggableWindow from './DraggableWindow.js';
import ConfirmModal from './ConfirmModal.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { getCurrentSeason } from '../utils/timeUtils.js';
import { readPairRankedBlock, readPairArenaAiMatchRecord } from '../shared/utils/unifiedRankedStatsMigration.js';

/** `UserProfileModal`과 동일: 시즌 표시 점수 = 1200 + dailyRankings.pair 델타 */
const SEASON_BASE_SCORE = 1200;

const getTier = (score: number, rank: number, totalGames: number) => {
    for (const tier of RANKING_TIERS) {
        if (tier.threshold(score, rank, totalGames)) return tier;
    }
    return RANKING_TIERS[RANKING_TIERS.length - 1];
};

interface PairArenaDetailedStatsModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
}

export interface PairArenaStatsPanelProps {
    currentUser: UserWithStatus;
    onAction: (action: ServerAction) => void;
}

type PairArenaResetConfirm = { type: 'single'; mode: GameMode; displayName: string } | { type: 'all' };

const DIAMOND_ICON = '/images/icon/Zem.png';

const SINGLE_RESET_COST = 300;
const CATEGORY_RESET_COST = 500;

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

const pairArenaPanelTheme = {
    accent: 'border-violet-500/35',
    rowHover: 'hover:bg-violet-400/[0.07]',
    labelMuted: 'text-violet-200/55',
    unifiedBg:
        'border-violet-400/35 bg-gradient-to-r from-violet-950/45 via-zinc-950/80 to-black/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_28px_-18px_rgba(139,92,246,0.35)]',
    unifiedScore: 'text-violet-100',
    winText: 'text-violet-100/95',
    singleBtn:
        'border border-violet-400/45 bg-gradient-to-r from-violet-900/45 to-zinc-900/85 text-violet-50 hover:border-violet-300/70 hover:from-violet-800/50 hover:to-zinc-800/90 active:translate-y-px disabled:opacity-40',
    categoryBtn:
        'border border-violet-400/40 bg-gradient-to-r from-slate-950/90 via-zinc-950/90 to-violet-950/35 text-violet-50/95 hover:border-violet-300/55 hover:from-zinc-900/90 hover:to-violet-900/40 active:translate-y-px disabled:opacity-40',
} as const;

/**
 * 페어 경기장: 통합 전적 + 전략 모드별 승패 (PVP 상세 모달 페어 탭·단독 모달 공용).
 */
export const PairArenaStatsPanel: React.FC<PairArenaStatsPanelProps> = ({ currentUser, onAction }) => {
    const { isNativeMobile } = useNativeMobileShell();
    const { stats, diamonds, pairArenaStatsByMode } = currentUser;
    const [pairResetConfirm, setPairResetConfirm] = useState<PairArenaResetConfirm | null>(null);

    const pairRankedBlk = readPairRankedBlock(stats as Record<string, { wins?: number; losses?: number; rankingScore?: number }>);
    const aggWins = pairRankedBlk.wins;
    const aggLosses = pairRankedBlk.losses;
    const pairAiBlk = readPairArenaAiMatchRecord(stats as Record<string, { wins?: number; losses?: number }>);

    const pairSeasonRank = useMemo(() => {
        const dr = currentUser.dailyRankings?.pair;
        let seasonScore: number;
        let rank: number;
        const totalGames = aggWins + aggLosses;
        if (dr && typeof dr.rank === 'number') {
            const delta = typeof dr.score === 'number' ? dr.score : 0;
            seasonScore = SEASON_BASE_SCORE + delta;
            rank = dr.rank;
        } else {
            seasonScore = pairRankedBlk.rankingScore;
            rank = 99_999;
        }
        const tier = getTier(seasonScore, rank, totalGames);
        return {
            tier,
            score: Math.round(seasonScore),
            rank: dr && typeof dr.rank === 'number' ? dr.rank : (null as number | null),
            seasonLabel: getCurrentSeason().name,
        };
    }, [currentUser.dailyRankings?.pair, aggWins, aggLosses, pairRankedBlk.rankingScore]);

    const canAffordSingle = diamonds >= SINGLE_RESET_COST;
    const canAffordCategory = diamonds >= CATEGORY_RESET_COST;

    const theme = pairArenaPanelTheme;

    const pairResetConfirmMessage = useMemo(() => {
        if (!pairResetConfirm) return '';
        if (pairResetConfirm.type === 'single') {
            return `「${pairResetConfirm.displayName}」 모드의 페어 경기장 전적만 초기화합니다. 랭킹전 레이팅·랭킹전 승패는 변하지 않습니다.`;
        }
        return '페어 경기장 모드별 전적을 모두 지우고, 페어 랭킹전 레이팅·랭킹전 승·패·페어 AI 대전 전적도 초기화합니다.';
    }, [pairResetConfirm]);

    const handleResetSingle = (mode: GameMode, displayName: string) => {
        if (!canAffordSingle) return;
        setPairResetConfirm({ type: 'single', mode, displayName });
    };

    const handleResetAll = () => {
        if (!canAffordCategory) return;
        setPairResetConfirm({ type: 'all' });
    };

    const executePairResetConfirm = () => {
        const c = pairResetConfirm;
        if (!c) return;
        if (c.type === 'single') {
            onAction({ type: 'RESET_PAIR_ARENA_SINGLE_STAT', payload: { mode: c.mode } });
        } else {
            onAction({ type: 'RESET_PAIR_ARENA_STRATEGIC_ALL' });
        }
    };

    return (
        <>
        <div className="space-y-2.5 text-primary sm:space-y-3">
            <div className={`relative overflow-hidden rounded-xl border px-2.5 py-2 sm:px-3 sm:py-2 ${theme.unifiedBg}`}>
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
                    aria-hidden
                />
                <div className="flex items-center gap-2 sm:gap-2.5">
                    <img
                        src={pairSeasonRank.tier.icon}
                        alt=""
                        className="h-[3.75rem] w-[3.75rem] shrink-0 rounded-lg border border-white/15 bg-black/30 object-contain p-1 shadow-sm ring-1 ring-white/10 sm:h-16 sm:w-16"
                        aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                        <div
                            className={`flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[11px] font-semibold leading-tight sm:text-xs ${theme.labelMuted}`}
                        >
                            <span className="uppercase tracking-[0.08em]">페어 랭킹전</span>
                            <span className="opacity-40" aria-hidden>
                                ·
                            </span>
                            <span className="text-violet-100/75">시즌 {pairSeasonRank.seasonLabel}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0">
                            <span className={`text-sm font-bold sm:text-base ${pairSeasonRank.tier.color}`}>{pairSeasonRank.tier.name}</span>
                            <span className={`text-lg font-black tabular-nums tracking-tight sm:text-xl ${theme.unifiedScore}`}>
                                {pairSeasonRank.score.toLocaleString()}
                                <span className="ml-0.5 text-[0.65em] font-semibold text-secondary/85">점</span>
                            </span>
                            <span className="text-[11px] font-semibold text-zinc-300 tabular-nums sm:text-xs">
                                통합 {aggWins.toLocaleString()}승 {aggLosses.toLocaleString()}패
                            </span>
                            <span className="basis-full text-[11px] font-semibold text-fuchsia-200/90 tabular-nums sm:text-xs">
                                페어 AI {pairAiBlk.wins.toLocaleString()}승 {pairAiBlk.losses.toLocaleString()}패
                            </span>
                            {typeof pairSeasonRank.rank === 'number' && (
                                <span className="text-[11px] font-semibold text-violet-200/55 tabular-nums sm:text-xs">
                                    랭킹 {pairSeasonRank.rank.toLocaleString()}위
                                </span>
                            )}
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled={!canAffordCategory}
                        title={
                            canAffordCategory
                                ? `다이아 ${CATEGORY_RESET_COST.toLocaleString()} — 페어 전략 모드 전체`
                                : `다이아 부족 (필요 ${CATEGORY_RESET_COST.toLocaleString()})`
                        }
                        onClick={handleResetAll}
                        className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-[11px] font-semibold leading-tight sm:px-2.5 sm:py-2 sm:text-xs ${theme.categoryBtn}`}
                    >
                        <span>전체 초기화</span>
                        <DiamondPrice
                            amount={CATEGORY_RESET_COST}
                            iconClassName="h-3.5 w-3.5 min-w-[0.875rem] sm:h-4 sm:w-4 sm:min-w-[1rem]"
                            className="text-violet-100/90"
                        />
                    </button>
                </div>
            </div>

            <div className="overflow-x-hidden">
                <div className={`rounded-lg border p-2 sm:p-2.5 ${theme.accent} bg-slate-950/40`}>
                    <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                        {SPECIAL_GAME_MODES.map(({ mode, name, image }) => {
                            const row = pairArenaStatsByMode?.[String(mode)];
                            const wins = row?.wins ?? 0;
                            const losses = row?.losses ?? 0;
                            const totalGames = wins + losses;
                            const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

                            return (
                                <div
                                    key={mode}
                                    className={`flex min-h-[8.75rem] flex-col items-center rounded-lg border border-white/10 bg-black/25 px-1.5 py-2 shadow-sm transition-colors sm:min-h-[9.25rem] sm:px-2 ${theme.rowHover}`}
                                >
                                    <div className="mb-1.5 flex flex-col items-center gap-1.5 text-center">
                                        <img
                                            src={image}
                                            alt=""
                                            className="h-[3.25rem] w-[3.25rem] shrink-0 rounded-lg border border-white/15 bg-black/25 object-contain p-0.5 sm:h-[3.5rem] sm:w-[3.5rem]"
                                            aria-hidden
                                        />
                                        <p className="line-clamp-2 text-center text-xs font-semibold leading-snug tracking-tight text-primary sm:line-clamp-1 sm:text-sm">
                                            {name}
                                        </p>
                                    </div>
                                    <div
                                        className={`mb-1.5 flex min-w-0 items-center justify-center gap-x-1.5 text-[11px] tabular-nums sm:text-xs ${theme.winText}`}
                                    >
                                        <span className="shrink-0 text-center leading-tight">
                                            <span className="font-bold">{wins}</span>
                                            <span className="text-secondary/75">승 </span>
                                            <span className="font-bold text-slate-200">{losses}</span>
                                            <span className="text-secondary/75">패</span>
                                            <span className="ml-1 text-sky-200/95">({winRate}%)</span>
                                        </span>
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
                                        className={`mt-auto inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors sm:h-8 sm:px-2.5 sm:text-xs ${theme.singleBtn}`}
                                    >
                                        <span>초기화</span>
                                        <DiamondPrice
                                            amount={SINGLE_RESET_COST}
                                            className="text-violet-100/90"
                                            iconClassName="h-4 w-4 min-w-[1rem] sm:h-[1.125rem] sm:w-[1.125rem] sm:min-w-[1.125rem]"
                                        />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
        {pairResetConfirm && (
            <ConfirmModal
                title="전적 초기화"
                variant="premium-ledger"
                ledgerCost={
                    pairResetConfirm.type === 'single' ? SINGLE_RESET_COST : CATEGORY_RESET_COST
                }
                message={pairResetConfirmMessage}
                confirmText="초기화하기"
                cancelText="취소"
                onCancel={() => setPairResetConfirm(null)}
                onConfirm={executePairResetConfirm}
                windowId="pair-arena-stats-reset-confirm"
                isTopmost
            />
        )}
        </>
    );
};

/** 페어 경기장 상세 전적 단독 창 */
const PairArenaDetailedStatsModal: React.FC<PairArenaDetailedStatsModalProps> = ({ currentUser, onClose, onAction }) => {
    const { isNativeMobile } = useNativeMobileShell();

    return (
        <DraggableWindow
            title="페어 경기장 상세 전적"
            onClose={onClose}
            windowId="pair-arena-detailed-stats"
            initialWidth={isNativeMobile ? 420 : 680}
            initialHeight={isNativeMobile ? 668 : 708}
            bodyPaddingClassName={isNativeMobile ? 'p-2.5' : 'p-2.5 sm:p-3.5'}
        >
            <PairArenaStatsPanel currentUser={currentUser} onAction={onAction} />
        </DraggableWindow>
    );
};

export default PairArenaDetailedStatsModal;
