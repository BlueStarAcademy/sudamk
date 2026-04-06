
import React, { useMemo } from 'react';
import { UserWithStatus, GameMode, ServerAction } from '../types.js';
import { SPECIAL_GAME_MODES, PLAYFUL_GAME_MODES } from '../constants';
import DraggableWindow from './DraggableWindow.js';

interface DetailedStatsModalProps {
    currentUser: UserWithStatus;
    statsType: 'strategic' | 'playful';
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
    const isStrategic = statsType === 'strategic';
    const title = isStrategic ? '전략 바둑 상세 전적' : '놀이 바둑 상세 전적';
    const modes = isStrategic ? SPECIAL_GAME_MODES : PLAYFUL_GAME_MODES;
    const { stats, diamonds } = currentUser;

    const canAffordSingle = diamonds >= SINGLE_RESET_COST;
    const canAffordCategory = diamonds >= CATEGORY_RESET_COST;

    const theme = useMemo(
        () =>
            isStrategic
                ? {
                      intro:
                          '모드별 통산 승·패·승률입니다. 랭킹은 전략 바둑 전체가 합산된 하나의 시즌 점수로 집계됩니다.',
                      accent: 'border-amber-500/35',
                      rowHover: 'hover:bg-amber-500/[0.06]',
                      labelMuted: 'text-amber-200/55',
                      unifiedBg: 'bg-amber-950/30 border-amber-500/25',
                      unifiedScore: 'text-amber-100',
                      winText: 'text-amber-100',
                      singleBtn:
                          'border border-amber-400/40 bg-amber-950/80 text-amber-50 hover:border-amber-300/60 hover:bg-amber-900/50 active:translate-y-px disabled:opacity-40',
                      categoryBtn:
                          'border border-amber-400/35 bg-slate-950/80 text-amber-50/95 hover:border-amber-300/50 hover:bg-amber-950/40 active:translate-y-px disabled:opacity-40',
                  }
                : {
                      intro:
                          '모드별 통산 승·패·승률입니다. 랭킹은 놀이 바둑 전체가 합산된 하나의 시즌 점수로 집계됩니다.',
                      accent: 'border-fuchsia-500/35',
                      rowHover: 'hover:bg-fuchsia-500/[0.06]',
                      labelMuted: 'text-fuchsia-200/50',
                      unifiedBg: 'bg-fuchsia-950/25 border-fuchsia-500/22',
                      unifiedScore: 'text-fuchsia-100',
                      winText: 'text-fuchsia-100',
                      singleBtn:
                          'border border-fuchsia-400/40 bg-fuchsia-950/75 text-fuchsia-50 hover:border-fuchsia-300/55 hover:bg-fuchsia-900/45 active:translate-y-px disabled:opacity-40',
                      categoryBtn:
                          'border border-fuchsia-400/35 bg-slate-950/80 text-fuchsia-50/95 hover:border-fuchsia-300/45 hover:bg-fuchsia-950/35 active:translate-y-px disabled:opacity-40',
                  },
        [isStrategic]
    );

