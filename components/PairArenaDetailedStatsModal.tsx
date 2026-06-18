import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserWithStatus, GameMode, ServerAction } from '../types.js';
import { SPECIAL_GAME_MODES, RANKING_TIERS } from '../constants';
import DraggableWindow from './DraggableWindow.js';
import AlertModal from './AlertModal.js';
import DetailedStatsResetConfirmModal from './DetailedStatsResetConfirmModal.js';
import type { DetailedStatResetScope } from '../shared/types/detailedStatReset.js';
import {
    DETAILED_STAT_NO_RESET_MESSAGE,
    hasPairArenaCategoryStatsToReset,
    hasPairArenaSingleStatsToReset,
} from '../shared/utils/detailedStatResetChecks.js';
import { readPairArenaAiMatchRecord, readPairRankedMatchRecord } from '../shared/utils/unifiedRankedStatsMigration.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { getCurrentSeason } from '../utils/timeUtils.js';
import { readPairRankedBlock } from '../shared/utils/unifiedRankedStatsMigration.js';

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
    /** PVP 상세 전적 3열 레이아웃 — 좁은 열에 맞춘 단일 컬럼 카드 */
    columnLayout?: boolean;
    /** false면 모드 목록 스크롤을 부모(탭 패널)에 맡김 */
    scrollModesInPanel?: boolean;
}

type PairArenaResetConfirm = { type: 'single'; mode: GameMode; displayName: string } | { type: 'all' };

const DIAMOND_ICON = '/images/icon/Zem.webp';

const SINGLE_RESET_COST = 300;
const CATEGORY_RESET_COST = 500;

