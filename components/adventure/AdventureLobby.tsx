import React, { useMemo, useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { ADVENTURE_STAGES } from '../../constants/adventureConstants.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import AdventureProfilePanel from './AdventureProfilePanel.js';
import AdventureMonsterCodexModal from './AdventureMonsterCodexModal.js';
import QuickAccessSidebar, { PC_QUICK_RAIL_COLUMN_CLASS } from '../QuickAccessSidebar.js';
import {
    getAdventureChapterUnlockBlockers,
    isAdventureChapterUnlockedByStageIndex,
    type AdventureChapterUnlockContext,
} from '../../utils/adventureChapterUnlock.js';

const STAGE_CARD_RINGS: readonly string[] = [
    'ring-emerald-400/40',
    'ring-sky-400/40',
    'ring-blue-400/40',
    'ring-amber-400/40',
    'ring-fuchsia-400/40',
];

const AdventureLobby: React.FC = () => {
    const { currentUserWithStatus } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const [monsterCodexOpen, setMonsterCodexOpen] = useState(false);
    const onBack = () => replaceAppHash('#/profile');

    const chapterUnlockCtx: AdventureChapterUnlockContext = useMemo(
        () => ({
            strategyLevel: Number(currentUserWithStatus?.strategyLevel ?? 0) || 0,
            isAdmin: !!currentUserWithStatus?.isAdmin,
            understandingXpByStage: currentUserWithStatus?.adventureProfile?.understandingXpByStage,
        }),
        [
            currentUserWithStatus?.strategyLevel,
            currentUserWithStatus?.isAdmin,
            currentUserWithStatus?.adventureProfile?.understandingXpByStage,
        ],
    );

    const titleBlock = (
        <div className="min-w-0">
            <h1
                className={`font-bold tracking-tight text-transparent bg-gradient-to-r from-fuchsia-200 via-violet-100 to-cyan-200 bg-clip-text ${
                    isNativeMobile ? 'text-lg' : 'text-xl sm:text-2xl'
                }`}
            >
                모험
            </h1>
        </div>
    );

    const chapterColumn = (
        <section
            className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-full lg:min-h-0"
            aria-label="챕터 입장"
        >
            <h2 className="mb-2 flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 sm:text-sm">
                <span className="h-px max-w-[2rem] flex-1 bg-gradient-to-r from-transparent to-zinc-600/60" aria-hidden />
                챕터
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-zinc-600/60" aria-hidden />
            </h2>
            <div className="min-h-0 flex-1 overflow-hidden">
                <ol className="flex h-full min-h-0 flex-col gap-2 sm:gap-2.5 lg:gap-3">
                    {ADVENTURE_STAGES.map((stage, i) => {
                        const ringClass = STAGE_CARD_RINGS[i] ?? STAGE_CARD_RINGS[0];
                        const unlocked = isAdventureChapterUnlockedByStageIndex(stage.stageIndex, chapterUnlockCtx);
                        const blockers = getAdventureChapterUnlockBlockers(stage.stageIndex, chapterUnlockCtx);
                        const hint = blockers.length > 0 ? blockers.join('\n') : undefined;
                        return (
                            <li key={stage.id} className="flex min-h-0 min-w-0 flex-1 flex-col">
                                <button
                                    type="button"
                                    disabled={!unlocked}
                                    title={hint}
                                    onClick={() => {
                                        if (!unlocked) return;
                                        replaceAppHash(`#/adventure/${stage.id}`);
                                    }}
                                    aria-label={
                                        unlocked ? `${stage.title} 맵으로 입장` : `${stage.title} 잠김: ${blockers.join(', ')}`
                                    }
                                    className={`group flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border text-left shadow-[0_18px_44px_-22px_rgba(0,0,0,0.92)] ring-1 transition-[border-color,box-shadow,filter] duration-200 sm:flex-row sm:rounded-2xl ${ringClass} ${
                                        unlocked
                                            ? 'cursor-pointer border-white/14 hover:border-amber-400/30 hover:shadow-[0_22px_52px_-22px_rgba(251,191,36,0.2)]'
                                            : 'cursor-not-allowed border-zinc-700/50 opacity-95'
                                    }`}
                                >
                                    {/* 챕터 키비주얼 — 맵과 동일 이미지, 텍스트와 분리해 노출 */}
                                    <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden sm:aspect-auto sm:h-full sm:w-[min(42%,13.5rem)] sm:min-w-[9.5rem] md:min-w-[11rem] lg:min-w-[12rem]">
                                        <img
                                            src={stage.mapWebp}
                                            alt=""
                                            className={`h-full w-full object-cover transition-transform duration-500 ${
                                                unlocked ? 'group-hover:scale-[1.03]' : 'grayscale-[0.25] brightness-[0.88]'
                                            }`}
                                            draggable={false}
                                        />
                                        {!unlocked && (
                                            <div
                                                className="pointer-events-none absolute inset-0 bg-black/30 backdrop-blur-[0.5px]"
                                                aria-hidden
                                            />
                                        )}
                                        <div
                                            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:via-transparent sm:to-black/20"
                                            aria-hidden
                                        />
                                    </div>

                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-1.5 border-t border-white/10 bg-gradient-to-br from-zinc-950/98 via-zinc-950/95 to-black/95 px-3 py-2.5 sm:border-l sm:border-t-0 sm:gap-2 sm:px-4 sm:py-3 lg:px-5 lg:py-3.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="w-fit rounded-md border border-white/22 bg-black/40 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-amber-100/95 sm:px-2.5 sm:py-1 sm:text-xs lg:text-sm">
                                                CHAPTER {String(stage.stageIndex).padStart(2, '0')}
                                            </span>
                                            {!unlocked && (
                                                <span className="rounded-md border border-zinc-600/60 bg-black/55 px-2 py-0.5 text-[10px] font-bold text-zinc-200 sm:text-xs">
                                                    🔒 잠금
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-base font-black leading-tight tracking-tight text-white sm:text-lg lg:text-xl xl:text-2xl">
                                            {stage.title}
                                        </h3>
                                        <p className="line-clamp-2 text-[11px] font-normal leading-relaxed text-zinc-300/95 sm:line-clamp-3 sm:text-sm lg:text-[0.95rem]">
                                            {stage.lobbyStoryLine}
                                        </p>
                                        {!unlocked && blockers.length > 0 && (
                                            <ul className="mt-0.5 list-inside list-disc space-y-0.5 text-[10px] leading-snug text-amber-200/90 sm:text-xs lg:text-[0.8rem]">
                                                {blockers.map((b) => (
                                                    <li key={b}>{b}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </section>
    );

    return (
        <div
            className={`relative mx-auto flex w-full bg-gradient-to-b from-zinc-900 via-zinc-950 to-black text-zinc-100 ${
                isNativeMobile
                    ? 'sudamr-native-route-root min-h-0 flex-1 flex-col overflow-hidden px-0.5'
                    : 'h-full min-h-0 flex-row gap-2 p-2 sm:gap-3 sm:p-3 lg:p-4'
            }`}
        >
            <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${isNativeMobile ? '' : ''}`}>
                <header
                    className={`flex shrink-0 items-center gap-2 ${isNativeMobile ? 'px-1 py-1' : 'px-0 pb-2 sm:pb-3'}`}
                >
                    {!isNativeMobile && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg p-0 transition-transform hover:bg-zinc-800 hover:drop-shadow-lg active:scale-90 sm:h-11 sm:w-11"
                            aria-label="뒤로가기"
                        >
                            <img src="/images/button/back.png" alt="" className="h-full w-full" />
                        </button>
                    )}
                    <div className={`flex min-w-0 flex-1 items-start gap-2 ${isNativeMobile ? 'justify-center' : ''}`}>
                        {isNativeMobile ? (
                            <>
                                <div className="w-9 shrink-0" aria-hidden />
                                <div className="min-w-0 flex-1 text-center">{titleBlock}</div>
                                <div className="w-9 shrink-0" aria-hidden />
                            </>
                        ) : (
                            titleBlock
                        )}
                    </div>
                </header>

                <div
                    className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain ${isNativeMobile ? 'px-0.5 pb-1' : ''}`}
                >
                    <div
                        className={`flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-5 xl:gap-6 ${!isNativeMobile ? 'pr-0' : ''}`}
                    >
                        <aside
                            className={`flex w-full min-w-0 shrink-0 flex-col lg:max-w-none lg:self-stretch ${
                                isNativeMobile
                                    ? ''
                                    : 'lg:w-[min(100%,clamp(22rem,34vw,38rem))] xl:w-[min(100%,40rem)]'
                            }`}
                        >
                            <AdventureProfilePanel
                                profile={currentUserWithStatus?.adventureProfile}
                                compact={isNativeMobile}
                                onOpenMonsterCodex={() => setMonsterCodexOpen(true)}
                            />
                        </aside>

                        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-hidden">
                            {chapterColumn}
                        </div>
                    </div>
                </div>
            </div>

            {!isNativeMobile && (
                <div className={`flex shrink-0 flex-col self-stretch ${PC_QUICK_RAIL_COLUMN_CLASS}`}>
                    <div className="flex h-full min-h-0 flex-col rounded-xl border border-violet-500/35 bg-gradient-to-b from-violet-950/45 via-zinc-950/80 to-black/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm">
                        <QuickAccessSidebar fillHeight compact={false} />
                    </div>
                </div>
            )}

            {monsterCodexOpen && (
                <AdventureMonsterCodexModal onClose={() => setMonsterCodexOpen(false)} isTopmost />
            )}
        </div>
    );
};

export default AdventureLobby;
