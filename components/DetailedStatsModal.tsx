
import React, { useMemo, useState } from 'react';
import { UserWithStatus, GameMode, ServerAction } from '../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants';
import DraggableWindow from './DraggableWindow.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

interface DetailedStatsModalProps {
    currentUser: UserWithStatus;
    statsType: 'strategic' | 'playful' | 'both';
    onClose: () => void;
    onAction: (action: ServerAction) => void;
}

const DIAMOND_ICON = '/images/icon/Zem.png';

const SINGLE_RESET_COST = 300;
const CATEGORY_RESET_COST = 500;

/** 대기실·프로필과 동일: 시즌 표시 점수 = 1200 + dailyRankings에 저장된 델타 */
const SEASON_BASE_SCORE = 1200;

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
    const [combinedTab, setCombinedTab] = useState<'strategic' | 'playful'>('strategic');
    const activeCategory = statsType === 'both' ? combinedTab : statsType;
    const isStrategic = activeCategory === 'strategic';
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

    /** 카테고리당 하나의 통합 시즌 점수 (프로필·대기실과 동일 로직) */
    const unifiedRanking = useMemo(() => {
        const drKey = activeCategory === 'strategic' ? 'strategic' : 'playful';
        const dr = currentUser.dailyRankings?.[drKey];
        const modeList = isStrategic ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
        let totalGames = 0;
        for (const m of modeList) {
            const s = currentUser.stats?.[m.mode];
            if (s) totalGames += (s.wins || 0) + (s.losses || 0);
        }
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
    }, [currentUser.dailyRankings, currentUser.stats, activeCategory]);

    const handleResetSingle = (mode: GameMode, displayName: string) => {
        if (!canAffordSingle) return;
        if (
            window.confirm(
                `다이아 ${SINGLE_RESET_COST.toLocaleString()}개를 사용하여 「${displayName}」 모드의 전적을 초기화할까요?\n\n해당 모드의 승·패 기록만 초기화됩니다.`
            )
        ) {
            onAction({ type: 'RESET_SINGLE_STAT', payload: { mode } });
        }
    };

    const handleResetAll = () => {
        if (!canAffordCategory) return;
        const categoryName = activeCategory === 'strategic' ? '전략' : '놀이';
        if (
            window.confirm(
                `다이아 ${CATEGORY_RESET_COST.toLocaleString()}개를 사용하여 모든 「${categoryName}」 바둑 모드의 전적을 한 번에 초기화할까요?\n\n각 모드의 승·패와 이 카테고리의 통합 랭킹(시즌) 점수가 함께 초기화됩니다.`
            )
        ) {
            onAction({ type: 'RESET_STATS_CATEGORY', payload: { category: activeCategory } });
        }
    };

    const unifiedLabel = isStrategic ? '전략 바둑 통합 랭킹' : '놀이 바둑 통합 랭킹';

    return (
        <DraggableWindow
            title={title}
            onClose={onClose}
            windowId="detailed-stats"
            initialWidth={isNativeMobile ? 420 : 640}
            initialHeight={isNativeMobile ? 700 : 760}
            bodyPaddingClassName={isNativeMobile ? 'p-2.5' : 'p-3 sm:p-4'}
        >
            <div className="space-y-3 text-primary">
                {statsType === 'both' && (
                    <div className="flex gap-1 rounded-lg border border-white/10 bg-black/30 p-1" role="tablist" aria-label="상세 전적 구분">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={combinedTab === 'strategic'}
                            onClick={() => setCombinedTab('strategic')}
                            className={`min-h-0 min-w-0 flex-1 rounded-md px-2 py-2 text-xs font-bold transition-all sm:text-sm ${
                                combinedTab === 'strategic'
                                    ? 'border border-cyan-400/50 bg-cyan-950/60 text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                                    : 'border border-transparent text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                            }`}
                        >
                            전략 바둑
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={combinedTab === 'playful'}
                            onClick={() => setCombinedTab('playful')}
                            className={`min-h-0 min-w-0 flex-1 rounded-md px-2 py-2 text-xs font-bold transition-all sm:text-sm ${
                                combinedTab === 'playful'
                                    ? 'border border-amber-400/50 bg-amber-950/55 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                                    : 'border border-transparent text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
                            }`}
                        >
                            놀이 바둑
                        </button>
                    </div>
                )}
                <div
                    className={`relative overflow-hidden rounded-xl border px-3 py-2.5 sm:px-3.5 sm:py-3 ${theme.unifiedBg}`}
                >
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" aria-hidden />
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <p className={`text-[10px] font-semibold uppercase tracking-[0.13em] ${theme.labelMuted}`}>{unifiedLabel}</p>
                            <p className={`mt-0.5 text-xl font-black tabular-nums tracking-tight sm:text-2xl ${theme.unifiedScore}`}>
                                {unifiedRanking.score.toLocaleString()}
                                <span className="ml-1 text-[0.72em] font-semibold text-secondary/85">점</span>
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={!canAffordCategory}
                            title={
                                canAffordCategory
                                    ? `다이아 ${CATEGORY_RESET_COST.toLocaleString()} — ${isStrategic ? '전략' : '놀이'} 전체`
                                    : `다이아 부족 (필요 ${CATEGORY_RESET_COST.toLocaleString()})`
                            }
                            onClick={handleResetAll}
                            className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${theme.categoryBtn}`}
                        >
                            <span>전체 초기화</span>
                            <DiamondPrice amount={CATEGORY_RESET_COST} iconClassName="h-4 w-4 min-w-[1rem]" className="text-cyan-100/90" />
                        </button>
                    </div>
                </div>

                <div className={`${isNativeMobile ? 'max-h-[min(56dvh,460px)] pr-0.5' : 'max-h-[min(50vh,420px)] pr-1'} overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]`}>
                    <div className={`divide-y divide-white/[0.06] rounded-lg border ${theme.accent} bg-slate-950/40`}>
                        {modes.map(({ mode, name }) => {
                            const gameStats = stats?.[mode];
                            const wins = gameStats?.wins ?? 0;
                            const losses = gameStats?.losses ?? 0;
                            const totalGames = wins + losses;
                            const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

                            return (
                                <div
                                    key={mode}
                                    className={`grid items-center gap-x-2 px-2.5 py-1.5 sm:px-3 sm:py-1.5 ${theme.rowHover}`}
                                    style={{ gridTemplateColumns: 'minmax(5.25rem, 0.95fr) minmax(0, 1fr) auto' }}
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-[12px] font-semibold tracking-tight text-primary sm:text-[0.92rem]">
                                            {name}
                                        </p>
                                    </div>
                                    <div
                                        className={`flex min-w-0 items-center justify-start gap-x-1.5 text-[11px] sm:text-[0.8rem] tabular-nums ${theme.winText}`}
                                    >
                                        <span className="shrink-0">
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
                                        className={`inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors sm:h-7 sm:text-[11px] ${theme.singleBtn}`}
                                    >
                                        <span>초기화</span>
                                        <DiamondPrice amount={SINGLE_RESET_COST} className="text-cyan-100/90" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </DraggableWindow>
    );
};

export default DetailedStatsModal;
