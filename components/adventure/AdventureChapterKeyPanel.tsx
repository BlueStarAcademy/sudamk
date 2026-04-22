import React, { useMemo } from 'react';
import { getAdventureStageById } from '../../constants/adventureConstants.js';
import type { AdventureStageId } from '../../constants/adventureConstants.js';
import { ADVENTURE_MAP_KEY_CHAPTER_CONFIG } from '../../shared/utils/adventureMapTreasureRewards.js';
import type { AdventureProfile } from '../../types/index.js';
import AdventureKeyFragmentIcon from './AdventureKeyFragmentIcon.js';

type Props = {
    stageId: AdventureStageId;
    adventureProfile: AdventureProfile | null | undefined;
    compact?: boolean;
    className?: string;
};

const AdventureChapterKeyPanel: React.FC<Props> = ({ stageId, adventureProfile, compact, className }) => {
    const stage = useMemo(() => getAdventureStageById(stageId), [stageId]);
    const chapterIdx = stage?.stageIndex ?? 1;
    const cfg = ADVENTURE_MAP_KEY_CHAPTER_CONFIG[Math.max(1, Math.min(5, Math.floor(chapterIdx)))]!;

    const held = Math.max(0, Math.floor(adventureProfile?.adventureMapKeysHeldByStageId?.[stageId] ?? 0));
    const prog = Math.max(0, Math.floor(adventureProfile?.adventureMapKeyKillProgressByStageId?.[stageId] ?? 0));

    const xpCap = Math.max(1, cfg.keyXpRequired);
    const progClamped = Math.min(prog, xpCap - 1);
    const barPct = Math.round(Math.min(1, progClamped / xpCap) * 100);

    return (
        <div className={className} role="region" aria-label="모험 열쇠">
            <h2
                className={
                    compact
                        ? 'mb-1.5 px-0.5 text-center text-xs font-bold tracking-wide text-amber-100 drop-shadow-sm sm:text-[0.8125rem]'
                        : 'mb-2 px-1 text-center text-sm font-bold tracking-wide text-amber-50 sm:text-base'
                }
            >
                지역 열쇠
            </h2>
            <div className={compact ? 'space-y-1.5 px-1 sm:space-y-2 sm:px-1.5' : 'space-y-2 px-2 sm:space-y-2.5 sm:px-2.5'}>
                <div className={`flex w-full min-w-0 items-center justify-between gap-2 ${compact ? 'gap-x-1.5' : 'gap-x-2'}`}>
                    <div
                        className={`flex min-w-0 flex-1 items-center tabular-nums ${compact ? 'gap-1' : 'gap-1.5'}`}
                        role="group"
                        aria-label={`열쇠 ${held} / ${cfg.maxHeld}개`}
                    >
                        <span
                            className={
                                compact
                                    ? 'shrink-0 text-[11px] font-semibold leading-none text-zinc-300 sm:text-xs'
                                    : 'shrink-0 text-xs font-semibold leading-none text-zinc-300 sm:text-sm'
                            }
                        >
                            열쇠
                        </span>
                        <span
                            className={
                                compact
                                    ? 'flex min-w-0 items-center gap-0.5 font-mono text-xs font-black text-amber-50 sm:text-[0.8125rem]'
                                    : 'flex min-w-0 items-center gap-1 font-mono text-sm font-black text-amber-50 sm:text-base'
                            }
                        >
                            <span aria-hidden className="inline-flex shrink-0 text-sm leading-none sm:text-base">
                                🔑
                            </span>
                            <span className="min-w-0 truncate">
                                {held}/{cfg.maxHeld}개
                            </span>
                        </span>
                    </div>
                    <div
                        className={`flex shrink-0 items-center justify-end tabular-nums ${compact ? 'gap-0.5 sm:gap-1' : 'gap-1 sm:gap-1.5'}`}
                        role="group"
                        aria-label={`열쇠 조각 진행 ${Math.min(prog, xpCap - 1)} / ${xpCap}`}
                    >
                        <span className="inline-flex shrink-0 items-center" aria-hidden>
                            <AdventureKeyFragmentIcon compact={compact} variant="panel" />
                        </span>
                        <span
                            className={
                                compact
                                    ? 'shrink-0 font-mono text-xs font-bold text-amber-100 sm:text-[0.8125rem]'
                                    : 'shrink-0 font-mono text-sm font-bold text-amber-50 sm:text-base'
                            }
                        >
                            {Math.min(prog, xpCap - 1)}/{xpCap}
                        </span>
                    </div>
                </div>
                <div
                    className={
                        compact
                            ? 'h-2 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-inset ring-amber-500/30 sm:h-2.5'
                            : 'h-2.5 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-inset ring-amber-500/35 sm:h-3'
                    }
                >
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-200 transition-all duration-500"
                        style={{ width: `${barPct}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default AdventureChapterKeyPanel;
