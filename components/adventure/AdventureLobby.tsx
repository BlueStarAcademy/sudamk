import React, { useState } from 'react';
import { useAppContext } from '../../hooks/useAppContext.js';
import { useNativeMobileShell } from '../../hooks/useNativeMobileShell.js';
import { ADVENTURE_LOBBY_CARD_ASPECT, ADVENTURE_STAGES } from '../../constants/adventureConstants.js';
import { replaceAppHash } from '../../utils/appUtils.js';
import AdventureProfilePanel from './AdventureProfilePanel.js';
import AdventureMonsterCodexModal from './AdventureMonsterCodexModal.js';

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

    return (
        <div
            className={`relative mx-auto flex w-full flex-col bg-gradient-to-b from-zinc-900 via-zinc-950 to-black text-zinc-100 ${
                isNativeMobile ? 'sudamr-native-route-root min-h-0 flex-1 overflow-hidden px-0.5' : 'h-full min-h-0 p-2 sm:p-4 lg:p-8'
            }`}
        >
            <header
                className={`flex flex-shrink-0 items-center ${isNativeMobile ? 'mb-0.5 justify-center px-1 py-1' : 'mb-3 justify-between px-2 sm:mb-4 sm:px-0 lg:mb-6'}`}
            >
                {!isNativeMobile && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="flex h-10 w-10 items-center justify-center rounded-lg p-0 transition-transform hover:bg-zinc-800 hover:drop-shadow-lg active:scale-90 sm:h-12 sm:w-12"
                        aria-label="뒤로가기"
                    >
                        <img src="/images/button/back.png" alt="" className="h-full w-full" />
                    </button>
                )}
                <div className={`flex min-w-0 flex-col items-center ${isNativeMobile ? '' : 'flex-1'}`}>
                    <h1
                        className={`font-bold tracking-tight text-transparent bg-gradient-to-r from-fuchsia-200 via-violet-100 to-cyan-200 bg-clip-text ${
                            isNativeMobile ? 'text-lg' : 'text-xl sm:text-2xl lg:text-3xl'
                        }`}
                    >
                        모험
                    </h1>
                    <p className="mt-0.5 text-center text-[10px] text-zinc-500 sm:text-xs">
                        왼쪽 모험 일지 · 오른쪽 챕터에서 맵 입장
                    </p>
                </div>
                {!isNativeMobile && (
                    <button
                        type="button"
                        onClick={() => setMonsterCodexOpen(true)}
                        className="flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-violet-500/35 bg-violet-950/40 p-0.5 text-[9px] font-bold leading-tight text-violet-100 shadow-inner transition-colors hover:border-amber-400/40 hover:bg-violet-900/50 active:scale-95 sm:h-12 sm:w-12 sm:text-[10px]"
                        aria-label="몬스터 도감 열기"
                        title="몬스터 도감"
                    >
                        <img src="/images/button/itembook.png" alt="" className="h-5 w-5 object-contain sm:h-6 sm:w-6" draggable={false} />
                        <span className="hidden sm:inline">도감</span>
                    </button>
                )}
            </header>

            {isNativeMobile && (
                <div className="mb-1.5 flex shrink-0 justify-center px-1">
                    <button
                        type="button"
                        onClick={() => setMonsterCodexOpen(true)}
                        className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-xl border border-violet-500/40 bg-gradient-to-r from-violet-950/70 via-zinc-900/80 to-fuchsia-950/50 px-3 py-2 text-sm font-bold text-violet-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-transform active:scale-[0.99]"
                    >
                        <img src="/images/button/itembook.png" alt="" className="h-6 w-6 object-contain" draggable={false} />
                        몬스터 도감
                    </button>
                </div>
            )}

            <div
                className={`min-h-0 w-full flex-1 overflow-y-auto overscroll-y-contain ${isNativeMobile ? 'px-0.5 pb-1' : 'max-w-6xl xl:max-w-7xl mx-auto w-full px-1 sm:px-0'}`}
            >
                <div className="flex min-h-0 flex-col gap-3 pb-2 lg:flex-row lg:items-start lg:gap-5 xl:gap-6">
                    {/* 좌: 모험 일지 */}
                    <aside className="w-full shrink-0 lg:sticky lg:top-1 lg:w-[min(100%,20rem)] xl:w-[22rem] lg:max-h-[min(calc(100dvh-5.5rem),100%)] lg:overflow-y-auto lg:overscroll-y-contain lg:pr-1">
                        <AdventureProfilePanel profile={currentUserWithStatus?.adventureProfile} compact={isNativeMobile} />
                    </aside>

                    {/* 우: 챕터 입장 */}
                    <section className="min-w-0 flex-1 lg:min-h-0" aria-label="챕터 입장">
                        <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500 sm:text-sm">
                            <span className="h-px flex-1 max-w-[2rem] bg-gradient-to-r from-transparent to-zinc-600/60" aria-hidden />
                            챕터
                            <span className="h-px flex-1 bg-gradient-to-l from-transparent to-zinc-600/60" aria-hidden />
                        </h2>
                        <div className="relative pb-1">
                            <div
                                className="pointer-events-none absolute left-[13px] top-3 bottom-3 w-px bg-gradient-to-b from-emerald-500/45 via-violet-500/35 to-fuchsia-500/45 sm:left-[15px]"
                                aria-hidden
                            />
                            <ol className="relative z-[1] space-y-3 sm:space-y-4">
                        {ADVENTURE_STAGES.map((stage, i) => {
                            const ringClass = STAGE_CARD_RINGS[i] ?? STAGE_CARD_RINGS[0];
                            return (
                                <li key={stage.id} className="relative pl-9 sm:pl-11">
                                    <div
                                        className={`absolute left-0 top-[calc(50%-0.625rem)] flex h-5 w-5 items-center justify-center rounded-full border-2 border-zinc-900 bg-gradient-to-br shadow-md sm:h-5 sm:w-5 ${
                                            i === 0
                                                ? 'from-emerald-400 to-teal-700'
                                                : i === 1
                                                  ? 'from-sky-400 to-blue-700'
                                                  : i === 2
                                                    ? 'from-blue-400 to-indigo-700'
                                                    : i === 3
                                                      ? 'from-amber-400 to-orange-700'
                                                      : 'from-fuchsia-400 to-purple-800'
                                        }`}
                                        aria-hidden
                                    >
                                        <span className="text-[9px] font-black tabular-nums text-white drop-shadow">{stage.stageIndex}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => replaceAppHash(`#/adventure/${stage.id}`)}
                                        aria-label={`${stage.title} 맵으로 입장`}
                                        className={`group relative flex w-full flex-col justify-between overflow-hidden rounded-2xl border border-white/12 text-left shadow-[0_20px_48px_-28px_rgba(0,0,0,0.9)] ring-1 transition-all duration-200 ${ADVENTURE_LOBBY_CARD_ASPECT} min-h-[5.5rem] hover:-translate-y-0.5 hover:border-amber-400/25 hover:shadow-[0_24px_56px_-24px_rgba(251,191,36,0.18)] active:translate-y-0 sm:min-h-[6.25rem] ${ringClass}`}
                                    >
                                        <img
                                            src={stage.mapWebp}
                                            alt=""
                                            className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                                            draggable={false}
                                        />
                                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/92 via-black/45 to-black/20" />
                                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                                        <div className="pointer-events-none absolute inset-0 opacity-25 mix-blend-overlay bg-[radial-gradient(ellipse_at_20%_50%,rgba(255,255,255,0.2),transparent_50%)]" />

                                        <div className="relative z-[1] flex h-full flex-row items-stretch justify-between gap-3 p-3 sm:p-4">
                                            <div className="flex min-w-0 flex-1 flex-col justify-center">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-md border border-white/20 bg-black/40 px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums text-amber-100/95 sm:text-xs">
                                                        CHAPTER {String(stage.stageIndex).padStart(2, '0')}
                                                    </span>
                                                    <span className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-zinc-200/90 sm:text-xs">
                                                        16:9 탐험 맵
                                                    </span>
                                                </div>
                                                <h2 className="mt-2 text-lg font-black leading-tight tracking-tight text-white drop-shadow-md sm:text-xl lg:text-2xl">
                                                    {stage.title}
                                                </h2>
                                                <p className="mt-1 max-w-md text-[11px] font-medium text-zinc-300/90 sm:text-xs">
                                                    탭하여 스테이지 맵으로 — 몬스터 스폰·대국은 이후 연동
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 flex-col items-end justify-center gap-1">
                                                <span className="rounded-lg border border-amber-400/35 bg-black/50 px-2.5 py-1 text-[10px] font-bold text-amber-100 shadow-inner sm:text-xs">
                                                    입장
                                                </span>
                                                <span className="text-[10px] text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 sm:text-[11px]">
                                                    →
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                            </ol>
                        </div>
                    </section>
                </div>
            </div>

            {monsterCodexOpen && (
                <AdventureMonsterCodexModal onClose={() => setMonsterCodexOpen(false)} isTopmost />
            )}
        </div>
    );
};

export default AdventureLobby;
