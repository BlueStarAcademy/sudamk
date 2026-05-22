import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import ClassNavigationPanel from './singleplayer/ClassNavigationPanel.js';
import StageGrid from './singleplayer/StageGrid.js';
import TrainingQuestPanel from './singleplayer/TrainingQuestPanel.js';
import QuickAccessSidebar, { PC_QUICK_RAIL_COLUMN_CLASS } from './QuickAccessSidebar.js';
import { SinglePlayerLevel, UserWithStatus } from '../types.js';
import { getSinglePlayerStages } from '../constants/singlePlayerConstants.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { useIsHandheldDevice } from '../hooks/useIsMobileLayout.js';
import { userHasFullTrainingQuestReward } from '../utils/trainingQuestRewardNotify.js';
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

const SINGLE_PLAYER_LOBBY_TITLE = '바둑학원';

const DesktopSinglePlayerLobbyLayout: React.FC<{
    selectedClass: SinglePlayerLevel;
    onClassSelect: (level: SinglePlayerLevel | null) => void;
    onBackToProfile: () => void;
    currentUserWithStatus: UserWithStatus;
}> = ({ selectedClass, onClassSelect, onBackToProfile, currentUserWithStatus }) => (
        <div className="grid min-h-0 flex-1 grid-cols-12 gap-2 sm:gap-3 xl:gap-4">
            <div className="col-span-4 flex min-h-0 flex-col">
                <ClassNavigationPanel
                    selectedClass={selectedClass}
                    onClassSelect={onClassSelect}
                    currentUser={currentUserWithStatus}
                    lobbyChrome={{
                        onBack: onBackToProfile,
                        screenTitle: SINGLE_PLAYER_LOBBY_TITLE,
                        compactTitleBar: false,
                    }}
                />
            </div>

            <div className="col-span-7 flex min-h-0 flex-col">
                <StageGrid selectedClass={selectedClass} currentUser={currentUserWithStatus} />
            </div>
            <div className={`flex min-h-0 ${PC_QUICK_RAIL_COLUMN_CLASS} flex-col overflow-hidden self-stretch`}>
                <div className="flex h-full min-h-0 flex-col rounded-xl border-2 border-amber-600/55 bg-gradient-to-br from-zinc-900 via-amber-950 to-zinc-950 p-1 shadow-xl shadow-black/40">
                    <QuickAccessSidebar fillHeight />
                </div>
            </div>
        </div>
);

