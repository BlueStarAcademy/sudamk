import { useTranslation } from 'react-i18next';
import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '../hooks/useAppContext.js';
import ClassNavigationPanel, { AcademyLobbyHeaderPanel } from './singleplayer/ClassNavigationPanel.js';
import StageGrid from './singleplayer/StageGrid.js';
import TrainingQuestPanel from './singleplayer/TrainingQuestPanel.js';
import QuickAccessSidebar from './QuickAccessSidebar.js';
import PcLobbyCenterColumn from './shell/PcLobbyCenterColumn.js';
import {
    PC_HOME_LEFT_COLUMN_CLASS,
    PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS,
    PC_QUICK_RAIL_COLUMN_CLASS,
    PC_QUICK_RAIL_WRAPPER_CLASS,
} from '../shared/constants/pcShellLayout.js';
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

const DesktopSinglePlayerLobbyLayout: React.FC<{
    selectedClass: SinglePlayerLevel;
    onClassSelect: (level: SinglePlayerLevel | null) => void;
    onBackToProfile: () => void;
    currentUserWithStatus: UserWithStatus;
    lobbyTitle: string;
}> = ({ selectedClass, onClassSelect, onBackToProfile, currentUserWithStatus, lobbyTitle }) => (
        <div className={`flex min-h-0 flex-1 flex-row overflow-hidden ${PC_LOBBY_THREE_COLUMN_ROW_GAP_CLASS}`}>
            <div className={`flex h-full min-h-0 ${PC_HOME_LEFT_COLUMN_CLASS} flex-col gap-2 overflow-hidden`}>
                <AcademyLobbyHeaderPanel onBack={onBackToProfile} title={lobbyTitle} />
                <div className="min-h-0 flex-1 overflow-hidden">
                    <ClassNavigationPanel
                        selectedClass={selectedClass}
                        onClassSelect={onClassSelect}
                        currentUser={currentUserWithStatus}
                    />
                </div>
            </div>

            <PcLobbyCenterColumn transparentShell fullWidth>
                <StageGrid selectedClass={selectedClass} currentUser={currentUserWithStatus} />
            </PcLobbyCenterColumn>
            <div className={`flex min-h-0 ${PC_QUICK_RAIL_COLUMN_CLASS} flex-col overflow-hidden self-stretch`}>
                <div className={PC_QUICK_RAIL_WRAPPER_CLASS}>
                    <QuickAccessSidebar fillHeight />
                </div>
            </div>
        </div>
);

const SinglePlayerLobby: React.FC = () => {
    const { t } = useTranslation('lobby');
    const { t: tNav } = useTranslation('nav');
    const lobbyTitle = tNav('dock.singleplayer');
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

    const onBackToProfile = () => window.location.hash = '#/home';

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
                <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden px-0.5 pb-0.5">
                    <AcademyLobbyHeaderPanel onBack={onBackToProfile} title={lobbyTitle} compact />
                    <div className="min-h-0 max-h-[min(24dvh,232px)] shrink-0 overflow-hidden rounded-xl sm:max-h-[min(26dvh,252px)]">
                        <ClassNavigationPanel
                            selectedClass={selectedClass}
                            onClassSelect={setOverrideClass}
                            currentUser={currentUserWithStatus}
                            compact
                            lobbyMobileTop
                        />
                    </div>
                    <div className="flex min-h-0 min-w-0 flex-[1.15] flex-col overflow-hidden rounded-lg border border-emerald-500/20 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:rounded-xl">
                        <div
                            className="flex shrink-0 gap-0.5 border-b border-white/10 px-1 py-0.5"
                            role="tablist"
                            aria-label={t('singleplayer.lobbyBottomTabsAria')}
                        >
                            <button
                                type="button"
                                role="tab"
                                aria-selected={mobileLobbySubTab === 'quests'}
                                aria-label={hasTrainingQuestRewardToClaim ? t('singleplayer.trainingQuestRewardAria') : t('singleplayer.trainingQuestTab')}
                                onClick={() => setMobileLobbySubTab('quests')}
                                className={`relative min-h-0 min-w-0 flex-1 rounded-md px-1.5 py-1 text-xs font-semibold tracking-tight transition-all sm:rounded-lg sm:px-2 sm:py-1.5 sm:text-[0.8125rem] ${
                                    mobileLobbySubTab === 'quests'
                                        ? 'border border-amber-400/55 bg-gradient-to-b from-emerald-900/50 to-zinc-950 text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                                        : 'border border-transparent text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200'
                                }`}
                            >
                                {t('singleplayer.trainingQuestTab')}
                                {hasTrainingQuestRewardToClaim && (
                                    <span
                                        className="absolute right-0.5 top-0.5 z-[1] h-1.5 w-1.5 rounded-full border border-slate-950 bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.55)] sm:right-1 sm:top-1 sm:h-2 sm:w-2 sm:border-2"
                                        aria-hidden
                                        title={t('profile:claimableReward')}
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
                                {t('singleplayer.stageTab')}
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
                lobbyTitle={lobbyTitle}
            />
            )}
        </div>
    );
};

export default SinglePlayerLobby;
