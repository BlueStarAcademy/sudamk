import React, { useMemo } from 'react';
import { SinglePlayerLevel, UserWithStatus } from '../../types.js';
import { getSinglePlayerStages, SINGLE_PLAYER_CLASS_BAR_REWARDS } from '../../constants/singlePlayerConstants.js';
import { useAppContext } from '../../hooks/useAppContext.js';
import {
    isSinglePlayerStageCleared,
    reconcileSinglePlayerProgress,
} from '../../shared/utils/singlePlayerProgress.js';
import { getItemTemplateByName } from '../../utils/itemTemplateLookup.js';

const resolveClassBarItemImageSrc = (itemId: string): string => {
    const t = getItemTemplateByName(itemId);
    const raw = (t as { image?: string } | null)?.image;
    if (!raw) return '/images/Box/box.webp';
    return raw.startsWith('/') ? raw : `/${raw}`;
};

const classBarApBadge = (itemId: string): string | null => {
    if (itemId === '행동력 회복제(+10)') return '+10';
    if (itemId === '행동력 회복제(+20)') return '+20';
    if (itemId === '행동력 회복제(+30)') return '+30';
    const m = itemId.match(/행동력\s*회복제\s*\(\+(\d+)\)/);
    return m ? `+${m[1]}` : null;
};

export type SinglePlayerClassBarRewardsDensity = 'desktop' | 'compact';

export interface SinglePlayerClassBarRewardsPanelProps {
    selectedClass: SinglePlayerLevel;
    currentUser: UserWithStatus;
    density: SinglePlayerClassBarRewardsDensity;
}

/**
 * 반(단계)별 스테이지 클리어 진행 막대 + 10·20 클리어 보상(수령).
 * PC `StageGrid` 상단과 모바일 로비(단계 이미지 하단)에서 공통 사용.
 */