const DiamondPrice: React.FC<{ amount: number; className?: string; iconClassName?: string }> = ({
    amount,
    className = '',
    iconClassName = 'h-[1em] w-[1em] min-w-[1em]',
}) => {
    const { t } = useTranslation('profile');
    return (
    <span
        className={`inline-flex items-center gap-0.5 tabular-nums ${className}`}
        aria-label={t('detailedStats.diamondsAria', { amount: amount.toLocaleString() })}
    >
        <img src={DIAMOND_ICON} alt="" className={`object-contain ${iconClassName}`} aria-hidden />
        <span className="font-semibold">{amount.toLocaleString()}</span>
    </span>
    );
};

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
export const PairArenaStatsPanel: React.FC<PairArenaStatsPanelProps> = ({
    currentUser,
    onAction,
    columnLayout = false,
    scrollModesInPanel = true,
}) => {
    const { t } = useTranslation('profile');
    const { t: tGame } = useTranslation('game');
    const { stats, diamonds, pairArenaStatsByMode } = currentUser;
    const [pairResetConfirm, setPairResetConfirm] = useState<PairArenaResetConfirm | null>(null);
    const [pairResetAlert, setPairResetAlert] = useState<string | null>(null);

    const pairRankedBlk = readPairRankedBlock(stats as Record<string, { wins?: number; losses?: number; rankingScore?: number }>);
    const aggWins = pairRankedBlk.wins;
    const aggLosses = pairRankedBlk.losses;

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

    const pairAggregate = useMemo(() => {
        let wins = 0;
        let losses = 0;
        for (const { mode } of SPECIAL_GAME_MODES) {
            const row = pairArenaStatsByMode?.[String(mode)];
            wins += row?.wins ?? 0;
            losses += row?.losses ?? 0;
        }
        const total = wins + losses;
        return { wins, losses, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 };
    }, [pairArenaStatsByMode]);

    const canAffordSingle = diamonds >= SINGLE_RESET_COST;
    const canAffordCategory = diamonds >= CATEGORY_RESET_COST;

    const theme = pairArenaPanelTheme;

    const pairResetPreview = useMemo(() => {
        if (!pairResetConfirm) return null;
        if (pairResetConfirm.type === 'single') {
            const row = pairArenaStatsByMode?.[String(pairResetConfirm.mode)];
            return {
                targetLabel: tGame('pairStats.modeTarget', { name: pairResetConfirm.displayName }),
                pvp: { wins: row?.wins ?? 0, losses: row?.losses ?? 0 },
                ai: { wins: 0, losses: 0 },
                ledgerCost: SINGLE_RESET_COST,
                seasonResetNote: tGame('pairStats.modeResetNote'),
            };
        }
        const ranked = readPairRankedMatchRecord(stats as Record<string, { wins?: number; losses?: number }>);
        const pairAi = readPairArenaAiMatchRecord(stats as Record<string, { wins?: number; losses?: number }>);
        return {
            targetLabel: tGame('pairStats.pairAll'),
            pvp: {
                wins: pairAggregate.wins + ranked.wins,
                losses: pairAggregate.losses + ranked.losses,
            },
            ai: { wins: pairAi.wins, losses: pairAi.losses },
            ledgerCost: CATEGORY_RESET_COST,
            seasonResetNote: tGame('pairStats.pairSeasonNote'),
        };
    }, [pairResetConfirm, pairArenaStatsByMode, pairAggregate, stats]);

    const handleResetSingle = (mode: GameMode, displayName: string) => {
        if (!canAffordSingle) return;
        if (!hasPairArenaSingleStatsToReset(currentUser, mode)) {
            setPairResetAlert(DETAILED_STAT_NO_RESET_MESSAGE);
            return;
        }
        setPairResetConfirm({ type: 'single', mode, displayName });
    };

    const handleResetAll = () => {
        if (!canAffordCategory) return;
        if (!hasPairArenaCategoryStatsToReset(currentUser, 'both')) {
            setPairResetAlert(DETAILED_STAT_NO_RESET_MESSAGE);
            return;
        }
        setPairResetConfirm({ type: 'all' });
    };

    const executePairResetConfirm = (scope: DetailedStatResetScope) => {
        const c = pairResetConfirm;
        if (!c) return;
        const hasStats =
            c.type === 'single'
                ? hasPairArenaSingleStatsToReset(currentUser, c.mode)
                : hasPairArenaCategoryStatsToReset(currentUser, scope);
        if (!hasStats) {
            setPairResetConfirm(null);
            setPairResetAlert(DETAILED_STAT_NO_RESET_MESSAGE);
            return;
        }
        if (c.type === 'single') {
            onAction({ type: 'RESET_PAIR_ARENA_SINGLE_STAT', payload: { mode: c.mode, scope: 'pvp' } });
        } else {
            onAction({ type: 'RESET_PAIR_ARENA_STRATEGIC_ALL', payload: { scope } });
        }
    };

    return (
        <>
        <div
            className={`text-primary ${
                columnLayout
                    ? scrollModesInPanel
                        ? 'flex h-full min-h-0 flex-col gap-2'
                        : 'flex flex-col gap-2'
                    : 'space-y-2.5 sm:space-y-3'
            }`}
        >
            <div className={`relative shrink-0 overflow-hidden rounded-xl border px-2.5 py-2 sm:px-3 sm:py-2.5 min-h-[3.5rem] sm:min-h-[4.25rem] ${theme.unifiedBg}`}>
                <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
                    aria-hidden
                />
                <div className="flex min-h-[2.5rem] w-full items-center justify-center gap-2 sm:min-h-[3rem] sm:gap-2.5">
                    <span className="shrink-0 text-xs font-bold tabular-nums sm:text-sm">{pairSeasonRank.seasonLabel}</span>
                    <img
                        src={pairSeasonRank.tier.icon}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-lg border border-white/15 bg-black/30 object-contain p-0.5 shadow-sm ring-1 ring-white/10 sm:h-12 sm:w-12"
                        aria-hidden
                    />
                    <p className={`font-black tabular-nums tracking-tight text-lg sm:text-xl ${theme.unifiedScore}`}>
                        {pairSeasonRank.score.toLocaleString()}
                        <span className="ml-0.5 text-[0.7em] font-semibold text-secondary/85">{t('detailedStats.pointsUnit')}</span>
                    </p>
                </div>
            </div>

            <div className={`shrink-0 rounded-xl border px-2.5 py-2 sm:px-3 sm:py-2.5 ${theme.accent} bg-slate-950/45`}>
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                    <div className={`min-w-0 text-xs tabular-nums sm:text-sm ${theme.winText}`}>
                        <span className={`mr-1.5 font-semibold ${theme.labelMuted}`}>{t('detailedStats.totalShort')}</span>
                        <span className="font-bold">{pairAggregate.wins.toLocaleString()}</span>
                        <span className="text-secondary/75">{t('detailedStats.winSuffix')}</span>
                        <span className="font-bold text-slate-200">{pairAggregate.losses.toLocaleString()}</span>
                        <span className="text-secondary/75">{t('detailedStats.lossSuffix')}</span>
                        <span className="ml-1.5 text-sky-200/95">({pairAggregate.winRate}%)</span>
                    </div>
                    <button
                        type="button"
                        disabled={!canAffordCategory}
                        title={
                            canAffordCategory
                                ? tGame('pairStats.resetPairAll', { cost: CATEGORY_RESET_COST.toLocaleString() })
                                : t('detailedStats.diamondInsufficient', { cost: CATEGORY_RESET_COST.toLocaleString() })
                        }
                        onClick={handleResetAll}
                        className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold sm:px-3 sm:py-2.5 sm:text-sm ${theme.categoryBtn}`}
                    >
                        <span>{t('detailedStats.resetAll')}</span>
                        <DiamondPrice
                            amount={CATEGORY_RESET_COST}
                            iconClassName="h-4 w-4 min-w-[1rem] sm:h-5 sm:w-5 sm:min-w-[1.25rem]"
                            className="text-violet-100/90"
                        />
                    </button>
                </div>
            </div>

            <div
                className={`overflow-x-hidden ${
                    columnLayout && scrollModesInPanel
                        ? 'min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-0.5'
                        : ''
                }`}
            >
                <div className={`rounded-lg border p-2.5 sm:p-3 ${theme.accent} bg-slate-950/40`}>
                    <div className={`grid ${columnLayout ? 'grid-cols-1 gap-2.5' : 'grid-cols-3 gap-2.5 sm:gap-3'}`}>
                        {SPECIAL_GAME_MODES.map(({ mode, name, image }) => {
                            const row = pairArenaStatsByMode?.[String(mode)];
                            const wins = row?.wins ?? 0;
                            const losses = row?.losses ?? 0;
                            const totalGames = wins + losses;
                            const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

                            if (columnLayout) {
                                return (
                                    <div
                                        key={mode}
                                        className={`flex items-center gap-2.5 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 shadow-sm transition-colors sm:gap-3 sm:px-3 sm:py-2.5 ${theme.rowHover}`}
                                    >
                                        <img
                                            src={image}
                                            alt=""
                                            className="h-12 w-12 shrink-0 rounded-md border border-white/15 bg-black/25 object-contain p-0.5 sm:h-14 sm:w-14"
                                            aria-hidden
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-primary sm:text-base">{name}</p>
                                            <p className={`text-xs tabular-nums sm:text-sm ${theme.winText}`}>
                                                <span className="font-bold">{wins}</span>{t('common:wins')}{' '}
                                                <span className="font-bold text-slate-200">{losses}</span>{t('common:losses')} ({winRate}%)
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={!canAffordSingle}
                                            title={
                                                canAffordSingle
                                                    ? t('detailedStats.resetSingle', { cost: SINGLE_RESET_COST })
                                                    : t('detailedStats.diamondInsufficient', { cost: SINGLE_RESET_COST })
                                            }
                                            onClick={() => handleResetSingle(mode, name)}
                                            className={`inline-flex min-w-[4.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold sm:min-w-[4.75rem] sm:px-3 sm:py-2.5 sm:text-sm ${theme.singleBtn}`}
                                        >
                                            <span>{t('detailedStats.resetBtn')}</span>
                                            <DiamondPrice
                                                amount={SINGLE_RESET_COST}
                                                className="text-violet-100/90"
                                                iconClassName="h-4 w-4 min-w-[1rem] sm:h-[1.125rem] sm:w-[1.125rem] sm:min-w-[1.125rem]"
                                            />
                                        </button>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    key={mode}
                                    className={`flex min-h-[8.75rem] flex-col items-center rounded-lg border border-white/10 bg-black/25 px-1.5 py-2 shadow-sm transition-colors sm:min-h-[9.25rem] sm:px-2 ${theme.rowHover}`}
                                >
                                    <div className="mb-1.5 flex flex-col items-center gap-1.5 text-center">
                                        <img
                                            src={image}
                                            alt=""
                                            className="h-[3.75rem] w-[3.75rem] shrink-0 rounded-lg border border-white/15 bg-black/25 object-contain p-0.5 sm:h-[4.25rem] sm:w-[4.25rem]"
                                            aria-hidden
                                        />
                                        <p className="line-clamp-2 text-center text-sm font-semibold leading-snug tracking-tight text-primary sm:line-clamp-1 sm:text-base">
                                            {name}
                                        </p>
                                    </div>
                                    <div
                                        className={`mb-1.5 flex min-w-0 items-center justify-center gap-x-1.5 text-xs tabular-nums sm:text-sm ${theme.winText}`}
                                    >
                                        <span className="shrink-0 text-center leading-tight">
                                            <span className="font-bold">{wins}</span>
                                            <span className="text-secondary/75">{t('detailedStats.winSuffix')}</span>
                                            <span className="font-bold text-slate-200">{losses}</span>
                                            <span className="text-secondary/75">{t('detailedStats.lossSuffix')}</span>
                                            <span className="ml-1 text-sky-200/95">({winRate}%)</span>
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!canAffordSingle}
                                        title={
                                            canAffordSingle
                                                ? t('detailedStats.resetSingle', { cost: SINGLE_RESET_COST })
                                                : t('detailedStats.diamondInsufficient', { cost: SINGLE_RESET_COST })
                                        }
                                        onClick={() => handleResetSingle(mode, name)}
                                        className={`mt-auto inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors sm:h-10 sm:px-3.5 sm:text-base ${theme.singleBtn}`}
                                    >
                                        <span>{t('detailedStats.resetBtn')}</span>
                                        <DiamondPrice
                                            amount={SINGLE_RESET_COST}
                                            className="text-violet-100/90"
                                            iconClassName="h-4 w-4 min-w-[1rem] sm:h-5 sm:w-5 sm:min-w-[1.25rem]"
                                        />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
        {pairResetConfirm && pairResetPreview && (
            <DetailedStatsResetConfirmModal
                targetLabel={pairResetPreview.targetLabel}
                pvpRecord={pairResetPreview.pvp}
                aiRecord={pairResetPreview.ai}
                ledgerCost={pairResetPreview.ledgerCost}
                seasonResetNote={pairResetPreview.seasonResetNote}
                onCancel={() => setPairResetConfirm(null)}
                onConfirm={executePairResetConfirm}
                windowId="pair-arena-stats-reset-confirm"
            />
        )}
        {pairResetAlert && (
            <AlertModal
                message={pairResetAlert}
                onClose={() => setPairResetAlert(null)}
                windowId="pair-arena-stats-reset-alert"
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
            title={tGame('pairStats.title')}
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
