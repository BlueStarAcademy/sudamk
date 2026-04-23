import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import ClassNavigationPanel from './singleplayer/ClassNavigationPanel.js';
import StageGrid from './singleplayer/StageGrid.js';
import TrainingQuestPanel from './singleplayer/TrainingQuestPanel.js';
import { SinglePlayerLevel, UserWithStatus } from '../types.js';
import { SINGLE_PLAYER_STAGES } from '../constants/singlePlayerConstants.js';
import { useNativeMobileShell } from '../hooks/useNativeMobileShell.js';
import { userHasFullTrainingQuestReward } from '../utils/trainingQuestRewardNotify.js';
import { isOnboardingTutorialActive } from '../shared/constants/onboardingTutorial.js';

/** singlePlayerProgress(다음 플레이 스테이지 전역 인덱스)에 맞는 반 — 대기실 기본 탭 */
function defaultSinglePlayerLevelFromProgress(progress: number): SinglePlayerLevel {
    const n = SINGLE_PLAYER_STAGES.length;
    if (n === 0) return SinglePlayerLevel.입문;
    const idx = Math.min(Math.max(0, progress), n - 1);
    return SINGLE_PLAYER_STAGES[idx].level;
}

const SINGLE_PLAYER_LOBBY_TITLE = '바둑학원';

/** PC: 수련과제는 프로필 홈 모달로 이동. 온보딩 phase 8(수련과제 튜토) 중에는 타깃 요소가 필요해 기존 3열 유지 */
const DesktopSinglePlayerLobbyLayout: React.FC<{
    selectedClass: SinglePlayerLevel;
    onClassSelect: (level: SinglePlayerLevel | null) => void;
    onBackToProfile: () => void;
    currentUserWithStatus: UserWithStatus;
}> = ({ selectedClass, onClassSelect, onBackToProfile, currentUserWithStatus }) => {
    const phase8TrainingSpotlight =
        isOnboardingTutorialActive(currentUserWithStatus) &&
        (currentUserWithStatus.onboardingTutorialPhase ?? 0) === 8;

    return (
        <div className="grid min-h-0 flex-1 grid-cols-12 gap-2 sm:gap-3 xl:gap-4">
            <div className="col-span-4 flex min-h-0 flex-col">
                <ClassNavigationPanel
                    selectedClass={selectedClass}
                    onClassSelect={onClassSelect}
                    lobbyChrome={{
                        onBack: onBackToProfile,
                        screenTitle: SINGLE_PLAYER_LOBBY_TITLE,
                        compactTitleBar: false,
                    }}
                />
            </div>

            <div className={`flex min-h-0 flex-col ${phase8TrainingSpotlight ? 'col-span-5' : 'col-span-8'}`}>
                <StageGrid selectedClass={selectedClass} currentUser={currentUserWithStatus} />
            </div>
            {phase8TrainingSpotlight && (
                <div className="col-span-3 flex min-h-0 flex-col">
                    <TrainingQuestPanel currentUser={currentUserWithStatus} />
                </div>
            )}
        </div>
    );
};

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

    useEffect(() => {
        if (!currentUserWithStatus || !isOnboardingTutorialActive(currentUserWithStatus)) return;
        const p = currentUserWithStatus.onboardingTutorialPhase ?? 0;
        if (p === 2 || p === 4) {
            setOverrideClass(SinglePlayerLevel.입문);
            if (isNativeMobile) setMobileLobbySubTab('stages');
        }
        if (!isNativeMobile) return;
        if (p === 8) setMobileLobbySubTab('quests');
    }, [isNativeMobile, currentUserWithStatus]);

    const hasTrainingQuestRewardToClaim = useMemo(
        () => userHasFullTrainingQuestReward(currentUserWithStatus),
        [currentUserWithStatus],
    );

    if (!currentUser || !currentUserWithStatus) {
        return null;
    }

    return (
        <div
            className={`relative mx-auto flex w-full flex-col bg-lobby-shell-singleplayer text-gray-100 ${isNativeMobile ? 'sudamr-native-route-root min-h-0 flex-1 overflow-hidden px-0.5 pt-0.5' : 'h-full min-h-0 px-2 pb-2 pt-1 sm:px-3 sm:pb-3 sm:pt-2 lg:px-6 lg:pb-6 lg:pt-3'}`}
        >
            {isNativeMobile ? (
                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-0.5 pb-0.5">
                    <div className="min-h-0 max-h-[min(34dvh,300px)] shrink-0 overflow-hidden rounded-xl">
                        <ClassNavigationPanel
                            selectedClass={selectedClass}
                            onClassSelect={setOverrideClass}
                            compact
                            lobbyMobileTop
                            lobbyChrome={{
                                onBack: onBackToProfile,
                                screenTitle: SINGLE_PLAYER_LOBBY_TITLE,
                                compactTitleBar: true,
                            }}
                        />
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-emerald-500/20 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <div
                            className="flex shrink-0 gap-1 border-b border-white/10 px-1 py-0.5 sm:p-1.5"
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
                                className={`relative min-h-0 min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm font-bold transition-all sm:py-2 sm:text-base ${
                                    mobileLobbySubTab === 'quests'
                                        ? 'border border-amber-400/55 bg-gradient-to-b from-emerald-900/50 to-zinc-950 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                                        : 'border border-transparent text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200'
                                }`}
                            >
                                수련과제
                                {hasTrainingQuestRewardToClaim && (
                                    <span
                                        className="absolute right-1 top-1 z-[1] h-2 w-2 rounded-full border-2 border-slate-950 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.65)]"
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
                                className={`min-h-0 min-w-0 flex-1 rounded-lg px-2 py-1.5 text-sm font-bold transition-all sm:py-2 sm:text-base ${
                                    mobileLobbySubTab === 'stages'
                                        ? 'border border-amber-400/55 bg-gradient-to-b from-emerald-900/50 to-zinc-950 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                                        : 'border border-transparent text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200'
                                }`}
                            >
                                스테이지
                            </button>
                        </div>
                        <div
                            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain p-2 sm:p-2.5"
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
