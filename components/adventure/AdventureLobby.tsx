import React, { Fragment, useMemo, useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { ADVENTURE_STAGES } from '../../constants/adventureConstants.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import AdventureProfilePanel from './AdventureProfilePanel.js';
import AdventureChapterRegionalSummary from './AdventureChapterRegionalSummary.js';
import AdventureRegionalBuffModal from './AdventureRegionalBuffModal.js';
import { buildAdventureStageUnderstandingRows } from '../../utils/adventureStageUnderstandingRows.js';
import PcLobbyThreeColumnShell from '../shell/PcLobbyThreeColumnShell.js';
import {
    PC_HOME_LEFT_COLUMN_CLASS,
} from '../../shared/constants/pcShellLayout.js';
import { useScreenGuide } from '../../hooks/useScreenGuide.js';
import ScreenGuideModal from '../ScreenGuideModal.js';
import {
    getAdventureChapterUnlockBlockers,
    getAdventureChapterUnlockConditionLines,
    isAdventureChapterUnlockedByStageIndex,
    type AdventureChapterUnlockContext,
} from '../../utils/adventureChapterUnlock.js';

/** 프로필 홈 경기장(`Profile.tsx` lobbyGridShell)과 동일 — 2열·3행 */
const ADVENTURE_CHAPTER_GRID_DESKTOP =
    'grid h-full min-h-0 w-full content-center grid-cols-2 grid-rows-[repeat(3,minmax(0,15rem))] gap-2.5 overflow-hidden lg:grid-rows-[repeat(3,minmax(0,17.5rem))] lg:gap-3 [&>*]:min-h-0 [&>*]:min-w-0';

/** 모바일: 챕터 카드 가로 1열 · 세로 스크롤 */
const ADVENTURE_CHAPTER_LIST_MOBILE =
    'flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain py-0.5 [&>*]:shrink-0';

/** PC 우측 챕터 뷰어 — Profile `mergedCardClass`·대기실 뒷판 패널과 동일 톤 */
const ADVENTURE_CHAPTER_VIEWER_SHELL_CLASS =
    'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-amber-500/40 bg-gradient-to-br from-zinc-900 via-zinc-900 to-black p-2 shadow-[0_18px_40px_-22px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.07)] ring-1 ring-white/10 sm:p-2.5';

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
    const { currentUserWithStatus, handlers } = useAppContext();
    const { isNativeMobile, isNarrowViewport, pcLikeMobileLayout } = useNativeMobileShell();

    /** 네이티브 앱 또는 모바일 웹(좁은 화면·PC동일 레이아웃 Off) — 챕터·일지 탭 */
    const mobileAdventureShell = isNativeMobile || (isNarrowViewport && !pcLikeMobileLayout);
    const [regionalBuffStageId, setRegionalBuffStageId] = useState<string | null>(null);
    /** 네이티브 모바일: 챕터(기본) · 모험 일지 */
    const [mobileLobbyTab, setMobileLobbyTab] = useState<'chapter' | 'journal'>('chapter');
    const adventureScreenGuide = useScreenGuide('adventure');
    const onBack = () => replaceAppHash('#/profile');

    const stageUnderstandingRows = useMemo(
        () => buildAdventureStageUnderstandingRows(currentUserWithStatus?.adventureProfile),
        [currentUserWithStatus?.adventureProfile],
    );

    const chapterUnlockCtx: AdventureChapterUnlockContext = useMemo(
        () => ({
            strategyLevel: Number(currentUserWithStatus?.userLevel ?? 0) || 0,
            isAdmin: !!currentUserWithStatus?.isAdmin,
            understandingXpByStage: currentUserWithStatus?.adventureProfile?.understandingXpByStage,
        }),
        [
            currentUserWithStatus?.userLevel,
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

    const chapterColumn = (showSectionHeading: boolean, opts?: { mobileScrollableList?: boolean }) => {
        const mobileScrollableList = !!opts?.mobileScrollableList;
        return (
        <section
            className={
                showSectionHeading
                    ? ADVENTURE_CHAPTER_VIEWER_SHELL_CLASS
                    : 'flex min-h-0 min-w-0 flex-1 flex-col lg:h-full lg:min-h-0'
            }
            aria-label="챕터 입장"
        >
            {showSectionHeading ? (
                <h2 className="mb-2 flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400/85 sm:text-sm">
                    <span className="h-px max-w-[2rem] flex-1 bg-gradient-to-r from-transparent to-amber-600/35" aria-hidden />
                    챕터
                    <span className="h-px flex-1 bg-gradient-to-l from-transparent to-amber-600/35" aria-hidden />
                </h2>
            ) : null}
            <div
                className={
                    mobileScrollableList
                        ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                        : 'min-h-0 flex-1 overflow-hidden'
                }
            >
                <ol
                    className={mobileScrollableList ? ADVENTURE_CHAPTER_LIST_MOBILE : ADVENTURE_CHAPTER_GRID_DESKTOP}
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
                                    mobileScrollableList ? 'flex flex-col' : 'flex flex-1 flex-col'
                                }`}
                            >
                                <div
                                    className={`group flex w-full min-w-0 flex-col overflow-hidden rounded-xl border text-left shadow-[0_18px_44px_-22px_rgba(0,0,0,0.92)] ring-1 transition-[border-color,box-shadow,filter] duration-200 sm:rounded-2xl ${ringClass} ${
                                        mobileScrollableList ? 'min-h-[8.75rem]' : 'h-full min-h-0'
                                    } ${
                                        unlocked
                                            ? 'border-white/14 hover:border-amber-400/30 hover:shadow-[0_22px_52px_-22px_rgba(251,191,36,0.2)]'
                                            : 'border-zinc-700/50 opacity-95'
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
                                    className={`m-0 flex w-full min-w-0 flex-col overflow-hidden border-0 bg-transparent p-0 text-left transition-[filter] duration-200 ${
                                        unlocked
                                            ? 'cursor-pointer group-hover:brightness-[1.02]'
                                            : 'cursor-not-allowed'
                                    }`}
                                >
                                    <div
                                        className={`relative min-h-[3.5rem] shrink-0 overflow-hidden sm:min-h-[4rem] ${
                                            mobileScrollableList
                                                ? 'h-[5.25rem] min-h-[5rem] shrink-0'
                                                : 'flex-[1.8] min-h-[4.5rem] lg:min-h-[5rem]'
                                        }`}
                                    >
                                        <img
                                            src={stage.mapWebp}
                                            alt=""
                                            className={`h-full min-h-0 w-full object-cover transition-transform duration-500 ${
                                                unlocked
                                                    ? 'group-hover:scale-[1.04]'
                                                    : 'scale-[1.03] blur-[3px] brightness-[0.88] saturate-[0.92]'
                                            }`}
                                            draggable={false}
                                        />
                                        <div
                                            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
                                            aria-hidden
                                        />
                                        {!unlocked && (
                                            <div
                                                className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-black/25"
                                                aria-hidden
                                            >
                                                <div className="flex flex-col items-center gap-1 rounded-full border border-amber-400/35 bg-zinc-950/55 p-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.55)] ring-2 ring-amber-500/15 backdrop-blur-[2px] sm:p-2">
                                                    <ChapterLockGlyph
                                                        className={`text-amber-100 ${mobileScrollableList ? 'h-4 w-4' : 'h-5 w-5 sm:h-6 sm:w-6'}`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        <div className="absolute inset-x-0 bottom-0 flex min-w-0 flex-col gap-1 px-1.5 pb-1 sm:gap-1.5 sm:px-2 sm:pb-1.5">
                                            <div className="flex min-w-0 items-end gap-1.5">
                                                <span
                                                    className={`shrink-0 rounded-md border border-white/25 bg-black/55 font-mono font-bold tabular-nums text-amber-100/95 shadow-sm backdrop-blur-[2px] ${
                                                        mobileScrollableList
                                                            ? 'px-1.5 py-0.5 text-[10px]'
                                                            : 'px-2 py-0.5 text-[10px] sm:text-[11px]'
                                                    }`}
                                                >
                                                    CH.{String(stage.stageIndex).padStart(2, '0')}
                                                </span>
                                                <h3
                                                    className={`min-w-0 flex-1 truncate font-black leading-tight text-white drop-shadow-sm ${
                                                        mobileScrollableList ? 'text-sm' : 'text-sm sm:text-base'
                                                    }`}
                                                >
                                                    {stage.title}
                                                </h3>
                                            </div>
                                            <p
                                                className={`line-clamp-2 min-w-0 text-zinc-100/95 drop-shadow-sm ${
                                                    mobileScrollableList
                                                        ? 'text-[10px] leading-snug'
                                                        : 'text-[11px] leading-snug sm:text-xs'
                                                }`}
                                            >
                                                {stage.lobbyStoryLine}
                                            </p>
                                            {!unlocked && conditionLines.length > 0 ? (
                                                <p
                                                    className={`line-clamp-1 min-w-0 font-semibold leading-snug ${
                                                        mobileScrollableList ? 'text-[8px]' : 'text-[8px] sm:text-[9px]'
                                                    }`}
                                                >
                                                    {conditionLines.map((line, idx) => (
                                                        <Fragment key={line.key}>
                                                            {idx > 0 ? (
                                                                <span className="text-zinc-500" aria-hidden>
                                                                    {' '}
                                                                    ·{' '}
                                                                </span>
                                                            ) : null}
                                                            <span
                                                                className={
                                                                    line.satisfied ? 'text-emerald-300' : 'text-amber-200/95'
                                                                }
                                                            >
                                                                {line.text}
                                                            </span>
                                                        </Fragment>
                                                    ))}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                </button>
                                    <div className="flex min-h-0 shrink-0 flex-col bg-gradient-to-br from-zinc-950/98 to-zinc-900/85">
                                        <AdventureChapterRegionalSummary
                                            row={stageUnderstandingRows[i]!}
                                            compact={false}
                                            onOpenEffectSlots={() => setRegionalBuffStageId(stage.id)}
                                        />
                                    </div>
                                </div>
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

    const desktopLeftColumn = (
        <div className={`flex h-full min-h-0 ${PC_HOME_LEFT_COLUMN_CLASS} flex-col overflow-hidden`}>
            <div className="flex shrink-0 items-center gap-2 pb-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg p-0 transition-transform hover:bg-zinc-800 hover:drop-shadow-lg active:scale-90 sm:h-11 sm:w-11"
                    aria-label="뒤로가기"
                >
                    <img src="/images/button/back.webp" alt="" className="h-full w-full" />
                </button>
                <div className="min-w-0 flex-1">{titleBlock}</div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <AdventureProfilePanel
                    profile={currentUserWithStatus?.adventureProfile}
                    userGold={currentUserWithStatus?.gold ?? 0}
                    compact={false}
                    onOpenMonsterCodex={() => handlers.openAdventureMonsterCodexModal()}
                />
            </div>
        </div>
    );

    return (
        <div
            className={`relative mx-auto flex w-full bg-gradient-to-b from-zinc-900 via-zinc-950 to-black text-zinc-100 ${
                mobileAdventureShell
                    ? isNativeMobile
                        ? 'sudamr-native-route-root min-h-0 flex-1 flex-col overflow-hidden px-0.5'
                        : 'h-full min-h-0 max-h-[100dvh] flex-1 flex-col overflow-hidden px-0.5'
                    : 'h-full min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-4 lg:p-2'
            }`}
        >
            {mobileAdventureShell ? (
                <>
                    <header className="flex shrink-0 items-center gap-2 px-1 py-0.5">
                        <div className="flex min-w-0 flex-1 items-start justify-center gap-2">
                            <div className="w-9 shrink-0" aria-hidden />
                            <div className="min-w-0 flex-1 text-center">{titleBlock}</div>
                            <div className="w-9 shrink-0" aria-hidden />
                        </div>
                    </header>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overscroll-contain px-0.5 pb-0.5">
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
                                chapterColumn(false, { mobileScrollableList: mobileAdventureShell })
                            ) : (
                                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                                    <AdventureProfilePanel
                                        profile={currentUserWithStatus?.adventureProfile}
                                        userGold={currentUserWithStatus?.gold ?? 0}
                                        compact
                                        mobileOneScreen={mobileAdventureShell}
                                        onOpenMonsterCodex={() => handlers.openAdventureMonsterCodexModal()}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <PcLobbyThreeColumnShell
                    left={desktopLeftColumn}
                    center={chapterColumn(true)}
                    centerTransparentShell
                    centerFullWidth
                />
            )}

            {regionalBuffStageId && (
                <AdventureRegionalBuffModal
                    stageId={regionalBuffStageId}
                    profile={currentUserWithStatus?.adventureProfile}
                    userGold={currentUserWithStatus?.gold ?? 0}
                    onClose={() => setRegionalBuffStageId(null)}
                    isTopmost
                />
            )}
            {adventureScreenGuide.isOpen && (
                <ScreenGuideModal
                    guideId="adventure"
                    onClose={adventureScreenGuide.close}
                    onDismissForever={adventureScreenGuide.dismissForever}
                />
            )}
        </div>
    );
};

export default AdventureLobby;
