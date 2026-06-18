
import { useTranslation } from 'react-i18next';
import React, { useMemo, useState } from 'react';
import { UserWithStatus, GameMode, ServerAction } from '../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES, RANKING_TIERS } from '../constants';
import DraggableWindow from './DraggableWindow.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { getCurrentSeason } from '../utils/timeUtils.js';
import { PairArenaStatsPanel } from './PairArenaDetailedStatsModal.js';
import AlertModal from './AlertModal.js';
import DetailedStatsResetConfirmModal from './DetailedStatsResetConfirmModal.js';
import type { DetailedStatResetScope } from '../shared/types/detailedStatReset.js';
import {
    DETAILED_STAT_NO_RESET_MESSAGE,
    hasPlayfulCategoryStatsToReset,
    hasSingleModeStatsToReset,
    hasStrategicCategoryStatsToReset,
} from '../shared/utils/detailedStatResetChecks.js';
import { readStrategicRankedMatchRecord } from '../shared/utils/unifiedRankedStatsMigration.js';
import { PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS } from '../shared/constants/pcShellLayout.js';
import { useMobileModalChrome } from '../hooks/useMobileModalChrome.js';

type PvpStatsTab = 'strategic' | 'pair' | 'playful';

interface DetailedStatsModalProps {
    currentUser: UserWithStatus;
    statsType: 'strategic' | 'playful' | 'both';
    onClose: () => void;
    onAction: (action: ServerAction) => void;
    /** PC 로비 중앙 인라인 패널 — DraggableWindow 생략 */
    embedded?: boolean;
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

type StatsPanelTheme = {
    accent: string;
    rowHover: string;
    labelMuted: string;
    unifiedBg: string;
    unifiedScore: string;
    winText: string;
    singleBtn: string;
    categoryBtn: string;
    columnTitle: string;
    columnDivider: string;
};

const STRATEGIC_STATS_THEME: StatsPanelTheme = {
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
    columnTitle: 'text-amber-100',
    columnDivider: 'border-amber-500/20',
};

const PLAYFUL_STATS_THEME: StatsPanelTheme = {
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
    columnTitle: 'text-fuchsia-100',
    columnDivider: 'border-fuchsia-500/20',
};

const PAIR_COLUMN_TITLE_CLASS = 'text-violet-100';
const PAIR_COLUMN_DIVIDER_CLASS = 'border-violet-500/20';

const SEASON_INFO_BAR_SHELL_CLASS =
    'relative shrink-0 overflow-hidden rounded-xl border px-2.5 py-2 sm:px-3 sm:py-2.5 min-h-[3.5rem] sm:min-h-[4.25rem]';
const SEASON_INFO_BAR_INNER_CLASS =
    'flex min-h-[2.5rem] w-full items-center justify-center gap-2 sm:min-h-[3rem] sm:gap-2.5';

const DetailedStatsModal: React.FC<DetailedStatsModalProps> = ({
    currentUser,
    statsType,
    onClose,
    onAction,
    embedded = false,
}) => {
    const { t } = useTranslation('profile');
    const [statsResetConfirm, setStatsResetConfirm] = useState<StatsResetConfirm | null>(null);
    const [statsResetAlert, setStatsResetAlert] = useState<string | null>(null);
    const isPvpCombined = statsType === 'both';
    const isStrategic = statsType !== 'playful';
    const showUnifiedRanking = isStrategic;
    /** 카테고리 일괄 초기화: 놀이는 전적만, 전략은 시즌 랭킹 연동 초기화 */
    const categoryResetTarget: 'strategic' | 'playful' = statsType === 'playful' ? 'playful' : 'strategic';
    const { isNativeMobile } = useNativeMobileShell();
    const useMobileChrome = useMobileModalChrome();
    const [pvpStatsTab, setPvpStatsTab] = useState<PvpStatsTab>('strategic');
    const title =
        statsType === 'both' ? t('detailedStats.pvpTitle') : isStrategic ? t('detailedStats.strategicTitle') : t('detailedStats.playfulTitle');
    const modes = isStrategic ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
    const { stats, diamonds } = currentUser;

    const canAffordSingle = diamonds >= SINGLE_RESET_COST;
    const canAffordCategory = diamonds >= CATEGORY_RESET_COST;

    const theme = isStrategic ? STRATEGIC_STATS_THEME : PLAYFUL_STATS_THEME;

    const unifiedRanking = useMemo(() => {
        if (statsType === 'playful') {
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
    }, [currentUser.dailyRankings, currentUser.stats, statsType]);

    const strategicSeasonTier = useMemo(() => {
        if (statsType === 'playful') return null;
        const rank = unifiedRanking.rank ?? 99_999;
        return {
            tier: getTier(unifiedRanking.score, rank, unifiedRanking.totalGames),
            seasonLabel: getCurrentSeason().name,
            rank: unifiedRanking.rank,
        };
    }, [statsType, unifiedRanking]);

    const strategicAggregate = useMemo(() => {
        let wins = 0;
        let losses = 0;
        for (const { mode } of SPECIAL_GAME_MODES) {
            const row = stats?.[mode];
            wins += row?.wins ?? 0;
            losses += row?.losses ?? 0;
        }
        const total = wins + losses;
        return { wins, losses, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 };
    }, [stats]);

    const playfulAggregate = useMemo(() => {
        let wins = 0;
        let losses = 0;
        for (const { mode } of PLAYFUL_GAME_MODES) {
            const row = stats?.[mode];
            wins += row?.wins ?? 0;
            losses += row?.losses ?? 0;
        }
        const total = wins + losses;
        return { wins, losses, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 };
    }, [stats]);

    const handleResetCategory = (category: 'strategic' | 'playful') => {
        if (!canAffordCategory) return;
        const hasStats =
            category === 'strategic'
                ? hasStrategicCategoryStatsToReset(currentUser, 'both')
                : hasPlayfulCategoryStatsToReset(currentUser, 'both');
        if (!hasStats) {
            setStatsResetAlert(DETAILED_STAT_NO_RESET_MESSAGE);
            return;
        }
        setStatsResetConfirm({ type: 'category', category });
    };

    const statsResetPreview = useMemo(() => {
        if (!statsResetConfirm) return null;
        if (statsResetConfirm.type === 'single') {
            const row = stats?.[statsResetConfirm.mode];
            return {
                targetLabel: `「${statsResetConfirm.displayName}」`,
                pvp: { wins: row?.wins ?? 0, losses: row?.losses ?? 0 },
                ai: { wins: row?.aiWins ?? 0, losses: row?.aiLosses ?? 0 },
                ledgerCost: SINGLE_RESET_COST,
                seasonResetNote: undefined as string | undefined,
            };
        }
        const modeList = statsResetConfirm.category === 'strategic' ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
        let pvpWins = 0;
        let pvpLosses = 0;
        let aiWins = 0;
        let aiLosses = 0;
        for (const { mode } of modeList) {
            const row = stats?.[mode];
            pvpWins += row?.wins ?? 0;
            pvpLosses += row?.losses ?? 0;
            aiWins += row?.aiWins ?? 0;
            aiLosses += row?.aiLosses ?? 0;
        }
        if (statsResetConfirm.category === 'strategic') {
            const ranked = readStrategicRankedMatchRecord(stats);
            pvpWins += ranked.wins;
            pvpLosses += ranked.losses;
            return {
                targetLabel: t('detailedStats.strategicAll'),
                pvp: { wins: pvpWins, losses: pvpLosses },
                ai: { wins: aiWins, losses: aiLosses },
                ledgerCost: CATEGORY_RESET_COST,
                seasonResetNote: t('detailedStats.seasonResetNote'),
            };
        }
        return {
            targetLabel: t('detailedStats.playfulAll'),
            pvp: { wins: pvpWins, losses: pvpLosses },
            ai: { wins: aiWins, losses: aiLosses },
            ledgerCost: CATEGORY_RESET_COST,
            seasonResetNote: undefined as string | undefined,
        };
    }, [statsResetConfirm, stats]);

    const handleResetSingle = (mode: GameMode, displayName: string) => {
        if (!canAffordSingle) return;
        if (!hasSingleModeStatsToReset(currentUser, mode, 'both')) {
            setStatsResetAlert(DETAILED_STAT_NO_RESET_MESSAGE);
            return;
        }
        setStatsResetConfirm({ type: 'single', mode, displayName });
    };

    const handleResetAll = () => {
        handleResetCategory(categoryResetTarget);
    };

    const executeStatsResetConfirm = (scope: DetailedStatResetScope) => {
        const c = statsResetConfirm;
        if (!c) return;
        const hasStats =
            c.type === 'single'
                ? hasSingleModeStatsToReset(currentUser, c.mode, scope)
                : c.category === 'strategic'
                  ? hasStrategicCategoryStatsToReset(currentUser, scope)
                  : hasPlayfulCategoryStatsToReset(currentUser, scope);
        if (!hasStats) {
            setStatsResetConfirm(null);
            setStatsResetAlert(DETAILED_STAT_NO_RESET_MESSAGE);
            return;
        }
        if (c.type === 'single') {
            onAction({ type: 'RESET_SINGLE_STAT', payload: { mode: c.mode, scope } });
        } else {
            onAction({ type: 'RESET_STATS_CATEGORY', payload: { category: c.category, scope } });
        }
    };

    const renderSeasonInfoBar = (seasonLabel: string, tierIcon: string, score: number, panelTheme: StatsPanelTheme) => (
        <div className={`${SEASON_INFO_BAR_SHELL_CLASS} ${panelTheme.unifiedBg}`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" aria-hidden />
            <div className={SEASON_INFO_BAR_INNER_CLASS}>
                <span className="shrink-0 text-xs font-bold tabular-nums sm:text-sm">{seasonLabel}</span>
                <img
                    src={tierIcon}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg border border-white/15 bg-black/30 object-contain p-0.5 shadow-sm ring-1 ring-white/10 sm:h-12 sm:w-12"
                    aria-hidden
                />
                <p className={`font-black tabular-nums tracking-tight text-lg sm:text-xl ${panelTheme.unifiedScore}`}>
                    {score.toLocaleString()}
                    <span className="ml-0.5 text-[0.7em] font-semibold text-secondary/85">{t('detailedStats.pointsUnit')}</span>
                </p>
            </div>
        </div>
    );

    const renderPlayfulSeasonInfoBar = (panelTheme: StatsPanelTheme) => (
        <div className={`${SEASON_INFO_BAR_SHELL_CLASS} ${panelTheme.unifiedBg}`}>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" aria-hidden />
            <div className={SEASON_INFO_BAR_INNER_CLASS}>
                <p className={`text-center text-xs font-semibold sm:text-sm ${panelTheme.labelMuted}`}>{t('detailedStats.noPairRanking')}</p>
            </div>
        </div>
    );

    const renderAggregateStatsPanel = (
        wins: number,
        losses: number,
        winRate: number,
        panelTheme: StatsPanelTheme,
        onResetAll: () => void,
        resetTitle: string,
    ) => (
        <div className={`shrink-0 rounded-xl border px-2.5 py-2 sm:px-3 sm:py-2.5 ${panelTheme.accent} bg-slate-950/45`}>
            <div className="flex items-center justify-between gap-2 sm:gap-3">
                <div className={`min-w-0 text-xs tabular-nums sm:text-sm ${panelTheme.winText}`}>
                    <span className={`mr-1.5 font-semibold ${panelTheme.labelMuted}`}>{t('detailedStats.totalShort')}</span>
                    <span className="font-bold">{wins.toLocaleString()}</span>
                    <span className="text-secondary/75">{t('detailedStats.winSuffix')}</span>
                    <span className="font-bold text-slate-200">{losses.toLocaleString()}</span>
                    <span className="text-secondary/75">{t('detailedStats.lossSuffix')}</span>
                    <span className="ml-1.5 text-sky-200/95">({winRate}%)</span>
                </div>
                <button
                    type="button"
                    disabled={!canAffordCategory}
                    title={canAffordCategory ? resetTitle : t('detailedStats.diamondInsufficient', { cost: CATEGORY_RESET_COST.toLocaleString() })}
                    onClick={onResetAll}
                    className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold sm:px-3 sm:py-2.5 sm:text-sm ${panelTheme.categoryBtn}`}
                >
                    <span>{t('detailedStats.resetAll')}</span>
                    <DiamondPrice amount={CATEGORY_RESET_COST} iconClassName="h-4 w-4 min-w-[1rem] sm:h-5 sm:w-5 sm:min-w-[1.25rem]" className="text-cyan-100/90" />
                </button>
            </div>
        </div>
    );

    const renderModeStatsGrid = (
        modeList: typeof SPECIAL_GAME_MODES,
        gridTheme: StatsPanelTheme,
        columnLayout: boolean,
    ) => (
        <div className="overflow-x-hidden">
            <div className={`rounded-lg border ${columnLayout ? 'p-2.5 sm:p-3' : 'p-2.5 sm:p-3'} ${gridTheme.accent} bg-slate-950/40`}>
                <div className={`grid ${columnLayout ? 'grid-cols-1 gap-2.5' : 'grid-cols-3 gap-2.5 sm:gap-3'}`}>
                    {modeList.map(({ mode, name, image }) => {
                        const gameStats = stats?.[mode];
                        const wins = gameStats?.wins ?? 0;
                        const losses = gameStats?.losses ?? 0;
                        const totalGames = wins + losses;
                        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
                        const aiW = gameStats?.aiWins ?? 0;
                        const aiL = gameStats?.aiLosses ?? 0;
                        const aiTot = aiW + aiL;
                        const aiWr = aiTot > 0 ? Math.round((aiW / aiTot) * 100) : 0;

                        if (columnLayout) {
                            return (
                                <div
                                    key={mode}
                                    className={`flex items-center gap-2.5 rounded-lg border border-white/10 bg-black/25 px-2.5 py-2 shadow-sm transition-colors sm:gap-3 sm:px-3 sm:py-2.5 ${gridTheme.rowHover}`}
                                >
                                    <img
                                        src={image}
                                        alt=""
                                        className="h-12 w-12 shrink-0 rounded-md border border-white/15 bg-black/25 object-contain p-0.5 sm:h-14 sm:w-14"
                                        aria-hidden
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-primary sm:text-base">{name}</p>
                                        <p className={`text-xs tabular-nums sm:text-sm ${gridTheme.winText}`}>
                                            <span className="text-secondary/80">PVP </span>
                                            {t('detailedStats.pvpWinLoss', { wins, losses, winRate })}
                                        </p>
                                        {aiTot > 0 ? (
                                            <p className="text-xs tabular-nums text-violet-200/90 sm:text-sm">
                                                {t('detailedStats.aiWinLoss', { wins: aiW, losses: aiL, winRate: aiWr })}
                                            </p>
                                        ) : null}
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
                                        className={`inline-flex min-w-[4.25rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold sm:min-w-[4.75rem] sm:px-3 sm:py-2.5 sm:text-sm ${gridTheme.singleBtn}`}
                                    >
                                        <span>{t('detailedStats.resetBtn')}</span>
                                        <DiamondPrice amount={SINGLE_RESET_COST} iconClassName="h-4 w-4 min-w-[1rem] sm:h-[1.125rem] sm:w-[1.125rem] sm:min-w-[1.125rem]" />
                                    </button>
                                </div>
                            );
                        }

                        return (
                            <div
                                key={mode}
                                className={`flex min-h-[10.75rem] flex-col items-center rounded-lg border border-white/10 bg-black/25 px-2 py-3 shadow-sm transition-colors sm:min-h-[11.5rem] sm:px-2.5 ${gridTheme.rowHover}`}
                            >
                                <div className="mb-2 flex flex-col items-center gap-2 text-center">
                                    <img
                                        src={image}
                                        alt=""
                                        className="h-[4.25rem] w-[4.25rem] shrink-0 rounded-lg border border-white/15 bg-black/25 object-contain p-1 sm:h-[5rem] sm:w-[5rem]"
                                        aria-hidden
                                    />
                                    <p className="line-clamp-2 text-center text-base font-semibold leading-snug tracking-tight text-primary sm:line-clamp-1 sm:text-lg">
                                        {name}
                                    </p>
                                </div>
                                <div
                                    className={`mb-1 flex min-w-0 flex-col items-center justify-center gap-y-0.5 text-xs tabular-nums sm:text-sm ${gridTheme.winText}`}
                                >
                                    <span className="shrink-0 text-center leading-tight">
                                        <span className="text-secondary/80">PVP </span>
                                        <span className="font-bold">{wins}</span>
                                        <span className="text-secondary/75">{t('detailedStats.winSuffix')}</span>
                                        <span className="font-bold text-slate-200">{losses}</span>
                                        <span className="text-secondary/75">{t('detailedStats.lossSuffix')}</span>
                                        <span className="ml-1 text-sky-200/95">({winRate}%)</span>
                                    </span>
                                    {aiTot > 0 ? (
                                        <span className="shrink-0 text-center leading-tight text-violet-200/90">
                                            <span className="text-violet-300/70">AI </span>
                                            {t('detailedStats.aiWinLoss', { wins: aiW, losses: aiL, winRate: aiWr })}
                                        </span>
                                    ) : null}
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
                                    className={`mt-auto inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors sm:h-10 sm:px-3.5 sm:text-base ${gridTheme.singleBtn}`}
                                >
                                    <span>{t('detailedStats.resetBtn')}</span>
                                    <DiamondPrice
                                        amount={SINGLE_RESET_COST}
                                        className="text-cyan-100/90"
                                        iconClassName="h-4 w-4 min-w-[1rem] sm:h-5 sm:w-5 sm:min-w-[1.25rem]"
                                    />
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const useMobilePvpTabLayout = isPvpCombined && useMobileChrome;

    const renderStrategicStatsSection = (showColumnHeading: boolean, innerScroll = !useMobilePvpTabLayout) => (
        <section
            className={`flex min-w-0 flex-col gap-2 ${
                innerScroll ? 'min-h-0 overflow-hidden' : ''
            } ${showColumnHeading ? `h-full px-1.5 sm:px-2 ${STRATEGIC_STATS_THEME.columnDivider}` : ''}`}
        >
            {showColumnHeading && (
                <h3 className={`shrink-0 text-center text-sm font-bold uppercase tracking-[0.12em] sm:text-base ${STRATEGIC_STATS_THEME.columnTitle}`}>
                    전략
                </h3>
            )}
            {strategicSeasonTier &&
                renderSeasonInfoBar(
                    strategicSeasonTier.seasonLabel,
                    strategicSeasonTier.tier.icon,
                    unifiedRanking.score,
                    STRATEGIC_STATS_THEME,
                )}
            {renderAggregateStatsPanel(
                strategicAggregate.wins,
                strategicAggregate.losses,
                strategicAggregate.winRate,
                STRATEGIC_STATS_THEME,
                () => handleResetCategory('strategic'),
                t('detailedStats.resetCategory', { cost: CATEGORY_RESET_COST.toLocaleString() }),
            )}
            {innerScroll ? (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
                    {renderModeStatsGrid(SPECIAL_GAME_MODES, STRATEGIC_STATS_THEME, true)}
                </div>
            ) : (
                renderModeStatsGrid(SPECIAL_GAME_MODES, STRATEGIC_STATS_THEME, true)
            )}
        </section>
    );

    const renderPairStatsSection = (showColumnHeading: boolean, innerScroll = !useMobilePvpTabLayout) => (
        <section
            className={`flex min-w-0 flex-col gap-2 ${
                innerScroll ? 'min-h-0 overflow-hidden' : ''
            } ${showColumnHeading ? `h-full px-1.5 sm:px-2 ${PAIR_COLUMN_DIVIDER_CLASS}` : ''}`}
        >
            {showColumnHeading && (
                <h3 className={`shrink-0 text-center text-sm font-bold uppercase tracking-[0.12em] sm:text-base ${PAIR_COLUMN_TITLE_CLASS}`}>
                    페어
                </h3>
            )}
            <div className={innerScroll ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : ''}>
                <PairArenaStatsPanel
                    currentUser={currentUser}
                    onAction={onAction}
                    columnLayout
                    scrollModesInPanel={innerScroll}
                />
            </div>
        </section>
    );

    const renderPlayfulStatsSection = (showColumnHeading: boolean, innerScroll = !useMobilePvpTabLayout) => (
        <section
            className={`flex min-w-0 flex-col gap-2 ${
                innerScroll ? 'min-h-0 overflow-hidden' : ''
            } ${showColumnHeading ? `h-full px-1.5 sm:px-2 ${PLAYFUL_STATS_THEME.columnDivider}` : ''}`}
        >
            {showColumnHeading && (
                <h3 className={`shrink-0 text-center text-sm font-bold uppercase tracking-[0.12em] sm:text-base ${PLAYFUL_STATS_THEME.columnTitle}`}>
                    놀이
                </h3>
            )}
            {renderPlayfulSeasonInfoBar(PLAYFUL_STATS_THEME)}
            {renderAggregateStatsPanel(
                playfulAggregate.wins,
                playfulAggregate.losses,
                playfulAggregate.winRate,
                PLAYFUL_STATS_THEME,
                () => handleResetCategory('playful'),
                t('detailedStats.resetPlayfulCategory', { cost: CATEGORY_RESET_COST.toLocaleString() }),
            )}
            {innerScroll ? (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
                    {renderModeStatsGrid(PLAYFUL_GAME_MODES, PLAYFUL_STATS_THEME, true)}
                </div>
            ) : (
                renderModeStatsGrid(PLAYFUL_GAME_MODES, PLAYFUL_STATS_THEME, true)
            )}
        </section>
    );

    const pvpCombinedMobileTabs: { id: PvpStatsTab; label: string; activeClass: string; idleClass: string }[] = [
        {
            id: 'strategic',
            label: t('detailedStats.tabStrategic'),
            activeClass: 'border-amber-400/55 bg-gradient-to-b from-amber-900/70 to-amber-950/80 text-amber-50 shadow-inner',
            idleClass: 'border-transparent text-amber-200/55 hover:bg-amber-950/35 hover:text-amber-100/90',
        },
        {
            id: 'pair',
            label: t('detailedStats.tabPair'),
            activeClass: 'border-violet-400/55 bg-gradient-to-b from-violet-900/70 to-violet-950/80 text-violet-50 shadow-inner',
            idleClass: 'border-transparent text-violet-200/55 hover:bg-violet-950/35 hover:text-violet-100/90',
        },
        {
            id: 'playful',
            label: t('detailedStats.tabPlayful'),
            activeClass: 'border-fuchsia-400/55 bg-gradient-to-b from-fuchsia-900/70 to-fuchsia-950/80 text-fuchsia-50 shadow-inner',
            idleClass: 'border-transparent text-fuchsia-200/55 hover:bg-fuchsia-950/35 hover:text-fuchsia-100/90',
        },
    ];

    const statsBody = isPvpCombined ? (
        useMobilePvpTabLayout ? (
            <div className="flex h-full min-h-0 flex-col text-primary">
                <div
                    className="mb-2 flex shrink-0 gap-1 rounded-xl border border-white/10 bg-black/35 p-1"
                    role="tablist"
                    aria-label={t('detailedStats.panelAria')}
                >
                    {pvpCombinedMobileTabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            role="tab"
                            aria-selected={pvpStatsTab === tab.id}
                            onClick={() => setPvpStatsTab(tab.id)}
                            className={`min-h-[2.5rem] flex-1 rounded-lg border px-2 py-2 text-sm font-bold transition-colors sm:text-base ${
                                pvpStatsTab === tab.id ? tab.activeClass : tab.idleClass
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
                    {pvpStatsTab === 'strategic' && renderStrategicStatsSection(false, false)}
                    {pvpStatsTab === 'pair' && renderPairStatsSection(false, false)}
                    {pvpStatsTab === 'playful' && renderPlayfulStatsSection(false, false)}
                </div>
            </div>
        ) : (
        <div className="flex h-full min-h-0 flex-col text-primary">
            <div className="grid min-h-0 flex-1 grid-cols-3 divide-x divide-white/10">
                {renderStrategicStatsSection(true)}
                {renderPairStatsSection(true)}
                {renderPlayfulStatsSection(true)}
            </div>
        </div>
        )
    ) : (
        <div className="space-y-2.5 text-primary sm:space-y-3">
            {showUnifiedRanking &&
                strategicSeasonTier &&
                renderSeasonInfoBar(
                    strategicSeasonTier.seasonLabel,
                    strategicSeasonTier.tier.icon,
                    unifiedRanking.score,
                    STRATEGIC_STATS_THEME,
                )}

            {showUnifiedRanking &&
                renderAggregateStatsPanel(
                    strategicAggregate.wins,
                    strategicAggregate.losses,
                    strategicAggregate.winRate,
                    STRATEGIC_STATS_THEME,
                    () => handleResetCategory('strategic'),
                    t('detailedStats.resetCategory', { cost: CATEGORY_RESET_COST.toLocaleString() }),
                )}

            {!showUnifiedRanking && statsType === 'playful' && renderPlayfulSeasonInfoBar(PLAYFUL_STATS_THEME)}

            {!showUnifiedRanking &&
                statsType === 'playful' &&
                renderAggregateStatsPanel(
                    playfulAggregate.wins,
                    playfulAggregate.losses,
                    playfulAggregate.winRate,
                    PLAYFUL_STATS_THEME,
                    handleResetAll,
                    t('detailedStats.resetPlayfulCategory', { cost: CATEGORY_RESET_COST.toLocaleString() }),
                )}

            {renderModeStatsGrid(modes, theme, false)}
        </div>
    );

    return (
        <>
            {embedded ? (
                <div
                    className={
                        useMobilePvpTabLayout
                            ? 'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden p-1.5 sm:p-2'
                            : `${PC_QUICK_UTILITY_EMBEDDED_BODY_CLASS} flex min-h-0 flex-1 flex-col p-1.5 sm:p-2`
                    }
                >
                    {statsBody}
                </div>
            ) : (
                <DraggableWindow
                    title={title}
                    onClose={onClose}
                    windowId="detailed-stats"
                    initialWidth={isNativeMobile ? 420 : isPvpCombined ? 960 : 660}
                    initialHeight={isNativeMobile ? 620 : isPvpCombined ? 680 : 640}
                    bodyPaddingClassName={isNativeMobile ? 'p-2.5' : 'p-2.5 sm:p-3.5'}
                    mobileViewportFit={isNativeMobile || useMobilePvpTabLayout}
                    mobileLockViewportHeight={isNativeMobile || useMobilePvpTabLayout}
                    bodyNoScroll={useMobilePvpTabLayout}
                >
                    {statsBody}
                </DraggableWindow>
            )}
            {statsResetConfirm && statsResetPreview && (
                <DetailedStatsResetConfirmModal
                    targetLabel={statsResetPreview.targetLabel}
                    pvpRecord={statsResetPreview.pvp}
                    aiRecord={statsResetPreview.ai}
                    ledgerCost={statsResetPreview.ledgerCost}
                    seasonResetNote={statsResetPreview.seasonResetNote}
                    onCancel={() => setStatsResetConfirm(null)}
                    onConfirm={executeStatsResetConfirm}
                    windowId="detailed-stats-reset-confirm"
                />
            )}
            {statsResetAlert && (
                <AlertModal
                    message={statsResetAlert}
                    onClose={() => setStatsResetAlert(null)}
                    windowId="detailed-stats-reset-alert"
                    isTopmost
                />
            )}
        </>
    );
};

export default DetailedStatsModal;