    /** 카테고리당 하나의 통합 시즌 점수 (프로필·대기실과 동일 로직) */
    const unifiedRanking = useMemo(() => {
        const drKey = isStrategic ? 'strategic' : 'playful';
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
    }, [currentUser.dailyRankings, currentUser.stats, isStrategic]);

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
        const categoryName = isStrategic ? '전략' : '놀이';
        if (
            window.confirm(
                `다이아 ${CATEGORY_RESET_COST.toLocaleString()}개를 사용하여 모든 「${categoryName}」 바둑 모드의 전적을 한 번에 초기화할까요?\n\n각 모드의 승·패와 이 카테고리의 통합 랭킹(시즌) 점수가 함께 초기화됩니다.`
            )
        ) {
            onAction({ type: 'RESET_STATS_CATEGORY', payload: { category: statsType } });
        }
    };

    const unifiedLabel = isStrategic ? '전략 바둑 통합 랭킹' : '놀이 바둑 통합 랭킹';

    return (
        <DraggableWindow title={title} onClose={onClose} windowId="detailed-stats" initialWidth={640} bodyPaddingClassName="p-3 sm:p-4">
            <div className="space-y-3 text-primary">
                <p className="text-xs sm:text-[0.8rem] leading-snug text-secondary border-l-2 border-accent/40 pl-2.5">{theme.intro}</p>

                <div
                    className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border px-3 py-2 ${theme.unifiedBg}`}
                >
                    <div className="min-w-0">
                        <p className={`text-[10px] font-semibold uppercase tracking-wider ${theme.labelMuted}`}>{unifiedLabel}</p>
                        <p className={`text-lg font-bold tabular-nums sm:text-xl ${theme.unifiedScore}`}>
                            {unifiedRanking.score.toLocaleString()}
                            <span className="text-sm font-semibold text-secondary/90">점</span>
                        </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-secondary">
                        {unifiedRanking.rank != null && unifiedRanking.rank > 0 && unifiedRanking.rank < 9999 ? (
                            <span>
                                순위 <span className="font-mono font-semibold text-primary">{unifiedRanking.rank}</span>위
                            </span>
                        ) : (
                            <span className="text-tertiary">순위 집계 전</span>
                        )}
                        <span className="text-tertiary">
                            랭킹전 대국 <span className="font-mono text-secondary">{unifiedRanking.totalGames}</span>국
                        </span>
                    </div>
                </div>

                <div className="max-h-[min(48vh,380px)] overflow-y-auto overflow-x-hidden pr-1 [scrollbar-gutter:stable]">
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
                                    className={`flex flex-nowrap items-center gap-x-2 overflow-x-auto px-2.5 py-1.5 sm:px-3 sm:py-2 ${theme.rowHover}`}
                                >
                                    <div className="min-w-[5.5rem] max-w-[40%] shrink-0 sm:min-w-[7rem]">
                                        <p className="truncate text-sm font-semibold text-primary sm:text-[0.95rem]">{name}</p>
                                    </div>
                                    <div
                                        className={`flex min-w-0 flex-1 items-center gap-x-2 text-xs tabular-nums sm:text-[0.8rem] ${theme.winText}`}
                                    >
                                        <span>
                                            <span className="font-bold">{wins}</span>
                                            <span className="text-secondary/75">승 </span>
                                            <span className="font-bold text-slate-200">{losses}</span>
                                            <span className="text-secondary/75">패</span>
                                        </span>
                                        <span className="text-secondary/50">·</span>
                                        <span className="text-sky-200/95">{winRate}%</span>
                                        <span className="text-secondary/50">·</span>
                                        <span className="text-tertiary">{totalGames}국</span>
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
                                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors sm:text-xs ${theme.singleBtn}`}
                                    >
                                        <span>초기화</span>
                                        <DiamondPrice amount={SINGLE_RESET_COST} className="text-cyan-100/90" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-col gap-1.5 border-t border-white/[0.07] pt-3">
                    <p className="text-center text-[10px] font-medium uppercase tracking-wider text-secondary">카테고리 일괄 초기화</p>
                    <button
                        type="button"
                        disabled={!canAffordCategory}
                        title={
                            canAffordCategory
                                ? `다이아 ${CATEGORY_RESET_COST} — ${isStrategic ? '전략' : '놀이'} 전체`
                                : `다이아 부족 (필요 ${CATEGORY_RESET_COST})`
                        }
                        onClick={handleResetAll}
                        className={`mx-auto flex max-w-md items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm ${theme.categoryBtn}`}
                    >
                        <span>{isStrategic ? '전략' : '놀이'} 전체 전적 초기화</span>
                        <DiamondPrice amount={CATEGORY_RESET_COST} iconClassName="h-4 w-4 min-w-[1rem]" className="text-cyan-100/90" />
                    </button>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default DetailedStatsModal;
