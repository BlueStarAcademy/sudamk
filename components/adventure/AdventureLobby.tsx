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
    const { isNativeMobile, isNarrowViewport, pcLikeMobileLayout } = useNativeMobileShell();
    /** 네이티브 앱 또는 모바일 웹(좁은 화면·PC동일 레이아웃 Off) — 챕터 5행 한 화면 */
    const mobileAdventureShell = isNativeMobile || (isNarrowViewport && !pcLikeMobileLayout);
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
                    mobileAdventureShell ? 'text-lg' : 'text-xl sm:text-2xl'
                }`}
            >
                모험
            </h1>
        </div>
    );

    const chapterColumn = (showSectionHeading: boolean, opts?: { mobileFillViewportCards?: boolean }) => {
        const mobileFillViewportCards = !!opts?.mobileFillViewportCards;
        return (
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
            <div
                className={
                    mobileFillViewportCards
                        ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                        : 'min-h-0 flex-1 overflow-hidden'
                }
            >
                <ol
                    className={
                        mobileFillViewportCards
                            ? 'grid min-h-0 min-w-0 flex-1 gap-0.5 overflow-hidden py-0 [grid-template-rows:repeat(5,minmax(0,1fr))]'
                            : 'flex h-full min-h-0 flex-col gap-2 sm:gap-2.5 lg:gap-3'
                    }
                >
                    {ADVENTURE_STAGES.map((stage, i) => {
                        const ringClass = STAGE_CARD_RINGS[i] ?? STAGE_CARD_RINGS[0];
                        const unlocked = isAdventureChapterUnlockedByStageIndex(stage.stageIndex, chapterUnlockCtx);
                        const blockers = getAdventureChapterUnlockBlockers(stage.stageIndex, chapterUnlockCtx);
                        const conditionLines = getAdventureChapterUnlockConditionLines(stage.stageIndex, chapterUnlockCtx);
                        const hint = blockers.length > 0 ? blockers.join('\n') : undefined;
                        return (
                            <li
                                key={stage.id}
                                className={`min-h-0 min-w-0 overflow-hidden ${
                                    mobileFillViewportCards ? 'flex h-full min-h-0 flex-col' : 'flex flex-1 flex-col'
                                }`}
                            >
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
                                    className={`group flex w-full flex-col overflow-hidden rounded-xl border text-left shadow-[0_18px_44px_-22px_rgba(0,0,0,0.92)] ring-1 transition-[border-color,box-shadow,filter] duration-200 sm:rounded-2xl ${ringClass} ${
                                        mobileFillViewportCards
                                            ? 'h-full min-h-0 max-h-full min-w-0 flex-1'
                                            : 'h-full min-h-0 min-w-0'
                                    } ${
                                        unlocked
                                            ? 'cursor-pointer border-white/14 hover:border-amber-400/30 hover:shadow-[0_22px_52px_-22px_rgba(251,191,36,0.2)]'
                                            : 'cursor-not-allowed border-zinc-700/50 opacity-95'
                                    }`}
                                >
                                    {/* 키비주얼 + 하단 타이틀·스토리 오버레이 */}
                                    <div
                                        className={
                                            mobileFillViewportCards
                                                ? 'relative min-h-0 w-full min-w-0 flex-1 shrink-0 overflow-hidden'
                                                : 'relative aspect-[16/9] min-h-[8.25rem] w-full min-w-0 flex-1 shrink-0 overflow-hidden sm:aspect-auto sm:min-h-0'
                                        }
                                    >
                                        <img
                                            src={stage.mapWebp}
                                            alt=""
                                            className={`min-h-0 h-full w-full max-h-full object-cover transition-transform duration-500 ${
                                                unlocked
                                                    ? 'group-hover:scale-[1.03]'
                                                    : 'scale-[1.03] blur-[3px] brightness-[0.88] saturate-[0.92]'
                                            }`}
                                            draggable={false}
                                        />
                                        <div
                                            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10 sm:from-black/70 sm:via-black/30 sm:to-black/15"
                                            aria-hidden
                                        />
                                        {!unlocked && (
                                            <div
                                                className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-black/15"
                                                aria-hidden
                                            >
                                                <div className="flex flex-col items-center gap-1 rounded-full border border-amber-400/35 bg-zinc-950/55 p-2 shadow-[0_8px_28px_rgba(0,0,0,0.55)] ring-2 ring-amber-500/15 backdrop-blur-[2px] sm:p-3">
                                                    <ChapterLockGlyph
                                                        className={`text-amber-100 ${mobileFillViewportCards ? 'h-5 w-5' : 'h-6 w-6 sm:h-8 sm:w-8'}`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <div
                                            className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex flex-col gap-0.5 bg-gradient-to-t from-black/92 via-black/70 to-transparent px-2 pb-1.5 pt-6 sm:gap-1 sm:px-3 sm:pb-2 sm:pt-8 lg:px-3.5 lg:pb-2.5"
                                        >
                                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5 sm:gap-x-2">
                                                <span
                                                    className={`shrink-0 rounded-md border border-white/25 bg-black/50 font-mono font-bold tabular-nums text-amber-100/95 shadow-sm backdrop-blur-[2px] ${
                                                        mobileFillViewportCards
                                                            ? 'px-1.5 py-0.5 text-[8px]'
                                                            : 'px-1.5 py-0.5 text-[9px] sm:px-2 sm:py-0.5 sm:text-[10px] sm:px-2.5 sm:py-1 sm:text-xs lg:text-sm'
                                                    }`}
                                                >
                                                    CHAPTER {String(stage.stageIndex).padStart(2, '0')}
                                                </span>
                                                <h3
                                                    className={`min-w-0 flex-1 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)] font-black leading-tight tracking-tight text-white ${
                                                        mobileFillViewportCards
                                                            ? 'text-xs leading-snug'
                                                            : 'text-sm leading-snug sm:text-base md:text-lg lg:text-xl'
                                                    }`}
                                                >
                                                    {stage.title}
                                                </h3>
                                            </div>
                                            <p
                                                className={`min-w-0 font-medium leading-snug text-zinc-100/95 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] ${
                                                    mobileFillViewportCards
                                                        ? 'line-clamp-2 text-[9px]'
                                                        : 'line-clamp-2 text-[10px] sm:line-clamp-3 sm:text-[11px] sm:leading-relaxed lg:text-sm'
                                                }`}
                                            >
                                                {stage.lobbyStoryLine}
                                            </p>
                                            {!unlocked && conditionLines.length > 0 && (
                                                <p
                                                    className={`flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 font-semibold leading-snug ${
                                                        mobileFillViewportCards
                                                            ? 'text-[9px]'
                                                            : 'text-[9px] sm:text-[10px] lg:text-[11px]'
                                                    }`}
                                                >
                                                    {conditionLines.map((line, idx) => (
                                                        <Fragment key={line.key}>
                                                            {idx > 0 ? (
                                                                <span className="shrink-0 text-zinc-500" aria-hidden>
                                                                    ·
                                                                </span>
                                                            ) : null}
                                                            <span
                                                                className={`min-w-0 break-words ${
                                                                    line.satisfied
                                                                        ? 'text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.35)]'
                                                                        : 'text-amber-200/95'
                                                                }`}
                                                            >
                                                                {line.text}
                                                            </span>
                                                        </Fragment>
                                                    ))}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </section>
        );
    };

    const mobileTabBtnBase =
        'min-h-0 min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-all sm:py-2 sm:text-sm sm:py-2.5 sm:text-base';
    const mobileTabBtnOn =
        'border border-amber-400/55 bg-gradient-to-b from-amber-800/40 to-zinc-950 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]';
    const mobileTabBtnOff = 'border border-transparent text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200';

    return (
        <div
            className={`relative mx-auto flex w-full bg-gradient-to-b from-zinc-900 via-zinc-950 to-black text-zinc-100 ${
                mobileAdventureShell
                    ? isNativeMobile
                        ? 'sudamr-native-route-root min-h-0 flex-1 flex-col overflow-hidden px-0.5'
                        : 'h-full min-h-0 max-h-[100dvh] flex-1 flex-col overflow-hidden px-0.5'
                    : 'h-full min-h-0 flex-row gap-2 p-2 sm:gap-3 sm:p-3 lg:p-4'
            }`}
        >
            <div className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden ${isNativeMobile ? '' : ''}`}>
                <header
                    className={`flex shrink-0 items-center gap-2 ${mobileAdventureShell ? 'px-1 py-0.5' : 'px-0 pb-2 sm:pb-3'}`}
                >
                    {!mobileAdventureShell && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg p-0 transition-transform hover:bg-zinc-800 hover:drop-shadow-lg active:scale-90 sm:h-11 sm:w-11"
                            aria-label="뒤로가기"
                        >
                            <img src="/images/button/back.png" alt="" className="h-full w-full" />
                        </button>
                    )}
                    <div className={`flex min-w-0 flex-1 items-start gap-2 ${mobileAdventureShell ? 'justify-center' : ''}`}>
                        {mobileAdventureShell ? (
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
                    className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overscroll-contain ${mobileAdventureShell ? 'px-0.5 pb-0.5' : 'overflow-y-auto'}`}
                >
                    {mobileAdventureShell ? (
                        <>
                            <div className="mb-0.5 flex shrink-0 gap-1 px-0.5 sm:gap-1.5" role="tablist" aria-label="모험 로비">
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
                                    chapterColumn(false, { mobileFillViewportCards: mobileAdventureShell })
                                ) : (
                                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
                                        <AdventureProfilePanel
                                            profile={currentUserWithStatus?.adventureProfile}
                                            userGold={currentUserWithStatus?.gold ?? 0}
                                            compact
                                            mobileJournalSplit={mobileAdventureShell}
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

            {!mobileAdventureShell && (
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