const SinglePlayerLobby: React.FC = () => {
    const { currentUser, currentUserWithStatus, singlePlayerStagesListRevision } = useAppContext();
    const { isNativeMobile } = useNativeMobileShell();
    const isHandheldViewport = useIsHandheldDevice(1024);
    /** 네이티브 앱 + 좁은 브라우저(폰) 동일 로비 밀도 */
    const compactSpLobby = isNativeMobile || isHandheldViewport;
    const progressForDefault = currentUserWithStatus?.singlePlayerProgress ?? 0;
    const defaultClass = useMemo(
        () => defaultSinglePlayerLevelFromProgress(progressForDefault),
        [progressForDefault, singlePlayerStagesListRevision]
    );
    const [overrideClass, setOverrideClass] = useState<SinglePlayerLevel | null>(null);

    useEffect(() => {
        setOverrideClass(null);
    }, [progressForDefault]);

    const selectedClass = overrideClass ?? defaultClass;

    const onBackToProfile = () => window.location.hash = '#/profile';

    const [mobileLobbySubTab, setMobileLobbySubTab] = useState<'quests' | 'stages'>('stages');

    const hasTrainingQuestRewardToClaim = useMemo(
        () => userHasFullTrainingQuestReward(currentUserWithStatus),
        [currentUserWithStatus],
    );

    const academyScreenGuide = useScreenGuide('singlePlayerAcademy');

    if (!currentUser || !currentUserWithStatus) {
        return null;
    }

    return (
        <div
            className={`relative mx-auto flex w-full flex-col bg-lobby-shell-singleplayer text-gray-100 ${
                isNativeMobile
                    ? 'sudamr-native-route-root min-h-0 flex-1 overflow-hidden px-0.5 pt-0.5'
                    : compactSpLobby
                      ? 'h-full min-h-0 flex-1 overflow-hidden px-1 pb-1 pt-0.5 sm:px-2 sm:pb-1.5'
                      : 'h-full min-h-0 px-2 pb-2 pt-1 sm:px-3 sm:pb-3 sm:pt-2 lg:px-6 lg:pb-6 lg:pt-3'
            }`}
        >
            {academyScreenGuide.isOpen && (
                <ScreenGuideModal
                    guideId="singlePlayerAcademy"
                    onClose={academyScreenGuide.close}
                    onDismissForever={academyScreenGuide.dismissForever}
                />
            )}
            {compactSpLobby ? (
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-0.5 pb-0.5">
                    <div className="min-h-0 max-h-[min(30dvh,280px)] shrink-0 overflow-hidden rounded-xl sm:max-h-[min(32dvh,300px)]">
                        <ClassNavigationPanel
                            selectedClass={selectedClass}
                            onClassSelect={setOverrideClass}
                            currentUser={currentUserWithStatus}
                            compact
                            lobbyMobileTop
                            lobbyChrome={{
                                onBack: onBackToProfile,
                                screenTitle: SINGLE_PLAYER_LOBBY_TITLE,
                                compactTitleBar: true,
                            }}
                        />
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-emerald-500/20 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:rounded-xl">
                        <div
                            className="flex shrink-0 gap-0.5 border-b border-white/10 px-1 py-0.5"
                            role="tablist"
                            aria-label="바둑학원 하단"
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mobileLobbySubTab === 'quests'}
                                aria-label={
                                    hasTrainingQuestRewardToClaim
                                        ? '수련과제, 수령 가능한 보상이 있습니다'
                                        : '수련과제'
                                }
                                onClick={() => setMobileLobbySubTab('quests')}
                                className={`relative min-h-0 min-w-0 flex-1 rounded-md px-1.5 py-1 text-xs font-semibold tracking-tight transition-all sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-[0.8125rem] ${
                                    mobileLobbySubTab === 'quests'
                                        ? 'border border-amber-400/55 bg-gradient-to-b from-emerald-900/50 to-zinc-950 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                                        : 'border border-transparent text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200'
                                }`}
                            >
                                수련과제
                                {hasTrainingQuestRewardToClaim && (
                                    <span
                                        className="absolute right-0.5 top-0.5 z-[1] h-1.5 w-1.5 rounded-full border border-slate-950 bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.55)] sm:right-1 sm:top-1 sm:h-2 sm:w-2 sm:border-2"
                                        aria-hidden
                                        title="수령 가능한 보상"
                                    />
                                )}
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mobileLobbySubTab === 'stages'}
                                onClick={() => setMobileLobbySubTab('stages')}
                                className={`min-h-0 min-w-0 flex-1 rounded-md px-1.5 py-1 text-xs font-semibold tracking-tight transition-all sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-[0.8125rem] ${
                                    mobileLobbySubTab === 'stages'
                                        ? 'border border-amber-400/55 bg-gradient-to-b from-emerald-900/50 to-zinc-950 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                                        : 'border border-transparent text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200'
                                }`}
                            >
                                스테이지
                            </button>
                        </div>
                        <div
                            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain p-1.5 sm:p-2"
                            role="tabpanel"
                        >
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
            <DesktopSinglePlayerLobbyLayout
                selectedClass={selectedClass}
                onClassSelect={setOverrideClass}
                onBackToProfile={onBackToProfile}
                currentUserWithStatus={currentUserWithStatus}
            />
            )}
        </div>
    );
};

export default SinglePlayerLobby;
