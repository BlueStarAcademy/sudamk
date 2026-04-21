import React, { useMemo } from 'react';
import { getAdventureStageById } from '../../constants/adventureConstants.js';
import type { AdventureStageId } from '../../constants/adventureConstants.js';
import { ADVENTURE_MAP_KEY_CHAPTER_CONFIG } from '../../shared/utils/adventureMapTreasureRewards.js';
import type { AdventureProfile } from '../../types/index.js';

type Props = {
    stageId: AdventureStageId;
    adventureProfile: AdventureProfile | null | undefined;
    compact?: boolean;
    className?: string;
};

const HalfKeyEmojiIcon: React.FC<{ compact?: boolean }> = ({ compact }) => (
    <span
        className={`relative inline-flex items-center justify-center overflow-hidden ${compact ? 'h-3.5 w-2.5' : 'h-4 w-3'}`}
        aria-label="열쇠 조각"
    >
        <span
            className={`absolute right-0 select-none leading-none ${compact ? 'text-[13px]' : 'text-[15px]'}`}
            style={{ width: compact ? 13 : 15 }}
        >
            🔑
        </span>
    </span>
);

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
                        ? 'mb-1 px-1 text-center text-[10px] font-bold tracking-wide text-amber-100 drop-shadow-sm'
                        : 'mb-2 px-1 text-center text-[11px] font-bold tracking-wide text-amber-50 sm:text-xs'
                }
            >
                지역 열쇠
            </h2>
            <div className={compact ? 'space-y-1 px-1' : 'space-y-2 px-2 sm:space-y-2 sm:px-2.5'}>
                <div className="flex items-center justify-between gap-2">
                    <span className={compact ? 'text-[9px] font-semibold text-zinc-400' : 'text-[10px] font-semibold text-zinc-400 sm:text-xs'} aria-label="열쇠 조각">
                        <HalfKeyEmojiIcon compact={compact} />
                    </span>
                    <span
                        className={
                            compact
                                ? 'font-mono text-[9px] font-bold tabular-nums text-amber-100'
                                : 'font-mono text-[10px] font-bold tabular-nums text-amber-50 sm:text-xs'
                        }
                    >
                        {Math.min(prog, xpCap - 1)}/{xpCap}
                    </span>
                </div>
                <div
                    className={
                        compact
                            ? 'h-1.5 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-inset ring-amber-500/25'
                            : 'h-2 overflow-hidden rounded-full bg-zinc-900 ring-1 ring-inset ring-amber-500/30 sm:h-2.5'
                    }
                >
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-200 transition-all duration-500"
                        style={{ width: `${barPct}%` }}
                    />
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-1.5">
                    <span className={compact ? 'text-[9px] font-semibold text-zinc-400' : 'text-[10px] font-semibold text-zinc-400 sm:text-xs'}>
                        보유 열쇠
                    </span>
                    <span
                        className={
                            compact
                                ? 'flex items-center gap-0.5 font-mono text-[9px] font-black tabular-nums text-amber-50'
                                : 'flex items-center gap-1 font-mono text-[10px] font-black tabular-nums text-amber-50 sm:text-xs'
                        }
                    >
                        <span aria-hidden>🔑</span>
                        <span>
                            {held}/{cfg.maxHeld}개
                        </span>
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AdventureChapterKeyPanel;
