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

    if (!currentUser || !currentUserWithStatus) {
        return null;
    }

    return (
        <div
            className={`relative mx-auto flex w-full flex-col bg-gray-900 text-gray-100 ${isNativeMobile ? 'sudamr-native-route-root min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-0.5' : 'h-full min-h-0 p-2 sm:p-4 lg:p-8'}`}
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
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto overscroll-y-contain pb-0.5">
                    {/* 상단: 좌 단계 선택 · 우 수련 과제 */}
                    <div className="grid min-h-0 min-h-[min(52dvh,540px)] max-h-[min(66dvh,660px)] shrink-0 grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-1.5 overflow-x-hidden overflow-y-auto overscroll-y-contain">
                        <div className="flex min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">
                            <ClassNavigationPanel selectedClass={selectedClass} onClassSelect={setOverrideClass} compact />
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain">
                            <TrainingQuestPanel currentUser={currentUserWithStatus} compactTopSlot />
                        </div>
                    </div>
                    {/* 하단: 스테이지 패널 */}
                    <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain">
                        <StageGrid selectedClass={selectedClass} currentUser={currentUserWithStatus} compact />
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
