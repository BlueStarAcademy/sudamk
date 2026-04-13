import React, { Fragment, useMemo, useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { ADVENTURE_STAGES } from '../../constants/adventureConstants.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import AdventureProfilePanel from './AdventureProfilePanel.js';
import AdventureMonsterCodexModal from './AdventureMonsterCodexModal.js';
import QuickAccessSidebar, { PC_QUICK_RAIL_COLUMN_CLASS } from '../QuickAccessSidebar.js';
import {
    getAdventureChapterUnlockBlockers,
    getAdventureChapterUnlockConditionLines,
    isAdventureChapterUnlockedByStageIndex,
    type AdventureChapterUnlockContext,
} from '../../utils/adventureChapterUnlock.js';
import AdventureChapterRewardHints from './AdventureChapterRewardHints.js';
import type { AdventureStageId } from '../../constants/adventureConstants.js';

const STAGE_CARD_RINGS: readonly string[] = [
    'ring-emerald-400/40',
    'ring-sky-400/40',
    'ring-blue-400/40',
    'ring-amber-400/40',
    'ring-fuchsia-400/40',
];

const ChapterLockGlyph: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
    </svg>
);

const AdventureLobby: React.FC = () => {
    const { currentUserWithStatus } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const [monsterCodexOpen, setMonsterCodexOpen] = useState(false);
    /** 네이티브 모바일: 챕터(기본) · 모험 일지 */
    const [mobileLobbyTab, setMobileLobbyTab] = useState<'chapter' | 'journal'>('chapter');
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

    const chapterColumn = (showSectionHeading: boolean) => (
        <section
            className="flex min-h-0 min-w-0 flex-1 flex-col lg:h-full lg:min-h-0"
            aria-label="챕터 입장"
        >
            {showSectionHeading ? (
                <h2 className="mb-2 flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 sm:text-sm">
                    <span className="h-px max-w-[2rem] flex-1 bg-gradient-to-r from-transparent to-zinc-600/60" aria-hidden />
                    챕터
                    <span className="h-px flex-1 bg-gradient-to-l from-transparent to-zinc-600/60" aria-hidden />
                </h2>
            ) : null}
            <div className="min-h-0 flex-1 overflow-hidden">
                <ol className="flex h-full min-h-0 flex-col gap-2 sm:gap-2.5 lg:gap-3">
                    {ADVENTURE_STAGES.map((stage, i) => {
                        const ringClass = STAGE_CARD_RINGS[i] ?? STAGE_CARD_RINGS[0];
                        const unlocked = isAdventureChapterUnlockedByStageIndex(stage.stageIndex, chapterUnlockCtx);
                        const blockers = getAdventureChapterUnlockBlockers(stage.stageIndex, chapterUnlockCtx);
                        const conditionLines = getAdventureChapterUnlockConditionLines(stage.stageIndex, chapterUnlockCtx);
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
                                                unlocked
                                                    ? 'group-hover:scale-[1.03]'
                                                    : 'scale-[1.03] blur-[3px] brightness-[0.88] saturate-[0.92]'
                                            }`}
                                            draggable={false}
                                        />
                                        <div
                                            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:via-transparent sm:to-black/20"
                                            aria-hidden
                                        />
                                        {!unlocked && (
                                            <div
                                                className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-black/25"
                                                aria-hidden
                                            >
                                                <div className="flex flex-col items-center gap-1 rounded-full border border-amber-400/35 bg-zinc-950/55 p-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.55)] ring-2 ring-amber-500/15 backdrop-blur-[2px] sm:p-3">
                                                    <ChapterLockGlyph className="h-7 w-7 text-amber-100 sm:h-8 sm:w-8" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex min-h-0 min-w-0 flex-1 flex-col justify-center gap-1.5 border-t border-white/10 bg-gradient-to-br from-zinc-950/98 via-zinc-950/95 to-black/95 px-3 py-2.5 sm:border-l sm:border-t-0 sm:gap-2 sm:px-4 sm:py-3 lg:px-5 lg:py-3.5">
                                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                                            <span className="shrink-0 rounded-md border border-white/22 bg-black/40 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-amber-100/95 sm:px-2.5 sm:py-1 sm:text-xs lg:text-sm">
                                                CHAPTER {String(stage.stageIndex).padStart(2, '0')}
                                            </span>
                                            <h3 className="min-w-0 flex-1 text-base font-black leading-tight tracking-tight text-white sm:text-lg lg:text-xl xl:text-2xl">
                                                {stage.title}
                                            </h3>
                                        </div>
                                        <p className="line-clamp-2 text-[11px] font-normal leading-relaxed text-zinc-300/95 sm:line-clamp-3 sm:text-sm lg:text-[0.95rem]">
                                            {stage.lobbyStoryLine}
                                        </p>
                                        <AdventureChapterRewardHints
                                            stageId={stage.id as AdventureStageId}
                                            compact
                                            className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5 sm:px-2.5 sm:py-2"
                                        />
                                        {!unlocked && conditionLines.length > 0 && (
                                            <p className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] font-semibold leading-snug sm:text-[11px] lg:text-xs">
                                                {conditionLines.map((line, idx) => (
                                                    <Fragment key={line.key}>
                                                        {idx > 0 ? (
                                                            <span className="shrink-0 text-zinc-600" aria-hidden>
                                                                ·
                                                            </span>
                                                        ) : null}
                                                        <span
                                                            className={`whitespace-nowrap ${
                                                                line.satisfied
                                                                    ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.25)]'
                                                                    : 'text-amber-200/85'
                                                            }`}
                                                        >
                                                            {line.text}
                                                        </span>
                                                    </Fragment>
                                                ))}
                                            </p>
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

    const mobileTabBtnBase =
        'min-h-0 min-w-0 flex-1 rounded-lg px-2 py-2 text-sm font-bold transition-all sm:py-2.5 sm:text-base';
    const mobileTabBtnOn =
        'border border-amber-400/55 bg-gradient-to-b from-amber-800/40 to-zinc-950 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]';
    const mobileTabBtnOff = 'border border-transparent text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200';

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
                    className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overscroll-contain ${isNativeMobile ? 'px-0.5 pb-1' : 'overflow-y-auto'}`}
                >
                    {isNativeMobile ? (
                        <>
                            <div className="mb-1 flex shrink-0 gap-1 px-0.5 sm:gap-1.5" role="tablist" aria-label="모험 로비">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={mobileLobbyTab === 'chapter'}
                                    onClick={() => setMobileLobbyTab('chapter')}
                                    className={`${mobileTabBtnBase} ${mobileLobbyTab === 'chapter' ? mobileTabBtnOn : mobileTabBtnOff}`}
                                >
                                    챕터
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={mobileLobbyTab === 'journal'}
                                    onClick={() => setMobileLobbyTab('journal')}
                                    className={`${mobileTabBtnBase} ${mobileLobbyTab === 'journal' ? mobileTabBtnOn : mobileTabBtnOff}`}
                                >
                                    모험 일지
                                </button>
                            </div>
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" role="tabpanel">
                                {mobileLobbyTab === 'chapter' ? (
                                    chapterColumn(false)
                                ) : (
                                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
                                        <AdventureProfilePanel
                                            profile={currentUserWithStatus?.adventureProfile}
                                            userGold={currentUserWithStatus?.gold ?? 0}
                                            compact
                                            onOpenMonsterCodex={() => setMonsterCodexOpen(true)}
                                        />
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div
                            className={`flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-5 xl:gap-6 ${!isNativeMobile ? 'pr-0' : ''}`}
                        >
                            <aside
                                className={`flex w-full min-w-0 shrink-0 flex-col lg:max-w-none lg:self-stretch lg:w-[min(100%,clamp(22rem,34vw,38rem))] xl:w-[min(100%,40rem)]`}
                            >
                                <AdventureProfilePanel
                                    profile={currentUserWithStatus?.adventureProfile}
                                    userGold={currentUserWithStatus?.gold ?? 0}
                                    compact={false}
                                    onOpenMonsterCodex={() => setMonsterCodexOpen(true)}
                                />
                            </aside>

                            <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-hidden">
                                {chapterColumn(true)}
                            </div>
                        </div>
                    )}
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
