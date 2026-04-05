
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

const DiamondPrice: React.FC<{ amount: number; className?: string; iconClassName?: string }> = ({
    amount,
    className = '',
    iconClassName = 'h-[1.1em] w-[1.1em] min-w-[1.1em]',
}) => (
    <span
        className={`inline-flex items-center gap-1.5 tabular-nums ${className}`}
        aria-label={`다이아 ${amount.toLocaleString()}`}
    >
        <img src={DIAMOND_ICON} alt="" className={`object-contain drop-shadow-[0_0_6px_rgba(56,189,248,0.45)] ${iconClassName}`} aria-hidden />
        <span className="font-bold tracking-tight">{amount.toLocaleString()}</span>
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
                      intro: '전략 모드별 통산 기록입니다. 모드 단위 또는 전체를 다이아로 초기화할 수 있습니다.',
                      accentLine: 'border-l-amber-400/95',
                      cardBg:
                          'bg-gradient-to-br from-slate-950/95 via-slate-900/80 to-amber-950/25 border border-amber-500/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_12px_40px_-16px_rgba(251,191,36,0.18)]',
                      labelMuted: 'text-amber-200/55',
                      statBox: 'bg-slate-950/65 border border-amber-500/15 shadow-inner',
                      winText: 'text-amber-100',
                      singleBtn: [
                          'border border-amber-400/45 bg-gradient-to-b from-amber-900/85 via-amber-950/90 to-slate-950/95',
                          'text-amber-50 shadow-[0_4px_18px_-6px_rgba(251,191,36,0.35),inset_0_1px_0_0_rgba(255,255,255,0.12)]',
                          'hover:border-amber-300/70 hover:shadow-[0_6px_28px_-8px_rgba(251,191,48,0.45)]',
                          'active:translate-y-px disabled:opacity-45 disabled:shadow-none disabled:hover:border-amber-400/45',
                      ].join(' '),
                      categoryWrap: 'rounded-2xl bg-gradient-to-r from-amber-600/35 via-rose-700/25 to-violet-700/35 p-[1px] shadow-[0_20px_50px_-24px_rgba(251,191,36,0.35)]',
                      categoryInner: 'rounded-[15px] bg-slate-950/92 backdrop-blur-sm border border-white/5',
                      categoryBtn: [
                          'w-full justify-center border border-rose-400/40 bg-gradient-to-b from-rose-900/80 via-rose-950/85 to-slate-950/95',
                          'text-rose-50 shadow-[0_6px_28px_-10px_rgba(244,63,94,0.4),inset_0_1px_0_0_rgba(255,255,255,0.1)]',
                          'hover:border-rose-300/65 hover:shadow-[0_8px_32px_-10px_rgba(251,113,133,0.45)]',
                          'active:translate-y-px disabled:opacity-45 disabled:shadow-none',
                      ].join(' '),
                  }
                : {
                      intro: '놀이 모드별 통산 기록입니다. 모드 단위 또는 전체를 다이아로 초기화할 수 있습니다.',
                      accentLine: 'border-l-fuchsia-400/90',
                      cardBg:
                          'bg-gradient-to-br from-slate-950/95 via-slate-900/80 to-fuchsia-950/22 border border-fuchsia-500/18 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06),0_12px_40px_-16px_rgba(217,70,239,0.16)]',
                      labelMuted: 'text-fuchsia-200/50',
                      statBox: 'bg-slate-950/65 border border-fuchsia-500/15 shadow-inner',
                      winText: 'text-fuchsia-100',
                      singleBtn: [
                          'border border-fuchsia-400/45 bg-gradient-to-b from-fuchsia-900/80 via-violet-950/90 to-slate-950/95',
                          'text-fuchsia-50 shadow-[0_4px_18px_-6px_rgba(192,132,252,0.35),inset_0_1px_0_0_rgba(255,255,255,0.11)]',
                          'hover:border-fuchsia-300/65 hover:shadow-[0_6px_28px_-8px_rgba(216,180,254,0.4)]',
                          'active:translate-y-px disabled:opacity-45 disabled:shadow-none disabled:hover:border-fuchsia-400/45',
                      ].join(' '),
                      categoryWrap: 'rounded-2xl bg-gradient-to-r from-fuchsia-600/35 via-indigo-700/28 to-cyan-700/30 p-[1px] shadow-[0_20px_50px_-24px_rgba(168,85,247,0.32)]',
                      categoryInner: 'rounded-[15px] bg-slate-950/92 backdrop-blur-sm border border-white/5',
                      categoryBtn: [
                          'w-full justify-center border border-fuchsia-400/45 bg-gradient-to-b from-fuchsia-900/78 via-indigo-950/88 to-slate-950/95',
                          'text-fuchsia-50 shadow-[0_6px_28px_-10px_rgba(168,85,247,0.42),inset_0_1px_0_0_rgba(255,255,255,0.1)]',
                          'hover:border-fuchsia-300/60 hover:shadow-[0_8px_32px_-10px_rgba(196,181,253,0.42)]',
                          'active:translate-y-px disabled:opacity-45 disabled:shadow-none',
                      ].join(' '),
                  },
        [isStrategic]
    );

    const handleResetSingle = (mode: GameMode, displayName: string) => {
        if (!canAffordSingle) return;
        if (
            window.confirm(
                `다이아 ${SINGLE_RESET_COST.toLocaleString()}개를 사용하여 「${displayName}」 모드의 전적을 초기화할까요?\n\n승·패·랭킹 점수가 해당 모드에서만 초기화됩니다.`
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
                `다이아 ${CATEGORY_RESET_COST.toLocaleString()}개를 사용하여 모든 「${categoryName}」 바둑 모드의 전적을 한 번에 초기화할까요?\n\n각 모드의 승·패·랭킹 점수가 모두 초기화됩니다.`
            )
        ) {
            onAction({ type: 'RESET_STATS_CATEGORY', payload: { category: statsType } });
        }
    };

    return (
        <DraggableWindow title={title} onClose={onClose} windowId="detailed-stats" initialWidth={680} bodyPaddingClassName="p-4 sm:p-5">
            <div className="space-y-5 text-primary">
                <p className="text-sm sm:text-[0.95rem] leading-relaxed text-secondary border-l-2 border-accent/40 pl-3.5 pr-1">
                    {theme.intro}
                </p>

                <div className="max-h-[min(52vh,420px)] overflow-y-auto overflow-x-hidden pr-1.5 space-y-4 [scrollbar-gutter:stable]">
                    {modes.map(({ mode, name }) => {
                        const gameStats = stats?.[mode];
                        const wins = gameStats?.wins ?? 0;
                        const losses = gameStats?.losses ?? 0;
                        const totalGames = wins + losses;
                        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
                        const rankingScore = gameStats?.rankingScore ?? 0;

                        return (
                            <article
                                key={mode}
                                className={`relative overflow-hidden rounded-2xl border-l-[3px] pl-4 pr-3 py-3.5 sm:py-4 ${theme.accentLine} ${theme.cardBg}`}
                            >
                                <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/[0.03] blur-2xl" aria-hidden />
                                <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                                    <div className="min-w-0 flex-1">
                                        <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] ${theme.labelMuted}`}>모드</p>
                                        <h3 className="mt-0.5 text-lg sm:text-xl font-bold tracking-tight text-primary drop-shadow-sm">
                                            {name}
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!canAffordSingle}
                                        title={
                                            canAffordSingle
                                                ? `다이아 ${SINGLE_RESET_COST.toLocaleString()} — 이 모드만 초기화`
                                                : `다이아가 부족합니다 (필요 ${SINGLE_RESET_COST.toLocaleString()}개)`
                                        }
                                        onClick={() => handleResetSingle(mode, name)}
                                        className={`flex shrink-0 flex-col items-stretch gap-1.5 rounded-xl px-3.5 py-2.5 text-left transition-all duration-200 sm:min-w-[148px] ${theme.singleBtn}`}
                                    >
                                        <span className="text-center text-xs font-bold tracking-wide text-white/95">전적 초기화</span>
                                        <span className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-sm text-cyan-100/95">
                                            <DiamondPrice amount={SINGLE_RESET_COST} className="text-cyan-100/95" />
                                        </span>
                                    </button>
                                </div>

                                <div className="relative mt-3.5 grid grid-cols-3 gap-2 sm:gap-3">
                                    <div className={`rounded-xl px-2 py-2.5 sm:px-3 sm:py-3 text-center ${theme.statBox}`}>
                                        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-secondary">승 / 패</p>
                                        <p className={`mt-1 text-base sm:text-lg font-bold tabular-nums ${theme.winText}`}>
                                            <span>{wins}</span>
                                            <span className="mx-1 text-secondary/80 font-semibold">/</span>
                                            <span className="text-slate-200">{losses}</span>
                                        </p>
                                    </div>
                                    <div className={`rounded-xl px-2 py-2.5 sm:px-3 sm:py-3 text-center ${theme.statBox}`}>
                                        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-secondary">승률</p>
                                        <p className="mt-1 text-base sm:text-lg font-bold tabular-nums text-sky-200">{winRate}%</p>
                                        <p className="mt-0.5 text-[10px] text-tertiary">{totalGames}국</p>
                                    </div>
                                    <div className={`rounded-xl px-2 py-2.5 sm:px-3 sm:py-3 text-center ${theme.statBox}`}>
                                        <p className="text-[10px] sm:text-xs font-medium uppercase tracking-wider text-secondary">랭킹 점수</p>
                                        <p className="mt-1 text-base sm:text-lg font-bold tabular-nums text-indigo-200">{rankingScore.toLocaleString()}</p>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>

                <div className={theme.categoryWrap}>
                    <div className={`${theme.categoryInner} px-4 py-4 sm:px-5 sm:py-5`}>
                        <div className="mb-3 text-center">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-secondary">일괄 초기화</p>
                            <h4 className="mt-1 text-base sm:text-lg font-bold text-primary">
                                {isStrategic ? '전략 바둑' : '놀이 바둑'} 전체 전적 초기화
                            </h4>
                            <p className="mt-1.5 text-xs sm:text-sm text-secondary leading-snug">
                                위에 나열된 모든 모드의 승·패·랭킹 점수를 한 번에 초기화합니다.
                            </p>
                        </div>
                        <button
                            type="button"
                            disabled={!canAffordCategory}
                            title={
                                canAffordCategory
                                    ? `다이아 ${CATEGORY_RESET_COST.toLocaleString()} — ${isStrategic ? '전략' : '놀이'} 전체 초기화`
                                    : `다이아가 부족합니다 (필요 ${CATEGORY_RESET_COST.toLocaleString()}개)`
                            }
                            onClick={handleResetAll}
                            className={`inline-flex flex-col items-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold transition-all duration-200 sm:flex-row sm:gap-3 sm:py-3 ${theme.categoryBtn}`}
                        >
                            <span className="order-2 sm:order-1 tracking-wide">전체 전적 초기화 실행</span>
                            <span className="order-1 flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-base text-cyan-100 sm:order-2">
                                <DiamondPrice amount={CATEGORY_RESET_COST} className="text-cyan-100" iconClassName="h-5 w-5 min-w-[1.25rem]" />
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default DetailedStatsModal;
