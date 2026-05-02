import React, { useMemo } from 'react';
import { UserWithStatus, GameMode, ServerAction } from '../types.js';
import { SPECIAL_GAME_MODES } from '../constants';
import DraggableWindow from './DraggableWindow.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

interface PairArenaDetailedStatsModalProps {
    currentUser: UserWithStatus;
    onClose: () => void;
    onAction: (action: ServerAction) => void;
}

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

/** 페어 경기장: 전략 바둑 모드별 상세 전적 (DetailedStatsModal 전략 탭과 동일 레이아웃) */
const PairArenaDetailedStatsModal: React.FC<PairArenaDetailedStatsModalProps> = ({ currentUser, onClose, onAction }) => {
    const { isNativeMobile } = useNativeMobileShell();
    const { stats, diamonds, pairArenaStatsByMode } = currentUser;

    const pairAgg = stats?.['pair' as keyof typeof stats] as { wins?: number; losses?: number } | undefined;
    const aggWins = pairAgg?.wins ?? 0;
    const aggLosses = pairAgg?.losses ?? 0;

    const canAffordSingle = diamonds >= SINGLE_RESET_COST;
    const canAffordCategory = diamonds >= CATEGORY_RESET_COST;

    const theme = useMemo(
        () => ({
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
        }),
        []
    );

    const handleResetSingle = (mode: GameMode, displayName: string) => {
        if (!canAffordSingle) return;
        if (
            window.confirm(
                `다이아 ${SINGLE_RESET_COST.toLocaleString()}개를 사용하여 페어 경기장 「${displayName}」 모드의 전적만 초기화할까요?\n\n통합 페어 전적에서도 해당 모드 기록만큼 차감됩니다.`
            )
        ) {
            onAction({ type: 'RESET_PAIR_ARENA_SINGLE_STAT', payload: { mode } });
        }
    };

    const handleResetAll = () => {
        if (!canAffordCategory) return;
        if (
            window.confirm(
                `다이아 ${CATEGORY_RESET_COST.toLocaleString()}개를 사용하여 페어 경기장의 모든 전략 모드 상세 전적과 통합 페어 전적을 초기화할까요?\n\n일반 PVP 경기장 전적은 변경되지 않습니다.`
            )
        ) {
            onAction({ type: 'RESET_PAIR_ARENA_STRATEGIC_ALL' });
        }
    };

    return (
        <DraggableWindow
            title="페어 경기장 상세 전적"
            onClose={onClose}
            windowId="pair-arena-detailed-stats"
            initialWidth={isNativeMobile ? 420 : 640}
            initialHeight={isNativeMobile ? 700 : 760}
            bodyPaddingClassName={isNativeMobile ? 'p-2.5' : 'p-3 sm:p-4'}
        >
            <div className="space-y-3 text-primary">
                <div
                    className={`relative overflow-hidden rounded-xl border px-3 py-2.5 sm:px-3.5 sm:py-3 ${theme.unifiedBg}`}
                >
                    <div
                        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent"
                        aria-hidden
                    />
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <p className={`text-[10px] font-semibold uppercase tracking-[0.13em] ${theme.labelMuted}`}>페어 통합 전적</p>
                            <p className={`mt-0.5 text-xl font-black tabular-nums tracking-tight sm:text-2xl ${theme.unifiedScore}`}>
                                <span className="text-violet-50">{aggWins.toLocaleString()}</span>
                                <span className="text-[0.72em] font-semibold text-secondary/85">승 </span>
                                <span className="text-slate-200">{aggLosses.toLocaleString()}</span>
                                <span className="text-[0.72em] font-semibold text-secondary/85">패</span>
                            </p>
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
                            className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${theme.categoryBtn}`}
                        >
                            <span>전체 초기화</span>
                            <DiamondPrice amount={CATEGORY_RESET_COST} iconClassName="h-4 w-4 min-w-[1rem]" className="text-violet-100/90" />
                        </button>
                    </div>
                </div>

                <div
                    className={`${isNativeMobile ? 'max-h-[min(56dvh,460px)] pr-0.5' : 'max-h-[min(50vh,420px)] pr-1'} overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]`}
                >
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
                                        className={`flex min-h-[8.2rem] flex-col items-center rounded-lg border border-white/10 bg-black/25 px-2 py-2 shadow-sm transition-colors ${theme.rowHover}`}
                                    >
                                        <div className="mb-1.5 flex flex-col items-center gap-1 text-center">
                                            <img
                                                src={image}
                                                alt=""
                                                className="h-10 w-10 shrink-0 rounded-md border border-white/15 bg-black/25 object-contain p-0.5"
                                                aria-hidden
                                            />
                                            <p className="line-clamp-1 text-center text-[12px] font-semibold tracking-tight text-primary sm:text-[0.95rem]">
                                                {name}
                                            </p>
                                        </div>
                                        <div
                                            className={`mb-2 flex min-w-0 items-center justify-center gap-x-1.5 text-[11px] sm:text-[0.86rem] tabular-nums ${theme.winText}`}
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
                                            className={`mt-auto inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors sm:h-7 sm:text-[11px] ${theme.singleBtn}`}
                                        >
                                            <span>초기화</span>
                                            <DiamondPrice
                                                amount={SINGLE_RESET_COST}
                                                className="text-violet-100/90"
                                                iconClassName="h-3.5 w-3.5 min-w-[0.875rem]"
                                            />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </DraggableWindow>
    );
};

export default PairArenaDetailedStatsModal;