const SinglePlayerClassBarRewardsPanel: React.FC<SinglePlayerClassBarRewardsPanelProps> = ({
    selectedClass,
    currentUser,
    density,
}) => {
    const { handlers, singlePlayerStagesListRevision } = useAppContext();
    const isCompact = density === 'compact';

    const stages = useMemo(() => {
        return getSinglePlayerStages()
            .filter((stage) => stage.level === selectedClass)
            .sort((a, b) => {
                const aNum = parseInt(a.id.split('-')[1], 10);
                const bNum = parseInt(b.id.split('-')[1], 10);
                return aNum - bNum;
            });
    }, [selectedClass, singlePlayerStagesListRevision]);

    const progress = useMemo(() => {
        return reconcileSinglePlayerProgress(
            getSinglePlayerStages(),
            (currentUser as any).clearedSinglePlayerStages,
            (currentUser as any).singlePlayerProgress
        );
    }, [currentUser, singlePlayerStagesListRevision]);

    const isStageCleared = (stageId: string) =>
        isSinglePlayerStageCleared(getSinglePlayerStages(), progress, stageId);

    const classStageProgress = useMemo(() => {
        const total = stages.length;
        if (total === 0) return { cleared: 0, total: 0, pct: 0 };
        let cleared = 0;
        for (const s of stages) {
            if (isStageCleared(s.id)) cleared += 1;
        }
        return { cleared, total, pct: Math.round((cleared / total) * 100) };
    }, [stages, progress, singlePlayerStagesListRevision]);

    const classBarConfig = SINGLE_PLAYER_CLASS_BAR_REWARDS[selectedClass];
    const barClaimsRaw = (currentUser as { singlePlayerClassBarClaims?: Partial<Record<SinglePlayerLevel, { m10?: boolean; m20?: boolean }>> })
        .singlePlayerClassBarClaims;
    const barClaims = barClaimsRaw?.[selectedClass] ?? {};
    const barThresholds = [10, 20] as const;
    const barMax = 20;
    const barDisplayCleared = Math.min(classStageProgress.cleared, barMax);
    const barFillPct = barMax > 0 ? (barDisplayCleared / barMax) * 100 : 0;

    const classBarRewardMarkStyle = (milestone: 10 | 20): React.CSSProperties => {
        const pct = barMax > 0 ? (milestone / barMax) * 100 : 0;
        if (pct >= 100) return { left: '100%', transform: 'translateX(-100%)' };
        return { left: `${pct}%`, transform: 'translateX(-50%)' };
    };

    const handleClaimClassBar = (milestone: 10 | 20) => {
        if (!handlers?.handleAction) return;
        void handlers.handleAction({
            type: 'CLAIM_SINGLE_PLAYER_CLASS_BAR_REWARD',
            payload: { level: selectedClass, milestone },
        });
    };

    const classLabel =
        selectedClass === SinglePlayerLevel.입문
            ? '입문반'
            : selectedClass === SinglePlayerLevel.초급
              ? '초급반'
              : selectedClass === SinglePlayerLevel.중급
                ? '중급반'
                : selectedClass === SinglePlayerLevel.고급
                  ? '고급반'
                  : '유단자';

    const shellClass = isCompact
        ? 'flex flex-col gap-0.5 rounded-md border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-zinc-900/50 to-amber-950/30 px-1.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:rounded-lg sm:px-2 sm:py-1.5'
        : 'mb-2 flex flex-shrink-0 flex-col gap-1 rounded-xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/35 via-zinc-900/45 to-amber-950/25 px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]';

    const titleRowClass = isCompact
        ? 'flex items-center justify-between gap-1 text-[9px] font-semibold tracking-tight text-slate-200/95 sm:text-[10px]'
        : 'flex items-center justify-between gap-2 text-[11px] font-semibold tracking-tight text-slate-200/95';

    const barTrackClass = isCompact
        ? 'relative h-3.5 w-full overflow-hidden rounded-full border border-slate-700/50 shadow-[inset_0_2px_6px_rgba(0,0,0,0.55)] sm:h-4'
        : 'relative h-5 w-full overflow-hidden rounded-full border border-slate-700/50 shadow-[inset_0_2px_10px_rgba(0,0,0,0.55)]';

    const rewardRowClass = isCompact ? 'relative h-7 w-full sm:h-8' : 'relative h-9 w-full';
    const rewardBtnClass = isCompact
        ? 'relative h-5 w-5 rounded border border-slate-500/35 bg-gradient-to-b from-slate-800/90 to-slate-950/90 p-px shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed sm:h-6 sm:w-6 sm:rounded-md sm:p-0.5'
        : 'relative h-7 w-7 rounded-md border border-slate-500/35 bg-gradient-to-b from-slate-800/90 to-slate-950/90 p-0.5 shadow-md transition-transform hover:scale-105 disabled:cursor-not-allowed';

    return (
        <div className={shellClass}>
            <div className={titleRowClass}>
                <span className="min-w-0 truncate text-emerald-100/90">{classLabel} 스테이지 클리어</span>
                <span className="flex-shrink-0 tabular-nums text-amber-100/95">
                    {classStageProgress.cleared} / {classStageProgress.total}
                </span>
            </div>
            <div className="flex flex-col gap-0">
                <div className="relative w-full rounded-full bg-gradient-to-r from-emerald-500/25 via-amber-500/20 to-teal-500/25 p-[1.5px] shadow-[0_0_12px_-8px_rgba(52,211,153,0.3)] sm:p-[2px] md:p-[3px]">
                    <div className={barTrackClass}>
                        <div className="pointer-events-none absolute inset-0 z-0 flex">
                            <div className="h-full w-1/2 border-r border-white/25 bg-slate-950/80" />
                            <div className="h-full w-1/2 bg-slate-900/75" />
                        </div>
                        <div
                            className="absolute inset-y-0 left-0 z-[1] overflow-hidden rounded-full shadow-[0_0_14px_rgba(52,211,153,0.22)] transition-all duration-500"
                            style={{ width: `${Math.min(100, barFillPct)}%` }}
                        >
                            <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400" />
                            <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.18] to-transparent" />
                        </div>
                        {(
                            [
                                { milestone: 10 as const, pct: 50 },
                                { milestone: 20 as const, pct: 100 },
                            ] as const
                        ).map(({ milestone, pct }) => {
                            const progressMet = classStageProgress.cleared >= milestone;
                            const isClaimed = milestone === 10 ? !!barClaims.m10 : !!barClaims.m20;
                            const posStyle =
                                pct >= 100
                                    ? ({ left: '100%', transform: 'translateX(-100%)' } as const)
                                    : ({ left: `${pct}%`, transform: 'translateX(-50%)' } as const);
                            return (
                                <div
                                    key={`seg-tick-${milestone}`}
                                    className="pointer-events-none absolute bottom-0 top-0 z-[2]"
                                    style={posStyle}
                                >
                                    <div
                                        className={`h-full w-[2px] ${
                                            isClaimed ? 'bg-emerald-300/95' : progressMet ? 'bg-amber-300/90' : 'bg-slate-200/55'
                                        }`}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div
                    className={`flex justify-between px-0.5 leading-none text-slate-500 ${isCompact ? 'pt-0 text-[7px] font-bold tabular-nums sm:text-[8px]' : 'pt-0 text-[9px] font-bold tabular-nums'}`}
                >
                    <span className="w-4 text-left text-slate-400">0</span>
                    <span className="flex-1 text-center text-slate-400">10</span>
                    <span className="w-4 text-right text-slate-400">20</span>
                </div>
                <div className={rewardRowClass}>
                    {barThresholds.map((milestone) => {
                        const itemDef = milestone === 10 ? classBarConfig.milestone10 : classBarConfig.milestone20;
                        const progressMet = classStageProgress.cleared >= milestone;
                        const isClaimed = milestone === 10 ? !!barClaims.m10 : !!barClaims.m20;
                        const canClaim = progressMet && !isClaimed;
                        const apBadge = classBarApBadge(itemDef.itemId);
                        const itemSrc = apBadge ? null : resolveClassBarItemImageSrc(itemDef.itemId);
                        return (
                            <div
                                key={`bar-mile-${milestone}`}
                                className="absolute top-0 flex flex-col items-center"
                                style={classBarRewardMarkStyle(milestone)}
                            >
                                <button
                                    type="button"
                                    onClick={() => canClaim && handleClaimClassBar(milestone)}
                                    disabled={!canClaim}
                                    className={`${rewardBtnClass} ${
                                        canClaim ? 'ring-1 ring-amber-400/40 shadow-[0_0_16px_-6px_rgba(251,191,36,0.55)]' : ''
                                    }`}
                                    title={isClaimed ? '수령 완료' : progressMet ? '보상 수령' : `${milestone} 스테이지 클리어 필요`}
                                >
                                    <div
                                        className={`relative h-full w-full rounded-sm ${!progressMet && !isClaimed ? 'opacity-45 grayscale' : ''}`}
                                        aria-label={`${milestone}점 보상`}
                                    >
                                        {apBadge ? (
                                            <span
                                                className={`flex h-full w-full items-center justify-center leading-none drop-shadow-[0_6px_12px_rgba(30,64,175,0.4)] ${isCompact ? 'text-base sm:text-[1.1rem]' : 'text-[1.35rem]'}`}
                                                aria-hidden
                                            >
                                                ⚡
                                            </span>
                                        ) : (
                                            <img src={itemSrc ?? '/images/Box/box.webp'} alt="" className="h-full w-full object-contain p-0.5" />
                                        )}
                                        {apBadge ? (
                                            <span
                                                className={`absolute right-0 top-0 rounded-bl bg-gray-900/90 px-0.5 font-bold leading-tight text-cyan-300 shadow-md ${isCompact ? 'text-[7px]' : 'text-[9px]'}`}
                                            >
                                                {apBadge}
                                            </span>
                                        ) : null}
                                    </div>
                                    {isClaimed && (
                                        <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-black/65 text-xs text-emerald-400">
                                            ✓
                                        </div>
                                    )}
                                </button>
                                <span
                                    className={`mt-0 font-bold tabular-nums leading-none ${
                                        progressMet ? 'text-amber-200' : 'text-slate-500'
                                    } ${isCompact ? 'text-[8px] sm:text-[9px]' : 'text-[10px]'}`}
                                >
                                    {milestone}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default SinglePlayerClassBarRewardsPanel;
