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
            className={`relative mx-auto flex w-full flex-col bg-gray-900 text-gray-100 ${isNativeMobile ? 'sudamr-native-route-root min-h-0 flex-1 px-0.5' : 'h-full min-h-0 p-2 sm:p-4 lg:p-8'}`}
        >
            {/* Header */}
            <header className={`flex flex-shrink-0 items-center justify-between ${isNativeMobile ? 'mb-0.5 px-0.5' : 'mb-3 px-2 sm:mb-4 sm:px-0 lg:mb-6'}`}>
                <button
                    onClick={onBackToProfile}
                    className={`flex items-center justify-center rounded-lg p-0 transition-transform hover:drop-shadow-lg active:scale-90 hover:bg-gray-800 ${isNativeMobile ? 'h-8 w-8' : 'h-10 w-10 sm:h-12 sm:w-12'}`}
                    aria-label="뒤로가기"
                >
                    <img src="/images/button/back.png" alt="Back" className="h-full w-full" />
                </button>
                <h1 className={`font-bold text-gray-100 ${isNativeMobile ? 'text-sm' : 'text-xl sm:text-2xl lg:text-3xl xl:text-4xl'}`}>싱글플레이</h1>
                <div className={isNativeMobile ? 'w-8' : 'w-10'} />
            </header>

            {isNativeMobile ? (
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden pb-0.5">
                    <div className="max-h-[26dvh] min-h-0 shrink-0 overflow-hidden">
                        <ClassNavigationPanel selectedClass={selectedClass} onClassSelect={setOverrideClass} compact />
                    </div>
                    <div className="min-h-0 flex-[1.2] overflow-hidden">
                        <StageGrid selectedClass={selectedClass} currentUser={currentUserWithStatus} />
                    </div>
                    <div className="max-h-[38dvh] min-h-0 shrink-0 overflow-y-auto overflow-x-hidden">
                        <TrainingQuestPanel currentUser={currentUserWithStatus} />
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
