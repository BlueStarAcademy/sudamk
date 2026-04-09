import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import ClassNavigationPanel from './singleplayer/ClassNavigationPanel.js';
import StageGrid from './singleplayer/StageGrid.js';
import TrainingQuestPanel from './singleplayer/TrainingQuestPanel.js';
import { SinglePlayerLevel } from '../types.js';
import { SINGLE_PLAYER_STAGES } from '../constants/singlePlayerConstants.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';

/** singlePlayerProgress(다음 플레이 스테이지 전역 인덱스)에 맞는 반 — 대기실 기본 탭 */
function defaultSinglePlayerLevelFromProgress(progress: number): SinglePlayerLevel {
    const n = SINGLE_PLAYER_STAGES.length;
    if (n === 0) return SinglePlayerLevel.입문;
    const idx = Math.min(Math.max(0, progress), n - 1);
    return SINGLE_PLAYER_STAGES[idx].level;
}

const SinglePlayerLobby: React.FC = () => {
    const { currentUser, currentUserWithStatus } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const progressForDefault = currentUserWithStatus?.singlePlayerProgress ?? 0;
    const defaultClass = useMemo(
        () => defaultSinglePlayerLevelFromProgress(progressForDefault),
        [progressForDefault]
    );
    const [overrideClass, setOverrideClass] = useState<SinglePlayerLevel | null>(null);

    useEffect(() => {
        setOverrideClass(null);
    }, [progressForDefault]);

    const selectedClass = overrideClass ?? defaultClass;

    const onBackToProfile = () => window.location.hash = '#/profile';

    const [mobileLobbySubTab, setMobileLobbySubTab] = useState<'quests' | 'stages'>('stages');

    if (!currentUser || !currentUserWithStatus) {
        return null;
    }

    return (
        <div
            className={`relative mx-auto flex w-full flex-col bg-lobby-shell-singleplayer text-gray-100 ${isNativeMobile ? 'sudamr-native-route-root min-h-0 flex-1 overflow-hidden px-0.5' : 'h-full min-h-0 p-2 sm:p-4 lg:p-8'}`}
        >
            {/* Header */}
            <header
                className={`flex flex-shrink-0 items-center ${isNativeMobile ? 'mb-0.5 justify-center px-1 py-1' : 'mb-3 justify-between px-2 sm:mb-4 sm:px-0 lg:mb-6'}`}
            >
                {!isNativeMobile && (
                    <button
                        onClick={onBackToProfile}
                        className="flex h-10 w-10 items-center justify-center rounded-lg p-0 transition-transform hover:drop-shadow-lg hover:bg-gray-800 active:scale-90 sm:h-12 sm:w-12"
                        aria-label="뒤로가기"
                    >
                        <img src="/images/button/back.png" alt="Back" className="h-full w-full" />
                    </button>
                )}
                <h1 className={`font-bold text-gray-100 ${isNativeMobile ? 'text-lg' : 'text-xl sm:text-2xl lg:text-3xl xl:text-4xl'}`}>싱글플레이</h1>
                {!isNativeMobile && <div className="w-10" />}
            </header>

            {isNativeMobile ? (
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-0.5 pb-0.5">
                    <div className="min-h-0 max-h-[min(32dvh,248px)] shrink-0 overflow-hidden rounded-xl">
                        <ClassNavigationPanel
                            selectedClass={selectedClass}
                            onClassSelect={setOverrideClass}
                            compact
                            lobbyMobileTop
                        />
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-emerald-500/20 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <div
                            className="flex shrink-0 gap-1 border-b border-white/10 px-1 py-0.5 sm:p-1.5"
                            role="tablist"
                            aria-label="싱글플레이 하단"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mobileLobbySubTab === 'quests'}
                                onClick={() => setMobileLobbySubTab('quests')}
                                className={`min-h-0 min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm font-bold transition-all sm:py-2 sm:text-base ${
                                    mobileLobbySubTab === 'quests'
                                        ? 'border border-amber-400/55 bg-gradient-to-b from-emerald-900/50 to-zinc-950 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                                        : 'border border-transparent text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200'
                                }`}
                            >
                                수련과제
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mobileLobbySubTab === 'stages'}
                                onClick={() => setMobileLobbySubTab('stages')}
                                className={`min-h-0 min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm font-bold transition-all sm:py-2 sm:text-base ${
                                    mobileLobbySubTab === 'stages'
                                        ? 'border border-amber-400/55 bg-gradient-to-b from-emerald-900/50 to-zinc-950 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                                        : 'border border-transparent text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200'
                                }`}
                            >
                                스테이지
                            </button>
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1 sm:p-1.5" role="tabpanel">
                            {mobileLobbySubTab === 'quests' ? (
                                <TrainingQuestPanel currentUser={currentUserWithStatus} embeddedInTab />
                            ) : (
                                <StageGrid
                                    selectedClass={selectedClass}
                                    currentUser={currentUserWithStatus}
                                    compact
                                    mobileTabShelf
                                />
                            )}
                        </div>
                    </div>
                </div>
            ) : (
            <div className="grid grid-cols-12 gap-4 xl:gap-6 flex-1 min-h-0">
                <div className="col-span-4 flex flex-col min-h-0">
                    <ClassNavigationPanel 
                        selectedClass={selectedClass}
                        onClassSelect={setOverrideClass}
                    />
                </div>

                <div className="col-span-5 flex flex-col min-h-0">
                    <StageGrid 
                        selectedClass={selectedClass}
                        currentUser={currentUserWithStatus}
                    />
                </div>
                <div className="col-span-3 flex flex-col min-h-0">
                    <TrainingQuestPanel 
                        currentUser={currentUserWithStatus}
                    />
                </div>
            </div>
            )}
        </div>
    );
};

export default SinglePlayerLobby;
