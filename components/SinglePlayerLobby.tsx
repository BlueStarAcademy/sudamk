import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import SinglePlayerMapTopBar from './singleplayer/SinglePlayerMapTopBar.js';
import SinglePlayerStageMap from './singleplayer/SinglePlayerStageMap.js';
import { SinglePlayerLevel } from '../types.js';
import { getSinglePlayerStages } from '../constants/singlePlayerConstants.js';
import { useScreenGuide } from '../hooks/useScreenGuide.js';
import ScreenGuideModal from './ScreenGuideModal.js';

/** singlePlayerProgress(다음 플레이 스테이지 전역 인덱스)에 맞는 반 — 대기실 기본 탭 */
function defaultSinglePlayerLevelFromProgress(progress: number): SinglePlayerLevel {
    const stages = getSinglePlayerStages();
    const n = stages.length;
    if (n === 0) return SinglePlayerLevel.입문;
    const idx = Math.min(Math.max(0, progress), n - 1);
    return stages[idx].level;
}

export type SinglePlayerLobbyProps = {
    /** homeViewer: 홈 중앙 퀵유틸 — 맵 우선 임베드 */
    presentation?: 'full' | 'homeViewer';
};

const SinglePlayerLobby: React.FC<SinglePlayerLobbyProps> = ({ presentation = 'full' }) => {
    const { t: tNav } = useTranslation('nav');
    const lobbyTitle = tNav('dock.singleplayer');
    const { currentUser, currentUserWithStatus, singlePlayerStagesListRevision, handlers } =
        useAppContext();
    const isHomeViewer = presentation === 'homeViewer';
    const progressForDefault = currentUserWithStatus?.singlePlayerProgress ?? 0;
    const defaultClass = useMemo(
        () => defaultSinglePlayerLevelFromProgress(progressForDefault),
        [progressForDefault, singlePlayerStagesListRevision],
    );
    const [overrideClass, setOverrideClass] = useState<SinglePlayerLevel | null>(null);

    useEffect(() => {
        setOverrideClass(null);
    }, [progressForDefault]);

    const selectedClass = overrideClass ?? defaultClass;

    const onBack = () => {
        if (isHomeViewer) {
            handlers.closeQuickUtilityPanel?.();
            return;
        }
        window.location.hash = '#/home';
    };

    const academyScreenGuide = useScreenGuide('singlePlayerAcademy');

    if (!currentUser || !currentUserWithStatus) {
        return null;
    }

    return (
        <div
            className={`relative mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden text-gray-100 ${
                isHomeViewer ? 'bg-transparent' : 'bg-lobby-shell-singleplayer'
            }`}
        >
            {academyScreenGuide.isOpen && (
                <ScreenGuideModal
                    guideId="singlePlayerAcademy"
                    onClose={academyScreenGuide.close}
                    onDismissForever={academyScreenGuide.dismissForever}
                />
            )}

            {!isHomeViewer ? (
                <div className="mb-1 flex shrink-0 items-center gap-2 px-1 pt-0.5 sm:px-2">
                    <button
                        type="button"
                        onClick={onBack}
                        className="h-9 w-9 shrink-0 transition-transform active:scale-90"
                        aria-label={lobbyTitle}
                    >
                        <img src="/images/button/back.webp" alt="" className="h-full w-full" />
                    </button>
                    <h1 className="truncate text-left text-base font-bold text-emerald-100 sm:text-lg">
                        {lobbyTitle}
                    </h1>
                </div>
            ) : null}

            {/* 뒤로가기(타이틀) 패널 아래 영역 전체를 맵이 사용하고, 상단 UI는 맵 위 오버레이 */}
            <div className="relative min-h-0 flex-1 overflow-hidden">
                <div className="absolute inset-0">
                    <SinglePlayerStageMap
                        selectedClass={selectedClass}
                        currentUser={currentUserWithStatus}
                        bleed
                    />
                </div>
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 p-1.5 sm:p-2">
                    <div className="pointer-events-auto">
                        <SinglePlayerMapTopBar
                            selectedClass={selectedClass}
                            onClassSelect={(level) => setOverrideClass(level)}
                            currentUser={currentUserWithStatus}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SinglePlayerLobby;
